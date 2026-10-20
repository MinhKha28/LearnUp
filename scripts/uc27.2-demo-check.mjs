import { spawn } from "node:child_process";
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";

if (process.env.NODE_ENV === "production")
  throw new Error("Refusing demo checks in production.");

const base = "http://localhost:3000";
const root = path.resolve(import.meta.dirname, "..");
const results = [];
const artifacts = process.env.DEMO_ARTIFACTS_DIR ?? path.join(root, "frontend", "dev", "uc27.2-results");
mkdirSync(artifacts, { recursive: true });
const chromeRoot = path.join(process.env.LOCALAPPDATA, "ms-playwright");
const chrome =
  process.env.CHROME_PATH ??
  readdirSync(chromeRoot)
    .filter((n) => n.startsWith("chromium-"))
    .map((n) => path.join(chromeRoot, n, "chrome-win64", "chrome.exe"))
    .find(existsSync);
if (!chrome)
  throw new Error("Set CHROME_PATH to an installed Chromium browser.");
const browser = spawn(
  chrome,
  [
    "--headless=new",
    "--disable-gpu",
    "--remote-debugging-port=19227",
    "--remote-allow-origins=*",
    "--autoplay-policy=no-user-gesture-required",
    `--user-data-dir=${mkdtempSync(path.join(tmpdir(), "uc272-chrome-"))}`,
    "about:blank",
  ],
  { stdio: "ignore", windowsHide: true },
);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let socket;
const waits = new Map();
let serial = 0;
const responses = [];
async function connect() {
  for (let i = 0; i < 50; i++) {
    try {
      const tabs = await fetch("http://127.0.0.1:19227/json").then((r) =>
        r.json(),
      );
      socket = new WebSocket(
        tabs.find((t) => t.type === "page").webSocketDebuggerUrl,
      );
      await new Promise((resolve, reject) => {
        socket.onopen = resolve;
        socket.onerror = reject;
      });
      socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.method === "Network.responseReceived")
          responses.push(message.params);
        const waiting = waits.get(message.id);
        if (waiting) {
          waits.delete(message.id);
          message.error
            ? waiting.reject(new Error(JSON.stringify(message.error)))
            : waiting.resolve(message.result);
        }
      };
      return;
    } catch {
      await sleep(200);
    }
  }
  throw new Error("Browser CDP did not start.");
}
const call = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++serial;
    waits.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
    setTimeout(() => {
      if (waits.delete(id)) reject(new Error("CDP timeout: " + method));
    }, 30000).unref();
  });
const evaluate = async (expression) => {
  const value = await call("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (value.exceptionDetails)
    throw new Error(
      value.exceptionDetails.exception?.description ??
        value.exceptionDetails.text,
    );
  return value.result.value;
};
async function until(expression, timeout = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await evaluate(expression)) return;
    await sleep(150);
  }
  throw new Error("Browser condition timed out: " + expression);
}
let viewportWidth = 1440;
async function viewport(width) {
  viewportWidth = width;
  await call("Emulation.setDeviceMetricsOverride", { width, height: 1024, deviceScaleFactor: 1, mobile: false });
}
async function assignmentScreenshots(name) {
  await screenshot(name);
  await viewport(1280);
  await screenshot(name + "-1280");
  if (name === "assignments-list") {
    assert.equal(await evaluate("Array.from(document.querySelectorAll('.organizer-assignment-nowrap')).every(cell => getComputedStyle(cell).whiteSpace === 'nowrap')"), true);
    assert.equal(await evaluate("document.querySelector('.organizer-assignments table').getBoundingClientRect().width <= document.querySelector('.ant-table-content').clientWidth + 1"), true);
  }
  await viewport(1440);
}
async function screenshot(name) {
  await evaluate("document.fonts.ready");
  await evaluate("Promise.all(document.getAnimations().filter(animation => Number.isFinite(animation.effect?.getComputedTiming().endTime)).map(animation => animation.finished.catch(() => {})))");
  const metrics = await call("Page.getLayoutMetrics");
  const image = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: viewportWidth, height: metrics.cssContentSize.height, scale: 1 } });
  writeFileSync(path.join(artifacts, name + ".png"), Buffer.from(image.data, "base64"));
}
async function navigate(route) {
  await call("Page.navigate", { url: base + route });
  await until(
    "document.readyState==='complete' && !!document.querySelector('#root') && document.body.innerText.length>50",
  );
}
const api = async (route, method = "GET", payload) => {
  const response = await fetch(base + route, {
    method,
    headers: payload ? { "content-type": "application/json" } : {},
    body: payload ? JSON.stringify(payload) : undefined,
  });
  return { status: response.status, body: await response.json() };
};
const identity = async (key) => {
  assert.equal((await api("/__dev/identity", "POST", { key })).status, 200);
};
async function check(name, fn) {
  if (process.env.CHECK_PREFIX && !name.startsWith(process.env.CHECK_PREFIX))
    return;
  try {
    const evidence = await fn();
    results.push({ name, result: "PASS", evidence });
    console.log("PASS " + name);
  } catch (error) {
    results.push({ name, result: "FAIL", reason: error.message });
    console.log("FAIL " + name + ": " + error.message);
  }
}
async function responseAfter(suffix, start) {
  for (let i = 0; i < 150; i++) {
    const response = responses
      .slice(start)
      .find((r) => r.response.url.endsWith(suffix));
    if (response) {
      try {
        return {
          status: response.response.status,
          body: JSON.parse(
            (
              await call("Network.getResponseBody", {
                requestId: response.requestId,
              })
            ).body,
          ),
        };
      } catch {}
    }
    await sleep(100);
  }
  throw new Error("No browser response for " + suffix);
}
const id = (suffix) => "01900000-0000-7000-8000-" + suffix;
const publicCourse = id("c0020000005c"),
  privateCourse = id("c00200000065"),
  optionalCourse = id("c00200000097");
const video = id("c0050001676b"),
  lesson = id("c004000023f1"),
  a = id("2a0000000027"),
  b = id("2a0000000028");
const player = (e) =>
  `/learner/courses/${e}/lessons/${lesson}/resources/${video}`;
const playback = async (e) => {
  const r = await api(`/api/v1/enrollments/${e}/materials/${video}/playback`);
  assert.equal(r.status, 200);
  return r.body.data;
};
const click = async (text) => {
  await until(
    `Array.from(document.querySelectorAll('button,a')).some(x=>x.textContent.trim()===${JSON.stringify(text)})`,
  );
  await evaluate(
    `Array.from(document.querySelectorAll('button,a')).find(x=>x.textContent.trim()===${JSON.stringify(text)}).click()`,
  );
};
async function loadPlayer(enrollment) {
  await navigate(player(enrollment));
  await until(
    "!!document.querySelector('video') && document.querySelector('video').readyState>=2",
  );
}
async function playUntil(time, rate = 1) {
  await evaluate(
    `(()=>{const v=document.querySelector('video');v.playbackRate=${rate};return v.play()})()`,
  );
  await until(`document.querySelector('video').currentTime>=${time}`, 30000);
  await evaluate("document.querySelector('video').pause()");
  await sleep(800);
}
try {
  await connect();
  await call("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1024, deviceScaleFactor: 1, mobile: false });
  await call("Page.enable");
  await call("Network.enable");
  await check("Inter 1: UC25/25.1/26/27/27.1", async () => {
    await identity("LEARNER_1");
    const catalog = await api("/api/v1/courses/catalog?page=1");
    assert.equal(catalog.status, 200);
    assert.ok(catalog.body.data.items.some((c) => c.id === publicCourse));
    assert.ok(catalog.body.data.items.some((c) => c.id === optionalCourse));
    await navigate("/learner/courses");
    await until("document.body.innerText.includes('Quá hạn')");
    await navigate(`/learner/courses/${id("2a0000000002")}/lessons/${lesson}`);
    await until("document.body.innerText.includes('Mở học liệu')");
    const buttons = await evaluate(
      "Array.from(document.querySelectorAll('button')).filter(x=>x.textContent.includes('Mở học liệu')).map(x=>x.disabled)",
    );
    assert.ok(buttons.includes(false));
    assert.ok(buttons.includes(true));
    const progress = (
      await api(`/api/v1/enrollments/${id("2a0000000002")}/curriculum`)
    ).body.data.requiredMaterials;
    return {
      catalogIds: catalog.body.data.items.map((c) => c.id),
      requiredMaterials: progress,
      videoEnabled: true,
      readingDisabled: true,
    };
  });
  await check("Inter 1: empty learner and organization isolation", async () => {
    await identity("LEARNER_2");
    assert.equal(
      (await api("/api/v1/enrollments/me?page=1")).body.data.items.length,
      0,
    );
    await navigate("/learner/courses");
    await until("document.body.innerText.includes('chưa')");
    await identity("LEARNER_3");
    assert.equal(
      (await api(`/api/v1/courses/${publicCourse}/introduction`)).status,
      404,
    );
    await navigate("/learner/courses");
    await until("document.querySelector('.learner-org-name')?.textContent === 'Tổ chức B'");
    return { empty: true, crossOrganization: 404 };
  });
  await check("UC25.3 enrollment and 429", async () => {
    await identity("LEARNER_1");
    await navigate(`/learner/catalog/${optionalCourse}`);
    await click("Đăng ký học");
    await until("!!document.querySelector('.ant-modal')");
    await evaluate(
      "Array.from(document.querySelectorAll('.ant-modal button')).find(x=>x.textContent.includes('Đăng ký')).click()",
    );
    await until("document.body.innerText.includes('Vào học')");
    const statuses = [];
    for (let i = 0; i < 12; i++)
      statuses.push(
        (await api("/api/v1/enrollments", "POST", { courseId: optionalCourse }))
          .status,
      );
    assert.ok(statuses.includes(429));
    return { duplicateStatuses: statuses };
  });
  await check("UC25.4 deleted / withdrawn / restored", async () => {
    await identity("LEARNER_4");
    await navigate("/learner/courses");
    await until("document.body.innerText.includes('Rút')");
    const initial = (await api("/api/v1/enrollments/me?page=1")).body.data
      .items;
    const x = initial.find((e) => e.courseId === publicCourse),
      y = initial.find((e) => e.courseId === optionalCourse);
    assert.ok(x && y);
    const before = (
      await api(`/api/v1/enrollments/${y.enrollmentId}/curriculum`)
    ).body.data.requiredMaterials;
    const withdraw = async (enrollmentId) => {
      const start = responses.length;
      await evaluate(
        `Array.from(document.querySelectorAll('li.learner-my-course')).find(x=>x.querySelector('a')?.href.includes('${enrollmentId}')).querySelector('.learner-my-course-action button:last-child').click()`,
      );
      await until(
        "!!document.querySelector('.ant-modal:not([style*=\"display: none\"])')",
      );
      await evaluate(
        "Array.from(document.querySelectorAll('.ant-modal button')).find(x=>x.textContent.includes('Rút khỏi Khóa học')).click()",
      );
      return responseAfter(
        `/api/v1/enrollments/${enrollmentId}/withdrawal`,
        start,
      );
    };
    const deleted = await withdraw(x.enrollmentId);
    assert.equal(deleted.body.data.outcome, "DELETED");
    await sleep(500);
    const withdrawn = await withdraw(y.enrollmentId);
    assert.equal(withdrawn.body.data.outcome, "WITHDRAWN");
    await navigate(`/learner/catalog/${optionalCourse}`);
    await click("Đăng ký học");
    await until("!!document.querySelector('.ant-modal')");
    const start = responses.length;
    await evaluate(
      "Array.from(document.querySelectorAll('.ant-modal button')).find(x=>x.textContent.includes('Đăng ký')).click()",
    );
    const restored = await responseAfter("/api/v1/enrollments", start);
    assert.equal(restored.body.data.restored, true);
    assert.equal(
      restored.body.data.id ?? restored.body.data.enrollmentId,
      y.enrollmentId,
    );
    assert.deepEqual(
      (await api(`/api/v1/enrollments/${y.enrollmentId}/curriculum`)).body.data
        .requiredMaterials,
      before,
    );
    await navigate("/learner/courses");
    return {
      deleted: deleted.status,
      withdrawn: withdrawn.status,
      restored: restored.status,
      retained: before,
      channel: "browser clicks and real HTTP responses",
    };
  });
  await check("UC24/24.1/24.2/24.3/24.5 one-page demo", async () => {
    await identity("ORGANIZER");
    await navigate("/organizer/assignments/assign");
    await until("!!document.querySelector('tr[data-row-key]')");
    await screenshot("assignment-create");
    await until("document.querySelector('.organizer-org-badge')?.textContent === 'Tổ chức A'");
    assert.equal(await evaluate("document.querySelector('.organizer-user strong')?.textContent === 'Quản lý đào tạo ABC'"), true);
    await screenshot("sidebar-organizer");
    const learners = await api("/api/v1/users/learners?page=1&pageSize=50");
    assert.equal(learners.status, 200);
    const previous = await api("/api/v1/assignments?page=1");
    const existing = previous.body.data.items.some(
      (e) =>
        e.learner?.id === id("00000000a203") && e.course?.id === privateCourse,
    );
    let created={status:200,body:{data:{reusedFromCleanRun:true}}};
    if(!existing) {
      await navigate("/organizer/assignments/assign");
      await until("!!document.querySelector('tr[data-row-key=\"01900000-0000-7000-8000-00000000a203\"]')");
      await evaluate("document.querySelector('.organizer-assignment-create .ant-select-selector').dispatchEvent(new MouseEvent('mousedown',{bubbles:true}))");
      await until("Array.from(document.querySelectorAll('.ant-select-item-option-content')).some(x=>x.textContent.includes('Bảo vệ dữ liệu cá nhân'))");
      await evaluate("Array.from(document.querySelectorAll('.ant-select-item-option-content')).find(x=>x.textContent.includes('Bảo vệ dữ liệu cá nhân')).click()");
      await evaluate("document.querySelector('tr[data-row-key=\"01900000-0000-7000-8000-00000000a203\"] input[type=checkbox]').click()");
      await click("Xem lại / bỏ chọn");
      await until("document.querySelector('.ant-modal')?.textContent.includes('Lê Văn Cường')");
      await click("Đóng");
      const start=responses.length;
      await click("Phân công");
      created=await responseAfter("/api/v1/assignments",start);
    }
    assert.equal(created.status, existing ? 200 : 201);
    const listing = await api("/api/v1/assignments?page=1");
    assert.equal(listing.status, 200);
    const row = listing.body.data.items.find(
      (e) =>
        (e.learnerId ?? e.learner?.id) === id("00000000a203") &&
        (e.courseId ?? e.course?.id) === privateCourse,
    );
    assert.ok(row, JSON.stringify(listing.body));
    const assignmentId = row.enrollmentId ?? row.id;
    await navigate("/organizer/assignments");
    await until("document.body.innerText.includes('Lê Văn Cường')");
    await assignmentScreenshots("assignments-list");
    await navigate(`/organizer/assignments/${assignmentId}`);
    await until("document.body.innerText.includes('Lê Văn Cường')");
    await assignmentScreenshots("assignment-detail");
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.organizer-assignment-email')).wordBreak"), "normal");
    assert.equal(await evaluate("document.body.innerText.includes('Northstar Learning') || document.body.innerText.includes('Mai Nguyen')"), false);
    assert.equal(await evaluate("document.querySelector('.organizer-status') && parseFloat(getComputedStyle(document.querySelector('.organizer-status')).fontSize) >= 14"), true);
    const detail = await api(`/api/v1/assignments/${assignmentId}`);
    assert.equal(detail.status, 200);
    const next = new Date(
      Math.max(Date.now(), new Date(detail.body.data.dueAt).getTime()),
    );
    next.setDate(next.getDate() + 2);
    await click("Kéo dài hạn");
    await until("!!document.querySelector('.ant-modal input[placeholder=\"Chọn ngày\"]')");
    await evaluate("document.querySelector('.ant-modal input[placeholder=\"Chọn ngày\"]').click()");
    const day=next.toISOString().slice(0,10);
    for(let i=0;i<3 && !await evaluate(`!!document.querySelector('.ant-picker-cell[title="${day}"]:not(.ant-picker-cell-disabled)')`);i++) {
      await evaluate("document.querySelector('.ant-picker-header-next-btn').click()");await sleep(100);
    }
    await evaluate(`document.querySelector('.ant-picker-cell[title="${day}"]:not(.ant-picker-cell-disabled) .ant-picker-cell-inner').click()`);
    const extensionStart=responses.length;
    await evaluate("Array.from(document.querySelectorAll('.ant-modal button')).find(x=>x.textContent.trim()==='Kéo dài hạn').click()");
    const extended=await responseAfter(`/api/v1/assignments/${assignmentId}/due-date`,extensionStart);
    assert.equal(extended.status, 200, JSON.stringify(extended.body));
    const duplicate = await api("/api/v1/assignments", "POST", {
      courseId: privateCourse,
      learnerIds: [id("00000000a203")],
    });
    assert.equal(duplicate.status, 422);
    assert.equal(
      (
        await api(`/api/v1/assignments/${assignmentId}/due-date`, "PATCH", {
          newDueDate: "2020-01-01",
          reason: "",
        })
      ).status,
      422,
    );
    assert.equal(
      (
        await api(
          `/api/v1/assignments/${id("2a0000000002")}/exemption`,
          "POST",
          { reason: "   " },
        )
      ).status,
      400,
    );
    const rejected = await api(
      `/api/v1/assignments/${assignmentId}/exemption`,
      "POST",
      { reason: "Chưa có hoạt động" },
    );
    assert.equal(rejected.status, 409);
    assert.equal(await evaluate("Array.from(document.querySelectorAll('button')).some(x=>x.textContent.trim()==='Đánh dấu Miễn')"),false);
    await navigate(`/organizer/assignments/${id("2a0000000002")}`);
    await until("!!document.querySelector('.organizer-assignment-learner')");
    await screenshot("assignment-before-exemption");
    await click("Đánh dấu Miễn");
    await until("!!document.querySelector('.ant-modal textarea')");
    await evaluate("(()=>{const t=document.querySelector('.ant-modal textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(t,'Hồi quy demo\\nĐã có hoạt động');t.dispatchEvent(new Event('input',{bubbles:true}))})()");
    const exemptionStart=responses.length;
    await evaluate("Array.from(document.querySelectorAll('.ant-modal button')).find(x=>x.textContent.trim()==='Đánh dấu Miễn').click()");
    const exempted=await responseAfter(`/api/v1/assignments/${id("2a0000000002")}/exemption`,exemptionStart);
    assert.equal(exempted.status, 200, JSON.stringify(exempted.body));
    await until("document.querySelector('.organizer-assignment-title .organizer-status')?.textContent === 'Miễn'");
    await screenshot("assignment-after-exemption");
    return {
      learnerCount: learners.body.data.meta.total,
      created: created.body.data,
      extended: extended.status,
      exempted: exempted.body.data.status,
      noActivity: rejected.status,
      channel: "browser positive flows; actual HTTP negative checks; tenant/course/learning",
      twoPages: "unit assignment.selection.test.ts",
    };
  });
  await check(
    "UC27.2 (1): actual 20s playback activates Enrollment",
    async () => {
      await identity("LEARNER_5");
      assert.equal(
        (await api("/api/v1/enrollments/me?page=1")).body.data.items.find(
          (e) => e.enrollmentId === a,
        ).status,
        "NotStarted",
      );
      await navigate("/learner/courses");
      await until("!!document.querySelector('.learner-my-course')");
      await screenshot("my-courses");
      await screenshot("sidebar-learner");
      await navigate(`/learner/catalog/${publicCourse}`);
      await until("!!document.querySelector('.course-overview-card')");
      assert.equal(await evaluate("document.body.innerText.includes('Learning Outcomes')"), false);
      await screenshot("catalog-course");
      await loadPlayer(a);
      await until("!!document.querySelector('.lesson-resource-target')");
      assert.equal(await evaluate("document.body.innerText.includes('Chưa đủ thời lượng')"), true);
      assert.equal(await evaluate("document.body.innerText.includes('trong proxy khi')"), false);
      await screenshot("video-incomplete");
      await playUntil(20);
      const state = await playback(a);
      assert.ok(
        state.watchedSeconds >= 19 && state.watchedSeconds <= 22,
        JSON.stringify(state),
      );
      await click("Về Bài học");
      await navigate("/learner/courses");
      await until("document.body.innerText.includes('Đang học')");
      assert.equal(
        (await api("/api/v1/enrollments/me?page=1")).body.data.items.find(
          (e) => e.enrollmentId === a,
        ).status,
        "InProgress",
      );
      return {
        watchedSeconds: state.watchedSeconds,
        actualPlayback: true,
        status: "InProgress",
      };
    },
  );
  await check(
    "UC27.2 (2): seek forward and replay do not add coverage",
    async () => {
      await identity("LEARNER_5");
      const before = await playback(a);
      await loadPlayer(a);
      await evaluate("document.querySelector('video').currentTime=590");
      await sleep(500);
      await evaluate("document.dispatchEvent(new Event('visibilitychange'))");
      await sleep(500);
      assert.equal((await playback(a)).watchedSeconds, before.watchedSeconds);
      await evaluate("document.querySelector('video').currentTime=0");
      await sleep(300);
      await playUntil(8, 2);
      assert.equal((await playback(a)).watchedSeconds, before.watchedSeconds);
      return {
        before: before.watchedSeconds,
        after: (await playback(a)).watchedSeconds,
      };
    },
  );
  await check(
    "UC27.2 (3): remaining segment at 2x completes material and refreshes D25",
    async () => {
      await identity("LEARNER_6");
      await loadPlayer(b);
      await until("document.querySelector('video').currentTime>=511");
      await evaluate(
        "(()=>{const s=document.querySelector('select[aria-label=\"Tốc độ phát\"]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,'2');s.dispatchEvent(new Event('change',{bubbles:true}))})()",
      );
      await playUntil(545, 2);
      await until("document.body.innerText.includes('Đã hoàn thành')");
      const state = await playback(b);
      assert.equal(state.completed, true);
      assert.ok(state.watchedSeconds >= 541);
      await click("Về Bài học");
      await until("document.body.innerText.includes('Đã hoàn thành')");
      const curriculum = (await api(`/api/v1/enrollments/${b}/curriculum`)).body
        .data;
      assert.equal(curriculum.requiredMaterials.completed, 1);
      return {
        watchedSeconds: state.watchedSeconds,
        requiredSeconds: state.requiredSeconds,
        completedAt: state.completedAt,
        requiredMaterials: curriculum.requiredMaterials,
      };
    },
  );
  await check(
    "UC27.2 (4): completion remains after backward replay",
    async () => {
      await identity("LEARNER_6");
      const before = await playback(b);
      await loadPlayer(b);
      await evaluate("document.querySelector('video').currentTime=0");
      await playUntil(4, 2);
      const after = await playback(b);
      assert.equal(after.completed, true);
      assert.equal(after.completedAt, before.completedAt);
      return { completedAt: after.completedAt };
    },
  );
  await check("UI: localized learner screenshots", async () => {
    await identity("LEARNER_5");
    await navigate("/learner/courses");
    await until("!!document.querySelector('.learner-my-course')");
    assert.equal(await evaluate("document.querySelector('.learner-status') && parseFloat(getComputedStyle(document.querySelector('.learner-status')).fontSize) >= 14"), true);
    await until("document.querySelector('.learner-org-name')?.textContent === 'Tổ chức A'");
    assert.equal(await evaluate("!!document.querySelector('.dev-identity-badge')"), false);
    await screenshot("my-courses");
    await screenshot("sidebar-learner");
    await navigate("/learner/catalog");
    await until("!!document.querySelector('.learner-catalog-card')");
    assert.equal(await evaluate("Array.from(document.querySelectorAll('.course-cover-initial')).some(x => x.textContent === '[')"), false);
    await screenshot("catalog");
    await navigate(`/learner/catalog/${publicCourse}`);
    await until("!!document.querySelector('.course-overview-card')");
    assert.equal(await evaluate("document.body.innerText.includes('Learning Outcomes')"), false);
    await screenshot("catalog-course");
    await loadPlayer(a);
    await screenshot("video-incomplete");
    await identity("LEARNER_6");
    await loadPlayer(b);
    await until("document.body.innerText.includes('Đã hoàn thành')");
    await screenshot("video-completed");
    await identity("ORGANIZER");
    await navigate(`/organizer/assignments/${id("2a0000000002")}`);
    await until("document.querySelector('.organizer-assignment-title .organizer-status')?.textContent === 'Miễn'");
    await screenshot("assignment-after-exemption");
    return { viewportWidth: 1440, artifactDirectory: artifacts };
  });
} finally {
  const output = path.join(artifacts, "checks.json");
  const previous =
    process.env.CHECK_PREFIX && existsSync(output)
      ? JSON.parse(readFileSync(output, "utf8")).results
      : [];
  const combined = [
    ...previous.filter((r) => !results.some((n) => n.name === r.name)),
    ...results,
  ];
  writeFileSync(
    output,
    JSON.stringify(
      { at: new Date().toISOString(), results: combined },
      null,
      2,
    ),
  );
  socket?.close();
  browser.kill();
}
if (results.some((r) => r.result === "FAIL")) process.exitCode = 1;

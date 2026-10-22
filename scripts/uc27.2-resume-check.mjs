import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.resolve(
  process.env.UC272_EVIDENCE_DIR ||
    path.join(os.tmpdir(), "learnup-uc272-" + Date.now()),
);
fs.mkdirSync(OUT, { recursive: true });
if (process.env.NODE_ENV === "production")
  throw Error("Refusing browser fixtures in production");
const require = createRequire(ROOT + "/services/learning-service/package.json");
const { Client } = require("pg");
const rawEnv = fs.readFileSync(
  ROOT + "/services/learning-service/.env",
  "utf8",
);
const dbUrl = new URL(
  rawEnv
    .match(/^\s*DATABASE_URL\s*=\s*(.*)$/m)[1]
    .trim()
    .replace(/^['"]|['"]$/g, ""),
);
dbUrl.port = "15433";
if (
  !["localhost", "127.0.0.1"].includes(dbUrl.hostname) ||
  dbUrl.pathname !== "/learning_db"
)
  throw Error("Unsafe DB target");
const db = new Client({ connectionString: dbUrl.href });
let base = "http://localhost:3000";
const enrollment = "01900000-0000-7000-8000-2a0000000027";
const org = "01900000-0000-7000-8000-00000000a001";
const material = "01900000-0000-7000-8000-c0050001676b";
const lesson = "01900000-0000-7000-8000-c004000023f1";
const route = `/learner/courses/${enrollment}/lessons/${lesson}/resources/${material}`;
const apiPath = `/api/v1/enrollments/${enrollment}/materials/${material}`;
let label = "setup";
const rows = [];
const evidenceFile = path.join(OUT, "browser-evidence.jsonl");
const resultFile = path.join(OUT, "matrix-results.json");
const write = (type, data = {}) =>
  fs.appendFileSync(
    evidenceFile,
    JSON.stringify({ at: new Date().toISOString(), label, type, ...data }) +
      "\n",
  );
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
class CDP {
  constructor(ws, targetId) {
    this.ws = ws;
    this.targetId = targetId;
    this.id = 0;
    this.waits = new Map();
    this.net = new Map();
  }
  static async open(url, targetId) {
    const c = new CDP(new WebSocket(url), targetId);
    await new Promise((resolve, reject) => {
      c.ws.onopen = resolve;
      c.ws.onerror = reject;
    });
    c.ws.onmessage = (event) => c.message(JSON.parse(event.data));
    c.ws.onclose = () => {
      for (const w of c.waits.values()) w.reject(Error("Target closed"));
      c.waits.clear();
    };
    return c;
  }
  async message(m) {
    const w = this.waits.get(m.id);
    if (w) {
      this.waits.delete(m.id);
      m.error ? w.reject(Error(JSON.stringify(m.error))) : w.resolve(m.result);
    }
    if (
      m.method === "Runtime.bindingCalled" &&
      m.params.name === "investigationEvidence"
    ) {
      try {
        write("media", {
          targetId: this.targetId,
          ...JSON.parse(m.params.payload),
        });
      } catch {}
    }
    if (m.method === "Network.requestWillBeSent") {
      const p = m.params,
        r = p.request;
      if (r.url.includes(apiPath)) {
        const n = {
          requestId: p.requestId,
          url: r.url,
          method: r.method,
          payload: r.postData,
          timestamp: p.timestamp,
          wallTime: p.wallTime,
          initiatedLabel: label,
          targetId: this.targetId,
        };
        this.net.set(p.requestId, n);
        write("request", n);
      }
    }
    if (
      m.method === "Network.responseReceived" &&
      this.net.has(m.params.requestId)
    ) {
      const p = m.params,
        n = this.net.get(p.requestId);
      n.status = p.response.status;
      write("response", {
        ...n,
        responseTimestamp: p.timestamp,
        fromDiskCache: p.response.fromDiskCache,
        fromServiceWorker: p.response.fromServiceWorker,
        cacheControl:
          p.response.headers["cache-control"] ??
          p.response.headers["Cache-Control"],
      });
    }
    if (
      m.method === "Network.loadingFailed" &&
      this.net.has(m.params.requestId)
    ) {
      write("failed", {
        ...this.net.get(m.params.requestId),
        errorText: m.params.errorText,
        canceled: m.params.canceled,
      });
    }
    if (
      m.method === "Network.loadingFinished" &&
      this.net.has(m.params.requestId)
    ) {
      const n = this.net.get(m.params.requestId);
      try {
        const b = await this.call("Network.getResponseBody", {
          requestId: m.params.requestId,
        });
        write("responseBody", { ...n, body: JSON.parse(b.body) });
      } catch (e) {
        write("bodyUnavailable", { ...n, reason: e.message });
      }
    }
  }
  call(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.id;
      this.waits.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.waits.delete(id)) reject(Error("CDP timeout: " + method));
      }, 25000).unref();
    });
  }
  async eval(expression) {
    const r = await this.call("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails)
      throw Error(
        r.exceptionDetails.exception?.description ?? r.exceptionDetails.text,
      );
    return r.result.value;
  }
}
const mediaScript = `(() => {
  const events = ['loadedmetadata','play','playing','pause','ended','seeking','seeked','ratechange','visibilitychange','pagehide','beforeunload'];
  const record = e => { const v = document.querySelector('video'); investigationEvidence(JSON.stringify({ event: e.type, browserAt: Date.now(), time: v?.currentTime, paused: v?.paused, seeking: v?.seeking, visibility: document.visibilityState })); };
  for (const type of events) window.addEventListener(type, record, true);
})()`;
let browser, chrome;
const openPages = new Set();
async function newPage() {
  const { targetId } = await browser.call("Target.createTarget", {
    url: "about:blank",
  });
  const tabs = await fetch("http://127.0.0.1:19427/json/list").then((r) =>
    r.json(),
  );
  const p = await CDP.open(
    tabs.find((t) => t.id === targetId).webSocketDebuggerUrl,
    targetId,
  );
  await p.call("Page.enable");
  await p.call("Runtime.enable");
  await p.call("Network.enable", {
    maxTotalBufferSize: 20000000,
    maxResourceBufferSize: 5000000,
    enableDurableMessages: true,
  });
  await p.call("Runtime.addBinding", { name: "investigationEvidence" });
  await p.call("Page.addScriptToEvaluateOnNewDocument", {
    source: mediaScript,
  });
  openPages.add(p);
  return p;
}
async function closePage(p) {
  if (!p || !openPages.has(p)) return;
  write("closeTab", { targetId: p.targetId });
  await browser.call("Target.closeTarget", { targetId: p.targetId });
  openPages.delete(p);
  p.ws.close();
}
async function until(p, expression, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await p.eval(expression)) return;
    await sleep(80);
  }
  throw Error("Condition timed out: " + expression);
}
async function load(p, url = base + route) {
  await p.call("Page.bringToFront");
  await p.call("Page.navigate", { url });
  await until(
    p,
    "!!document.querySelector('video') && document.querySelector('video').readyState>=2",
  );
  await until(p, "!document.querySelector('video').seeking");
  const time = await p.eval("document.querySelector('video').currentTime");
  write("playerLoaded", { targetId: p.targetId, time });
  return time;
}
async function watchTo(p, time, pause = true) {
  await p.eval("document.querySelector('video').play()");
  await until(
    p,
    `document.querySelector('video').currentTime >= ${time}`,
    90000,
  );
  return pause
    ? pauseNow(p)
    : p.eval("document.querySelector('video').currentTime");
}
async function pauseNow(p) {
  return p.eval(
    "(()=>{const v=document.querySelector('video');v.pause();return v.currentTime})()",
  );
}
async function seek(p, time) {
  await p.eval(`document.querySelector('video').currentTime=${time}`);
  await until(p, "!document.querySelector('video').seeking");
}
async function snapshot(stage) {
  const r = await db.query(
    `SELECT e.status,e.first_activity_at,p.watched_ranges::text,p.last_reported_at,p.completed_at,p.updated_at,p.position_seconds,p.position_reported_at,
    COALESCE((SELECT SUM(upper(r)-lower(r))::int FROM unnest(p.watched_ranges) r),0) AS watched_seconds
    FROM enrollments e LEFT JOIN material_progress p ON p.enrollment_id=e.id AND p.material_id=$2 AND p.organization_id=e.organization_id
    WHERE e.id=$1 AND e.organization_id=$3`,
    [enrollment, material, org],
  );
  write("db", { stage, row: r.rows[0] });
  return r.rows[0];
}
async function reset(completeFixture = false) {
  for (const p of [...openPages]) await closePage(p);
  await sleep(1500);
  await db.query(
    "DELETE FROM material_progress WHERE enrollment_id=$1 AND material_id=$2 AND organization_id=$3",
    [enrollment, material, org],
  );
  await db.query(
    "UPDATE enrollments SET status='NotStarted',first_activity_at=NULL,completed_at=NULL,completed_late=NULL WHERE id=$1 AND organization_id=$2",
    [enrollment, org],
  );
  if (completeFixture)
    await db.query(
      `INSERT INTO material_progress(id,organization_id,enrollment_id,material_id,watched_ranges,last_reported_at,position_seconds,position_reported_at)
    VALUES(gen_random_uuid(),$1,$2,$3,'{[0,511)}'::int4multirange,NULL,511,now()-interval '1 second')`,
      [org, enrollment, material],
    );
  return snapshot("initial");
}
async function throttle(p, offline = false) {
  await p.call("Network.emulateNetworkConditions", {
    offline,
    latency: offline ? 0 : 2000,
    downloadThroughput: offline ? -1 : 50000,
    uploadThroughput: offline ? -1 : 50000,
    connectionType: "cellular3g",
  });
}
async function normal(p) {
  await p.call("Network.emulateNetworkConditions", {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
}
async function perform(caseNo, iteration, cache) {
  label = `case-${caseNo}-cache-${cache}-run-${iteration}`;
  base = cache ? "http://localhost:3000" : "http://localhost:3001";
  const result = {
    caseNo,
    iteration,
    cache,
    startedAt: new Date().toISOString(),
  };
  try {
    result.initialDb = await reset(caseNo === "10a" || caseNo === "10b");
    let p = await newPage();
    result.initialResume = await load(p);
    if (caseNo === "10a" || caseNo === "10b") {
      result.stop = await watchTo(p, 545);
      await sleep(1800);
      result.beforeReopen = await snapshot("afterCompletion");
      if (caseNo === "10b") {
        await db.query(
          "UPDATE enrollments SET status='Completed',completed_at=now() WHERE id=$1 AND organization_id=$2",
          [enrollment, org],
        );
        write("fixtureEnrollmentCompleted");
      }
      await closePage(p);
      p = await newPage();
      result.resume = await load(p);
      result.completedReopenStart = result.resume;
      await watchTo(p, 550);
      await sleep(1200);
      result.afterReplay = await snapshot("afterCompletedReplay");
      result.completionStable =
        !!result.beforeReopen.completed_at &&
        String(result.beforeReopen.completed_at) ===
          String(result.afterReplay.completed_at);
      result.coverageStable =
        result.beforeReopen.watched_ranges ===
        result.afterReplay.watched_ranges;
      result.success =
        Math.abs(result.resume - result.stop) <= 1 &&
        result.completionStable &&
        (caseNo !== "10b" || result.coverageStable) &&
        Math.abs(result.afterReplay.position_seconds - 550) <= 1;
    } else if (caseNo === 11) {
      const held = [];
      const interceptor = (event) => {
        const m = JSON.parse(event.data);
        if (m.method === "Fetch.requestPaused") {
          held.push(m.params.requestId);
          write("heldRequest", { payload: m.params.request.postData });
        }
      };
      p.ws.addEventListener("message", interceptor);
      await p.call("Fetch.enable", {
        patterns: [
          { urlPattern: "*" + apiPath + "/progress", requestStage: "Request" },
        ],
      });
      await seek(p, 20);
      await sleep(200);
      const second = await newPage();
      await load(second);
      await seek(second, 60);
      await sleep(700);
      result.newerTab = await snapshot("newerTabBeforeRelease");
      p.ws.removeEventListener("message", interceptor);
      for (const requestId of held)
        await p.call("Fetch.continueRequest", { requestId });
      await p.call("Fetch.disable");
      await sleep(700);
      result.afterOlderTab = await snapshot("afterOlderTabReleased");
      await p.call("Page.bringToFront");
      await seek(p, 8);
      await sleep(700);
      result.afterBackward = await snapshot("newestBackwardPosition");
      result.stop = 8;
      result.resume = result.afterBackward.position_seconds;
      result.success =
        held.length > 0 &&
        result.newerTab.position_seconds === 60 &&
        result.afterOlderTab.position_seconds === 60 &&
        result.resume === 8 &&
        result.afterBackward.watched_seconds === 0;
    } else if (caseNo === 7) {
      await watchTo(p, 10, false);
      await seek(p, 60);
      await watchTo(p, 70, false);
      await seek(p, 5);
      result.stop = await watchTo(p, 8);
      await sleep(1500);
      await closePage(p);
      p = await newPage();
      result.resume = await load(p);
    } else if (caseNo === 9) {
      await watchTo(p, 10, false);
      await throttle(p, true);
      write("offlineOn");
      await sleep(30000);
      result.timeWhenOnline = await p.eval(
        "document.querySelector('video').currentTime",
      );
      await normal(p);
      write("offlineOff");
      result.stop = await watchTo(p, result.timeWhenOnline + 20);
      await sleep(2000);
      await closePage(p);
      p = await newPage();
      result.resume = await load(p);
    } else {
      if (caseNo === 8) await throttle(p);
      result.stop = await watchTo(p, 10, ![4, 6].includes(caseNo));
      if (caseNo === 1) {
        await p.call("Page.reload");
        await until(
          p,
          "!!document.querySelector('video') && document.querySelector('video').readyState>=2 && !document.querySelector('video').seeking",
        );
        result.resume = await p.eval(
          "document.querySelector('video').currentTime",
        );
      } else if ([2, 4, 8].includes(caseNo)) {
        await closePage(p);
        p = await newPage();
        result.resume = await load(p);
      } else if (caseNo === 3) {
        const other = await newPage();
        await other.call("Page.bringToFront");
        result.hidden = await p.eval("document.visibilityState");
        await sleep(20000);
        await p.call("Page.bringToFront");
        result.returnedVisibility = await p.eval("document.visibilityState");
        await p.call("Page.navigate", { url: base + "/learner/courses" });
        await until(
          p,
          "document.readyState==='complete' && !document.querySelector('video')",
        );
        result.resume = await load(p);
        await closePage(other);
      } else if (caseNo === 5) {
        await p.eval(
          `Array.from(document.querySelectorAll('button')).find(x=>x.textContent.includes('Về Lesson')).click()`,
        );
        await until(
          p,
          "!document.querySelector('video') && Array.from(document.querySelectorAll('button')).some(x=>x.textContent.includes('Mở học liệu') && !x.disabled)",
        );
        await p.eval(
          "Array.from(document.querySelectorAll('button')).find(x=>x.textContent.includes('Mở học liệu') && !x.disabled).click()",
        );
        await until(
          p,
          "!!document.querySelector('video') && document.querySelector('video').readyState>=2 && !document.querySelector('video').seeking",
        );
        result.resume = await p.eval(
          "document.querySelector('video').currentTime",
        );
      } else if (caseNo === 6) {
        result.stop = await p.eval(
          "(()=>{const v=document.querySelector('video');v.currentTime=60;v.pause();return v.currentTime})()",
        );
        await until(p, "!document.querySelector('video').seeking");
        await sleep(500);
        await closePage(p);
        p = await newPage();
        result.resume = await load(p);
      }
    }
    result.dbAfterReopen = await snapshot("afterReopen");
    if (result.success === undefined)
      result.success = Math.abs(result.resume - result.stop) <= 1;
    result.delta = result.resume - result.stop;
    result.completedAt = new Date().toISOString();
    console.log(
      JSON.stringify({
        caseNo,
        iteration,
        cache,
        stop: result.stop,
        resume: result.resume,
        success: result.success,
        watchedSeconds: result.dbAfterReopen.watched_seconds,
        visibility: result.hidden,
        completed: !!result.dbAfterReopen.completed_at,
      }),
    );
  } catch (e) {
    result.success = false;
    result.error = e.message;
    console.log(JSON.stringify({ caseNo, iteration, cache, error: e.message }));
  }
  rows.push(result);
  write("result", result);
  fs.writeFileSync(
    resultFile,
    JSON.stringify({ at: new Date().toISOString(), rows }, null, 2),
  );
}
try {
  await db.connect();
  const version = await db.query("SELECT version(),inet_server_port()");
  write("databaseServer", { version: version.rows[0] });
  for (const origin of ["http://localhost:3000", "http://localhost:3001"]) {
    const identity = await fetch(origin + "/__dev/identity", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: "LEARNER_5" }),
    });
    if (identity.status !== 200)
      throw Error("Cannot select demo learner: " + identity.status);
  }
  const chromeRoot = path.join(process.env.LOCALAPPDATA, "ms-playwright");
  const chromePath = fs
    .readdirSync(chromeRoot)
    .filter((n) => n.startsWith("chromium-"))
    .map((n) => path.join(chromeRoot, n, "chrome-win64", "chrome.exe"))
    .find(fs.existsSync);
  chrome = spawn(
    chromePath,
    [
      "--headless=new",
      "--disable-gpu",
      "--remote-debugging-port=19427",
      "--remote-allow-origins=*",
      "--autoplay-policy=no-user-gesture-required",
      `--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(), "resume-check-"))}`,
      "about:blank",
    ],
    { stdio: "ignore", windowsHide: true },
  );
  for (let i = 0; i < 100; i++) {
    try {
      const v = await fetch("http://127.0.0.1:19427/json/version").then((r) =>
        r.json(),
      );
      browser = await CDP.open(v.webSocketDebuggerUrl, "browser");
      write("browserVersion", { version: v.Browser });
      break;
    } catch {
      await sleep(200);
    }
  }
  if (!browser) throw Error("Chromium did not start");
  const cases = (process.env.UC272_CASES || "1,2,3,4,5,6,7,8,9,10a,10b,11")
    .split(",")
    .map((v) => (/^\d+$/.test(v) ? Number(v) : v));
  const reps = Number(process.env.UC272_REPS || 10);
  for (const c of cases)
    for (let i = 1; i <= reps; i++) await perform(c, i, true);
  if (!process.env.UC272_CASES || process.env.UC272_CACHE_OFF === "1") {
    for (const c of [1, 5])
      for (let i = 1; i <= reps; i++) await perform(c, i, false);
  }
  if (rows.some((row) => !row.success)) process.exitCode = 1;
} finally {
  for (const p of [...openPages])
    try {
      await closePage(p);
    } catch {}
  await db.end();
  browser?.ws.close();
  chrome?.kill();
}

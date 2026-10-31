import assert from "node:assert/strict";
import { GATEWAY, SEED, loadClusterEnv } from "../lib/config.mjs";
import { data, request } from "../lib/http.mjs";

const courseId = SEED.coursePrivate;
const PASSWORD_PLACEHOLDER = "Enter your password";
const EMAIL_PLACEHOLDER = "alex.morgan@acme.example";

async function signIn(page, shared, email, password, landing) {
  await page.goto(`${shared.origin}/login`);
  await page.waitFor(`document.querySelector('input[placeholder="${EMAIL_PLACEHOLDER}"]')`, "login form");
  await page.type(`document.querySelector('input[placeholder="${EMAIL_PLACEHOLDER}"]')`, email, "email input");
  await page.type(`document.querySelector('input[placeholder="${PASSWORD_PLACEHOLDER}"]')`, password, "password input");
  await page.clickText("button", "Sign in");
  await page.waitFor(`location.pathname.startsWith(${JSON.stringify(landing)})`, `redirect to ${landing}`);
}

const organizerLogin = (page, shared) =>
  signIn(page, shared, shared.organizer.email, loadClusterEnv().FIXTURE_ORGANIZER_PASSWORD, "/organizer");
const learnerLogin = (page, shared) => signIn(page, shared, shared.learner.email, shared.learner.password, "/learner");

const get = async (token, p) => data(await request("GET", `${GATEWAY}${p}`, { token, label: p.replace(/[0-9a-f-]{36}/g, ":id") }));

export const journeys = [
  {
    id: "S1",
    title: "UC05 Organizer login",
    async run({ page, step, shared }) {
      await step("login form renders", async () => {
        await page.goto(`${shared.origin}/login`);
        await page.waitForText("Sign in to LearnUP");
        assert.ok(await page.hasText("Email address"));
      });
      await step("Organizer signs in and lands on the organizer area", async () => {
        await organizerLogin(page, shared);
        await page.waitFor(`document.querySelector(".organizer-org-badge")`, "organization badge");
      });
      await step("landing page shows the organization name (recorded, not asserted against a fixed value)", async () => {
        const badge = await page.eval(`document.querySelector(".organizer-org-badge").innerText`);
        assert.ok(badge.trim().length > 0, "empty organization badge");
        (page.observations ??= []).push(`organization badge shows "${badge.trim()}" for ${shared.organizer.email}`);
      });
    },
  },
  {
    id: "S2",
    title: "UC13 -> UC24.2 Organizer assigns a course",
    async run({ page, step, shared }) {
      const { email, fullName } = shared.learner;
      await organizerLogin(page, shared);
      const names = await get(shared.organizer.token, "/api/v1/courses/organization?current=1&pageSize=100");
      const course = (names.result ?? []).find((c) => c.id === courseId);
      assert.ok(course, "seeded course missing from organization courses");
      shared.course = course;
      await step("learner list finds the learner created for this run", async () => {
        await page.goto(`${shared.origin}/organizer/learners`);
        await page.type(`document.querySelector('input[placeholder="Search by name or email"]')`, email, "learner search");
        await page.waitFor(`document.body.innerText.includes(${JSON.stringify(email)})`, "learner row");
      });
      await step("assignments page opens the assign form", async () => {
        await page.goto(`${shared.origin}/organizer/assignments`);
        await page.waitForText("Phân công đào tạo");
        await page.clickText("a button, button", "Phân công Khóa học");
        await page.waitForText("Khóa học đã xuất bản");
      });
      await step("select the course and the learner", async () => {
        await page.click(`document.querySelector(".ant-select-selector")`, "course select");
        await page.cmd("Input.insertText", { text: course.name });
        const label = `${course.name} · Phiên bản ${course.versionNumber}`;
        await page.clickText(".ant-select-item-option", label, "course option");
        await page.waitFor(`document.querySelector(".ant-select-selection-item")`, "course chosen");
        // The learner table has no search: page through until the run's learner shows up.
        const row = `[...document.querySelectorAll(".ant-table-tbody tr")].find((r) => r.innerText.includes(${JSON.stringify(email)}))`;
        for (let i = 0; i < 200 && !(await page.eval(`Boolean(${row})`)); i++) {
          const more = await page.eval(`(() => { const b = document.querySelector('.ant-pagination-next:not(.ant-pagination-disabled)'); return Boolean(b); })()`);
          assert.ok(more, "learner not found on any page of the learner table");
          await page.click(`document.querySelector(".ant-table-wrapper .ant-pagination-next")`, "next learner page");
          await page.networkIdle();
        }
        await page.click(`(${row}).querySelector("input[type=checkbox]")`, "learner checkbox");
        await page.waitForText("Đã chọn 1 / 500");
      });
      await step("Phân công shows the success message and the assignment with its due date", async () => {
        await page.clickText("button", "Phân công", "submit");
        await page.waitFor(`location.pathname === "/organizer/assignments"`, "redirect to assignments");
        await page.waitFor(`document.querySelector(".ant-alert-success")`, "success message");
        shared.summary = await page.eval(`document.querySelector(".ant-alert-success").innerText`);
        const row = `[...document.querySelectorAll(".ant-table-tbody tr")].find((r) => r.innerText.includes(${JSON.stringify(email)}))`;
        await page.waitFor(row, "assignment row for the learner");
        const cells = await page.eval(`(${row}).innerText`);
        (page.observations ??= []).push(`success message: "${shared.summary}"; row: ${cells.replace(/\s+/g, " ")}`);
        assert.ok(/\d{1,2}\/\d{1,2}\/\d{4}/.test(cells), `no due date in the assignment row: ${cells}`);
      });
    },
  },
  {
    id: "S3",
    title: "UC26 -> UC27 -> UC27.1 -> UC27.3 -> UC27.2 learner learning path",
    async run({ page, step, shared }) {
      const { token } = shared.learner;
      const mine = (await get(token, "/api/v1/enrollments/me")).items.find((i) => i.courseId === courseId);
      assert.ok(mine, "assigned course missing from the learner's enrollments (API); S2 must pass first");
      shared.enrollmentId = mine.enrollmentId;
      let plan = null;
      for (const m of (await get(token, `/api/v1/enrollments/${mine.enrollmentId}/curriculum`)).modules)
        for (const l of m.lessons) {
          const detail = await get(token, `/api/v1/enrollments/${mine.enrollmentId}/lessons/${l.lessonId}`);
          const reading = detail.materials.find((x) => x.materialType === "Reading" && x.isRequired);
          const video = detail.materials.find((x) => x.materialType === "Video");
          if (!plan && reading && video) plan = { lesson: detail.lesson, reading, video };
        }
      assert.ok(plan, "no lesson with a required Reading and a Video in the assigned course");
      shared.plan = plan;
      await step("learner signs in and lands in the learner area", () => learnerLogin(page, shared));
      await step("My courses lists the assigned course with its due date", async () => {
        await page.goto(`${shared.origin}/learner/courses`);
        await page.waitForText("Khóa học của tôi");
        await page.waitForText("Hạn hoàn thành:");
        assert.ok(await page.hasText(shared.course.name), `course ${shared.course.name} not listed`);
        const meta = await page.eval(`document.querySelector(".learner-my-course-meta").innerText`);
        (page.observations ??= []).push(`My courses meta: ${meta.replace(/\s+/g, " ")}`);
      });
      await step("Vào học opens the curriculum", async () => {
        await page.clickText("button", "Vào học");
        await page.waitFor(`location.pathname === "/learner/courses/${mine.enrollmentId}"`, "curriculum route");
        await page.waitForText("Chương trình học");
      });
      await step("lesson page lists its materials", async () => {
        await page.clickText("a.course-curriculum-lesson", plan.lesson.title);
        await page.waitForText("Học liệu");
        await page.waitForText(plan.reading.title);
      });
      await step("open the Reading, mark it complete", async () => {
        await page.click(`[...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === ${JSON.stringify(`Mở học liệu ${plan.reading.title}`)})`, "open reading");
        await page.waitForText("Đánh dấu đã hoàn thành");
        await page.clickText("button", "Đánh dấu đã hoàn thành");
        await page.waitFor(`[...document.querySelectorAll("button")].some((b) => b.innerText.trim() === "Đã hoàn thành" && b.disabled)`, "completed state");
      });
      await step("Reading stays completed after reload", async () => {
        await page.cmd("Page.reload");
        await page.waitForText(plan.reading.title);
        await page.waitFor(`[...document.querySelectorAll("button")].some((b) => b.innerText.trim() === "Đã hoàn thành" && b.disabled)`, "completed after reload");
      });
      await step("Video page renders with its controls (playback URL is the unreachable E2E fixture)", async () => {
        await page.clickText("a", "Về Bài học");
        await page.waitForText("Học liệu");
        await page.click(`[...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === ${JSON.stringify(`Mở học liệu ${plan.video.title}`)})`, "open video");
        await page.waitFor(`document.querySelector("video[controls]")`, "video element");
        assert.ok(await page.hasText("Tốc độ phát"), "playback-rate control missing");
        await page.waitFor(`document.querySelector("video").error`, "media error state (fixture URL is unreachable)");
        const state = await page.eval(`(() => { const v = document.querySelector("video"); return { src: v.currentSrc || v.src, error: v.error && v.error.code, readyState: v.readyState, text: document.body.innerText.replace(/\\s+/g, " ").slice(0, 400) }; })()`);
        (page.observations ??= []).push(`video page: ${JSON.stringify(state)}`);
      });
    },
  },
  {
    id: "S4",
    title: "UC28 learner progress",
    async run({ page, step, shared }) {
      const { token } = shared.learner;
      const base = `/api/v1/enrollments/${shared.enrollmentId}`;
      const required = [];
      for (const m of (await get(token, `${base}/curriculum`)).modules)
        for (const l of m.lessons)
          required.push(...(await get(token, `${base}/lessons/${l.lessonId}`)).materials.filter((x) => x.isRequired));
      const done = required.filter((x) => x.completed);
      const missing = required.filter((x) => !x.completed);
      assert.ok(done.length >= 1 && missing.length >= 1, "S3 must leave a completed Reading and other required items open");
      await learnerLogin(page, shared);
      await step("progress page opens for the enrollment and shows the What remains list", async () => {
        await page.goto(`${shared.origin}/learner/courses/${shared.enrollmentId}/progress`);
        const shown = await page.waitFor(`document.querySelector(".course-progress-table")`, "What remains table", 10000).then(
          () => true,
          async () => {
            (page.observations ??= []).push(`progress page body: "${(await page.bodyText()).replace(/\s+/g, " ").trim()}"`);
            return false;
          },
        );
        assert.ok(shown, "progress page renders nothing for a real enrollment (no What remains table)");
      });
      await step("the completed Reading is not listed as remaining; every other required item is", async () => {
        const rows = await page.eval(`[...document.querySelectorAll(".course-progress-table tbody tr")].map((r) => r.innerText.replace(/\\s+/g, " "))`);
        for (const m of done) assert.ok(!rows.some((r) => r.includes(m.title)), `completed "${m.title}" still listed as remaining`);
        for (const m of missing) assert.ok(rows.some((r) => r.includes(m.title)), `required "${m.title}" missing from What remains`);
      });
    },
  },
];

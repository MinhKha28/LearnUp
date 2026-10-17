#!/usr/bin/env node
/**
 * Dựng môi trường demo Inter 1 (6 UC của Hào) bằng một lệnh (D46, D47):
 *
 *   node scripts/inter1-demo.mjs          kiểm trước, bật postgres, migrate, seed, bật course, learning, frontend
 *   node scripts/inter1-demo.mjs --check  chỉ kiểm trước rồi thoát
 *
 * Mọi lỗi môi trường phải lộ ra trước dòng "Sẵn sàng demo". Đầu ra của từng tiến trình ghi vào
 * <thư mục tạm>/learnup-demo/*.log. Ctrl+C tắt toàn bộ tiến trình con (không tắt postgres).
 * Chỉ dùng module có sẵn của Node, chạy được trên Windows, Linux và macOS.
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const IS_WINDOWS = process.platform === "win32";
const CHECK_ONLY = process.argv.includes("--check");
const LOG_DIR = path.join(os.tmpdir(), "learnup-demo");

const DIRS = {
  course: path.join(ROOT, "services", "course-service"),
  learning: path.join(ROOT, "services", "learning-service"),
  frontend: path.join(ROOT, "frontend"),
  tsCommon: path.join(ROOT, "libraries", "ts-common"),
};

const PORTS = { frontend: 3000, course: 8083, learning: 8085 };
const POSTGRES_SERVICE = "postgres";
const POSTGRES_CONTAINER = "learnup-postgres";

const LEARNER_1 = {
  userId: "0199a000-0000-7000-8000-0b0000000001",
  organizationId: "0199a000-0000-7000-8000-0a0000000001",
};
const COURSE_03 = "0199a000-0000-7000-8000-0e0000000003";
const ASSESSMENT_DEMO_ENV = {
  ASSESSMENT_CLIENT_MODE: "fake",
  ASSESSMENT_FAKE_RESULT_COURSE_IDS: COURSE_03,
};
const E_DEMO_1 = "0199a000-0000-7000-8000-2a0000000001";
const E_DEMO_2 = "0199a000-0000-7000-8000-2a0000000002";
const L11 = "0199a000-0000-7000-8000-1b0000000011";
const L13 = "0199a000-0000-7000-8000-1b0000000013";

const TOTAL_STEPS = 10;
const startedAt = Date.now();

// ---------------------------------------------------------------------------
// Lỗi có hướng dẫn sửa
// ---------------------------------------------------------------------------
class DemoError extends Error {
  /** @param {string} reason @param {string} hint @param {string} [logFile] */
  constructor(reason, hint, logFile) {
    super(reason);
    this.hint = hint;
    this.logFile = logFile;
  }
}

const step = (n, text) => console.log(`[${n}/${TOTAL_STEPS}] ${text}`);
const detail = (text) => console.log(`       ${text}`);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// Tiến trình con
// ---------------------------------------------------------------------------
/** @type {Set<import("node:child_process").ChildProcess>} */
const children = new Set();
let shuttingDown = false;

function logPath(name) {
  return path.join(LOG_DIR, `${name}.log`);
}

function openLog(name) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  return fs.openSync(logPath(name), "w");
}

function tailLog(file, lines = 30) {
  try {
    return fs
      .readFileSync(file, "utf8")
      .replace(/\x1b\[[0-9;]*m/g, "")
      .replace(/\r\n/g, "\n")
      .trimEnd()
      .split("\n")
      .slice(-lines)
      .join("\n");
  } catch {
    return "(không đọc được log)";
  }
}

/**
 * npm, npx cần shell trên Windows (npm.cmd); node chạy thẳng bằng process.execPath.
 * cwd truyền qua option nên đường dẫn có dấu cách vẫn chạy.
 */
function spawnLogged(command, args, { cwd, env, logName, longRunning = false }) {
  const fd = openLog(logName);
  const useShell = command !== process.execPath && IS_WINDOWS;
  const childEnv = { ...process.env, ...env };
  if (cwd === DIRS.learning) {
    childEnv.NODE_PATH = [DIRS.learning, childEnv.NODE_PATH].filter(Boolean).join(path.delimiter);
  }
  const child = spawn(command, args, {
    cwd,
    env: childEnv,
    stdio: ["ignore", fd, fd],
    shell: useShell,
    windowsHide: true,
    // Hệ khác Windows: nhóm tiến trình riêng để tắt cả cây bằng kill(-pid)
    detached: !IS_WINDOWS && longRunning,
  });
  fs.closeSync(fd);
  children.add(child);
  child.on("exit", () => children.delete(child));
  return child;
}

/** Chạy một lệnh ngắn tới khi xong; mã thoát khác 0 thì báo kèm log. */
function runTask(command, args, { cwd, env, logName, hint }) {
  return new Promise((resolve, reject) => {
    const child = spawnLogged(command, args, { cwd, env, logName });
    child.on("error", (error) => reject(new DemoError(`Không chạy được ${command}: ${error.message}`, hint, logPath(logName))));
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new DemoError(`${[command, ...args].join(" ")} thoát với mã ${code}.`, hint, logPath(logName)));
    });
  });
}

function killTree(child) {
  if (child.pid === undefined || child.exitCode !== null || child.signalCode !== null) return;
  if (IS_WINDOWS) {
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    return;
  }
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    try {
      child.kill("SIGTERM");
    } catch {
      // đã thoát
    }
  }
}

function killTreeHard(child) {
  if (IS_WINDOWS || child.pid === undefined || child.exitCode !== null || child.signalCode !== null) return;
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch {
    // đã thoát
  }
}

async function shutdown(exitCode) {
  if (shuttingDown) return;
  shuttingDown = true;
  const running = [...children];
  running.forEach(killTree);
  const deadline = Date.now() + 5000;
  while (running.some((c) => c.exitCode === null && c.signalCode === null) && Date.now() < deadline) {
    await sleep(100);
  }
  running.forEach(killTreeHard);
  process.exit(exitCode);
}

process.on("exit", () => {
  for (const child of children) {
    killTree(child);
    killTreeHard(child);
  }
});

function fail(error) {
  console.error("");
  if (error instanceof DemoError) {
    console.error(`LỖI: ${error.message}`);
    console.error(`Cách sửa: ${error.hint}`);
    if (error.logFile) {
      console.error(`\n--- 30 dòng cuối của ${error.logFile} ---\n${tailLog(error.logFile)}\n---`);
    }
  } else {
    console.error(`LỖI không lường trước: ${error instanceof Error ? error.stack : String(error)}`);
  }
  if (children.size > 0) console.error("Đang tắt các tiến trình đã bật...");
  void shutdown(1);
}

// ---------------------------------------------------------------------------
// Đọc .env (KEY=VALUE, bỏ dòng chú thích); không in giá trị
// ---------------------------------------------------------------------------
function readEnvFile(file) {
  if (!fs.existsSync(file)) return null;
  const env = new Map();
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!match || line.trimStart().startsWith("#")) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env.set(match[1], value);
  }
  return env;
}

// ---------------------------------------------------------------------------
// Bước 1: kiểm trước, không bật gì
// ---------------------------------------------------------------------------
function checkNode() {
  const major = Number(process.versions.node.split(".")[0]);
  if (major < 22) {
    throw new DemoError(`Node ${process.versions.node} quá cũ.`, "Hãy cài Node 22 trở lên rồi chạy lại.");
  }
}

function checkDocker() {
  const info = spawnSync("docker", ["info", "--format", "{{.ServerVersion}}"], { encoding: "utf8", windowsHide: true });
  if (info.error && info.error.code === "ENOENT") {
    throw new DemoError("Không tìm thấy lệnh docker.", "Hãy cài Docker Desktop rồi chạy lại.");
  }
  if (info.status !== 0) {
    throw new DemoError("Docker daemon chưa chạy.", "Hãy mở Docker Desktop rồi chạy lại.");
  }
  const compose = spawnSync("docker", ["compose", "version"], { encoding: "utf8", windowsHide: true });
  if (compose.status !== 0) {
    throw new DemoError("Không có lệnh docker compose.", "Hãy cập nhật Docker Desktop để có docker compose rồi chạy lại.");
  }
}

/** Cổng bận nếu không listen được hoặc đã có tiến trình nhận kết nối ở IPv4/IPv6. */
function portIsFree(port) {
  const canListen = new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.listen({ port, exclusive: true }, () => server.close(() => resolve(true)));
  });
  const accepts = (host) =>
    new Promise((resolve) => {
      const socket = net.connect({ port, host });
      socket.setTimeout(500);
      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.once("timeout", () => {
        socket.destroy();
        resolve(false);
      });
      socket.once("error", () => resolve(false));
    });
  return Promise.all([canListen, accepts("127.0.0.1"), accepts("::1")]).then(
    ([listen, v4, v6]) => listen && !v4 && !v6,
  );
}

async function checkPorts() {
  for (const port of Object.values(PORTS)) {
    if (!(await portIsFree(port))) {
      throw new DemoError(
        `Cổng ${port} đang bị chiếm.`,
        `Cổng ${port} đang bị chiếm, hãy tắt cửa sổ demo cũ hoặc tiến trình đang dùng cổng này.`,
      );
    }
  }
}

function checkInstalled() {
  for (const [name, dir] of [
    ["course-service", DIRS.course],
    ["learning-service", DIRS.learning],
    ["frontend", DIRS.frontend],
  ]) {
    if (!fs.existsSync(path.join(dir, "node_modules"))) {
      throw new DemoError(`${name} chưa có node_modules.`, `Hãy chạy npm install trong ${path.relative(ROOT, dir)} rồi chạy lại.`);
    }
  }
  if (!fs.existsSync(path.join(DIRS.tsCommon, "dist", "index.js"))) {
    throw new DemoError("libraries/ts-common chưa build.", "Hãy chạy npm install rồi npm run build trong libraries/ts-common rồi chạy lại.");
  }
  for (const [name, dir] of [
    ["course-service", DIRS.course],
    ["learning-service", DIRS.learning],
  ]) {
    if (!fs.existsSync(path.join(dir, "generated", "prisma", "client.ts"))) {
      throw new DemoError(`Prisma client của ${name} chưa generate.`, `Hãy chạy npm run prisma:generate trong ${path.relative(ROOT, dir)} rồi chạy lại.`);
    }
  }
}

/** Biến bắt buộc và khóa nội bộ trùng nhau ở cả ba nơi; không in giá trị. */
function checkEnv() {
  const files = {
    course: path.join(DIRS.course, ".env"),
    learning: path.join(DIRS.learning, ".env"),
    frontend: path.join(DIRS.frontend, ".env.development.local"),
  };
  const course = readEnvFile(files.course);
  const learning = readEnvFile(files.learning);
  const frontend = readEnvFile(files.frontend);
  const rel = (file) => path.relative(ROOT, file);

  if (!course) throw new DemoError(`Thiếu ${rel(files.course)}.`, `Hãy chép ${rel(files.course)}.example thành ${rel(files.course)} rồi chạy lại.`);
  if (!learning) throw new DemoError(`Thiếu ${rel(files.learning)}.`, `Hãy chép ${rel(files.learning)}.example thành ${rel(files.learning)} rồi chạy lại.`);
  if (!frontend) {
    throw new DemoError(
      `Thiếu ${rel(files.frontend)}.`,
      `Hãy tạo ${rel(files.frontend)} theo các biến DEV_* trong frontend/.env.example rồi chạy lại.`,
    );
  }

  const need = (env, file, name, expected) => {
    const value = env.get(name);
    if (!value) throw new DemoError(`${rel(file)} thiếu ${name}.`, `Hãy đặt ${name} trong ${rel(file)} rồi chạy lại.`);
    if (expected !== undefined && value !== expected) {
      throw new DemoError(`${name} trong ${rel(file)} phải là ${expected}.`, `Hãy sửa ${name}=${expected} trong ${rel(file)} rồi chạy lại.`);
    }
    return value;
  };

  need(course, files.course, "PORT", String(PORTS.course));
  need(course, files.course, "DATABASE_URL");
  need(course, files.course, "TENANT_SERVICE_URL");
  need(course, files.course, "LEARNING_SERVICE_URL", `http://localhost:${PORTS.learning}`);
  const courseKey = need(course, files.course, "INTERNAL_SERVICE_KEY");

  need(learning, files.learning, "PORT", String(PORTS.learning));
  need(learning, files.learning, "DATABASE_URL");
  const learningKey = need(learning, files.learning, "INTERNAL_SERVICE_KEY");
  const courseUrl = need(learning, files.learning, "COURSE_SERVICE_URL");
  if (!new RegExp(`^https?://(localhost|127\\.0\\.0\\.1):${PORTS.course}/?$`).test(courseUrl)) {
    throw new DemoError(
      `COURSE_SERVICE_URL trong ${rel(files.learning)} không trỏ tới course-service local.`,
      `Hãy đặt COURSE_SERVICE_URL=http://localhost:${PORTS.course} trong ${rel(files.learning)} rồi chạy lại.`,
    );
  }
  need(learning, files.learning, "TENANT_CLIENT_MODE", "fake");
  need(learning, files.learning, "TENANT_FAKE_TIMEZONE");
  need(learning, files.learning, "TENANT_SERVICE_URL");

  need(frontend, files.frontend, "DEV_IDENTITY_PROXY", "1");
  need(frontend, files.frontend, "VITE_DEV_IDENTITY_PROXY", "1");
  for (const name of ["VITE_TENANT_BACKEND_URL", "VITE_COURSE_BACKEND_URL", "VITE_ASSESSMENT_BACKEND_URL"]) {
    need(frontend, files.frontend, name);
  }
  const frontendKey = need(frontend, files.frontend, "DEV_INTERNAL_SERVICE_KEY");

  if (courseKey !== learningKey) {
    throw new DemoError(
      "INTERNAL_SERVICE_KEY của course-service và learning-service khác nhau.",
      "Hãy đặt cùng một INTERNAL_SERVICE_KEY trong .env của hai service rồi chạy lại.",
    );
  }
  if (frontendKey !== learningKey) {
    throw new DemoError(
      "DEV_INTERNAL_SERVICE_KEY của frontend khác INTERNAL_SERVICE_KEY của hai service.",
      `Hãy chép INTERNAL_SERVICE_KEY của services/learning-service/.env vào DEV_INTERNAL_SERVICE_KEY trong ${rel(files.frontend)} rồi chạy lại.`,
    );
  }
  for (const name of ["DEV_COURSE_SERVICE_URL", "DEV_LEARNING_SERVICE_URL"]) {
    if (frontend.get(name) && !/^https?:\/\/(localhost|127\.0\.0\.1):\d+\/?$/.test(frontend.get(name))) {
      throw new DemoError(`${name} trong ${rel(files.frontend)} không phải địa chỉ local.`, `Hãy xóa ${name} khỏi ${rel(files.frontend)} để dùng mặc định rồi chạy lại.`);
    }
  }
  return { internalKey: learningKey };
}

function checkNodeEnv() {
  if (process.env.NODE_ENV === "production") {
    throw new DemoError("NODE_ENV=production.", "Hãy bỏ biến NODE_ENV=production trong cửa sổ này rồi chạy lại; demo chỉ chạy ở môi trường dev.");
  }
}

// ---------------------------------------------------------------------------
// HTTP và chờ
// ---------------------------------------------------------------------------
function learnerHeaders(internalKey) {
  return {
    "x-internal-key": internalKey,
    "x-user-id": LEARNER_1.userId,
    "x-organization-id": LEARNER_1.organizationId,
    "x-user-role": "LEARNER",
  };
}

async function getJson(url, headers = {}) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(5000) });
  const text = await response.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    // không phải JSON
  }
  return { status: response.status, body };
}

/** Chờ tới khi check() trả true; tiến trình con thoát sớm thì báo ngay. */
async function waitUntil(check, { timeoutMs, child, what, hint, logFile }) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "";
  while (Date.now() < deadline) {
    if (child && (child.exitCode !== null || child.signalCode !== null)) {
      throw new DemoError(`${what} đã dừng trước khi sẵn sàng (mã ${child.exitCode ?? child.signalCode}).`, hint, logFile);
    }
    try {
      if (await check()) return;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await sleep(1000);
  }
  throw new DemoError(`${what} chưa sẵn sàng sau ${Math.round(timeoutMs / 1000)} giây${lastError ? ` (${lastError})` : ""}.`, hint, logFile);
}

/** Dịch vụ chạy lâu: dừng bất ngờ sau khi đã sẵn sàng thì tắt toàn bộ và báo. */
function watchService(child, name) {
  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    fail(new DemoError(`${name} đã dừng bất ngờ (mã ${code ?? signal}).`, "Xem log bên dưới, sửa lỗi rồi chạy lại lệnh demo.", logPath(name)));
  });
}

// ---------------------------------------------------------------------------
// Các bước
// ---------------------------------------------------------------------------
async function preflight() {
  checkNode();
  checkNodeEnv();
  checkDocker();
  await checkPorts();
  checkInstalled();
  return checkEnv();
}

async function startPostgres() {
  await runTask("docker", ["compose", "up", "-d", POSTGRES_SERVICE], {
    cwd: ROOT,
    logName: "postgres",
    hint: "Hãy kiểm Docker Desktop đang chạy và docker-compose.yml ở thư mục gốc rồi chạy lại.",
  });
  await waitUntil(
    async () =>
      spawnSync("docker", ["exec", POSTGRES_CONTAINER, "pg_isready", "-U", "postgres"], { stdio: "ignore", windowsHide: true }).status === 0,
    {
      timeoutMs: 60_000,
      what: "postgres",
      hint: `Hãy xem docker logs ${POSTGRES_CONTAINER}, sửa lỗi rồi chạy lại.`,
      logFile: logPath("postgres"),
    },
  );
}

async function migrate() {
  for (const [name, dir] of [
    ["course", DIRS.course],
    ["learning", DIRS.learning],
  ]) {
    await runTask("npx", ["prisma", "migrate", "deploy"], {
      cwd: dir,
      logName: `${name}-migrate`,
      hint: `Hãy xem log migrate của ${name}-service; kiểm DATABASE_URL và database đã được tạo trong postgres rồi chạy lại.`,
    });
  }
}

async function seedBase() {
  await runTask("npm", ["run", "prisma:seed"], {
    cwd: DIRS.course,
    logName: "course-seed",
    hint: "Hãy xem log seed của course-service, sửa lỗi rồi chạy lại.",
  });
  // platform_settings (video_completion_percent) mà seed:demo và UC25.3 cần
  await runTask("npm", ["run", "db:seed"], {
    cwd: DIRS.learning,
    logName: "learning-seed",
    hint: "Hãy xem log seed của learning-service, sửa lỗi rồi chạy lại.",
  });
}

async function startService(name, dir, port, probePath, internalKey) {
  await runTask("npm", ["run", "build"], {
    cwd: dir,
    logName: `${name}-build`,
    hint: `Hãy chạy npm run build trong ${path.relative(ROOT, dir)} để xem lỗi biên dịch rồi chạy lại.`,
  });
  // Chạy bản build, không watch: không tự khởi động lại giữa demo
  const child = spawnLogged(process.execPath, [path.join("dist", "src", "main.js")], {
    cwd: dir,
    env: name === "learning-service" ? ASSESSMENT_DEMO_ENV : undefined,
    logName: name,
    longRunning: true,
  });
  await waitUntil(
    async () => {
      const { status } = await getJson(`http://localhost:${port}${probePath}`, learnerHeaders(internalKey));
      if (status !== 200) throw new Error(`HTTP ${status}`);
      return true;
    },
    {
      timeoutMs: 90_000,
      child,
      what: name,
      hint: `Hãy xem log ${name} bên dưới, sửa lỗi rồi chạy lại.`,
      logFile: logPath(name),
    },
  );
  watchService(child, name);
}

async function seedDemo() {
  await runTask("npm", ["run", "demo:reset"], {
    cwd: DIRS.learning,
    logName: "learning-demo-reset",
    hint: "Hãy xem log demo:reset, sửa lỗi rồi chạy lại.",
  });
  await runTask("npm", ["run", "seed:demo"], {
    cwd: DIRS.learning,
    env: ASSESSMENT_DEMO_ENV,
    logName: "learning-seed-demo",
    hint: "Hãy xem log seed:demo; nếu có xung đột ID fixture thì kiểm tra trước khi chạy lại.",
  });
  const summary = fs
    .readFileSync(logPath("learning-demo-reset"), "utf8")
    .split(/\r?\n/)
    .find((line) => line.startsWith("demo:reset Course 03"));
  if (summary) detail(summary);
}

async function startFrontend() {
  const child = spawnLogged(process.execPath, [path.join("node_modules", "vite", "bin", "vite.js"), "--strictPort"], {
    cwd: DIRS.frontend,
    env: { DEV_PROXY_LEARNER: "LEARNER_1" },
    logName: "frontend",
    longRunning: true,
  });
  await waitUntil(
    async () => {
      const { status, body } = await getJson(`http://localhost:${PORTS.frontend}/api/v1/courses/catalog?page=1`);
      if (status !== 200) throw new Error(`HTTP ${status}`);
      if (body?.data?.meta?.total !== 2) throw new Error(`danh mục có ${body?.data?.meta?.total} Course, cần 2`);
      return true;
    },
    {
      timeoutMs: 90_000,
      child,
      what: "frontend (proxy danh tính)",
      hint: "Hãy xem log frontend; kiểm frontend/.env.development.local rồi chạy lại.",
      logFile: logPath("frontend"),
    },
  );
  watchService(child, "frontend");
}

async function finalChecks() {
  const base = `http://localhost:${PORTS.frontend}/api/v1`;
  const hint = "Dữ liệu demo không đúng trạng thái đầu; hãy xem log seed:demo và demo:reset rồi chạy lại.";

  const mine = await getJson(`${base}/enrollments/me?page=1`);
  const ids = mine.body?.data?.items?.map((item) => item.enrollmentId) ?? [];
  if (mine.status !== 200 || ids.length !== 2 || ids[0] !== E_DEMO_2 || ids[1] !== E_DEMO_1) {
    throw new DemoError(`Course của tôi (LEARNER_1) trả ${mine.status} với ${ids.length} dòng, cần đúng E-demo-2 rồi E-demo-1.`, hint, logPath("learning-seed-demo"));
  }

  const links = await getJson(`${base}/enrollments/me/course-ids`);
  if (links.status !== 200 || !Array.isArray(links.body?.data) || links.body.data.some((link) => link.courseId === COURSE_03)) {
    throw new DemoError("course-ids của LEARNER_1 vẫn có Course 03 (D47 chưa dọn).", hint, logPath("learning-demo-reset"));
  }

  const curriculum = await getJson(`${base}/enrollments/${E_DEMO_2}/curriculum`);
  const required = curriculum.body?.data?.requiredMaterials;
  if (curriculum.status !== 200 || required?.completed !== 2 || required?.total !== 6) {
    throw new DemoError(
      `Chương trình học E-demo-2 trả ${curriculum.status}, học liệu bắt buộc ${required ? `${required.completed}/${required.total}` : "?"}, cần 2/6.`,
      hint,
      logPath("learning-seed-demo"),
    );
  }
}

function printReady() {
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  const web = `http://localhost:${PORTS.frontend}`;
  const lines = [
    `Sẵn sàng demo (khởi động trong ${seconds} giây)`,
    "",
    `Danh mục Course:     ${web}/learner/catalog`,
    `Course của tôi:      ${web}/learner/courses`,
    `Chương trình học:    ${web}/learner/courses/${E_DEMO_2}`,
    `Lesson L11:          ${web}/learner/courses/${E_DEMO_2}/lessons/${L11}`,
    `Lesson L13:          ${web}/learner/courses/${E_DEMO_2}/lessons/${L13}`,
    "",
    `Log: ${LOG_DIR}`,
    "Nhấn Ctrl+C để tắt toàn bộ",
  ];
  // Không vẽ viền phải: URL dài, terminal hẹp sẽ làm vỡ khung
  const rule = "=".repeat(60);
  console.log(`\n${rule}\n${lines.map((line) => (line ? `  ${line}` : "")).join("\n")}\n${rule}`);
}

async function main() {
  process.on("SIGINT", () => {
    console.log("\nĐang tắt course-service, learning-service và frontend (postgres vẫn chạy)...");
    void shutdown(0);
  });
  process.on("SIGTERM", () => void shutdown(0));
  // Windows: Ctrl+Break; đóng cửa sổ terminal gửi SIGHUP
  process.on("SIGBREAK", () => void shutdown(0));
  process.on("SIGHUP", () => void shutdown(0));

  step(1, "Kiểm môi trường (Node, Docker, cổng, node_modules, ts-common, Prisma client, biến môi trường)");
  const { internalKey } = await preflight();
  if (CHECK_ONLY) {
    console.log("Kiểm trước: đạt.");
    return;
  }

  step(2, `Bật postgres (docker compose up -d ${POSTGRES_SERVICE})`);
  await startPostgres();

  step(3, "Migrate course_db và learning_db (prisma migrate deploy)");
  await migrate();

  step(4, "Seed dữ liệu nền (course prisma:seed, learning db:seed)");
  await seedBase();

  step(5, `Build và bật course-service (cổng ${PORTS.course})`);
  await startService("course-service", DIRS.course, PORTS.course, "/api/v1/courses/catalog?page=1", internalKey);

  step(6, `Build và bật learning-service (cổng ${PORTS.learning})`);
  await startService("learning-service", DIRS.learning, PORTS.learning, "/api/v1/enrollments/me?page=1", internalKey);

  step(7, "Seed demo (seed:demo) và dọn Enrollment Course 03 (demo:reset)");
  await seedDemo();

  step(8, `Bật frontend dev server (cổng ${PORTS.frontend}, danh tính LEARNER_1)`);
  await startFrontend();

  step(9, "Kiểm dữ liệu demo qua proxy");
  await finalChecks();

  step(10, "Xong");
  printReady();
}

main().catch(fail);

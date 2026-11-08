import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react-swc";
import { createServer, type ViteDevServer } from "vite";
import { expect, it } from "vitest";

const root = fileURLToPath(new URL("../", import.meta.url));
const route = "/learner/courses";
const courseName = "Lập trình ứng dụng".repeat(8);
const longQuery = "Tìm theo tên Khóa học ".repeat(7).trim();
const entry = [
  'import { createRoot } from "react-dom/client";',
  'import { App } from "antd";',
  'import { BrowserRouter } from "react-router-dom";',
  'import MyCourses from "/src/pages/learner/my.courses.tsx";',
  'import "/src/styles/global.scss";',
  'createRoot(document.getElementById("root")).render(<App><BrowserRouter><MyCourses /></BrowserRouter></App>);',
].join("\n");

const delay = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));

function connect(socket: WebSocket) {
  let sequence = 0;
  const pending = new Map<number, (message: { result?: unknown; error?: unknown }) => void>();
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(String(data)) as { id: number; result?: unknown; error?: unknown };
    pending.get(message.id)?.(message);
  });
  return <T>(method: string, params: Record<string, unknown> = {}) =>
    new Promise<T>((done, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error("Chrome timed out on " + method));
      }, 15000);
      pending.set(id, ({ result, error }) => {
        clearTimeout(timer);
        pending.delete(id);
        if (error) reject(new Error(method + " failed: " + JSON.stringify(error)));
        else done(result as T);
      });
      socket.send(JSON.stringify({ id, method, params }));
    });
}

it.skipIf(process.env.LEARNUP_RECOVERY_BROWSER_TESTS !== "1")(
  "keeps My Courses filter rects stable across states and fits two narrow viewports",
  { timeout: 120000 },
  async () => {
    const chromePath = process.env.CHROME_PATH ?? [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      "/usr/bin/chromium",
      "/usr/bin/google-chrome",
    ].find(existsSync);
    if (!chromePath) throw new Error("Installed Chromium required");

    const temp = resolve(tmpdir());
    const profile = await mkdtemp(join(temp, "learnup-my-courses-browser-"));
    if (dirname(resolve(profile)) !== temp) throw new Error("Unexpected Chrome profile path");
    let vite: ViteDevServer | undefined;
    let chrome: ChildProcess | undefined;
    let socket: WebSocket | undefined;
    try {
      vite = await createServer({
        root,
        configFile: false,
        cacheDir: join(profile, "vite-cache"),
        logLevel: "error",
        resolve: { alias: { "@": join(root, "src") } },
        define: {
          "import.meta.env.VITE_BACKEND_URL": '""',
          "import.meta.env.VITE_DEV_IDENTITY_PROXY": '"0"',
        },
        server: { host: "127.0.0.1", port: 0, hmr: false },
        css: { preprocessorOptions: { scss: { api: "modern-compiler" } } },
        plugins: [react(), {
          name: "my-courses-browser",
          resolveId: (id) => id === "virtual:my-courses-browser" ? "\0my-courses-browser.tsx" : null,
          load: (id) => id === "\0my-courses-browser.tsx" ? entry : null,
          configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
              const url = new URL(req.url ?? "/", "http://localhost");
              if (url.pathname === "/api/v1/enrollments/me") {
                const q = url.searchParams.get("q");
                const items = q === "không khớp" ? [] : [{
                  enrollmentId: "enrollment",
                  courseId: "course",
                  enrollmentType: "Required",
                  status: "InProgress",
                  dueAt: null,
                  dueTimezone: null,
                  requiredMaterials: { completed: 0, total: 1 },
                  course: { name: courseName, versionNumber: 1, coverFileId: null },
                }];
                res.setHeader("Content-Type", "application/json");
                if (q === "thử lại") {
                  res.statusCode = 503;
                  res.end(JSON.stringify({ error: { code: "SERVICE_UNAVAILABLE" } }));
                } else {
                  res.end(JSON.stringify({
                    data: { items, meta: { current: 1, pageSize: 20, pages: items.length, total: items.length } },
                  }));
                }
              } else if (url.pathname === route) {
                res.setHeader("Content-Type", "text/html; charset=utf-8");
                res.end(await server.transformIndexHtml(route,
                  '<!doctype html><html lang="vi"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/@id/virtual:my-courses-browser"></script></body></html>',
                ));
              } else next();
            });
          },
        }],
      });
      await vite.listen();
      const address = vite.httpServer?.address();
      if (!address || typeof address === "string") throw new Error("Vite port unavailable");
      const origin = "http://127.0.0.1:" + address.port;
      chrome = spawn(chromePath, [
        "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
        "--disable-background-networking", "--remote-debugging-port=0",
        "--host-resolver-rules=MAP fonts.googleapis.com ~NOTFOUND, MAP fonts.gstatic.com ~NOTFOUND",
        "--user-data-dir=" + profile, "about:blank",
      ], { stdio: "ignore", windowsHide: true });
      let port = "";
      for (let i = 0; i < 150 && !port; i++) {
        try { port = (await readFile(join(profile, "DevToolsActivePort"), "utf8")).split(/\r?\n/)[0]; }
        catch { await delay(100); }
      }
      if (!port) throw new Error("Chrome debugging port unavailable");
      const targets = await fetch("http://127.0.0.1:" + port + "/json/list").then(
        (response) => response.json() as Promise<{ type: string; webSocketDebuggerUrl: string }[]>,
      );
      const page = targets.find((target) => target.type === "page");
      if (!page) throw new Error("Chrome page target unavailable");
      socket = new WebSocket(page.webSocketDebuggerUrl);
      await new Promise<void>((done, reject) => {
        socket?.addEventListener("open", () => done(), { once: true });
        socket?.addEventListener("error", reject, { once: true });
      });
      const call = connect(socket);
      const evaluate = async <T>(expression: string): Promise<T> => {
        const response = await call<{ result: { value: T }; exceptionDetails?: unknown }>(
          "Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true },
        );
        if (response.exceptionDetails) throw new Error("Browser evaluation failed");
        return response.result.value;
      };
      const layout = async (filters: Record<string, string>, width: number, expected = courseName) => {
        await call("Emulation.setDeviceMetricsOverride", {
          width, height: 844, deviceScaleFactor: 1, mobile: width < 500,
        });
        const search = "?" + new URLSearchParams({ ...filters, page: "1" });
        await call("Page.navigate", { url: origin + route + search });
        const ready = "location.search === " + JSON.stringify(search) +
          " && !!document.body && document.body.innerText.includes(" + JSON.stringify(expected) + ")";
        const deadline = Date.now() + 15000;
        while (!(await evaluate<boolean>(ready))) {
          if (Date.now() >= deadline) throw new Error("My Courses did not settle for " + search);
          await delay(50);
        }
        return evaluate<{ rects: number[][]; scrollWidth: number; clientWidth: number }>(
          "(async () => { await document.fonts.ready; " +
          "const controls = document.querySelectorAll('.learner-my-course-filters > *'); " +
          "return { rects: [...controls].map(el => { const { x, y, width, height } = el.getBoundingClientRect(); return [x, y, width, height]; }), " +
          "scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }; })()",
        );
      };
      const defaultState = await layout({}, 1280);
      expect(defaultState.rects).toHaveLength(3);
      const applied = { q: "lap trinh", type: "Required", status: "InProgress" };
      for (const [filters, expected] of [
        [applied, courseName],
        [{ q: applied.q, status: applied.status }, courseName],
        [{ q: applied.q, type: applied.type }, courseName],
        [{ ...applied, q: "không khớp" }, "Không tìm thấy Khóa học phù hợp"],
        [{ ...applied, q: "thử lại" }, "Thử lại"],
      ] as const) {
        expect((await layout(filters, 1280, expected)).rects, JSON.stringify(filters)).toEqual(defaultState.rects);
      }
      for (const width of [390, 320]) {
        const measured = await layout({ q: longQuery }, width);
        expect(measured.clientWidth).toBe(width);
        expect(measured.scrollWidth).toBe(width);
        const [search, type, status] = measured.rects;
        expect(search[1]).toBeLessThan(type[1]);
        expect(status[1]).toBe(type[1]);
        expect(status[0]).toBeGreaterThan(type[0]);
      }
      expect(await evaluate<boolean>(
        "(() => { const label = document.querySelector('.learner-my-course-filters .ant-select-selection-item'); " +
        "label.textContent = label.textContent.repeat(5); return label.scrollWidth > label.clientWidth " +
        "&& getComputedStyle(label).textOverflow === 'ellipsis' && document.documentElement.scrollWidth === 320; })()",
      )).toBe(true);
    } finally {
      socket?.close();
      if (chrome && chrome.exitCode === null && chrome.signalCode === null) {
        const exited = new Promise<void>((done) => chrome?.once("exit", () => done()));
        chrome.kill();
        await Promise.race([exited, delay(5000)]);
      }
      await vite?.close();
      await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    }
  },
);

import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer, type Server, type ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react-swc";
import { createServer as createViteServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

// Real Reading React screen + Axios, isolated Gateway stub and owned Chromium profile.
const enabled = process.env.LEARNUP_RECOVERY_BROWSER_TESTS === "1";
const root = fileURLToPath(new URL("../", import.meta.url));
const prefix = "learnup-reading-browser-";
const owner = {
  id: "reading-browser-learner",
  organizationId: "reading-browser-org",
};
const jwt = `h.${Buffer.from(JSON.stringify({ sub: owner.id, organizationId: owner.organizationId, exp: 9_999_999_999 })).toString("base64url")}.s`;
const delay = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));
describe.skipIf(!enabled)("UC27.3 Reading browser", { timeout: 45000 }, () => {
  let gateway: Server,
    vite: ViteDevServer,
    chrome: ChildProcess,
    socket: WebSocket;
  let profile = "",
    front = "",
    origin = "",
    sequence = 0;
  let completed = false,
    status = "InProgress",
    hold = false,
    failure = false;
  let posts = 0,
    lessonReads = 0,
    enrollmentReads = 0;
  let failedRequests = 0;
  const held: ServerResponse[] = [];
  const pending = new Map<
    number,
    {
      resolve: (result: unknown) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  const call = <T = unknown>(
    method: string,
    params: Record<string, unknown> = {},
  ): Promise<T> =>
    new Promise((done, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error("Browser protocol timeout"));
      }, 15000);
      pending.set(id, { resolve: (r) => done(r as T), reject, timer });
      socket.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async <T = unknown>(expression: string) => {
    const r = await call<{ result: { value: T }; exceptionDetails?: unknown }>(
      "Runtime.evaluate",
      { expression, awaitPromise: true, returnByValue: true },
    );
    if (r.exceptionDetails)
      throw new Error("Reading browser evaluation failed");
    return r.result.value;
  };
  const waitFor = async (expression: string) => {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      if (await evaluate<boolean>(expression)) return;
      await delay(30);
    }
    throw new Error("Reading screen condition timed out: " + expression);
  };
  const reply = (res: ServerResponse, data: unknown, code = 200) => {
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ statusCode: code, data }));
  };
  const completion = () => ({
    materialId: "m",
    completedAt: completed ? "2026-10-24T00:00:00.000Z" : null,
    alreadyCompleted: false,
    lessonCompleted: completed,
    enrollmentStatus: status,
    completionEvaluationPending: true,
  });
  beforeAll(async () => {
    const executable =
      process.env.CHROME_PATH ??
      [
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      ].find(existsSync);
    if (!executable) throw new Error("Installed Chromium required");
    profile = await mkdtemp(join(tmpdir(), prefix));
    gateway = createServer(async (req, res) => {
      res.setHeader("Access-Control-Allow-Origin", front);
      res.setHeader(
        "Access-Control-Allow-Headers",
        "content-type,authorization",
      );
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      if (req.url?.endsWith("/complete-reading")) {
        posts++;
        expect(Buffer.concat(chunks).toString()).toBe("");
        if (failure) {
          res.destroy();
          return;
        }
        if (hold) {
          held.push(res);
          return;
        }
        if (status !== "Completed") completed = true;
        reply(res, completion());
        return;
      }
      if (req.url?.endsWith("/reading-access")) {
        reply(res, {
          materialId: "m",
          title: "Reading",
          accessUrl: "https://example.test/fixture.pdf",
          fixture: true,
        });
        return;
      }
      if (req.url?.endsWith("/curriculum")) {
        enrollmentReads++;
        reply(res, { enrollmentId: "e", courseId: "c", status, modules: [] });
        return;
      }
      if (req.url?.endsWith("/lessons/l")) {
        lessonReads++;
        reply(res, {
          enrollmentId: "e",
          lesson: {
            lessonId: "l",
            title: "Lesson",
            content: null,
            completed,
            isRequired: true,
          },
          materials: [
            {
              materialId: "m",
              title: "Reading",
              materialType: "Reading",
              isRequired: true,
              completed,
              durationSeconds: null,
            },
          ],
          previousLesson: null,
          nextLesson: null,
        });
        return;
      }
      reply(res, {}, 404);
    });
    await new Promise<void>((done) => gateway.listen(0, "127.0.0.1", done));
    const address = gateway.address();
    if (!address || typeof address === "string")
      throw new Error("Gateway port unavailable");
    origin = `http://127.0.0.1:${address.port}`;
    vite = await createViteServer({
      root,
      configFile: false,
      cacheDir: join(profile, "vite-cache"),
      logLevel: "error",
      plugins: [
        react(),
        {
          name: "reading-browser-entry",
          resolveId: (id) =>
            id === "virtual:reading-browser" ? "\0reading-browser.tsx" : null,
          load: (id) =>
            id === "\0reading-browser.tsx"
              ? `import React from 'react'; import {createRoot} from 'react-dom/client';
          import {MemoryRouter,Routes,Route} from 'react-router-dom'; import Resource from '/src/pages/learner/lesson.resource.tsx';
          createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={['/learner/courses/e/lessons/l/resources/m']}><Routes><Route path='/learner/courses/:enrollmentId/lessons/:lessonId/resources/:resourceId' element={<Resource/>}/></Routes></MemoryRouter>);`
              : null,
          transform: (code, id) =>
            id.includes("app.context.tsx")
              ? `export const useCurrentApp = () => ({user:${JSON.stringify(owner)}});`
              : code,
          configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
              if (req.url !== "/reading-browser") {
                next();
                return;
              }
              res.setHeader("Content-Type", "text/html");
              res.end(
                await server.transformIndexHtml(
                  "/reading-browser",
                  '<html><head></head><body><div id="root"></div><script type="module" src="/@id/virtual:reading-browser"></script></body></html>',
                ),
              );
            });
          },
        },
      ],
      resolve: { alias: { "@": join(root, "src") } },
      define: {
        "import.meta.env.VITE_BACKEND_URL": JSON.stringify(origin),
        "import.meta.env.VITE_DEV_IDENTITY_PROXY": '"0"',
      },
      server: { host: "127.0.0.1", port: 0, hmr: false },
      css: { preprocessorOptions: { scss: { api: "modern-compiler" } } },
    });
    await vite.listen();
    const va = vite.httpServer!.address();
    if (!va || typeof va === "string") throw new Error("Vite port unavailable");
    front = `http://127.0.0.1:${va.port}`;
    chrome = spawn(
      executable,
      [
        "--headless=new",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-background-networking",
        "--remote-debugging-address=127.0.0.1",
        "--remote-debugging-port=0",
        `--user-data-dir=${profile}`,
        "about:blank",
      ],
      { stdio: "ignore", windowsHide: true },
    );
    let port = "";
    const deadline = Date.now() + 15000;
    while (!port && Date.now() < deadline) {
      try {
        port = (
          await readFile(join(profile, "DevToolsActivePort"), "utf8")
        ).split(/\r?\n/)[0];
      } catch {
        await delay(100);
      }
    }
    const targets = (await fetch(`http://127.0.0.1:${port}/json/list`).then(
      (r) => r.json(),
    )) as { type: string; webSocketDebuggerUrl: string }[];
    socket = new WebSocket(
      targets.find((t) => t.type === "page")!.webSocketDebuggerUrl,
    );
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      const p = pending.get(message.id);
      if (p) {
        clearTimeout(p.timer);
        pending.delete(message.id);
        if (message.error) p.reject(new Error("Browser command failed"));
        else p.resolve(message.result);
      }
      if (message.method === "Fetch.requestPaused") {
        const { requestId, request } = message.params;
        if (failure && request.url.endsWith("/complete-reading")) {
          failedRequests++;
          void call("Fetch.failRequest", {
            requestId,
            errorReason: "ConnectionFailed",
          });
        } else void call("Fetch.continueRequest", { requestId });
      }
    });
    await new Promise<void>((done) =>
      socket.addEventListener("open", () => done(), { once: true }),
    );
    await call("Page.enable");
    await call("Runtime.enable");
    await call("Fetch.enable", {
      patterns: [{ urlPattern: "*", requestStage: "Request" }],
    });
    await call("Page.addScriptToEvaluateOnNewDocument", {
      source: `localStorage.setItem('access_token',${JSON.stringify(jwt)});`,
    });
  }, 120000);
  beforeEach(async () => {
    completed = false;
    status = "InProgress";
    hold = false;
    failure = false;
    posts = 0;
    lessonReads = 0;
    enrollmentReads = 0;
    failedRequests = 0;
    await call("Page.navigate", { url: front + "/reading-browser" });
    await waitFor(
      "!!document.querySelector('.reading-resource button.ant-btn-primary') && document.body.innerText.includes('fixture')",
    );
    await delay(100);
  });
  afterAll(async () => {
    held.splice(0).forEach((r) => r.destroy());
    if (socket?.readyState === WebSocket.OPEN) {
      await call("Browser.close").catch(() => undefined);
      socket.close();
    }
    for (const p of pending.values()) clearTimeout(p.timer);
    pending.clear();
    if (chrome && chrome.exitCode === null) {
      await delay(500);
      if (chrome.exitCode === null) chrome.kill();
    }
    await vite?.close();
    gateway?.closeAllConnections();
    if (gateway) await new Promise<void>((done) => gateway.close(() => done()));
    if (profile) {
      if (
        dirname(resolve(profile)) !== resolve(tmpdir()) ||
        !basename(profile).startsWith(prefix)
      )
        throw new Error("Unexpected browser profile path");
      await rm(profile, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 100,
      });
    }
  }, 30000);
  const click = () =>
    evaluate(
      "document.querySelector('.reading-resource button.ant-btn-primary').click()",
    );
  it("blocks double click, marks once, shows immutable completion and refreshes Enrollment at most three delayed times", async () => {
    hold = true;
    await evaluate(
      "const b=document.querySelector('.reading-resource button.ant-btn-primary'); b.click(); b.click();",
    );
    await waitFor("!!document.querySelector('.ant-btn-loading')");
    await delay(100);
    expect(posts).toBe(1);
    completed = true;
    hold = false;
    held.splice(0).forEach((r) => reply(r, completion()));
    await waitFor(
      "document.querySelector('.reading-resource button.ant-btn-primary').disabled && document.body.innerText.includes('Đã hoàn thành')",
    );
    const initialReads = enrollmentReads;
    await delay(6500);
    expect(enrollmentReads - initialReads).toBe(3);
    expect(posts).toBe(1);
    expect(
      await evaluate(
        "Array.from(document.querySelectorAll('button')).some(b=>/bỏ đánh dấu/i.test(b.textContent))",
      ),
    ).toBe(false);
    await click();
    expect(posts).toBe(1);
  });
  it("network failure remains unconfirmed and can be retried without a persistent queue", async () => {
    failure = true;
    await click();
    await waitFor(
      "document.body.innerText.includes('Chưa xác nhận') && !document.querySelector('.ant-btn-loading')",
    );
    expect(
      await evaluate(
        "document.querySelector('.reading-resource button.ant-btn-primary').disabled",
      ),
    ).toBe(false);
    failure = false;
    await click();
    await waitFor(
      "document.querySelector('.reading-resource button.ant-btn-primary').disabled",
    );
    expect(failedRequests).toBe(1);
    expect(posts).toBe(1);
    expect(
      await evaluate<string>("JSON.stringify({...localStorage})"),
    ).not.toContain("reading-completion");
  });
  it("focus and visible events reconcile another tab's completion; Completed never offers a write", async () => {
    const before = lessonReads;
    completed = true;
    status = "Completed";
    await evaluate(
      "window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange'));",
    );
    await waitFor(
      "document.querySelector('.reading-resource button.ant-btn-primary').disabled && document.querySelector('[aria-label=\"Trạng thái Enrollment\"]').textContent.includes('Đã hoàn thành')",
    );
    expect(lessonReads).toBeGreaterThan(before);
    expect(posts).toBe(0);
  });
});

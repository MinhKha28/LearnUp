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

// Real Video React screen + Axios, isolated Gateway stub and owned Chromium profile.
// Prepare public/dev-media/uc27.2-sample.mp4 with the demo runner, or set LEARNUP_VIDEO_TEST_FILE.
const enabled = process.env.LEARNUP_RECOVERY_BROWSER_TESTS === "1";
const root = fileURLToPath(new URL("../", import.meta.url));
const prefix = "learnup-signed-video-browser-";
const owner = {
  id: "signed-video-browser-learner",
  organizationId: "signed-video-browser-org",
};
const jwt = `h.${Buffer.from(JSON.stringify({ sub: owner.id, organizationId: owner.organizationId, exp: 9_999_999_999 })).toString("base64url")}.s`;
const delay = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));
describe.skipIf(!enabled)("UC27.2 signed Video browser", { timeout: 45000 }, () => {
  let gateway: Server,
    vite: ViteDevServer,
    chrome: ChildProcess,
    socket: WebSocket;
  let profile = "",
    front = "",
    origin = "",
    sequence = 0;
  let completed = false, status = "InProgress";
  const held: ServerResponse[] = [];
  let playbackReads = 0, failMedia = 0, intercepted = 0;
  let closing = false;
  const interceptionCalls = new Set<Promise<unknown>>();
  const interceptionErrors: unknown[] = [];
  const intercept = (method: string, params: Record<string, unknown>) => {
    const operation = call(method, params).catch(error => {
      if (!(closing && error instanceof Error && error.message.includes("Fetch domain is not enabled"))) interceptionErrors.push(error);
    });
    interceptionCalls.add(operation);
    void operation.then(() => interceptionCalls.delete(operation));
  };
  let expired = false;
  let media: Buffer;
  const reports: { ranges: number[][]; positionSeconds: number }[] = [];
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
      throw new Error("Video browser evaluation failed: " + JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  const waitFor = async (expression: string) => {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      if (await evaluate<boolean>(expression)) return;
      await delay(30);
    }
    throw new Error("Video screen condition timed out: " + expression);
  };
  const reply = (res: ServerResponse, data: unknown, code = 200) => {
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ statusCode: code, data }));
  };
  beforeAll(async () => {
    const executable =
      process.env.CHROME_PATH ??
      [
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      ].find(existsSync);
    if (!executable) throw new Error("Installed Chromium required");
    profile = await mkdtemp(join(tmpdir(), prefix));
    media = await readFile(process.env.LEARNUP_VIDEO_TEST_FILE ?? join(root, 'public/dev-media/uc27.2-sample.mp4'));
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
      if (req.url?.startsWith('/media')) {
        const start = Number(req.headers.range?.match(/bytes=(\d+)/)?.[1] ?? 0);
        const end = Math.min(start + 65535, media.length - 1);
        res.writeHead(206, { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${media.length}`, 'Content-Length': end-start+1, 'Cache-Control': 'no-store' });
        res.end(media.subarray(start, end+1)); return;
      }
      const progress = { materialId: 'm', durationSeconds: 601, watchedRanges: [], watchedSeconds: 0, requiredSeconds: 541, completed: false, completedAt: null, positionSeconds: null, positionReportedAt: null, heartbeatSeconds: 15 };
      if (req.url?.endsWith('/playback')) {
        playbackReads++;
        reply(res, { ...progress, title: 'Video', playbackUrl: `${origin}/media?generation=${playbackReads}`, expiresAt: new Date(Date.now() + (expired && playbackReads === 1 ? -1000 : playbackReads > 1 ? 1800000 : 900000)).toISOString(), mimeType: 'video/mp4' }); return;
      }
      if (req.url?.endsWith('/progress')) {
        reports.push(JSON.parse(Buffer.concat(chunks).toString()));
        reply(res, progress); return;
      }
      if (req.url?.endsWith("/curriculum")) {
        reply(res, { enrollmentId: "e", courseId: "c", status, modules: [] });
        return;
      }
      if (req.url?.endsWith("/lessons/l")) {
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
              materialType: "Video",
              isRequired: true,
              completed,
              durationSeconds: 601,
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
          name: "signed-video-browser-entry",
          resolveId: (id) =>
            id === "virtual:signed-video-browser" ? "\0signed-video-browser.tsx" : null,
          load: (id) =>
            id === "\0signed-video-browser.tsx"
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
              if (req.url !== "/signed-video-browser") {
                next();
                return;
              }
              res.setHeader("Content-Type", "text/html");
              res.end(
                await server.transformIndexHtml(
                  "/signed-video-browser",
                  '<html><head></head><body><div id="root"></div><script type="module" src="/@id/virtual:signed-video-browser"></script></body></html>',
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
        "--autoplay-policy=no-user-gesture-required",
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
        if (message.error) p.reject(new Error("Browser command failed: " + message.error.message));
        else p.resolve(message.result);
      }
      if (message.method === "Fetch.requestPaused") {
        const { requestId, request } = message.params;
        if (failMedia > 0 && request.url.includes('/media?')) {
          failMedia--; intercepted++;
          intercept('Fetch.fulfillRequest', { requestId, responseCode: 401, responseHeaders: [{ name: 'Content-Type', value: 'text/plain' }], body: Buffer.from('Stale request').toString('base64') });
        } else intercept('Fetch.continueRequest', { requestId });
      }
    });
    await new Promise<void>((done) =>
      socket.addEventListener("open", () => done(), { once: true }),
    );
    await call("Page.enable");
    await call("Runtime.enable");
    await call("Fetch.enable", {
      patterns: [{ urlPattern: "*/media?*", requestStage: "Request" }],
    });
    await call("Page.addScriptToEvaluateOnNewDocument", {
      source: `localStorage.setItem('access_token',${JSON.stringify(jwt)});`,
    });
  }, 120000);
  beforeEach(async () => {
    playbackReads = 0; failMedia = 0; intercepted = 0; expired = false; reports.length = 0;
    completed = false;
    status = "InProgress";
    await call("Page.navigate", { url: front + "/signed-video-browser" });
    await waitFor(
      "!!document.querySelector('video') && document.querySelector('video').readyState >= 1",
    );
    await evaluate("window.mediaEvents=[]; for(const type of ['error','stalled']) document.querySelector('video').addEventListener(type,()=>window.mediaEvents.push(type));");
    await delay(100);
  }, 30000);
  afterAll(async () => {
    closing = true;
    held.splice(0).forEach((r) => r.destroy());
    if (socket?.readyState === WebSocket.OPEN) {
      await call("Fetch.disable");
      await Promise.all(interceptionCalls);
      await call("Browser.close").catch(() => undefined);
      socket.close();
    }
    for (const p of pending.values()) clearTimeout(p.timer);
    pending.clear();
    if (chrome && chrome.exitCode === null) {
      await delay(500);
      if (chrome.exitCode === null) chrome.kill();
    }
    expect(interceptionErrors).toEqual([]);
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
  const play = () => evaluate("void document.querySelector('video').play().catch(()=>{})");
  const inject = async (count: number) => {
    failMedia = count;
    await call('Network.enable');
    await call('Network.setCacheDisabled', { cacheDisabled: true });
    await evaluate("document.querySelector('video').currentTime=500");
  };
  it('retries one native media error, restores position and playing state, and retains progress ranges', async () => {
    await play();
    await waitFor("document.querySelector('video').currentTime > 1.5");
    await inject(1);
    await waitFor("window.mediaEvents.includes('error') || window.mediaEvents.includes('stalled')");
    console.info('Mid-stream 401 Chrome events:', await evaluate('window.mediaEvents'));
    await waitFor("document.querySelector('video').currentTime >= 499 && !document.querySelector('video').paused && document.querySelector('video').readyState >= 3");
    expect(intercepted).toBe(1); expect(playbackReads).toBe(2);
    expect(await evaluate<number>("document.querySelector('video').currentTime")).toBeLessThan(502);
    await evaluate("document.querySelector('video').pause()");
    await delay(200);
    expect(reports.some(r => r.ranges.some(([start,end]) => start < 1 && end >= 1))).toBe(true);
    expect(reports.every(r => r.ranges.every(([start,end]) => !(start < 10 && end > 490)))).toBe(true);
  });
  it('stops after two consecutive failures and the Vietnamese retry button recovers', async () => {
    await play(); await inject(2);
    await waitFor("document.body.innerText.includes('Không tải được video. Vui lòng thử lại.')");
    expect(intercepted).toBe(2); expect(playbackReads).toBe(2);
    await evaluate("Array.from(document.querySelectorAll('button')).find(b=>b.innerText==='Thử lại').click()");
    await waitFor("document.querySelector('video').readyState >= 3 && !document.querySelector('video').paused");
    expect(playbackReads).toBe(3);
  });
  it('preserves the paused position when handling a media error', async () => {
    await play();
    await waitFor("document.querySelector('video').currentTime > 1");
    await evaluate("const v=document.querySelector('video');v.pause();window.pausedPosition=v.currentTime;v.dispatchEvent(new Event('error'));");
    await waitFor("document.querySelector('video').currentSrc.includes('generation=2') && document.querySelector('video').readyState >= 3");
    expect(playbackReads).toBe(2);
    expect(await evaluate("document.querySelector('video').paused")).toBe(true);
    expect(await evaluate<number>("Math.abs(document.querySelector('video').currentTime-window.pausedPosition)")).toBeLessThan(2);
  });
  it('refreshes near expiry on visibility return and keeps a paused video paused', async () => {
    await evaluate("window.originalNow=Date.now; Date.now=()=>window.originalNow()+901000; document.dispatchEvent(new Event('visibilitychange'));");
    await waitFor("document.querySelector('video').currentSrc.includes('generation=2') && document.querySelector('video').readyState >= 3");
    expect(playbackReads).toBe(2);
    expect(await evaluate("document.querySelector('video').paused")).toBe(true);
    await evaluate('Date.now=window.originalNow');
  });
  it('refreshes an expired URL before resuming after a pause', async () => {
    // First URL is made stale by moving the browser clock; course TTL remains untouched.
    await play();
    await evaluate("document.querySelector('video').pause(); window.originalNow=Date.now; Date.now=()=>window.originalNow()+901000;");
    await play();
    await waitFor("document.querySelector('video').readyState >= 3 && !document.querySelector('video').paused");
    expect(playbackReads).toBe(2);
    await evaluate('Date.now=window.originalNow');
  });
});

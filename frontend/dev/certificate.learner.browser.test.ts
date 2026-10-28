import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import {
  createServer as createHttpServer,
  type Server,
  type ServerResponse,
} from "node:http";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react-swc";
import { createServer as createViteServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const enabled = process.env.LEARNUP_RECOVERY_BROWSER_TESTS === "1";
const PATH = "/api/v1/certificates/me";
const ROUTE = "/learner/certificates";
const FRONTEND_ROOT = fileURLToPath(new URL("../", import.meta.url));
const PROFILE_PREFIX = "learnup-uc34-browser-";
type BrowserRequest = { url: string; headers: Record<string, string> };
type CdpResponse<T> = { result: { value?: T }; exceptionDetails?: unknown };
type CdpMessage = {
  id?: number;
  result?: unknown;
  error?: unknown;
  method?: string;
  params?: unknown;
};
type PendingCall = {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timeout: NodeJS.Timeout;
};
const delay = (milliseconds: number) =>
  new Promise<void>((done) => setTimeout(done, milliseconds));
class BrowserConnection {
  private sequence = 0;
  private pending = new Map<number, PendingCall>();
  readonly requests: BrowserRequest[] = [];
  readonly diagnostics: string[] = [];
  failCertificateRequests = false;
  failPut = false;
  failedCertificateAttempts = 0;

  constructor(
    private readonly socket: WebSocket,
    private readonly allowedOrigins: string[],
  ) {
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as CdpMessage;
      if (message.id !== undefined) {
        const waiting = this.pending.get(message.id);
        if (waiting) {
          clearTimeout(waiting.timeout);
          this.pending.delete(message.id);
          if (message.error)
            waiting.reject(new Error("Browser protocol command failed"));
          else waiting.resolve(message.result);
        }
      } else if (message.method === "Page.javascriptDialogOpening") {
        void this.call("Page.handleJavaScriptDialog", { accept: true }).catch(
          () => undefined,
        );
      } else if (message.method === "Network.requestWillBeSent") {
        const payload = message.params as { request: BrowserRequest };
        this.requests.push(payload.request);
      } else if (message.method === "Runtime.consoleAPICalled") {
        const payload = message.params as {
          args: { value?: unknown; description?: string }[];
        };
        this.diagnostics.push(
          payload.args
            .map((argument) =>
              String(argument.value ?? argument.description ?? ""),
            )
            .join(" "),
        );
      } else if (message.method === "Runtime.exceptionThrown") {
        const payload = message.params as {
          exceptionDetails: {
            text?: string;
            exception?: { description?: string };
          };
        };
        this.diagnostics.push(
          payload.exceptionDetails.exception?.description ??
            payload.exceptionDetails.text ??
            "Browser exception",
        );
      } else if (message.method === "Fetch.requestPaused") {
        const payload = message.params as {
          requestId: string;
          request: { url: string; method: string };
        };
        if (
          (this.failCertificateRequests ||
            (this.failPut && payload.request.method === "PUT")) &&
          [PATH].some((path) =>
            payload.request.url.startsWith(this.allowedOrigins[1] + path),
          )
        ) {
          // Fail at the browser boundary to avoid Chromium's connection retry.
          this.failedCertificateAttempts++;
          void this.call("Fetch.failRequest", {
            requestId: payload.requestId,
            errorReason: "ConnectionFailed",
          }).catch(() => undefined);
          return;
        }
        const allowed =
          payload.request.url.startsWith("blob:") ||
          payload.request.url.startsWith("data:") ||
          this.allowedOrigins.some((origin) =>
            payload.request.url.startsWith(origin + "/"),
          );
        // Do not contact Google Fonts or any other external service during a smoke test.
        void this.call(
          allowed ? "Fetch.continueRequest" : "Fetch.failRequest",
          allowed
            ? { requestId: payload.requestId }
            : { requestId: payload.requestId, errorReason: "BlockedByClient" },
        ).catch(() => undefined);
      }
    });
    socket.addEventListener("close", () => {
      for (const waiting of this.pending.values()) {
        clearTimeout(waiting.timeout);
        waiting.reject(new Error("Owned browser connection closed"));
      }
      this.pending.clear();
    });
  }

  call<T = unknown>(
    method: string,
    params: Record<string, unknown> = {},
  ): Promise<T> {
    return new Promise<T>((resolveCall, reject) => {
      const id = ++this.sequence;
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("Browser protocol timeout: " + method));
      }, 15000);
      this.pending.set(id, {
        resolve: (value) => resolveCall(value as T),
        reject,
        timeout,
      });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate<T = unknown>(expression: string): Promise<T> {
    const result = await this.call<CdpResponse<T>>("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) throw new Error("Browser evaluation failed");
    return result.result.value as T;
  }

  async waitFor(expression: string, explanation: string, timeout = 15000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (await this.evaluate<boolean>(expression)) return;
      await delay(50);
    }
    throw new Error(
      "Browser condition timed out: " +
        explanation +
        "\\n" +
        (await this.evaluate<string>("document.body.innerText")),
    );
  }

  async fill(selector: string, text: string, index = 0) {
    await this.evaluate(
      `document.querySelectorAll(${JSON.stringify(selector)})[${index}].focus()`,
    );
    await this.call("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "a",
      code: "KeyA",
      modifiers: 2,
      windowsVirtualKeyCode: 65,
    });
    await this.call("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "a",
      code: "KeyA",
      modifiers: 2,
      windowsVirtualKeyCode: 65,
    });
    await this.call("Input.insertText", { text });
  }

  async submit() {
    await this.evaluate(
      "document.querySelector('button[type=submit]').click()",
    );
  }

  close() {
    this.socket.close();
  }
}

describe.skipIf(!enabled)(
  "learner certificates CDP browser",
  { timeout: 45000 },
  () => {
    let gateway: Server | undefined,
      vite: ViteDevServer | undefined,
      chrome: ChildProcess | undefined;
    let browser: BrowserConnection | undefined, profile: string | undefined;
    let gatewayOrigin = "",
      frontendOrigin = "";
    let mode = "list",
      pdfStatus = 200,
      held: ServerResponse | undefined,
      holdList = false;
    const requests: string[] = [],
      sockets = new Set<import("node:net").Socket>();
    const certificate = {
      id: "019a0000-0000-7000-8000-000000000001",
      recipient: "Nguyễn Thị Ánh",
      organizationName: "Tổ chức học tập",
      courseTitle: "An toàn lao động",
      versionNumber: 2,
      issuedAt: "2026-10-31T23:00:00.000Z",
      issuedDate: "2026-11-01",
      certificateCode: "0123-4567-89AB",
      completedLate: true,
      signerName: "Trần Bình",
      signerTitle: "Giám đốc",
    };
    const screenshots = join(tmpdir(), "learnup-uc34-screenshots");
    const page = () => {
      if (!browser) throw Error("Browser unavailable");
      return browser;
    };
    const json = (res: ServerResponse, status: number, value: unknown) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(value));
    };
    const pdfRequests = () => requests.filter((path) => path.endsWith("/pdf"));
    beforeAll(async () => {
      const executable =
        process.env.CHROME_PATH ??
        [
          join(
            process.env.PROGRAMFILES ?? "",
            "Google/Chrome/Application/chrome.exe",
          ),
          join(
            process.env["PROGRAMFILES(X86)"] ?? "",
            "Microsoft/Edge/Application/msedge.exe",
          ),
        ].find(existsSync);
      if (!executable || !existsSync(executable))
        throw Error("Chromium executable required for opted-in tests");
      profile = await mkdtemp(join(tmpdir(), PROFILE_PREFIX));
      await mkdir(screenshots, { recursive: true });
      gateway = createHttpServer(async (req, res) => {
        res.setHeader("Access-Control-Allow-Origin", frontendOrigin);
        res.setHeader(
          "Access-Control-Allow-Headers",
          "authorization,content-type",
        );
        res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
        res.setHeader("Vary", "Origin");
        if (req.method === "OPTIONS") {
          res.writeHead(204);
          res.end();
          return;
        }
        const path = req.url ?? "";
        requests.push(path);
        if (path.endsWith("/pdf")) {
          if (pdfStatus !== 200) {
            json(res, pdfStatus, {
              error: {
                code:
                  pdfStatus === 503
                    ? "SERVICE_UNAVAILABLE"
                    : "CERTIFICATE_NOT_FOUND",
              },
            });
            return;
          }
          await delay(150);
          res.writeHead(200, {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="0123-4567-89AB.pdf"; filename*=UTF-8''0123-4567-89AB.pdf`,
          });
          res.end("%PDF-1.4\nsynthetic-download-fixture");
          return;
        }
        if (mode === "error") {
          json(res, 503, { error: { code: "INTERNAL_ERROR" } });
          return;
        }
        if (path === PATH || path.startsWith(PATH + "?")) {
          if (holdList) {
            held = res;
            return;
          }
          const next = path.includes("cursor=");
          json(res, 200, {
            data: {
              items:
                mode === "empty"
                  ? []
                  : [
                      {
                        ...certificate,
                        ...(next
                          ? {
                              id: certificate.id.slice(0, -1) + "2",
                              courseTitle: "Khóa học thứ hai",
                            }
                          : {}),
                      },
                    ],
              nextCursor: mode === "paging" && !next ? "opaque-next" : null,
            },
          });
          return;
        }
        if (mode === "not-found") {
          json(res, 404, { error: { code: "CERTIFICATE_NOT_FOUND" } });
          return;
        }
        const { id: _id, ...detail } = certificate;
        void _id;
        json(res, 200, { data: detail });
      });
      gateway.on("connection", (socket) => {
        sockets.add(socket);
        socket.on("close", () => sockets.delete(socket));
      });
      await new Promise<void>((done) => gateway!.listen(0, "127.0.0.1", done));
      const address = gateway.address();
      if (!address || typeof address === "string")
        throw Error("No owned gateway port");
      gatewayOrigin = "http://127.0.0.1:" + address.port;
      const reserve = createHttpServer();
      await new Promise<void>((done) => reserve.listen(0, "127.0.0.1", done));
      const reserved = reserve.address();
      if (!reserved || typeof reserved === "string")
        throw Error("No reserved port");
      const vitePort = reserved.port;
      await new Promise<void>((done) => reserve.close(() => done()));
      const entry =
        'import React from "react";import {createRoot} from "react-dom/client";import {createBrowserRouter,RouterProvider} from "react-router-dom";import List from "/src/pages/learner/certificates.tsx";import Detail from "/src/pages/learner/certificate.detail.tsx";import "/src/styles/global.scss";const router=createBrowserRouter([{path:"/learner/certificates",element:<List/>},{path:"/learner/certificates/:certificateId",element:<Detail/>},{path:"/away",element:<p>Đã rời trang</p>}]);createRoot(document.getElementById("root")).render(<RouterProvider router={router}/>);';
      vite = await createViteServer({
        root: FRONTEND_ROOT,
        configFile: false,
        cacheDir: join(profile, "vite-cache"),
        logLevel: "error",
        plugins: [
          react(),
          {
            name: "certificate-learner-browser-entry",
            resolveId: (id) =>
              id === "/certificate-learner-entry.tsx" ? id : undefined,
            load: (id) =>
              id === "/certificate-learner-entry.tsx" ? entry : undefined,
            configureServer(server) {
              server.middlewares.use((req, res, next) => {
                if (!(
                  (req.url ?? "").startsWith(ROUTE) || req.url === "/away"
                )) {
                  next();
                  return;
                }
                res.setHeader("Content-Type", "text/html");
                res.end(
                  '<!doctype html><html><head><script type="module">import RefreshRuntime from "/@react-refresh";RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script></head><body><div id="root"></div><script type="module" src="/certificate-learner-entry.tsx"></script></body></html>',
                );
              });
            },
          },
        ],
        resolve: { alias: { "@": join(FRONTEND_ROOT, "src") } },
        define: {
          "import.meta.env.VITE_BACKEND_URL": JSON.stringify(gatewayOrigin),
          "import.meta.env.VITE_DEV_IDENTITY_PROXY": '"0"',
        },
        server: {
          host: "127.0.0.1",
          port: vitePort,
          strictPort: true,
          hmr: false,
        },
        css: { preprocessorOptions: { scss: { api: "modern-compiler" } } },
      });
      await vite.listen();
      frontendOrigin = "http://127.0.0.1:" + vitePort;
      chrome = spawn(
        executable,
        [
          "--headless=new",
          "--disable-gpu",
          "--no-first-run",
          "--no-default-browser-check",
          "--disable-background-networking",
          "--disable-sync",
          "--disable-component-update",
          "--remote-debugging-address=127.0.0.1",
          "--remote-debugging-port=0",
          "--user-data-dir=" + profile,
          "about:blank",
        ],
        { stdio: "ignore", windowsHide: true },
      );
      const deadline = Date.now() + 15000;
      let port = "";
      while (Date.now() < deadline && !port) {
        try {
          port = (
            await readFile(join(profile, "DevToolsActivePort"), "utf8")
          ).split(/\r?\n/)[0];
        } catch {
          await delay(100);
        }
      }
      if (!port) throw Error("Owned browser did not start");
      const targets = (await fetch(
        "http://127.0.0.1:" + port + "/json/list",
      ).then((r) => r.json())) as {
        type: string;
        webSocketDebuggerUrl: string;
      }[];
      const target = targets.find((t) => t.type === "page");
      if (!target) throw Error("No page target");
      const socket = new WebSocket(target.webSocketDebuggerUrl);
      await new Promise<void>((done, reject) => {
        socket.addEventListener("open", () => done(), { once: true });
        socket.addEventListener("error", reject, { once: true });
      });
      browser = new BrowserConnection(socket, [frontendOrigin, gatewayOrigin]);
      await browser.call("Emulation.setDeviceMetricsOverride", {
        width: 1440,
        height: 1000,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await browser.call("Page.enable");
      await browser.call("Runtime.enable");
      await browser.call("Network.enable");
      await browser.call("Fetch.enable", {
        patterns: [{ urlPattern: "*", requestStage: "Request" }],
      });
      await browser.call("Browser.setDownloadBehavior", {
        behavior: "allow",
        downloadPath: profile,
      });
      await browser.call("Page.addScriptToEvaluateOnNewDocument", {
        source:
          'try{localStorage.setItem("access_token","synthetic-learner-certificate-token")}catch{}',
      });
    }, 120000);
    beforeEach(async () => {
      mode = "list";
      pdfStatus = 200;
      holdList = false;
      held?.destroy();
      held = undefined;
      requests.length = 0;
      page().failCertificateRequests = false;
      await page().call("Page.navigate", { url: frontendOrigin + "/away" });
      await waitText("Đã rời trang");
    }, 45000);
    afterAll(async () => {
      held?.destroy();
      if (browser) {
        await browser.call("Browser.close").catch(() => undefined);
        browser.close();
      }
      if (chrome && chrome.exitCode === null) {
        const child = chrome;
        await Promise.race([
          new Promise<void>((done) => child.once("exit", () => done())),
          delay(5000),
        ]);
        if (child.exitCode === null) child.kill();
      }
      await vite?.close();
      sockets.forEach((socket) => socket.destroy());
      if (gateway)
        await new Promise<void>((done) => gateway!.close(() => done()));
      if (profile) {
        const owned = resolve(profile);
        if (
          dirname(owned) !== resolve(tmpdir()) ||
          !basename(owned).startsWith(PROFILE_PREFIX)
        )
          throw Error("Invalid owned browser profile");
        await rm(owned, {
          recursive: true,
          force: true,
          maxRetries: 10,
          retryDelay: 100,
        });
      }
    }, 30000);
    const waitText = (text: string) =>
      page().waitFor(
        "document.body.innerText.includes(" + JSON.stringify(text) + ")",
        text,
        45000,
      );
    async function visit(detail = false) {
      await page().call("Page.navigate", {
        url: frontendOrigin + ROUTE + (detail ? "/" + certificate.id : ""),
      });
    }
    async function button(text: string, double = false) {
      await page().evaluate(
        '(()=>{const b=[...document.querySelectorAll("button")].find(b=>b.textContent.replace(/\\s/g,"")===' +
          JSON.stringify(text.replace(/\s/g, "")) +
          ');if(!b)throw Error("Missing button");b.click();' +
          (double ? "b.click();" : "") +
          "})()",
      );
    }
    async function shot(name: string) {
      const result = await page().call<{ data: string }>(
        "Page.captureScreenshot",
        { format: "png", captureBeyondViewport: true },
      );
      await writeFile(
        join(screenshots, name + ".png"),
        Buffer.from(result.data, "base64"),
      );
    }
    it("lists frozen certificates and Vietnam issue date", async () => {
      await visit();
      await waitText("An toàn lao động");
      await waitText("01/11/2026");
      await shot("list");
      expect(await page().evaluate("document.body.innerText")).not.toContain(
        "Alex Morgan",
      );
    });
    it("announces initial loading before the first response", async () => {
      holdList = true;
      await visit();
      await page().waitFor(
        `!!document.querySelector('[aria-label="Đang tải"]')`,
        "initial loading",
      );
      const deadline = Date.now() + 3000;
      while (!held && Date.now() < deadline) await delay(25);
      expect(held).toBeDefined();
      json(held!, 200, { data: { items: [certificate], nextCursor: null } });
      held = undefined;
      await waitText("An toàn lao động");
    });
    it("shows an empty state", async () => {
      mode = "empty";
      await visit();
      await waitText("Chưa có chứng chỉ");
      await shot("empty");
    });
    it("shows initial error and recovers with retry", async () => {
      mode = "error";
      await visit();
      await waitText("Không tải được dữ liệu");
      await shot("error");
      mode = "list";
      await button("Thử lại");
      await waitText("An toàn lao động");
    });
    it("shows frozen detail and private not-found state", async () => {
      await visit(true);
      await waitText("Nguyễn Thị Ánh");
      await waitText("Trần Bình");
      await waitText("đã hoàn thành khóa học");
      const detail = await page().evaluate<{
        gap: number;
        contrasts: number[];
      }>(`(() => {
        const signer = document.querySelector('.certificate-detail-signer');
        const gap = signer.children[1].getBoundingClientRect().top - signer.children[0].getBoundingClientRect().bottom;
        const luminance = color => { const channels = color.match(/\\d+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*channels[0]+.7152*channels[1]+.0722*channels[2]; };
        const background = luminance(getComputedStyle(document.querySelector('.certificate-detail-card')).backgroundColor);
        return {gap,contrasts:[...document.querySelectorAll('.certificate-detail-meta .learner-detail-item > span')].map(label=>{const foreground=luminance(getComputedStyle(label).color);return (Math.max(foreground,background)+.05)/(Math.min(foreground,background)+.05);})};
      })()`);
      expect(detail.gap).toBeLessThanOrEqual(4.5);
      expect(detail.contrasts).toHaveLength(2);
      detail.contrasts.forEach((ratio) =>
        expect(ratio).toBeGreaterThanOrEqual(4.5),
      );
      await shot("detail");
      mode = "not-found";
      await visit(true);
      await waitText("Không tìm thấy chứng chỉ");
    });
    it("downloads once on a double click using Content-Disposition filename", async () => {
      await visit(true);
      await waitText("Nguyễn Thị Ánh");
      await button("Tải PDF", true);
      await waitText("Đã tải chứng chỉ.");
      expect(pdfRequests()).toHaveLength(1);
      await page().waitFor(
        '!document.querySelector("button.ant-btn-loading")',
        "download finished",
      );
      let downloaded = "";
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline && !downloaded) {
        try {
          downloaded = await readFile(
            join(profile!, "0123-4567-89AB.pdf"),
            "utf8",
          );
        } catch {
          await delay(50);
        }
      }
      expect(downloaded).toContain("%PDF-1.4");
      await shot("download-success");
    });
    it("keeps busy during two retries then explains overload", async () => {
      pdfStatus = 503;
      await visit();
      await waitText("An toàn lao động");
      await button("Tải PDF", true);
      await page().waitFor(
        '!!document.querySelector("button.ant-btn-loading")',
        "busy download",
      );
      await waitText("Hệ thống đang bận. Vui lòng thử tải lại sau.");
      expect(pdfRequests()).toHaveLength(3);
      await page().waitFor(
        '!document.querySelector("button.ant-btn-loading")',
        "retries finished",
      );
      const enabled = await page().evaluate<boolean>(
        '(()=>{const b=[...document.querySelectorAll("button")].find(b=>b.textContent.replace(/\\s/g,"")==="TảiPDF");return !!b&&!b.disabled})()',
      );
      expect(enabled).toBe(true);
      await page().waitFor(
        '(()=>{const buttons=[...document.querySelectorAll(".learner-certificates-actions button")];return getComputedStyle(buttons[0]).color===getComputedStyle(buttons[1]).color&&getComputedStyle(buttons[1]).cursor!=="not-allowed"})()',
        "enabled download appearance",
      );
      await shot("busy-503");
      pdfStatus = 200;
      await button("Tải PDF");
      await waitText("Đã tải chứng chỉ.");
      expect(pdfRequests()).toHaveLength(4);
    });
    it("handles network loss during a download without duplicate requests", async () => {
      await visit();
      await waitText("An toàn lao động");
      page().failCertificateRequests = true;
      await button("Tải PDF");
      await waitText("Không tải được chứng chỉ. Kiểm tra kết nối và thử lại.");
    });
    it("keeps existing rows while paging and fits a mobile viewport", async () => {
      mode = "paging";
      await visit();
      await waitText("An toàn lao động");
      holdList = true;
      await button("Xem thêm", true);
      await page().waitFor(
        '!!document.querySelector("button.ant-btn-loading")',
        "paging busy",
      );
      expect(await page().evaluate("document.body.innerText")).toContain(
        "An toàn lao động",
      );
      await page().waitFor("true", "page request");
      const deadline = Date.now() + 3000;
      while (!held && Date.now() < deadline) await delay(25);
      expect(held).toBeDefined();
      json(held!, 200, {
        data: {
          items: [
            {
              ...certificate,
              id: certificate.id.slice(0, -1) + "2",
              courseTitle: "Khóa học thứ hai",
            },
          ],
          nextCursor: null,
        },
      });
      held = undefined;
      await waitText("Khóa học thứ hai");
      expect(requests.filter((p) => p.includes("cursor="))).toHaveLength(1);
      await page().call("Emulation.setDeviceMetricsOverride", {
        width: 375,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await delay(100);
      expect(
        await page().evaluate(
          "document.documentElement.scrollWidth<=document.documentElement.clientWidth",
        ),
      ).toBe(true);
      const mobile = await page().evaluate<{
        left: number;
        right: number;
        width: number;
        buttons: { left: number; right: number; top: number; bottom: number }[];
        height: number;
      }>(
        `(() => {const card=document.querySelector('.learner-certificate-item').getBoundingClientRect();return {left:card.left,right:card.right,width:document.documentElement.clientWidth,height:innerHeight,buttons:[...document.querySelectorAll('.learner-certificates-actions button')].map(button=>{const b=button.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom};})};})()`,
      );
      expect(mobile.left).toBe(16);
      expect(mobile.right).toBe(mobile.width - 16);
      expect(mobile.buttons).toHaveLength(4);
      mobile.buttons.forEach((button) => {
        expect(button.left).toBeGreaterThanOrEqual(16);
        expect(button.right).toBeLessThanOrEqual(mobile.width - 16);
        expect(button.top).toBeGreaterThanOrEqual(0);
        expect(button.bottom).toBeLessThanOrEqual(mobile.height);
      });
      await waitText("Hoàn thành sau hạn");
      await shot("mobile");
      await page().call("Emulation.clearDeviceMetricsOverride");
    });
  },
);

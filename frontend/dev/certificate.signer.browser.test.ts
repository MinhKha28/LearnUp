import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer as createHttpServer, type Server, type ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react-swc";
import { createServer as createViteServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { SignerSettings } from "../src/types/certificate-signer.types";

const enabled = process.env.LEARNUP_CERTIFICATE_BROWSER_TESTS === "1";
const PATH = "/api/v1/certificates/signer-settings";
const ROUTE = "/organizer/certificate-settings";
const FRONTEND_ROOT = fileURLToPath(new URL("../", import.meta.url));
const PROFILE_PREFIX = "learnup-certificate-browser-";
type BrowserRequest = { url: string; headers: Record<string, string> };
type CdpResponse<T> = { result: { value?: T }; exceptionDetails?: unknown };
type CdpMessage = { id?: number; result?: unknown; error?: unknown; method?: string; params?: unknown };
type PendingCall = { resolve: (value: unknown) => void; reject: (reason: Error) => void; timeout: NodeJS.Timeout };
const delay = (milliseconds: number) => new Promise<void>(done => setTimeout(done, milliseconds));
class BrowserConnection {
  private sequence = 0;
  private pending = new Map<number, PendingCall>();
  readonly requests: BrowserRequest[] = [];
  readonly diagnostics: string[] = [];
  failCertificateRequests = false;
  failPut = false;
  failedCertificateAttempts = 0;

  constructor(private readonly socket: WebSocket, private readonly allowedOrigins: string[]) {
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as CdpMessage;
      if (message.id !== undefined) {
        const waiting = this.pending.get(message.id);
        if (waiting) {
          clearTimeout(waiting.timeout);
          this.pending.delete(message.id);
          if (message.error) waiting.reject(new Error("Browser protocol command failed"));
          else waiting.resolve(message.result);
        }
      } else if (message.method === "Page.javascriptDialogOpening") {
        void this.call("Page.handleJavaScriptDialog", { accept: true }).catch(() => undefined);
      } else if (message.method === "Network.requestWillBeSent") {
        const payload = message.params as { request: BrowserRequest };
        this.requests.push(payload.request);
      } else if (message.method === "Runtime.consoleAPICalled") {
        const payload = message.params as { args: { value?: unknown; description?: string }[] };
        this.diagnostics.push(payload.args.map((argument) => String(argument.value ?? argument.description ?? "")).join(" "));
      } else if (message.method === "Runtime.exceptionThrown") {
        const payload = message.params as { exceptionDetails: { text?: string; exception?: { description?: string } } };
        this.diagnostics.push(payload.exceptionDetails.exception?.description ?? payload.exceptionDetails.text ?? "Browser exception");
      } else if (message.method === "Fetch.requestPaused") {
        const payload = message.params as { requestId: string; request: { url: string; method: string } };
        if ((this.failCertificateRequests || this.failPut && payload.request.method === "PUT") && [PATH].some((path) => payload.request.url === this.allowedOrigins[1] + path)) {
          // Fail at the browser boundary to avoid Chromium's connection retry.
          this.failedCertificateAttempts++;
          void this.call("Fetch.failRequest", { requestId: payload.requestId, errorReason: "ConnectionFailed" }).catch(() => undefined);
          return;
        }
        const allowed = payload.request.url.startsWith("blob:") || payload.request.url.startsWith("data:") || this.allowedOrigins.some((origin) => payload.request.url.startsWith(origin + "/"));
        // Do not contact Google Fonts or any other external service during a smoke test.
        void this.call(allowed ? "Fetch.continueRequest" : "Fetch.failRequest",
          allowed ? { requestId: payload.requestId } : { requestId: payload.requestId, errorReason: "BlockedByClient" })
          .catch(() => undefined);
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

  call<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    return new Promise<T>((resolveCall, reject) => {
      const id = ++this.sequence;
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("Browser protocol timeout: " + method));
      }, 15000);
      this.pending.set(id, { resolve: (value) => resolveCall(value as T), reject, timeout });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate<T = unknown>(expression: string): Promise<T> {
    const result = await this.call<CdpResponse<T>>("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error("Browser evaluation failed");
    return result.result.value as T;
  }

  async waitFor(expression: string, explanation: string, timeout = 15000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (await this.evaluate<boolean>(expression)) return;
      await delay(50);
    }
    throw new Error("Browser condition timed out: " + explanation + "\\n" + await this.evaluate<string>("document.body.innerText"));
  }

  async fill(selector: string, text: string, index = 0) {
    await this.evaluate(`document.querySelectorAll(${JSON.stringify(selector)})[${index}].focus()`);
    await this.call("Input.dispatchKeyEvent", { type: "keyDown", key: "a", code: "KeyA", modifiers: 2, windowsVirtualKeyCode: 65 });
    await this.call("Input.dispatchKeyEvent", { type: "keyUp", key: "a", code: "KeyA", modifiers: 2, windowsVirtualKeyCode: 65 });
    await this.call("Input.insertText", { text });
  }

  async submit() {
    await this.evaluate("document.querySelector('button[type=submit]').click()");
  }

  close() { this.socket.close(); }
}


/** Real page interactions with a data router, owned Chromium and a cross-origin HTTP stub. */
describe.skipIf(!enabled)("UC34.3 certificate signer browser", { timeout: 45000 }, () => {
  let gateway: Server | undefined, vite: ViteDevServer | undefined, chrome: ChildProcess | undefined;
  let browser: BrowserConnection | undefined, profile: string | undefined;
  let gatewayOrigin = "", frontendOrigin = "";
  let settings: SignerSettings;
  let imageBytes: Buffer;
  let status = 200, code = "", imageStatus = 200, getStatus = 200, subscriptionStatus = "Active";
  let hold = false, held: ServerResponse | undefined;
  const requests: { method: string; path: string; body: string; match?: string; contentType?: string }[] = [];
  const sockets = new Set<import("node:net").Socket>();
  const page = () => { if (!browser) throw new Error("No owned browser"); return browser; };
  const puts = () => requests.filter(r => r.method === "PUT");
  const blank = (): SignerSettings => ({ configured: false, signerName: null, signerTitle: null, signature: null, version: 0, updatedAt: null });
  const configured = (withImage = false): SignerSettings => ({
    configured: true, signerName: "Nguyễn An", signerTitle: "Giám đốc", version: 1, updatedAt: null,
    signature: withImage ? { mimeType: "image/png", sizeBytes: imageBytes.length } : null,
  });
  const json = (res: ServerResponse, status: number, value: unknown) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(value)); };
  beforeAll(async () => {
    const executable = process.env.CHROME_PATH ?? ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"].find(existsSync);
    if (!executable || !existsSync(executable)) throw new Error("Install Chromium or set CHROME_PATH for opted-in browser tests");
    profile = await mkdtemp(join(tmpdir(), PROFILE_PREFIX));
    gateway = createHttpServer(async (req, res) => {
      res.setHeader("Access-Control-Allow-Origin", frontendOrigin);
      res.setHeader("Access-Control-Allow-Headers", "content-type,authorization,if-match");
      res.setHeader("Access-Control-Allow-Methods", "GET,PUT,OPTIONS");
      res.setHeader("Access-Control-Expose-Headers", "ETag");
      res.setHeader("Access-Control-Allow-Credentials", "true");
      if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const path = (req.url ?? "").split("?")[0], raw = Buffer.concat(chunks).toString("latin1");
      requests.push({ method: req.method ?? "", path, body: raw, match: req.headers["if-match"] as string | undefined, contentType: req.headers["content-type"] });
      if (path === "/api/v1/subscriptions/current") { json(res, 200, { data: { subscription: { status: subscriptionStatus } } }); return; }
      if (path === PATH + "/signature") {
        if (imageStatus !== 200) { json(res, imageStatus, { error: { code: imageStatus === 404 ? "SIGNATURE_NOT_FOUND" : "STORAGE_UNAVAILABLE" } }); return; }
        res.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "no-store" }); res.end(imageBytes); return;
      }
      if (path !== PATH) { json(res, 404, {}); return; }
      if (req.method === "GET") {
        if (getStatus !== 200) { json(res, getStatus, { error: { code: "TENANT_UNAVAILABLE" } }); return; }
        res.setHeader("ETag", '"' + settings.version + '"'); json(res, 200, { data: settings }); return;
      }
      if (hold) { held = res; return; }
      if (status !== 200) { json(res, status, { error: { code } }); return; }
      const value = (name: string) => {
        const content = raw.split('name="' + name + '"')[1]?.split("\r\n\r\n")[1]?.split("\r\n")[0] ?? "";
        return Buffer.from(content, "latin1").toString("utf8");
      };
      settings = { ...settings, configured: true, signerName: value("signerName"), signerTitle: value("signerTitle"), version: settings.version + 1,
        signature: value("signatureAction") === "remove" ? null : value("signatureAction") === "replace" ? { mimeType: "image/png", sizeBytes: imageBytes.length } : settings.signature };
      res.setHeader("ETag", '"' + settings.version + '"'); json(res, 200, { data: settings });
    });
    gateway.on("connection", socket => { sockets.add(socket); socket.on("close", () => sockets.delete(socket)); });
    await new Promise<void>(done => gateway!.listen(0, "127.0.0.1", done));
    const address = gateway.address();
    if (!address || typeof address === "string") throw new Error("Missing owned HTTP port");
    gatewayOrigin = "http://127.0.0.1:" + address.port;
    const reserve = createHttpServer();
    await new Promise<void>(done => reserve.listen(0, "127.0.0.1", done));
    const reservedAddress = reserve.address();
    if (!reservedAddress || typeof reservedAddress === "string") throw new Error("Missing owned Vite port reservation");
    const vitePort = reservedAddress.port;
    await new Promise<void>(done => reserve.close(() => done()));
    const entry = 'import React from "react"; import {createRoot} from "react-dom/client"; import {App} from "antd"; import {createBrowserRouter,RouterProvider,Link} from "react-router-dom"; import Page from "/src/pages/organizer/certificate.settings.tsx"; import "/src/styles/global.scss"; const router=createBrowserRouter([{path:"'+ROUTE+'",element:<><Link to="/away">Rời trang thử nghiệm</Link><Page/></>},{path:"/away",element:<p>Đã rời trang</p>}]);createRoot(document.getElementById("root")).render(<App><RouterProvider router={router}/></App>);';
    vite = await createViteServer({
      root: FRONTEND_ROOT, configFile: false, cacheDir: join(profile, "vite-cache"), logLevel: "error",
      plugins: [react(), {
        name: "certificate-test-entry",
        resolveId: id => id === "/certificate-test-entry.tsx" ? id : undefined,
        load: id => id === "/certificate-test-entry.tsx" ? entry : undefined,
        configureServer(server) { server.middlewares.use((req, res, next) => {
          if (![ROUTE, "/away"].includes((req.url ?? "").split("?")[0])) { next(); return; }
          res.setHeader("Content-Type", "text/html");
          res.end('<!doctype html><html><head><script type="module">import RefreshRuntime from "/@react-refresh"; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;</script></head><body><div id="root"></div><script type="module" src="/certificate-test-entry.tsx"></script></body></html>');
        }); },
      }],
      resolve: { alias: { "@": join(FRONTEND_ROOT, "src") } },
      define: Object.fromEntries(Object.entries({
        VITE_BACKEND_URL: gatewayOrigin, VITE_TENANT_BACKEND_URL: gatewayOrigin, VITE_COURSE_BACKEND_URL: gatewayOrigin,
        VITE_ASSESSMENT_BACKEND_URL: gatewayOrigin, VITE_DEV_IDENTITY_PROXY: "0", VITE_DEV_FAKE_USER_ID: "",
      }).map(([key, value]) => ["import.meta.env." + key, JSON.stringify(value)])),
      server: { host: "127.0.0.1", port: vitePort, strictPort: true, hmr: false },
      css: { preprocessorOptions: { scss: { api: "modern-compiler" } } },
    });
    await vite.listen();
    const vAddress = vite.httpServer?.address();
    if (!vAddress || typeof vAddress === "string") throw new Error("Missing owned Vite port");
    frontendOrigin = "http://127.0.0.1:" + vAddress.port;
    chrome = spawn(executable, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
      "--disable-background-networking", "--disable-sync", "--disable-component-update", "--remote-debugging-address=127.0.0.1",
      "--remote-debugging-port=0", "--user-data-dir=" + profile, "about:blank"], { stdio: "ignore", windowsHide: true });
    const deadline = Date.now() + 15000;
    let port = "";
    while (Date.now() < deadline && !port) { try { port = (await readFile(join(profile, "DevToolsActivePort"), "utf8")).split(/\r?\n/)[0]; } catch { await delay(100); } }
    if (!port) throw new Error("Owned browser did not start");
    const targets = await fetch("http://127.0.0.1:" + port + "/json/list").then(r => r.json()) as { type: string; webSocketDebuggerUrl: string }[];
    const target = targets.find(t => t.type === "page");
    if (!target) throw new Error("No browser target");
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise<void>((done, reject) => { socket.addEventListener("open", () => done(), { once: true }); socket.addEventListener("error", reject, { once: true }); });
    browser = new BrowserConnection(socket, [frontendOrigin, gatewayOrigin]);
    await browser.call("Page.enable"); await browser.call("Runtime.enable"); await browser.call("Network.enable");
    await browser.call("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" }] });
    await browser.call("Page.addScriptToEvaluateOnNewDocument", { source: 'try { localStorage.setItem("access_token","synthetic-certificate-browser-access"); window.ownedUrls=[]; window.revokedUrls=[]; const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL); URL.createObjectURL=(blob)=>{const url=create(blob);window.ownedUrls.push(url);return url};URL.revokeObjectURL=(url)=>{window.revokedUrls.push(url);revoke(url)}; } catch {}' });
    await browser.call("Page.navigate", { url: frontendOrigin + "/away" });
    await browser.waitFor("document.querySelector('#root') !== null", "canvas fixture page");
    imageBytes = Buffer.from(await browser.evaluate<string>('(()=>{const c=document.createElement("canvas");c.width=450;c.height=150;const x=c.getContext("2d");x.fillText("An",10,40);return c.toDataURL("image/png").split(",")[1]})()'), "base64");
  }, 120000);

  beforeEach(async () => {
    if (browser) await browser.call("Page.handleJavaScriptDialog", { accept: true }).catch(() => undefined);
    held?.destroy(); held = undefined; hold = false;
    status = 200; code = ""; imageStatus = 200; getStatus = 200; subscriptionStatus = "Active"; settings = blank();
    requests.length = 0; page().failCertificateRequests = false; page().failPut = false; page().diagnostics.length = 0;
    await page().call("Page.navigate", { url: frontendOrigin + "/away" });
    await page().waitFor('document.body.innerText.includes("Đã rời trang")', "reset page");
  });
  afterAll(async () => {
    held?.destroy();
    if (browser) { await browser.call("Browser.close").catch(() => undefined); browser.close(); }
    if (chrome && chrome.exitCode === null) {
      const child = chrome; await Promise.race([new Promise<void>(done => child.once("exit", () => done())), delay(5000)]);
      if (child.exitCode === null) child.kill();
    }
    await vite?.close(); sockets.forEach(socket => socket.destroy());
    if (gateway) await new Promise<void>(done => gateway!.close(() => done()));
    if (profile) {
      const owned = resolve(profile);
      if (dirname(owned) !== resolve(tmpdir()) || !basename(owned).startsWith(PROFILE_PREFIX)) throw new Error("Profile outside owned temp directory");
      await rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    }
  }, 30000);

  async function visit() {
    await page().call("Page.navigate", { url: frontendOrigin + ROUTE });
    await page().waitFor('!!document.querySelector("#certificate-signer-form") || document.body.innerText.includes("Không tải được") || document.body.innerText.includes("Chưa kiểm tra được")', "certificate page", 45000);
  }
  async function button(text: string) {
    await page().evaluate('(()=>{const button=[...document.querySelectorAll("button")].find(b=>b.textContent.replace(/\\s/g,"")==='+JSON.stringify(text.replace(/\s/g, ""))+');if(!button)throw Error("Missing button");button.click()})()');
  }
  const waitText = (text: string) => page().waitFor("document.body.innerText.includes(" + JSON.stringify(text) + ")", text);
  async function edit(name = "Trần Bình") { await page().fill("#certificate-signer-form_name", name); await page().fill("#certificate-signer-form_title", "Trưởng phòng");
    await page().waitFor('document.querySelector("#certificate-signer-form_name").value === ' + JSON.stringify(name) + ' && !document.querySelector("button[type=submit]").disabled', "draft ready to save");
  }
  async function pick() {
    await page().evaluate('(()=>{const canvas=document.createElement("canvas");canvas.width=450;canvas.height=150;return new Promise(resolve=>canvas.toBlob(blob=>{const data=new DataTransfer();data.items.add(new File([blob],"signature.png",{type:"image/png"}));const input=document.querySelector("input[type=file]");input.files=data.files;input.dispatchEvent(new Event("change",{bubbles:true}));resolve(true)},"image/png"))})()');
    await waitText("Ảnh mới – chưa lưu.");
  }
  it("loads unconfigured state, saves atomically once and uses quoted ETag", async () => {
    await visit(); await waitText("Chưa cấu hình người ký");
    await edit(); await pick(); await button("Lưu");
    await waitText("Đã lưu cấu hình");
    expect(puts()).toHaveLength(1); expect(puts()[0].match).toBe('"0"'); expect(puts()[0].contentType).toMatch(/^multipart\/form-data; boundary=/);
    expect(puts()[0].body).toContain('name="signature";'); expect(settings.configured).toBe(true);
  });
  it("discards selected image/text without PUT and revokes preview URL", async () => {
    settings = configured(); await visit(); await pick(); await edit(); await button("Hủy thay đổi");
    expect(puts()).toHaveLength(0);
    expect(await page().evaluate('document.querySelector("#certificate-signer-form_name").value')).toBe("Nguyễn An");
    await page().waitFor("window.ownedUrls.every(url=>window.revokedUrls.includes(url))", "all draft URLs revoked");
  });
  it("removes only the image and preserves required text", async () => {
    settings = configured(true); await visit(); await button("Xóa ảnh"); await button("Lưu"); await waitText("Đã lưu cấu hình");
    expect(puts()[0].body).toContain("remove"); expect(settings.signature).toBeNull(); expect(settings.signerName).toBe("Nguyễn An");
  });
  it("412 retains text and File, reloads latest and reuses new ETag on explicit save", async () => {
    settings = configured(); await visit(); await edit(); await pick();
    settings = { ...configured(true), signerName: "Người khác", version: 2 }; status = 412; code = "VERSION_CONFLICT";
    await button("Lưu"); await waitText("Cấu hình vừa được lưu ở nơi khác"); await waitText("Người khác");
    expect(await page().evaluate('document.querySelector("#certificate-signer-form_name").value')).toBe("Trần Bình");
    await waitText("Ảnh mới – chưa lưu."); status = 200; await button("Lưu"); await waitText("Đã lưu cấu hình");
    expect(puts()).toHaveLength(2); expect(puts()[1].match).toBe('"2"'); expect(puts()[1].body).toContain('name="signature";');
  });
  it("412 keep uses latest saved image and Use latest discards draft", async () => {
    settings = configured(); await visit(); await edit();
    settings = { ...configured(true), signerName: "Người khác", version: 2 }; status = 412; code = "VERSION_CONFLICT";
    await button("Lưu"); await waitText("Sẽ giữ ảnh hiện tại trên hệ thống.");
    await page().waitFor('document.querySelectorAll("img").length >= 1', "latest image");
    await button("Dùng bản mới");
    expect(await page().evaluate('document.querySelector("#certificate-signer-form_name").value')).toBe("Người khác");
    expect(puts()).toHaveLength(1);
  });
  it("412 reload failure preserves draft and has a dedicated retry", async () => {
    settings = configured(); await visit(); await edit(); status = 412; code = "VERSION_CONFLICT"; getStatus = 503;
    await button("Lưu"); await waitText("Thử tải lại cấu hình");
    expect(await page().evaluate('document.querySelector("#certificate-signer-form_name").value')).toBe("Trần Bình");
    getStatus = 200; settings.version = 2; await button("Thử tải lại cấu hình"); await waitText("Hệ thống vừa tải:");
  });
  it("Suspended locks in advance, while Grace permits save", async () => {
    settings = configured(); subscriptionStatus = "Suspended"; await visit(); await waitText("chế độ chỉ đọc");
    expect(await page().evaluate('document.querySelector("#certificate-signer-form_name").disabled')).toBe(true);
    subscriptionStatus = "Grace"; await page().call("Page.navigate", { url: frontendOrigin + "/away" }); await visit();
    await edit(); await button("Lưu"); await waitText("Đã lưu cấu hình");
  });
  it.each([["ORGANIZATION_READ_ONLY", "chế độ chỉ đọc"], ["FORBIDDEN_ROLE", "không có quyền"]])("403 %s preserves draft and blocks further saves", async (errorCode, text) => {
    settings = configured(); await visit(); await edit(); status = 403; code = errorCode;
    await button("Lưu"); await waitText(text);
    expect(await page().evaluate('document.querySelector("#certificate-signer-form_name").value')).toBe("Trần Bình");
    expect(await page().evaluate('document.querySelector("button[type=submit]").disabled')).toBe(true);
  });
  it.each([["TENANT_UNAVAILABLE", "Chưa kiểm tra được quyền ghi"], ["STORAGE_UNAVAILABLE", "Kho lưu trữ ảnh"]])("503 %s preserves draft and permits retry", async (errorCode, text) => {
    settings = configured(); await visit(); await edit(); status = 503; code = errorCode;
    await button("Lưu"); await waitText(text);
    expect(await page().evaluate('document.querySelector("#certificate-signer-form_name").value')).toBe("Trần Bình");
    status = 200; await button("Lưu"); await waitText("Đã lưu cấu hình"); expect(puts()).toHaveLength(2);
  });
  it("missing signature is an independent image error with retry", async () => {
    settings = configured(true); imageStatus = 404; await visit(); await waitText("Không tìm thấy ảnh");
    expect(await page().evaluate('document.querySelector("#certificate-signer-form_name").value')).toBe("Nguyễn An");
    imageStatus = 200; await button("Thử tải lại ảnh"); await page().waitFor("!!document.querySelector('img')", "image retry");
  });
  it("offline PUT reconciles latest version without automatically retrying PUT", async () => {
    settings = configured(); await visit(); await edit();
    settings = { ...settings, version: 2, signerName: "Có thể đã lưu" }; page().failPut = true;
    await button("Lưu"); await waitText("có thể đã được lưu"); await waitText("Có thể đã lưu");
    expect(puts()).toHaveLength(0);
    expect(await page().evaluate('document.querySelector("#certificate-signer-form_name").value')).toBe("Trần Bình");
  });
  it("navigation warns for dirty draft, stays or leaves and revokes URLs", async () => {
    settings = configured(); await visit(); await edit(); await pick();
    await page().evaluate('document.querySelector("a").click()'); await waitText("Rời trang khi chưa lưu?");
    await button("Ở lại"); expect(await page().evaluate("location.pathname")).toBe(ROUTE);
    await page().evaluate('document.querySelector("a").click()'); await waitText("Rời trang khi chưa lưu?");
    await button("Rời trang"); await waitText("Đã rời trang");
    await page().waitFor("window.ownedUrls.every(url=>window.revokedUrls.includes(url))", "unmount URL cleanup");
  });
  it("blocks duplicate saves and warns while a PUT is pending", async () => {
    settings = configured(); await visit(); await edit(); hold = true;
    await button("Lưu"); await page().waitFor('document.querySelector("button[type=submit]").disabled', "save disabled");
    await button("Lưu"); expect(puts()).toHaveLength(1);
    await page().evaluate('document.querySelector("a").click()'); await waitText("Yêu cầu lưu đang được xử lý");
    await button("Ở lại"); hold = false;
    held!.setHeader("ETag", '"2"'); json(held!, 200, { data: { ...settings, version: 2 } }); held = undefined;
    await waitText("Đã lưu cấu hình");
  });
  it("clean focus refreshes changed version and blob; dirty focus preserves draft", async () => {
    settings = configured(); await visit();
    settings = { ...configured(true), version: 2, signerName: "Phiên bản mới" };
    await page().evaluate('window.dispatchEvent(new Event("focus"))'); await waitText("Thông tin người ký");
    await page().waitFor('document.querySelector("#certificate-signer-form_name").value === "Phiên bản mới"', "focus latest text");
    await page().waitFor("!!document.querySelector('img')", "focus latest blob");
    await edit(); const count = requests.length;
    await page().evaluate('window.dispatchEvent(new Event("focus"))'); await delay(200);
    expect(requests).toHaveLength(count);
  });

  it("initial GET failure has its own retry without PUT", async () => {
    getStatus = 503; await visit(); await waitText("Thử lại"); getStatus = 200;
    await button("Thử lại"); await page().waitFor('!!document.querySelector("#certificate-signer-form_name")', "GET retry");
    expect(puts()).toHaveLength(0);
  });
  it("428 requires reload and keeps draft", async () => {
    settings = configured(); await visit(); await edit(); status = 428; code = "PRECONDITION_REQUIRED";
    await button("Lưu"); await waitText("Cần tải lại cấu hình trước khi lưu.");
    expect(await page().evaluate('document.querySelector("#certificate-signer-form_name").value')).toBe("Trần Bình");
    await button("Tải lại cấu hình");
    await page().waitFor('!document.querySelector("button[type=submit]").disabled', "ETag restored");
    status = 200; await button("Lưu"); await waitText("Đã lưu cấu hình"); expect(puts()).toHaveLength(2);
  });
  it.each([[413, "SIGNATURE_TOO_LARGE", "Ảnh không được vượt quá"], [415, "SIGNATURE_UNSUPPORTED_TYPE", "Chỉ chấp nhận ảnh PNG"]])("upload error %i preserves text and shows next to upload", async (http, errorCode, text) => {
    settings = configured(); await visit(); await edit(); await pick(); status = http; code = errorCode;
    await button("Lưu"); await waitText(text);
    expect(await page().evaluate('document.querySelector(".ant-form-item-explain-error").textContent')).toContain(text);
    expect(await page().evaluate('document.querySelector("#certificate-signer-form_name").value')).toBe("Trần Bình");
  });
  it("shared SIGNER_NAME_INVALID with valid client text becomes a form-level message", async () => {
    settings = configured(); await visit(); await edit(); status = 400; code = "SIGNER_NAME_INVALID";
    await button("Lưu"); await waitText("Tên hoặc chức danh không hợp lệ.");
    expect(await page().evaluate('document.querySelector("#certificate-signer-form_name").value')).toBe("Trần Bình");
  });
  it("renders desktop and mobile without horizontal overflow", async () => {
    settings = configured(true); await visit();
    await page().waitFor("!!document.querySelector('img')", "saved signature");
    for (const width of [1440, 375]) {
      await page().call("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: false });
      await delay(100);
      expect(await page().evaluate("document.documentElement.scrollWidth <= window.innerWidth")).toBe(true);
      const shot = await page().call<{ data: string }>("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
      await writeFile(join(tmpdir(), "learnup-uc343-" + width + ".png"), Buffer.from(shot.data, "base64"));
    }
    await page().call("Emulation.clearDeviceMetricsOverride");
  });
});

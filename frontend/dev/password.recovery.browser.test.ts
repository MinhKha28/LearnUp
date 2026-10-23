import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer as createHttpServer, type IncomingHttpHeaders, type Server, type ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react-swc";
import { createServer as createViteServer, type ViteDevServer } from "vite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

/**
 * Real React/Ant Design interactions in an owned headless browser, against an isolated
 * HTTP Gateway stub. No shared backend/database, packages, screenshots or repo artifacts.
 * Opt in: LEARNUP_RECOVERY_BROWSER_TESTS=1 npm test -- dev/password.recovery.browser.test.ts
 */
const enabled = process.env.LEARNUP_RECOVERY_BROWSER_TESTS === "1";
const RAW_TOKEN = "synthetic-recovery-token-from-email-link";
const PASSWORD = "abc123";
const BACKEND_SECRET = "synthetic-backend-error-secret-must-not-render";
const EMAIL = "recovery-fixture@identity-contract.invalid";
const FORGOT = "/api/v1/auth/forgot-password";
const RESET = "/api/v1/auth/reset-password";
const FRONTEND_ROOT = fileURLToPath(new URL("../", import.meta.url));
const PROFILE_PREFIX = "learnup-recovery-browser-";

type ResponsePlan = { status: number; body: string; hold?: boolean; networkFailure?: boolean };
type RecordedRequest = { method: string; path: string; headers: IncomingHttpHeaders; body: unknown };
type BrowserRequest = { url: string; headers: Record<string, string>; referrerPolicy?: string };
type CdpResponse<T> = { result: { value?: T }; exceptionDetails?: unknown };
type CdpMessage = { id?: number; result?: unknown; error?: unknown; method?: string; params?: unknown };
type PendingCall = { resolve: (value: unknown) => void; reject: (reason: Error) => void; timeout: NodeJS.Timeout };

const delay = (milliseconds: number) => new Promise<void>((done) => setTimeout(done, milliseconds));
const success = (): ResponsePlan => ({ status: 200, body: JSON.stringify({ success: true, data: { message: "Request accepted" } }) });

class BrowserConnection {
  private sequence = 0;
  private pending = new Map<number, PendingCall>();
  readonly requests: BrowserRequest[] = [];
  readonly diagnostics: string[] = [];
  failRecoveryRequests = false;
  failedRecoveryAttempts = 0;

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
        const payload = message.params as { requestId: string; request: { url: string } };
        if (this.failRecoveryRequests && [FORGOT, RESET].some((path) => payload.request.url === this.allowedOrigins[1] + path)) {
          // Fail the real XHR at the browser's transport boundary. Abruptly closing an
          // HTTP socket instead can trigger Chromium's own connection-retry machinery.
          this.failedRecoveryAttempts++;
          void this.call("Fetch.failRequest", { requestId: payload.requestId, errorReason: "ConnectionFailed" }).catch(() => undefined);
          return;
        }
        const allowed = this.allowedOrigins.some((origin) => payload.request.url.startsWith(origin + "/"));
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
    throw new Error("Browser condition timed out: " + explanation);
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

describe.skipIf(!enabled)("UC07 password recovery (owned Chrome + isolated HTTP Gateway stub)", { timeout: 45000 }, () => {
  let gateway: Server | undefined;
  let vite: ViteDevServer | undefined;
  let chrome: ChildProcess | undefined;
  let browser: BrowserConnection | undefined;
  let profile: string | undefined;
  let gatewayOrigin = "";
  let frontendOrigin = "";
  let plan = success();
  const requests: RecordedRequest[] = [];
  const heldResponses: ServerResponse[] = [];
  const liveSockets = new Set<import("node:net").Socket>();

  const page = () => {
    if (!browser) throw new Error("Owned browser is unavailable");
    return browser;
  };
  const authRequests = () => requests.filter((request) => request.path.startsWith("/api/v1/auth/"));
  const recoveryRequests = () => requests.filter((request) => request.path === FORGOT || request.path === RESET);
  const sendResponse = (response: ServerResponse, responsePlan = plan) => {
    response.writeHead(responsePlan.status, { "Content-Type": "application/json" });
    response.end(responsePlan.body);
  };

  beforeAll(async () => {
    const executable = process.env.CHROME_PATH ?? [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    ].find(existsSync);
    if (!executable || !existsSync(executable)) {
      throw new Error("Opt-in browser tests require an installed Chromium executable (CHROME_PATH)");
    }
    profile = await mkdtemp(join(tmpdir(), PROFILE_PREFIX));
    gateway = createHttpServer(async (request, response) => {
      response.setHeader("Access-Control-Allow-Origin", frontendOrigin);
      response.setHeader("Access-Control-Allow-Headers", "content-type,authorization,x-dev-user-id");
      response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      response.setHeader("Vary", "Origin");
      if (request.method === "OPTIONS") { response.writeHead(204); response.end(); return; }
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      const rawBody = Buffer.concat(chunks).toString("utf8");
      let body: unknown = null;
      try { body = rawBody ? JSON.parse(rawBody) : null; } catch { body = "invalid-json"; }
      const path = (request.url ?? "").split("?")[0];
      requests.push({ method: request.method ?? "", path, headers: request.headers, body });
      if (path !== FORGOT && path !== RESET) {
        sendResponse(response, { status: 401, body: JSON.stringify({ success: false, error: { code: "UNAUTHORIZED" } }) });
      } else if (plan.hold) heldResponses.push(response);
      else sendResponse(response);
    });
    gateway.on("connection", (socket) => { liveSockets.add(socket); socket.on("close", () => liveSockets.delete(socket)); });
    await new Promise<void>((done) => gateway!.listen(0, "127.0.0.1", done));
    const address = gateway.address();
    if (!address || typeof address === "string") throw new Error("Gateway stub did not acquire an owned port");
    gatewayOrigin = "http://127.0.0.1:" + address.port;
    vite = await createViteServer({
      root: FRONTEND_ROOT,
      configFile: false,
      cacheDir: join(profile, "vite-cache"),
      plugins: [react()],
      logLevel: "error",
      resolve: { alias: { "@": join(FRONTEND_ROOT, "src") } },
      define: Object.fromEntries(Object.entries({
        VITE_BACKEND_URL: gatewayOrigin,
        VITE_TENANT_BACKEND_URL: gatewayOrigin,
        VITE_COURSE_BACKEND_URL: gatewayOrigin,
        VITE_ASSESSMENT_BACKEND_URL: gatewayOrigin,
        VITE_DEV_IDENTITY_PROXY: "0",
        VITE_DEV_FAKE_USER_ID: "",
      }).map(([key, value]) => ["import.meta.env." + key, JSON.stringify(value)])),
      server: { host: "127.0.0.1", port: 0, strictPort: true, hmr: false },
      css: { preprocessorOptions: { scss: { api: "modern-compiler" } } },
    });
    await vite.listen();
    const viteAddress = vite.httpServer?.address();
    if (!viteAddress || typeof viteAddress === "string") throw new Error("Vite did not acquire an owned port");
    frontendOrigin = "http://127.0.0.1:" + viteAddress.port;
    chrome = spawn(executable, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
      "--disable-background-networking", "--disable-sync", "--disable-component-update", "--remote-debugging-address=127.0.0.1",
      "--remote-debugging-port=0", "--user-data-dir=" + profile, "about:blank"], { stdio: "ignore", windowsHide: true });
    const deadline = Date.now() + 15000;
    let port = "";
    while (Date.now() < deadline && !port) {
      try { port = (await readFile(join(profile, "DevToolsActivePort"), "utf8")).split(/\r?\n/)[0]; }
      catch { await delay(100); }
    }
    if (!port) throw new Error("Owned Chromium did not open its local debugging endpoint");
    const targets = (await fetch("http://127.0.0.1:" + port + "/json/list").then((response) => response.json())) as
      { type: string; webSocketDebuggerUrl: string }[];
    const target = targets.find((entry) => entry.type === "page");
    if (!target) throw new Error("Owned Chromium did not create a page target");
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise<void>((done, reject) => { socket.addEventListener("open", () => done(), { once: true });
      socket.addEventListener("error", () => reject(new Error("Could not connect to owned Chromium")), { once: true }); });
    browser = new BrowserConnection(socket, [frontendOrigin, gatewayOrigin]);
    await browser.call("Page.enable");
    await browser.call("Runtime.enable");
    await browser.call("Network.enable");
    await browser.call("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" }] });
    await browser.call("Page.addScriptToEvaluateOnNewDocument", {
      source: "try { localStorage.clear(); sessionStorage.clear(); } catch { /* opaque initial origin */ }",
    });
  }, 120000);

  beforeEach(() => {
    requests.length = 0;
    heldResponses.splice(0).forEach((response) => response.destroy());
    plan = success();
    page().requests.length = 0;
    page().diagnostics.length = 0;
    page().failRecoveryRequests = false;
    page().failedRecoveryAttempts = 0;
  });

  afterEach(async () => {
    heldResponses.splice(0).forEach((response) => response.destroy());
    if (!browser) return;
    expect(browser.diagnostics.join("\n")).not.toContain(RAW_TOKEN);
    expect(browser.diagnostics.join("\n")).not.toContain(PASSWORD);
    expect(browser.diagnostics.join("\n")).not.toContain(BACKEND_SECRET);
    const storage = await browser.evaluate<string>("JSON.stringify({ local: {...localStorage}, session: {...sessionStorage} })");
    expect(storage).not.toContain(RAW_TOKEN);
    expect(storage).not.toContain(PASSWORD);
    expect(authRequests().filter((request) => ![FORGOT, RESET].includes(request.path))).toHaveLength(0);
    for (const request of recoveryRequests()) {
      expect(request.headers.authorization).toBeUndefined();
      expect(request.headers["x-dev-user-id"]).toBeUndefined();
      expect(request.headers["x-internal-key"]).toBeUndefined();
      expect(request.headers["x-user-id"]).toBeUndefined();
      expect(request.headers["x-organization-id"]).toBeUndefined();
      expect(request.headers["x-user-role"]).toBeUndefined();
      if (request.path === RESET) expect(request.headers.referer).toBeUndefined();
    }
  });

  afterAll(async () => {
    if (browser) { await browser.call("Browser.close").catch(() => undefined); browser.close(); }
    if (chrome && chrome.exitCode === null) {
      const child = chrome;
      await Promise.race([new Promise<void>((done) => child.once("exit", () => done())), delay(5000)]);
      if (child.exitCode === null) child.kill();
    }
    await vite?.close();
    liveSockets.forEach((socket) => socket.destroy());
    if (gateway) await new Promise<void>((done) => gateway!.close(() => done()));
    if (profile) {
      const owned = resolve(profile);
      if (dirname(owned) !== resolve(tmpdir()) || !basename(owned).startsWith(PROFILE_PREFIX)) {
        throw new Error("Refusing to remove a browser profile outside the owned temporary directory");
      }
      await rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    }
  }, 30000);

  async function visit(path: string) {
    await page().call("Page.navigate", { url: frontendOrigin + path });
    await page().waitFor("!!document.querySelector('.auth-card') && document.readyState !== 'loading'", "recovery screen rendered", 45000);
    expect(await page().evaluate<boolean>("document.body.innerText.toLowerCase().includes('demo-token')")).toBe(false);
  }

  async function waitForRequest(count = 1) {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline && recoveryRequests().length < count) await delay(25);
    expect(recoveryRequests()).toHaveLength(count);
  }

  async function waitForError() {
    await page().waitFor("!!document.querySelector('[role=alert]') && !document.querySelector('button[type=submit]')?.disabled",
      "readable recovery failure with submit re-enabled");
    expect(await page().evaluate<string>("document.body.innerText")).not.toContain(BACKEND_SECRET);
    expect(await page().evaluate<boolean>("!!document.querySelector('.auth-confirmation')")).toBe(false);
    expect(await page().evaluate<boolean>("document.querySelector('h1')?.textContent === 'Password reset'")).toBe(false);
  }

  async function fillReset(password = PASSWORD, confirmation = password) {
    await page().fill("input[autocomplete=new-password]", password);
    await page().fill("input[autocomplete=new-password]", confirmation, 1);
  }

  it("validates required/invalid email in the real Ant Design form without an API request", async () => {
    await visit("/forgot-password");
    await page().submit();
    await page().waitFor("document.body.innerText.includes('Enter your email address')", "required email validation");
    await page().fill("input[autocomplete=email]", "not-an-email");
    await page().submit();
    await page().waitFor("document.body.innerText.includes('valid email')", "email syntax validation");
    expect(recoveryRequests()).toHaveLength(0);
    expect(await page().evaluate<boolean>("!!document.querySelector('a[href=\"/login\"]')")).toBe(true);
  });

  it.each([EMAIL, "unknown-account@identity-contract.invalid"])("uses neutral success for an accepted request (%#)", async (email) => {
    await visit("/forgot-password");
    await page().fill("input[autocomplete=email]", email);
    await page().submit();
    await waitForRequest();
    await page().waitFor("!!document.querySelector('.auth-confirmation')", "neutral recovery confirmation");
    const confirmation = await page().evaluate<string>("document.querySelector('.auth-confirmation').textContent");
    expect(confirmation).not.toContain(email);
    expect(confirmation).toMatch(/if|eligible/i);
    expect(confirmation).not.toMatch(/was sent|has been sent/i);
    expect(recoveryRequests()[0]).toMatchObject({ method: "POST", path: FORGOT, body: { email } });
    expect(await page().evaluate<boolean>("!!document.querySelector('a[href*=\"demo-token\"]')")).toBe(false);
  });

  it("disables forgot submission and rejects duplicate submit events while the request is pending", async () => {
    plan.hold = true;
    await visit("/forgot-password");
    await page().fill("input[autocomplete=email]", EMAIL);
    await page().submit();
    await waitForRequest();
    expect(await page().evaluate<boolean>("document.querySelector('button[type=submit]').disabled")).toBe(true);
    expect(await page().evaluate<boolean>("document.querySelector('input[autocomplete=email]').disabled")).toBe(true);
    await page().evaluate("document.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))");
    await delay(150);
    expect(recoveryRequests()).toHaveLength(1);
    plan.hold = false;
    heldResponses.splice(0).forEach((response) => sendResponse(response));
    await page().waitFor("!!document.querySelector('.auth-confirmation')", "confirmation after pending response completes");
  });

  const unavailableResponses: [string, ResponsePlan][] = [
    ["success:false", { status: 200, body: JSON.stringify({ success: false, error: { message: BACKEND_SECRET } }) }],
    ["malformed JSON", { status: 200, body: "not-json-" + BACKEND_SECRET }],
    ["HTTP failure", { status: 503, body: JSON.stringify({ success: false, error: { message: BACKEND_SECRET } }) }],
    ["network failure", { status: 200, body: "", networkFailure: true }],
  ];

  it.each(unavailableResponses)("does not pretend to send an email after %s", async (_label, response) => {
    plan = response;
    await visit("/forgot-password");
    page().failRecoveryRequests = response.networkFailure === true;
    await page().fill("input[autocomplete=email]", EMAIL);
    await page().submit();
    if (!response.networkFailure) await waitForRequest();
    await waitForError();
    if (response.networkFailure) {
      expect(page().failedRecoveryAttempts).toBe(1);
      expect(recoveryRequests()).toHaveLength(0);
    }
  });

  it("validates mismatched, too-short and whitespace-only passwords without calling reset", async () => {
    await visit("/reset-password/" + encodeURIComponent(RAW_TOKEN));
    await fillReset("12345", "different");
    await page().submit();
    await page().waitFor("document.body.innerText.includes('6 characters') && document.body.innerText.includes('Passwords do not match')",
      "password length and confirmation validation");
    expect(recoveryRequests()).toHaveLength(0);
    await fillReset("      ");
    await page().submit();
    await page().waitFor("document.body.innerText.includes('Enter a new password')", "whitespace-only password validation");
    expect(recoveryRequests()).toHaveLength(0);
  });

  it("rejects a blank recovery route parameter without submitting credentials", async () => {
    await visit("/reset-password/%20");
    await page().waitFor("!!document.querySelector('[role=alert]')", "missing recovery authority feedback");
    expect(await page().evaluate<boolean>("document.querySelector('button[type=submit]').disabled")).toBe(true);
    expect(await page().evaluate<string>("document.querySelector('[role=alert]').textContent")).toMatch(/invalid|expired|usable/i);
    expect(recoveryRequests()).toHaveLength(0);
    expect(await page().evaluate<boolean>("!!document.querySelector('a[href=\"/forgot-password\"]')")).toBe(true);
  });

  it("applies the BCrypt UTF-8 byte limit rather than a JavaScript-character-only limit", async () => {
    await visit("/reset-password/" + encodeURIComponent(RAW_TOKEN));
    await fillReset("🔒".repeat(19));
    await page().submit();
    await page().waitFor("document.body.innerText.includes('Password is too long')", "UTF-8 password byte limit");
    expect(recoveryRequests()).toHaveLength(0);
  });

  it("submits the route token and a valid six-character password exactly once, then offers sign-in without authentication", async () => {
    plan.hold = true;
    await visit("/reset-password/" + encodeURIComponent(RAW_TOKEN));
    await fillReset();
    await page().submit();
    await waitForRequest();
    expect(await page().evaluate<boolean>("document.querySelector('button[type=submit]').disabled")).toBe(true);
    await page().evaluate("document.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))");
    await delay(150);
    expect(recoveryRequests()).toHaveLength(1);
    expect(recoveryRequests()[0]).toMatchObject({ method: "POST", path: RESET,
      body: { token: RAW_TOKEN, newPassword: PASSWORD, confirmPassword: PASSWORD } });
    plan.hold = false;
    heldResponses.splice(0).forEach((response) => sendResponse(response));
    await page().waitFor("document.querySelector('h1')?.textContent === 'Password reset'", "successful password reset response");
    expect(await page().evaluate("localStorage.getItem('access_token')")).toBeNull();
    expect(await page().evaluate("localStorage.getItem('refresh_token')")).toBeNull();
    await page().evaluate("Array.from(document.querySelectorAll('button,a')).find(node=>node.textContent.includes('sign in')).click()");
    await page().waitFor("location.pathname === '/login'", "explicit sign-in navigation");
  });

  it.each(["expired", "reused", "revoked"])("shows the same safe invalid-link outcome for a %s token", async () => {
    // Identity intentionally returns the same contract for all three lifecycle states.
    plan = { status: 400, body: JSON.stringify({ success: false,
      error: { code: "BAD_REQUEST", message: "Invalid, expired, or already used password reset token" } }) };
    await visit("/reset-password/" + encodeURIComponent(RAW_TOKEN));
    await fillReset();
    await page().submit();
    await waitForRequest();
    await waitForError();
    expect(await page().evaluate<string>("document.querySelector('[role=alert]').textContent")).toMatch(/invalid|expired|used|no longer valid/i);
    expect(await page().evaluate<boolean>("!!document.querySelector('a[href=\"/forgot-password\"]')")).toBe(true);
  });

  it.each(unavailableResponses)("does not claim password reset after %s", async (_label, response) => {
    plan = response;
    await visit("/reset-password/" + encodeURIComponent(RAW_TOKEN));
    page().failRecoveryRequests = response.networkFailure === true;
    await fillReset();
    await page().submit();
    if (!response.networkFailure) await waitForRequest();
    await waitForError();
    if (response.networkFailure) {
      expect(page().failedRecoveryAttempts).toBe(1);
      expect(recoveryRequests()).toHaveLength(0);
    }
  });

  it("does not refresh, replace or transmit an unrelated existing browser session for public recovery", async () => {
    plan = { status: 401, body: JSON.stringify({ success: false, error: { code: "UNAUTHORIZED" } }) };
    await visit("/forgot-password");
    await page().evaluate("localStorage.setItem('access_token','synthetic-existing-access');localStorage.setItem('refresh_token','synthetic-existing-refresh')");
    await page().fill("input[autocomplete=email]", EMAIL);
    await page().submit();
    await waitForRequest();
    await waitForError();
    expect(await page().evaluate("localStorage.getItem('access_token')")).toBe("synthetic-existing-access");
    expect(await page().evaluate("localStorage.getItem('refresh_token')")).toBe("synthetic-existing-refresh");
    expect(authRequests()).toHaveLength(1);
  });

  it("sets no-referrer before the external font and recovery API requests can expose the route token", async () => {
    await visit("/reset-password/" + encodeURIComponent(RAW_TOKEN));
    expect(await page().evaluate<string>("document.querySelector('meta[name=referrer]')?.getAttribute('content')")).toBe("no-referrer");
    const fontRequests = page().requests.filter((request) => request.url.startsWith("https://fonts."));
    expect(fontRequests.length).toBeGreaterThan(0);
    for (const request of fontRequests) {
      expect(request.referrerPolicy).toBe("no-referrer");
      // CDP can represent an omitted Referer as an empty header before interception.
      expect(Object.entries(request.headers).find(([name]) => name.toLowerCase() === "referer")?.[1] ?? "").toBe("");
    }
    await fillReset();
    await page().submit();
    await waitForRequest();
    expect(recoveryRequests()[0].headers.referer).toBeUndefined();
  });
});

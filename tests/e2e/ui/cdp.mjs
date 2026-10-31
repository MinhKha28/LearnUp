import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** First usable Chromium/Chrome: CHROME_PATH, then PATH names, then a Playwright cache. */
export function findChrome() {
  const candidates = [process.env.CHROME_PATH, ...["google-chrome", "chromium", "chromium-browser", "chrome"].map(onPath)];
  for (const root of [process.env.PLAYWRIGHT_BROWSERS_PATH, "/opt/pw-browsers", path.join(os.homedir(), ".cache/ms-playwright")]) {
    if (!root || !fs.existsSync(root)) continue;
    for (const dir of fs.readdirSync(root).sort().reverse())
      candidates.push(path.join(root, dir, "chrome-linux64/chrome"), path.join(root, dir, "chrome-linux/chrome"));
  }
  const found = candidates.find((c) => c && fs.existsSync(c));
  if (!found) throw new Error("no Chromium found: set CHROME_PATH or install chromium");
  return found;
}

function onPath(name) {
  for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
    const full = path.join(dir, name);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

/** Raw Chrome DevTools Protocol over Node's built-in WebSocket; no npm dependency. */
export class Browser {
  static async launch() {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), "learnup-e2e-ui-"));
    const proc = spawn(
      findChrome(),
      ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--remote-debugging-port=0",
        `--user-data-dir=${profile}`, "--window-size=1366,900", "--lang=vi-VN", "about:blank"],
      { stdio: ["ignore", "ignore", "pipe"], detached: true },
    );
    const url = await new Promise((resolve, reject) => {
      let log = "";
      const timer = setTimeout(() => reject(new Error(`Chrome did not report a DevTools endpoint: ${log.slice(-300)}`)), 20000);
      proc.stderr.on("data", (chunk) => {
        log += chunk;
        const m = /DevTools listening on (ws:\/\/\S+)/.exec(log);
        if (m) {
          clearTimeout(timer);
          resolve(m[1]);
        }
      });
      proc.on("exit", (code) => reject(new Error(`Chrome exited early (${code}): ${log.slice(-300)}`)));
    });
    const browser = new Browser(proc, profile, new WebSocket(url));
    await new Promise((resolve, reject) => {
      browser.ws.onopen = resolve;
      browser.ws.onerror = () => reject(new Error("DevTools WebSocket failed"));
    });
    browser.ws.onmessage = (event) => browser.#dispatch(JSON.parse(event.data));
    return browser;
  }

  #seq = 0;
  #pending = new Map();
  #listeners = new Map();
  constructor(proc, profile, ws) {
    Object.assign(this, { proc, profile, ws });
  }

  #dispatch(msg) {
    if (msg.id) {
      const p = this.#pending.get(msg.id);
      this.#pending.delete(msg.id);
      if (!p) return;
      clearTimeout(p.timer);
      if (msg.error) p.reject(new Error(`${p.method}: ${msg.error.message}`));
      else p.resolve(msg.result);
    } else if (msg.sessionId) this.#listeners.get(msg.sessionId)?.(msg.method, msg.params);
  }

  send(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      const id = ++this.#seq;
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }, 30000);
      this.#pending.set(id, { resolve, reject, timer, method });
      this.ws.send(JSON.stringify({ id, method, params, ...(sessionId && { sessionId }) }));
    });
  }

  onSession(sessionId, handler) {
    this.#listeners.set(sessionId, handler);
  }

  /** A fresh, isolated browser context (own cookies/storage) with one page. */
  async newPage() {
    const { browserContextId } = await this.send("Target.createBrowserContext");
    const { targetId } = await this.send("Target.createTarget", { url: "about:blank", browserContextId });
    const { sessionId } = await this.send("Target.attachToTarget", { targetId, flatten: true });
    const page = new Page(this, sessionId, browserContextId);
    await page.init();
    return page;
  }

  async close() {
    try {
      this.ws.close();
    } catch {
      /* already closed */
    }
    const exited = new Promise((resolve) => this.proc.once("exit", resolve));
    try {
      process.kill(-this.proc.pid, "SIGKILL"); // whole Chrome process group (renderers, zygote)
    } catch {
      this.proc.kill("SIGKILL");
    }
    await exited;
    try {
      fs.rmSync(this.profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    } catch {
      /* temp profile of this run only; the OS clears /tmp */
    }
  }
}

export class Page {
  constructor(browser, sessionId, contextId) {
    Object.assign(this, { browser, sessionId, contextId });
    this.errors = []; // uncaught exceptions
    this.responses = []; // { status, url, method }
    this.failures = []; // network-level failures
    this.inflight = new Map();
    this.requestMethods = new Map();
  }

  cmd = (method, params) => this.browser.send(method, params, this.sessionId);

  async init() {
    this.browser.onSession(this.sessionId, (method, p) => {
      if (method === "Runtime.exceptionThrown")
        this.errors.push(p.exceptionDetails.exception?.description ?? p.exceptionDetails.text);
      else if (method === "Network.requestWillBeSent") {
        this.inflight.set(p.requestId, p.request.url);
        this.requestMethods.set(p.requestId, p.request.method);
      } else if (method === "Network.responseReceived")
        this.responses.push({ status: p.response.status, url: p.response.url, method: this.requestMethods.get(p.requestId) ?? "GET" });
      else if (method === "Network.loadingFinished") this.inflight.delete(p.requestId);
      else if (method === "Network.loadingFailed") {
        this.inflight.delete(p.requestId);
        if (!p.canceled) this.failures.push({ url: p.request?.url, error: p.errorText });
      }
    });
    await Promise.all(["Page", "Runtime", "Network"].map((d) => this.cmd(`${d}.enable`)));
  }

  async goto(url) {
    await this.cmd("Page.navigate", { url });
  }

  async eval(expression) {
    const r = await this.cmd("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(`page evaluation failed: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
    return r.result.value;
  }

  /** Polls a page-side boolean expression until it is truthy; never a fixed sleep. */
  async waitFor(expression, what, timeoutMs = 20000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await this.eval(`(() => { try { return Boolean(${expression}); } catch { return false; } })()`)) return;
      await new Promise((r) => setTimeout(r, 40));
    }
    const text = await this.bodyText().catch(() => "");
    throw new Error(`timed out waiting for ${what ?? expression}; page shows: ${text.slice(0, 300).replace(/\s+/g, " ")}`);
  }

  /** Waits until the page has had no request in flight for `quietMs`. */
  async networkIdle(quietMs = 400, timeoutMs = 20000) {
    const deadline = Date.now() + timeoutMs;
    let quietSince = null;
    while (Date.now() < deadline) {
      if (this.inflight.size === 0) {
        quietSince ??= Date.now();
        if (Date.now() - quietSince >= quietMs) return;
      } else quietSince = null;
      await new Promise((r) => setTimeout(r, 40));
    }
    throw new Error(`network not idle; pending: ${[...this.inflight.values()].join(", ").slice(0, 300)}`);
  }

  bodyText = () => this.eval("document.body.innerText");
  hasText = (text) => this.eval(`document.body.innerText.includes(${JSON.stringify(text)})`);
  waitForText = (text, timeoutMs) => this.waitFor(`document.body.innerText.includes(${JSON.stringify(text)})`, `text "${text}"`, timeoutMs);
  path = () => this.eval("location.pathname + location.search");

  /** Real mouse click at the centre of the first visible element matched by the page-side expression. */
  async click(elementExpr, what) {
    await this.waitFor(`(${elementExpr})`, what ?? elementExpr);
    const centre = () => this.eval(`(() => { const el = (${elementExpr}); el.scrollIntoView({block:"center"}); const r = el.getBoundingClientRect(); return JSON.stringify({ x: r.x + r.width / 2, y: r.y + r.height / 2 }); })()`);
    // Wait until the element stops moving (dropdown/modal animations).
    let last = await centre();
    for (let i = 0; i < 100; i++) {
      await new Promise((r) => setTimeout(r, 50));
      const now = await centre();
      if (now === last) break;
      last = now;
    }
    const box = JSON.parse(last);
    for (const type of ["mouseMoved", "mousePressed", "mouseReleased"])
      await this.cmd("Input.dispatchMouseEvent", { type, x: box.x, y: box.y, button: "left", clickCount: 1, buttons: type === "mousePressed" ? 1 : 0 });
  }

  /** Clicks the visible element of `selector` whose text equals or contains `text`. */
  clickText = (selector, text, what) =>
    this.click(
      `[...document.querySelectorAll(${JSON.stringify(selector)})].find((e) => e.offsetParent !== null && e.textContent.trim().includes(${JSON.stringify(text)}))`,
      what ?? `${selector} "${text}"`,
    );

  async type(inputExpr, value, what) {
    await this.click(inputExpr, what);
    await this.cmd("Input.insertText", { text: value });
  }

  /** Presses and releases one key (e.g. "Enter") on the focused element. */
  async press(key) {
    const code = { Enter: 13, ArrowDown: 40 }[key];
    for (const type of ["keyDown", "keyUp"])
      await this.cmd("Input.dispatchKeyEvent", { type, key, code: key, windowsVirtualKeyCode: code, ...(key === "Enter" && type === "keyDown" && { text: "\r" }) });
  }

  async screenshot(file) {
    const { data } = await this.cmd("Page.captureScreenshot", { format: "png" });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(data, "base64"));
  }

  async close() {
    await this.browser.send("Target.disposeBrowserContext", { browserContextId: this.contextId }).catch(() => {});
  }
}

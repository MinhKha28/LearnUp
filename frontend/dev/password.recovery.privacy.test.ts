import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const nginx = readFileSync(new URL("../nginx.conf", import.meta.url), "utf8");
const guard = html.match(/<script id="password-recovery-privacy">([\s\S]*?)<\/script>/)?.[1];

function executeGuard(pathname: string) {
  const children: Record<string, string>[] = [];
  const created: string[] = [];
  const document = {
    createElement: (tag: string) => {
      created.push(tag);
      return {};
    },
    head: { appendChild: (element: Record<string, string>) => children.push(element) },
  };
  runInNewContext(guard || "", { window: { location: { pathname } }, document });
  return { children, created };
}

function nginxMapPattern(variable: string) {
  const block = nginx.match(new RegExp(`map \\$${variable} [^\\{]+\\{([\\s\\S]*?)\\}`))?.[1];
  const pattern = block?.match(/~\*(\S+)\s+"/i)?.[1];
  expect(pattern).toBeTruthy();
  return new RegExp(pattern || "(?!)", "i");
}

describe("early password recovery referrer protection", () => {
  it("runs before resource references and leaves typography/resource policy unchanged", () => {
    expect(guard).toBeTruthy();
    expect(html.indexOf('id="password-recovery-privacy"')).toBeLessThan(html.indexOf('<link '));
    expect(html.indexOf('id="password-recovery-privacy"')).toBeLessThan(html.indexOf('type="module"'));
    expect(guard).not.toContain("Content-Security-Policy");
    expect(guard).not.toContain("console.");
    expect(guard).not.toContain("localStorage");
    expect(guard).not.toContain("sessionStorage");
  });

  it.each([
    "/reset-password",
    "/reset-password/",
    "/reset-password/synthetic-sensitive-token",
    "/reset-password/invalid%ZZtoken",
    "/%72eset%2Dpassword/synthetic-sensitive-token",
    "/%52ESET-PASSWORD/synthetic-sensitive-token",
    "/%72eset-password/invalid%ZZtoken",
    "/reset-password%2Fsynthetic-sensitive-token",
    "//reset-password/synthetic-sensitive-token",
  ])("sets no-referrer before app startup for %s", (path) => {
    expect(executeGuard(path)).toEqual({
      children: [{ id: "password-recovery-referrer", name: "referrer", content: "no-referrer" }],
      created: ["meta"],
    });
  });

  it.each(["/", "/login", "/forgot-password", "/register", "/learner/courses", "/reset-password-help", "/invalid%ZZ/path"])(
    "does not modify unrelated path %s",
    (path) => expect(executeGuard(path)).toEqual({ children: [], created: [] }),
  );
});

describe("recovery-only Nginx access-log redaction", () => {
  it("uses original request URI through SPA fallback and retains combined-log diagnostics", () => {
    expect(nginx).toContain("map $request_uri $recovery_safe_request");
    expect(nginx).toContain("default $request;");
    expect(nginx).toContain("default $http_referer;");
    expect(nginx).toContain('"" "-";');
    expect(nginx).toContain("$request_method /reset-password/[redacted] $server_protocol");
    expect(nginx).toContain("$remote_addr - $remote_user [$time_local]");
    expect(nginx).toContain("$status $body_bytes_sent");
    expect(nginx).toContain("$http_user_agent");
    expect(nginx).toContain("try_files $uri $uri/ /index.html;");
    expect(nginx).toContain("access_log /var/log/nginx/access.log recovery_safe_combined;");
    expect(nginx).not.toMatch(/access_log\s+off/);
  });

  it.each([
    "/reset-password/synthetic-sensitive-token?tracking=private",
    "/reset-password?token=synthetic-sensitive-token",
    "/RESET-PASSWORD/synthetic-sensitive-token",
    "/%72eset%2dpassword/synthetic-sensitive-token",
    "/%52%45%53%45%54%2D%50%41%53%53%57%4F%52%44/synthetic-sensitive-token",
    "/reset-password%2fsynthetic-sensitive-token",
    "//reset-password/synthetic-sensitive-token",
    "/%2freset-password/synthetic-sensitive-token",
  ])("redacts original sensitive request %s", (uri) => {
    expect(nginxMapPattern("request_uri").test(uri)).toBe(true);
  });

  it.each(["/", "/login", "/forgot-password", "/reset-password-help", "/assets/index.css?theme=light"])(
    "preserves the original non-recovery request %s",
    (uri) => expect(nginxMapPattern("request_uri").test(uri)).toBe(false),
  );

  it.each([
    "https://learnup.example/reset-password/synthetic-sensitive-token",
    "https://learnup.example/reset-password?token=synthetic-sensitive-token",
    "https://learnup.example/%72eset%2Dpassword/synthetic-sensitive-token",
    "https://learnup.example/%52%45%53%45%54%2D%50%41%53%53%57%4F%52%44/synthetic-sensitive-token",
  ])("redacts a sensitive Referer %s", (referer) => {
    expect(nginxMapPattern("http_referer").test(referer)).toBe(true);
  });

  it.each(["https://learnup.example/", "https://learnup.example/login", "https://learnup.example/reset-password-help", ""])(
    "preserves ordinary Referer %s",
    (referer) => expect(nginxMapPattern("http_referer").test(referer)).toBe(false),
  );
});

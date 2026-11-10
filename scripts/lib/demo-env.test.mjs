import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { loadDotenvParse, readEnvFile, tenantDemoEnv } from "./demo-env.mjs";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const parse = loadDotenvParse(path.join(ROOT, "services", "tenant-service"));
const LONG_KEY = "k".repeat(24) + "-" + "q".repeat(24);

const tempDirs = [];
after(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

const envFile = (content) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "demo-env-"));
  tempDirs.push(dir);
  const file = path.join(dir, ".env");
  fs.writeFileSync(file, content);
  return file;
};

test("a quoted value over several lines is read whole, like tenant's dotenv", () => {
  const file = envFile(
    `OTHER=1\nEMAIL_OTP_SECRET="${LONG_KEY.slice(0, 20)}\n${LONG_KEY.slice(20)}"\nNEXT=2\n`,
  );
  const env = readEnvFile(file, parse);
  assert.equal(
    env.get("EMAIL_OTP_SECRET"),
    `${LONG_KEY.slice(0, 20)}\n${LONG_KEY.slice(20)}`,
  );
  assert.ok(Buffer.byteLength(env.get("EMAIL_OTP_SECRET")) >= 32);
  assert.equal(env.get("NEXT"), "2");
});

test("a value containing '=' keeps everything after the first '='", () => {
  const env = readEnvFile(
    envFile("DATABASE_URL=postgresql://u:p@h:5432/db?schema=public&x=1\n"),
    parse,
  );
  assert.equal(
    env.get("DATABASE_URL"),
    "postgresql://u:p@h:5432/db?schema=public&x=1",
  );
});

test("CRLF line endings, comments and quotes are read as dotenv reads them", () => {
  const env = readEnvFile(
    envFile(
      `# comment\r\nA=plain\r\nB="quoted # not a comment"\r\nC=value # comment\r\nEMAIL_OTP_SECRET=${LONG_KEY}\r\n`,
    ),
    parse,
  );
  assert.equal(env.get("A"), "plain");
  assert.equal(env.get("B"), "quoted # not a comment");
  assert.equal(env.get("C"), "value");
  assert.equal(env.get("EMAIL_OTP_SECRET"), LONG_KEY);
});

test("a missing file gives null", () => {
  assert.equal(
    readEnvFile(path.join(os.tmpdir(), "no-such-dir-demo-env", ".env"), parse),
    null,
  );
});

const pick = (processValue, content) =>
  tenantDemoEnv({
    processValue,
    fileEnv: content === null ? null : readEnvFile(envFile(content), parse),
    onGenerate: (message) => messages.push(message),
  });
let messages = [];

for (const [label, processValue, content, expected] of [
  ["key in the environment is kept", LONG_KEY, "EMAIL_OTP_SECRET=", "kept"],
  [
    "blank environment, key in .env is passed",
    "   ",
    `EMAIL_OTP_SECRET=${LONG_KEY}`,
    "file",
  ],
  [
    "comment-only value generates",
    undefined,
    "EMAIL_OTP_SECRET= # put the key here",
    "generated",
  ],
  [
    "whitespace-only quoted value generates",
    undefined,
    'EMAIL_OTP_SECRET="   "',
    "generated",
  ],
  [
    "quoted key with a trailing comment is passed",
    "",
    `EMAIL_OTP_SECRET="${LONG_KEY}" # dev key`,
    "file",
  ],
  ["no .env generates", undefined, null, "generated"],
  [
    "multiline key in .env is passed whole",
    "",
    `EMAIL_OTP_SECRET="${LONG_KEY.slice(0, 20)}\n${LONG_KEY.slice(20)}"`,
    "multiline",
  ],
]) {
  test(`tenantDemoEnv: ${label}`, () => {
    messages = [];
    const result = pick(processValue, content);
    if (expected === "kept") assert.equal(result, undefined);
    if (expected === "file")
      assert.deepEqual(result, { EMAIL_OTP_SECRET: LONG_KEY });
    if (expected === "multiline") {
      assert.equal(
        result.EMAIL_OTP_SECRET,
        `${LONG_KEY.slice(0, 20)}\n${LONG_KEY.slice(20)}`,
      );
    }
    if (expected === "generated") {
      assert.equal(
        Buffer.from(result.EMAIL_OTP_SECRET, "base64url").length,
        32,
      );
      assert.equal(messages.length, 1);
      assert.ok(!messages[0].includes(result.EMAIL_OTP_SECRET));
    } else {
      assert.equal(messages.length, 0);
    }
  });
}

test("no key value reaches the console", (t) => {
  const printed = [];
  for (const method of ["log", "error", "warn", "info"]) {
    t.mock.method(console, method, (...args) => printed.push(args.join(" ")));
  }
  pick("", `EMAIL_OTP_SECRET="${LONG_KEY}"`);
  const generated = tenantDemoEnv({
    processValue: undefined,
    fileEnv: null,
    onGenerate: console.log,
  });
  const output = printed.join("\n");
  assert.ok(!output.includes(LONG_KEY));
  assert.ok(!output.includes(generated.EMAIL_OTP_SECRET));
});

test("a missing dotenv gives a clear message without any value", () => {
  assert.throws(
    () => loadDotenvParse(path.join(os.tmpdir(), "no-such-service")),
    /npm ci/,
  );
});

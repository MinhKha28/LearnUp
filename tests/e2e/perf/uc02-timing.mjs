#!/usr/bin/env node
/**
 * UC02 response timing per branch (Issue #218, BR-12): does the answer time tell an email that
 * already has an account apart from a new one?
 *
 * Runs against the disposable E2E cluster only (tests/e2e/cluster/start.sh), with tenant built from
 * the branch under test. Single client, requests sent one at a time, branches interleaved round by
 * round so a slow moment of the machine hits every branch alike.
 *
 *   node tests/e2e/perf/uc02-timing.mjs            20 samples per branch
 *   UC02_SAMPLES=40 node tests/e2e/perf/uc02-timing.mjs
 *   UC02_LIMIT=5 ...   skip reading max_link_resends_per_24h with psql
 *
 * Branches (UC02 cases):
 *   new                 email never seen: identity call + new registration
 *   replace-unverified  C: unverified Pending registration replaced (identity call)
 *   verified-pending    B: verified Pending registration, reopen link sent again
 *   pending-limit       D: Pending registration, per-email limit reached, nothing sent
 *   account-exists      A: email of an account, account-exists mail sent
 *   account-limit       A: email of an account, limit reached, nothing sent
 *
 * Decision rule agreed on #218: a minimum response time is needed when the median gap between any
 * two branches is larger than the p95 - p50 spread of the "new" branch.
 * Creates registrations and accounts with run-prefixed emails in the cluster; it changes no setting.
 */
import { randomBytes } from "node:crypto";
import { GATEWAY } from "../lib/config.mjs";
import { sql } from "../lib/db.mjs";
import { data, percentile, request } from "../lib/http.mjs";
import { mailsTo, registrationOtp } from "../lib/mailbox.mjs";

const SAMPLES = Number(process.env.UC02_SAMPLES ?? 20);
const WARMUP = 3;
const run = `t${Date.now().toString(36)}${randomBytes(2).toString("hex")}`;
let sequence = 0;
const freshEmail = (tag) => `${run}-${tag}-${++sequence}@e2e.learnup.test`;
const password = () => `E2e-${randomBytes(6).toString("hex")}!`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const post = (path, json) => request("POST", `${GATEWAY}${path}`, { json, label: path });

async function offeredPlanId() {
  const res = await request("GET", `${GATEWAY}/api/v1/subscription-plans`);
  const list = [].concat(data(res)?.items ?? data(res) ?? []);
  const plan = list.find((p) => p.isOffered !== false);
  if (!plan?.id) throw new Error(`no offered plan (HTTP ${res.status})`);
  return plan.id;
}

let planId;
const register = (email) =>
  post("/api/v1/registrations", {
    planId,
    organization: {
      name: `Timing ${run}`,
      taxCode: "0312345678",
      address: "123 Nguyễn Huệ, Quận 1, TP.HCM",
      contactPhone: "0901234567",
    },
    organizer: { fullName: "Timing Organizer", email, password: password() },
  });

async function timed(email) {
  const res = await register(email);
  if (res.status !== 202) {
    throw new Error(`expected 202 for ${email}, got ${res.status}: ${JSON.stringify(res.body).slice(0, 200)}`);
  }
  return res.ms;
}

async function latestOtp(email, count) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const otps = mailsTo(email).map(registrationOtp).filter(Boolean);
    if (otps.length >= count) return otps.at(-1);
    await sleep(300);
  }
  throw new Error(`verification mail #${count} to ${email} did not arrive`);
}

/** A Pending registration whose email is verified (case B). */
async function verifiedPending() {
  const email = freshEmail("b");
  await timed(email);
  const res = await post("/api/v1/registrations/verify-email", { email, otp: await latestOtp(email, 1) });
  if (res.status !== 200) throw new Error(`verify failed for ${email}: HTTP ${res.status}`);
  return email;
}

/** An Active Organizer account with no Pending registration (case A). */
async function paidAccount() {
  const email = freshEmail("a");
  await timed(email);
  const verified = await post("/api/v1/registrations/verify-email", { email, otp: await latestOtp(email, 1) });
  const token = data(verified)?.paymentToken;
  if (!token) throw new Error(`verify failed for ${email}: HTTP ${verified.status}`);
  const paid = await post("/api/v1/registrations/payments", { token });
  if (data(paid)?.paymentStatus !== "Succeeded") throw new Error(`payment failed for ${email}: HTTP ${paid.status}`);
  return email;
}

/** Hands out emails, opening a new one once the current one has used up `uses` requests. */
function pool(make, uses) {
  let current = null;
  let left = 0;
  return async () => {
    if (left === 0) {
      current = await make();
      left = uses;
    }
    left -= 1;
    return current;
  };
}

/** Emails that already reached the limit (`limit` counted mails in the last 24 h). */
function exhausted(make, limit) {
  let current = null;
  return async () => {
    if (!current) {
      current = await make();
      for (let i = 0; i < limit; i += 1) await timed(current);
    }
    return current;
  };
}

const ms = (value) => (value === null ? "-" : value.toFixed(1).padStart(7));

async function main() {
  planId = await offeredPlanId();
  const limit = Number(
    process.env.UC02_LIMIT ?? sql("tenant_db", "SELECT max_link_resends_per_24h FROM platform_settings LIMIT 1"),
  );
  if (!Number.isInteger(limit) || limit < 1) throw new Error(`could not read max_link_resends_per_24h (${limit})`);
  console.log(`UC02 timing, run ${run}, gateway ${GATEWAY}, ${SAMPLES} samples per branch, limit ${limit} mails / 24 h`);

  const branches = {
    new: async () => freshEmail("new"),
    "replace-unverified": pool(async () => {
      const email = freshEmail("c");
      await timed(email);
      return email;
    }, limit),
    "verified-pending": pool(verifiedPending, limit),
    "pending-limit": exhausted(verifiedPending, limit),
    "account-exists": pool(paidAccount, limit),
    "account-limit": exhausted(paidAccount, limit),
  };
  const samples = Object.fromEntries(Object.keys(branches).map((name) => [name, []]));

  for (let round = 0; round < WARMUP + SAMPLES; round += 1) {
    for (const [name, nextEmail] of Object.entries(branches)) {
      const email = await nextEmail();
      const elapsed = await timed(email);
      if (round >= WARMUP) samples[name].push(elapsed);
    }
    process.stdout.write(`\r  round ${round + 1}/${WARMUP + SAMPLES}`);
  }
  process.stdout.write("\n");

  const exhaustedAccount = await branches["account-limit"]();
  const accountMails = () => mailsTo(exhaustedAccount).filter((mail) => mail.includes("/forgot-password")).length;
  const mailDeadline = Date.now() + 30000;
  while (accountMails() < limit && Date.now() < mailDeadline) await sleep(500);
  if (accountMails() !== limit) {
    throw new Error(
      `expected ${limit} account-exists mails to ${exhaustedAccount}, found ${accountMails()}: is tenant built from the #218 branch?`,
    );
  }

  const stats = Object.entries(samples).map(([name, values]) => ({
    name,
    p50: percentile(values, 50),
    p95: percentile(values, 95),
    min: Math.min(...values),
    max: Math.max(...values),
  }));
  console.log("\nbranch               p50 ms   p95 ms   min ms   max ms");
  for (const s of stats) console.log(`${s.name.padEnd(19)} ${ms(s.p50)}  ${ms(s.p95)}  ${ms(s.min)}  ${ms(s.max)}`);

  const fresh = stats.find((s) => s.name === "new");
  const spread = fresh.p95 - fresh.p50;
  const medians = stats.map((s) => s.p50);
  const gap = Math.max(...medians) - Math.min(...medians);
  const fastest = stats.reduce((a, b) => (a.p50 <= b.p50 ? a : b));
  const slowest = stats.reduce((a, b) => (a.p50 >= b.p50 ? a : b));
  console.log(`\nlargest median gap: ${gap.toFixed(1)} ms (${slowest.name} - ${fastest.name})`);
  console.log(`"new" p95 - p50 spread: ${spread.toFixed(1)} ms`);
  console.log(
    gap > spread
      ? `=> gap > spread: a minimum response time is needed (suggested: "new" p95 = ${fresh.p95.toFixed(0)} ms)`
      : "=> gap <= spread: no minimum response time needed",
  );
}

main().catch((error) => {
  console.error(`\nUC02 timing failed: ${error.message}`);
  process.exit(1);
});

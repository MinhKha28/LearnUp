import { GATEWAY } from "../lib/config.mjs";
import { login } from "../lib/actors.mjs";
import { literal, sql } from "../lib/db.mjs";
import { assert, expectStatus } from "../lib/harness.mjs";
import { data, request } from "../lib/http.mjs";
import { mailsTo, registrationOtp, reopenToken } from "../lib/mailbox.mjs";

const REPEATS = 10;

const post = (path, json, label) => request("POST", `${GATEWAY}${path}`, { json, label: label ?? path });

async function offeredPlanId() {
  const res = expectStatus(await request("GET", `${GATEWAY}/api/v1/subscription-plans`), 200, "list plans");
  const plans = data(res);
  const list = Array.isArray(plans) ? plans : (plans?.items ?? []);
  const plan = list.find((p) => p.isOffered !== false);
  assert.ok(plan?.id, `no offered subscription plan: ${JSON.stringify(res.body).slice(0, 300)}`);
  return plan.id;
}

const registrationBody = (planId, email, password, tag) => ({
  planId,
  organization: {
    name: `Tổ chức ${tag}`,
    taxCode: "0312345678",
    address: "123 Nguyễn Huệ, Quận 1, TP.HCM",
    contactPhone: "0901234567",
  },
  organizer: { fullName: `Organizer ${tag}`, email, password },
});

const register = (planId, email, password, tag) =>
  post("/api/v1/registrations", registrationBody(planId, email, password, tag), "/api/v1/registrations");

/** Verification mails (those carrying an OTP) sent to the email, oldest first, with OTP and reopen token. */
const verificationMails = (email) =>
  mailsTo(email)
    .map((mail) => ({ otp: registrationOtp(mail), token: reopenToken(mail) }))
    .filter((m) => m.otp);

async function nthVerificationMail(email, n) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const mails = verificationMails(email);
    if (mails.length >= n) return mails[n - 1];
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`verification email #${n} to ${email} did not arrive`);
}

const verify = (email, otp) => post("/api/v1/registrations/verify-email", { email, otp });
const summary = (token) => request("GET", `${GATEWAY}/api/v1/registrations/${token}`, { label: "/api/v1/registrations/:token" });
const code = (res) => res.body?.error?.code ?? res.body?.code ?? res.body?.data?.code;

/** Verifies with the OTP, pays with the returned payment token and reads the registration back as Paid. */
async function verifyAndPay(email, otp) {
  const verified = expectStatus(await verify(email, otp), 200, "verify OTP");
  const paymentToken = data(verified).paymentToken;
  assert.ok(paymentToken, "verify returned no paymentToken");
  const before = expectStatus(await summary(paymentToken), 200, "registration summary");
  assert.equal(data(before).status, "PendingPayment");
  assert.equal(data(before).organizerEmail, email);
  const paid = expectStatus(await post("/api/v1/registrations/payments", { token: paymentToken }), 200, "pay");
  assert.equal(data(paid).paymentStatus, "Succeeded");
  const after = expectStatus(await summary(paymentToken), 200, "registration summary after payment");
  assert.equal(data(after).status, "Paid");
  return paymentToken;
}

async function assertLogin(email, working, rejected, what) {
  const token = await login(email, working);
  const me = expectStatus(await request("GET", `${GATEWAY}/api/v1/auth/me`, { token }), 200, `${what} auth/me`);
  assert.equal(data(me).role, "ORGANIZER");
  for (const password of [].concat(rejected)) {
    const res = await post("/api/v1/auth/login", { username: email, password }, "/api/v1/auth/login (rejected)");
    assert.ok(res.status === 400 || res.status === 401, `${what}: rejected password expected 400/401, got ${res.status}: ${JSON.stringify(res.body).slice(0, 200)}`);
  }
}

/** Read-only DB view of every registration of an email: status, organization status, organizer deleted flag. */
const registrationRows = (email) =>
  sql(
    "tenant_db",
    `SELECT r.status || '/' || o.status || '/' || (u.deleted_at IS NOT NULL) FROM registrations r
       JOIN organizations o ON o.id = r.organization_id JOIN users u ON u.id = r.organizer_user_id
      WHERE u.email = ${literal(email)} ORDER BY r.created_at`,
  )
    .split("\n")
    .filter(Boolean);

const neutral = (res) => ({ status: res.status, body: res.body });
/** The neutral answer without the echoed email, comparable across different emails. */
const shape = (res) => ({ status: res.status, message: res.body?.message, data: { ...res.body?.data, email: undefined } });

export default {
  id: "J9",
  title: "Re-registration with the same email: replace, expire, active-account email, concurrency",
  services: ["api-gateway", "tenant", "identity", "notification"],
  async run({ step, shared }) {
    const planId = await offeredPlanId();
    const run = shared.runId;
    const [P1, P2, P3] = [1, 2, 3].map((n) => `E2e-${run}-Re${n}!`);
    const emailA = `${run}-j9a@e2e.learnup.test`;
    const emailB = `${run}-j9b@e2e.learnup.test`;

    // ---- J9a: branch C, unverified registration replaced by a new one ----
    const first = await step("J9a register X/P1 (unverified), OTP mail #1 arrives", async () => {
      const res = expectStatus(await register(planId, emailA, P1, "j9a-1"), 202, "register 1");
      return { res, mail: await nthVerificationMail(emailA, 1) };
    });
    const second = await step("J9a register X/P2 again: same neutral response, OTP mail #2 arrives", async () => {
      const res = expectStatus(await register(planId, emailA, P2, "j9a-2"), 202, "register 2");
      assert.deepEqual(neutral(res), neutral(first.res), "second response differs from the first (BR-12)");
      const mail = await nthVerificationMail(emailA, 2);
      assert.notEqual(mail.otp, first.mail.otp, "two registrations produced the same OTP");
      return { res, mail };
    });
    await step("J9a old registration link is Expired (410) and old OTP is rejected", async () => {
      const old = await summary(first.mail.token);
      expectStatus(old, 410, "old registration link");
      assert.equal(code(old), "REGISTRATION_EXPIRED");
      const rejected = expectStatus(await verify(emailA, first.mail.otp), 400, "old OTP");
      assert.equal(code(rejected), "OTP_INVALID");
    });
    await step("J9a new OTP accepted, payment succeeds, registration reads back Paid", async () => {
      await verifyAndPay(emailA, second.mail.otp);
    });
    await step("J9a login X/P2 succeeds as ORGANIZER, X/P1 is rejected", () => assertLogin(emailA, P2, P1, "J9a"));

    // ---- J9b: branch E, expired registration is cancelled and the email is freed ----
    const expiredFirst = await step("J9b register X2/P1, OTP mail #1 arrives", async () => {
      expectStatus(await register(planId, emailB, P1, "j9b-1"), 202, "register 1");
      return nthVerificationMail(emailB, 1);
    });
    await step("J9b make that registration expired (SQL setup on its own row only: no API shortens the validity)", async () => {
      // Setup exception: pending_registration_ttl_hours has no API and no seeded override, so the
      // expiry of THIS run's own registration row is moved into the past. Nothing else is touched.
      const changed = sql(
        "tenant_db",
        `WITH changed AS (
           UPDATE registrations r SET expires_at = now() - interval '1 hour'
             FROM users u
            WHERE u.id = r.organizer_user_id AND u.email = ${literal(emailB)} AND r.status = 'PendingPayment'
            RETURNING r.id)
         SELECT count(*) FROM changed`,
      );
      assert.equal(changed, "1", "expected to expire exactly one registration row");
    });
    const secondB = await step("J9b register X2/P2 again: same neutral response shape, OTP mail #2 arrives", async () => {
      const res = expectStatus(await register(planId, emailB, P2, "j9b-2"), 202, "register 2");
      assert.deepEqual(shape(res), shape(second.res), "J9b response differs from the J9a neutral response");
      return nthVerificationMail(emailB, 2);
    });
    await step("J9b old registration link answers Expired (410)", async () => {
      const old = await summary(expiredFirst.token);
      expectStatus(old, 410, "old registration link");
      assert.equal(code(old), "REGISTRATION_EXPIRED");
    });
    await step("J9b new OTP accepted, payment succeeds, registration reads back Paid", async () => {
      await verifyAndPay(emailB, secondB.otp);
    });
    await step("J9b login X2/P2 succeeds as ORGANIZER, X2/P1 is rejected", () => assertLogin(emailB, P2, P1, "J9b"));
    await step("J9b DB check (read-only, no API): old registration Expired + Organization Cancelled + organizer deleted; new Paid + Active", async () => {
      assert.deepEqual(registrationRows(emailB), ["Expired/Cancelled/true", "Paid/Active/false"]);
    });

    // ---- J9c: email of an active account (observation against BR-12, neutrality not asserted) ----
    await step("J9c register the active account's email X with P3: no 5xx, no new OTP mail, X/P2 still logs in, X/P3 fails", async () => {
      const mailsBefore = verificationMails(emailA).length;
      const res = await register(planId, emailA, P3, "j9c");
      console.log(`   observation J9c (BR-12): registering an active account's email -> HTTP ${res.status} code=${code(res) ?? "-"} (neutral 202 would be ${res.status === 202})`);
      assert.ok(res.status < 500, `J9c expected a non-5xx answer, got ${res.status}: ${JSON.stringify(res.body).slice(0, 300)}`);
      await new Promise((r) => setTimeout(r, 2500));
      assert.equal(verificationMails(emailA).length, mailsBefore, "a verification mail was sent for an active account's email");
      await assertLogin(emailA, P2, P3, "J9c");
      assert.deepEqual(registrationRows(emailA), ["Expired/Cancelled/true", "Paid/Active/false"], "DB check (read-only): no new registration row");
    });

    // ---- J9d: concurrent registrations for the same fresh email ----
    await step(`J9d two parallel registrations with different passwords, ${REPEATS} repetitions with fresh emails`, async () => {
      const failures = [];
      for (let i = 1; i <= REPEATS; i++) {
        const email = `${run}-j9d-${i}@e2e.learnup.test`;
        const [pa, pb] = [`E2e-${run}-Da${i}!`, `E2e-${run}-Db${i}!`];
        const line = { i, statuses: null, winner: null, otpAttempts: [], dbRows: null };
        try {
          const [ra, rb] = await Promise.all([register(planId, email, pa, `j9d-${i}-a`), register(planId, email, pb, `j9d-${i}-b`)]);
          line.statuses = [ra.status, rb.status];
          assert.ok(ra.status < 500 && rb.status < 500, `5xx: ${ra.status}/${rb.status} ${JSON.stringify([ra.body, rb.body]).slice(0, 300)}`);
          assert.deepEqual([ra.status, rb.status], [202, 202]);
          assert.deepEqual(neutral(ra), neutral(rb), "responses differ");

          // Try every OTP that arrives; exactly one may verify.
          const tried = new Set();
          let paymentToken = null;
          const deadline = Date.now() + 20000;
          let settledAt = null;
          while (Date.now() < deadline) {
            for (const m of verificationMails(email)) {
              if (tried.has(m.otp)) continue;
              tried.add(m.otp);
              const res = await verify(email, m.otp);
              line.otpAttempts.push(res.status);
              assert.ok(res.status === 200 || res.status === 400, `verify answered ${res.status}`);
              if (res.status === 200) {
                assert.equal(paymentToken, null, "two OTPs verified");
                paymentToken = data(res).paymentToken;
              }
            }
            if (paymentToken && settledAt === null) settledAt = Date.now() + 2000;
            if (settledAt !== null && Date.now() >= settledAt) break;
            await new Promise((r) => setTimeout(r, 300));
          }
          assert.ok(paymentToken, `no OTP chain verified (tried ${tried.size})`);
          const paid = expectStatus(await post("/api/v1/registrations/payments", { token: paymentToken }), 200, "pay");
          assert.equal(data(paid).paymentStatus, "Succeeded");

          const [la, lb] = await Promise.all(
            [pa, pb].map((password) => post("/api/v1/auth/login", { username: email, password }, "/api/v1/auth/login (J9d)")),
          );
          const working = [la, lb].filter((r) => r.status === 200);
          assert.equal(working.length, 1, `working logins: ${working.length} (statuses ${la.status}/${lb.status})`);
          assert.ok([la, lb].every((r) => r.status === 200 || r.status === 401 || r.status === 400));
          line.winner = la.status === 200 ? "first-sent" : "second-sent";

          line.dbRows = registrationRows(email);
          const nonExpired = line.dbRows.filter((r) => !r.startsWith("Expired/"));
          assert.equal(nonExpired.length, 1, `non-Expired registrations: ${JSON.stringify(line.dbRows)}`);
          assert.equal(nonExpired[0], "Paid/Active/false");
        } catch (error) {
          line.error = String(error?.message ?? error).slice(0, 300);
          failures.push(line);
        }
        console.log(`   J9d #${String(i).padStart(2)}: responses ${line.statuses?.join("/") ?? "-"}, verify ${line.otpAttempts.join(",") || "-"}, winner ${line.winner ?? "-"}, rows ${line.dbRows?.join(" | ") ?? "-"}${line.error ? `, ERROR ${line.error}` : ""}`);
      }
      assert.equal(failures.length, 0, `${failures.length}/${REPEATS} repetitions failed: ${failures.map((f) => `#${f.i} ${f.error}`).join("; ")}`);
    });
  },
};

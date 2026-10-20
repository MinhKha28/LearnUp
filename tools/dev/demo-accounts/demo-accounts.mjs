import { execFile } from "node:child_process";
import { createHmac, timingSafeEqual } from "node:crypto";
import { open, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const domain = "demo.learnup.test";
export const organizations = Object.freeze([
  { key: "alpha", name: "LearnUP Demo Alpha", taxCode: "0000000101" },
  { key: "beta", name: "LearnUP Demo Beta", taxCode: "0000000102" },
]);
export const manifest = Object.freeze([
  { email: `admin@${domain}`, role: "Admin", organization: null, fullName: "Demo Admin" },
  ...organizations.flatMap((org) => [
    { email: `organizer.${org.key}@${domain}`, role: "Organizer", organization: org.name, fullName: `Demo ${org.key} Organizer` },
    ...[1, 2].map((n) => ({ email: `instructor.${org.key}0${n}@${domain}`, role: "Instructor", organization: org.name, fullName: `Demo ${org.key} Instructor ${n}` })),
    ...[1, 2, 3, 4, 5].map((n) => ({ email: `learner.${org.key}0${n}@${domain}`, role: "Learner", organization: org.name, fullName: `Demo ${org.key} Learner ${n}` })),
  ]),
].map(Object.freeze));

// Only controlled diagnostic codes ever cross the CLI boundary. Never echo an
// upstream body, subprocess stderr, URL, exception message, or credential.
export class FixtureError extends Error {
  constructor(code) { super(code); this.code = code; }
}
function check(condition, code) { if (!condition) throw new FixtureError(code); }

export function validateManifest(accounts = manifest) {
  check(accounts.length === 17 && new Set(accounts.map((a) => a.email)).size === 17, "MANIFEST_INVENTORY");
  check(accounts.every((a) => /^[a-z0-9.]+@demo\.learnup\.test$/.test(a.email)), "MANIFEST_EMAIL");
  check(accounts.filter((a) => a.role === "Admin" && a.organization === null).length === 1, "MANIFEST_ADMIN");
  for (const org of organizations) {
    const members = accounts.filter((a) => a.organization === org.name);
    for (const [role, count] of [["Organizer", 1], ["Instructor", 2], ["Learner", 5]]) {
      check(members.filter((a) => a.role === role).length === count, "MANIFEST_ROLES");
    }
  }
}

function origin(value) {
  let url;
  try { url = new URL(value); } catch { throw new FixtureError("LOCAL_ORIGIN_REQUIRED"); }
  check(url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname)
    && url.port && url.pathname === "/" && !url.username && !url.password && !url.search && !url.hash,
  "LOCAL_ORIGIN_REQUIRED");
  return url.origin;
}

export function configuration(env = process.env) {
  check(["development", "test"].includes(env.NODE_ENV), "DEVELOPMENT_ONLY");
  check(!env.SPRING_PROFILES_ACTIVE || /^(development|test)$/.test(env.SPRING_PROFILES_ACTIVE), "UNSAFE_PROFILE");
  check(/^[a-z][a-z0-9-]{2,23}$/.test(env.DEMO_TARGET ?? "")
    && !/prod|live|stage|shared/.test(env.DEMO_TARGET), "ISOLATED_TARGET_REQUIRED");
  const project = `learnup-demo-${env.DEMO_TARGET}`;
  check(env.DEMO_CONFIRM_ISOLATED === project, "ISOLATION_CONFIRMATION_REQUIRED");
  for (const key of ["DEMO_DB_PASSWORD", "DEMO_JWT_SECRET", "DEMO_INTERNAL_KEY", "DEMO_OTP_SECRET"]) {
    const secret = env[key] ?? "";
    check(Buffer.byteLength(secret) >= 32 && new Set(secret).size >= 12
      && !/learnup|changeme|default|password|example/i.test(secret), "PRIVATE_SECRETS_REQUIRED");
  }
  check(new Set([env.DEMO_DB_PASSWORD, env.DEMO_JWT_SECRET, env.DEMO_INTERNAL_KEY, env.DEMO_OTP_SECRET]).size === 4,
    "DISTINCT_SECRETS_REQUIRED");
  check(/^[a-zA-Z0-9_-]+$/.test(env.DEMO_DB_PASSWORD), "DATABASE_PASSWORD_URL_SAFE_REQUIRED");
  check(Buffer.byteLength(env.DEMO_ACCOUNT_PASSWORD ?? "") >= 12
    && Buffer.byteLength(env.DEMO_ACCOUNT_PASSWORD) <= 72, "ACCOUNT_PASSWORD_REQUIRED");
  return {
    target: env.DEMO_TARGET, project,
    gateway: origin(env.DEMO_GATEWAY_URL), smtp: origin(env.DEMO_MAILPIT_URL), frontend: origin(env.DEMO_FRONTEND_URL),
    password: env.DEMO_ACCOUNT_PASSWORD, dbPassword: env.DEMO_DB_PASSWORD,
    jwt: env.DEMO_JWT_SECRET, internalKey: env.DEMO_INTERNAL_KEY, otp: env.DEMO_OTP_SECRET,
  };
}

async function docker(args) {
  try { return (await exec("docker", args, { windowsHide: true, timeout: 15000, maxBuffer: 4 * 1024 * 1024 })).stdout; }
  catch { throw new FixtureError("DOCKER_INSPECTION_FAILED"); }
}
function variables(container) {
  return Object.fromEntries(container.Config.Env.map((entry) => {
    const i = entry.indexOf("="); return [entry.slice(0, i), entry.slice(i + 1)];
  }));
}

export function validateRuntime(config, containers, network, ingress) {
  const required = ["postgres", "smtp", "eureka-server", "api-gateway", "identity-service", "notification-service", "tenant-service"];
  const services = Object.fromEntries(containers.map((c) => [c.Config.Labels["com.docker.compose.service"], c]));
  check(containers.length === required.length && required.every((s) => services[s]), "DEDICATED_STACK_REQUIRED");
  check(network?.Internal === true && network.Labels?.["com.learnup.demo-fixture"] === config.target, "PRIVATE_NETWORK_REQUIRED");
  check(ingress?.Internal === false && ingress.Labels?.["com.learnup.demo-fixture"] === config.target
    && ingress.Id !== network.Id, "DEDICATED_INGRESS_REQUIRED");
  for (const container of containers) {
    check(container.State.Running && container.Config.Labels["com.docker.compose.project"] === config.project
      && container.Config.Labels["com.learnup.demo-fixture"] === config.target, "UNOWNED_CONTAINER");
    const networks = Object.values(container.NetworkSettings.Networks);
    const isIngress = container === services.smtp || container === services["api-gateway"];
    check(networks.length === (isIngress ? 2 : 1) && networks.some((n) => n.NetworkID === network.Id)
      && networks.every((n) => n.NetworkID === network.Id || (isIngress && n.NetworkID === ingress.Id)), "UNSAFE_NETWORK");
    // No shared storage, Docker socket or application/config overrides.
    const mounts = container.Mounts ?? [];
    check(mounts.every((m) => m.Type === "tmpfs" || (container === services.postgres
      && m.Type === "bind" && m.RW === false && m.Destination === "/docker-entrypoint-initdb.d/fixture.sql"
      && path.resolve(m.Source) === path.resolve(import.meta.dirname, "init-databases.sql"))), "SHARED_STORAGE_REFUSED");
    for (const bindings of Object.values(container.NetworkSettings.Ports ?? {})) {
      check(!bindings || bindings.every((b) => b.HostIp === "127.0.0.1"), "NON_LOOPBACK_PORT");
    }
  }
  for (const [service, port, url] of [["api-gateway", "8080/tcp", config.gateway], ["smtp", "8025/tcp", config.smtp]]) {
    const bindings = services[service].NetworkSettings.Ports[port];
    check(bindings?.length === 1 && bindings[0].HostPort === new URL(url).port, "WRONG_PUBLISHED_PORT");
  }
  for (const service of ["identity-service", "notification-service", "tenant-service", "postgres", "eureka-server"]) {
    check(Object.values(services[service].NetworkSettings.Ports ?? {}).every((b) => !b), "PRIVATE_SERVICE_PORT_REQUIRED");
  }
  const pg = variables(services.postgres);
  check(pg.POSTGRES_USER === "fixture" && pg.POSTGRES_PASSWORD === config.dbPassword, "DATABASE_CONFIG_MISMATCH");
  for (const service of ["api-gateway", "identity-service", "notification-service", "tenant-service"]) {
    const v = variables(services[service]);
    check(v.INTERNAL_SERVICE_KEY === config.internalKey, "INTERNAL_CONFIG_MISMATCH");
    if (service !== "tenant-service") {
      check(v.SPRING_PROFILES_ACTIVE === "development" && !v.SPRING_APPLICATION_JSON && !v.SPRING_CONFIG_LOCATION
        && !v.SPRING_CONFIG_ADDITIONAL_LOCATION, "UNSAFE_PROFILE");
      check(v.EUREKA_CLIENT_SERVICEURL_DEFAULTZONE === "http://eureka-server:8761/eureka/", "DISCOVERY_CONFIG_MISMATCH");
    }
    if (["api-gateway", "identity-service"].includes(service)) {
      check(v.JWT_SECRET === config.jwt && v.TENANT_SERVICE_URL === "http://tenant-service:8084", "AUTH_CONFIG_MISMATCH");
    }
    if (["identity-service", "notification-service"].includes(service)) {
      const db = service === "identity-service" ? "identity" : "notification";
      check(v.SPRING_DATASOURCE_URL === `jdbc:postgresql://postgres:5432/learnup_demo_${db}`
        && v.SPRING_DATASOURCE_USERNAME === "fixture" && v.SPRING_DATASOURCE_PASSWORD === config.dbPassword, "DATABASE_CONFIG_MISMATCH");
    }
  }
  const identity = variables(services["identity-service"]);
  check(identity.LEARNUP_SEED_ENABLED === "false" && identity.NOTIFICATION_SERVICE_URL === "http://notification-service:8082"
    && identity.PASSWORD_RECOVERY_FRONTEND_BASE_URL === config.frontend, "IDENTITY_CONFIG_MISMATCH");
  const tenant = variables(services["tenant-service"]);
  check(tenant.NODE_ENV === "development" && tenant.DEV_FAKE_AUTH === "false" && tenant.EMAIL_OTP_SECRET === config.otp
    && tenant.DATABASE_URL === `postgresql://fixture:${config.dbPassword}@postgres:5432/learnup_demo_tenant`
    && tenant.IDENTITY_SERVICE_URL === "http://identity-service:8081"
    && tenant.NOTIFICATION_SERVICE_URL === "http://notification-service:8082" && tenant.FRONTEND_URL === config.frontend,
  "TENANT_CONFIG_MISMATCH");
  const mail = variables(services["notification-service"]);
  check(mail.LEARNUP_MAIL_ENABLED === "true" && mail.SPRING_MAIL_HOST === "smtp" && mail.SPRING_MAIL_PORT === "1025"
    && mail.SPRING_MAIL_SMTP_AUTH === "false" && mail.SPRING_MAIL_SMTP_STARTTLS_ENABLE === "false"
    && !mail.SPRING_MAIL_USERNAME && !mail.SPRING_MAIL_PASSWORD && mail.SPRING_MAIL_PROPERTIES_MAIL_DEBUG !== "true", "DISPOSABLE_SMTP_REQUIRED");
  check(services.smtp.Config.Image === "axllent/mailpit:v1.27.4"
    && !services.smtp.Config.Env.some((e) => /^MP_(SMTP_RELAY|SMTP_FORWARD|WEBHOOK)/.test(e)), "SMTP_RELAY_REFUSED");
  return services;
}

export async function inspectRuntime(config) {
  const ids = (await docker(["ps", "--filter", `label=com.docker.compose.project=${config.project}`, "--format", "{{.ID}}"])).trim().split(/\s+/).filter(Boolean);
  check(ids.length === 7, "DEDICATED_STACK_REQUIRED");
  const containers = JSON.parse(await docker(["container", "inspect", ...ids]));
  const networkIds = [...new Set(containers.flatMap((c) => Object.values(c.NetworkSettings.Networks).map((n) => n.NetworkID)))];
  check(networkIds.length === 2, "PRIVATE_NETWORK_REQUIRED");
  const networks = JSON.parse(await docker(["network", "inspect", ...networkIds]));
  return validateRuntime(config, containers, networks.find((n) => n.Internal), networks.find((n) => !n.Internal));
}

// Projection deliberately excludes password hashes, raw/hashed tokens and outbox bodies.
const tenantSql = `SELECT json_build_object(
 'users', (SELECT coalesce(json_agg(x ORDER BY email), '[]') FROM
   (SELECT id,email,role,organization_id AS "organizationId",status,deleted_at AS "deletedAt" FROM users) x),
 'organizations', (SELECT coalesce(json_agg(x ORDER BY name), '[]') FROM (SELECT id,name,status FROM organizations) x),
 'subscriptions', (SELECT coalesce(json_agg(x ORDER BY id), '[]') FROM
   (SELECT id,organization_id AS "organizationId",status,max_instructors AS "maxInstructors",max_learners AS "maxLearners",
    starts_at AS "startsAt",expires_at AS "expiresAt" FROM subscriptions) x));`;
const identitySql = `SELECT coalesce(json_agg(x ORDER BY email), '[]') FROM
 (SELECT id,email,role,organization_id AS "organizationId",enabled FROM users) x;`;

export function databaseReader(postgres) {
  const read = async (db, sql) => JSON.parse((await docker(["exec", "-e", "PGOPTIONS=-c default_transaction_read_only=on -c statement_timeout=5000",
    postgres.Id, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "fixture", "-d", db,
    "-c", `BEGIN READ ONLY; ${sql} COMMIT;`])).trim());
  return async () => ({ ...await read("learnup_demo_tenant", tenantSql), identity: await read("learnup_demo_identity", identitySql) });
}

export function inspectInventory(snapshot) {
  check(snapshot.users.every((u) => manifest.some((a) => a.email === u.email))
    && snapshot.identity.every((u) => manifest.some((a) => a.email === u.email))
    && snapshot.organizations.every((o) => organizations.some((a) => a.name === o.name)), "NON_FIXTURE_DATA_REFUSED");
  check(new Set(snapshot.users.map((u) => u.email)).size === snapshot.users.length
    && new Set(snapshot.identity.map((u) => u.email)).size === snapshot.identity.length
    && new Set(snapshot.organizations.map((o) => o.name)).size === snapshot.organizations.length, "DUPLICATE_FIXTURE_DATA");
  for (const org of snapshot.organizations) {
    const organizer = manifest.find((a) => a.organization === org.name && a.role === "Organizer");
    check(snapshot.users.some((u) => u.email === organizer.email
      && u.organizationId === org.id && u.role === "Organizer"), "ORGANIZATION_CONFLICT");
  }
  return manifest.map((account) => {
    const user = snapshot.users.find((u) => u.email === account.email);
    const credential = snapshot.identity.find((u) => u.email === account.email);
    const org = snapshot.organizations.find((o) => o.name === account.organization);
    if (!user && !credential) return { ...account, state: account.role === "Admin" ? "blocked" : "missing", reason: account.role === "Admin" ? "ADMIN_BOOTSTRAP_UNAVAILABLE" : null };
    const valid = user && credential && user.id === credential.id && user.role === account.role
      && credential.role === account.role.toUpperCase() && user.status === "Active" && !user.deletedAt && credential.enabled
      && (account.organization ? org?.status === "Active" && user.organizationId === org.id && credential.organizationId === org.id
        : user.organizationId === null && credential.organizationId === null);
    return { ...account, id: user?.id, state: valid ? "existing" : "blocked", reason: valid ? null : "EXISTING_ACCOUNT_CONFLICT" };
  });
}

export function activeSubscription(snapshot, orgId) {
  const subs = snapshot.subscriptions.filter((s) => s.organizationId === orgId);
  check(subs.length === 1 && subs[0].status === "Active" && Date.parse(subs[0].startsAt) <= Date.now()
    && Date.parse(subs[0].expiresAt) > Date.now() && subs[0].maxInstructors >= 2 && subs[0].maxLearners >= 5, "SUBSCRIPTION_CONFLICT");
}

export function selectPlan(plans) {
  const eligible = plans.filter((p) => p.maxInstructors >= 2 && p.maxLearners >= 5 && p.durationDays > 0 && p.price >= 0);
  check(eligible.length, "NO_ELIGIBLE_PLAN");
  return eligible.sort((a, b) => a.price - b.price || a.id.localeCompare(b.id))[0];
}

export async function request(base, endpoint, { method = "GET", body, bearer } = {}) {
  try {
    const response = await fetch(`${base}${endpoint}`, {
      method, redirect: "error", signal: AbortSignal.timeout(15000),
      headers: { "Content-Type": "application/json", ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    check(response.ok, `HTTP_${response.status}`);
    return await response.json();
  } catch (e) { throw e instanceof FixtureError ? e : new FixtureError("REQUEST_FAILED_NO_AUTOMATIC_RETRY"); }
}

export async function ensureReady(config, services) {
  // A GET to a POST-only public authentication path reaches Identity without
  // creating a session or sending credentials. Discovery-not-ready (503) must
  // stop before registration, which is deliberately never automatically retried.
  let reachedIdentity = false;
  try { await request(config.gateway, "/api/v1/auth/login"); }
  catch (error) { reachedIdentity = ["HTTP_401", "HTTP_405"].includes(error.code); }
  check(reachedIdentity, "IDENTITY_GATEWAY_NOT_READY");
  const health = JSON.parse(await docker(["exec", services["notification-service"].Id,
    "wget", "-qO-", "http://127.0.0.1:8082/actuator/health"]));
  check(health.status === "UP", "NOTIFICATION_NOT_READY");
}

export function extractMailToken(message, config, kind) {
  const text = `${message.HTML ?? ""}\n${message.Text ?? ""}`.replaceAll("&amp;", "&");
  for (const match of text.matchAll(/https?:\/\/[^\s<>"']+/g)) {
    let url;
    try { url = new URL(match[0]); } catch { continue; }
    if (url.origin !== config.frontend) continue;
    const token = kind === "registration" && url.pathname === "/register/pending-payment"
      ? url.searchParams.get("token") : kind === "invitation" ? /^\/activate\/([A-Za-z0-9_-]+)$/.exec(url.pathname)?.[1] : null;
    if (token && /^[A-Za-z0-9_-]{20,256}$/.test(token)) return token;
  }
  throw new FixtureError("EXPECTED_MAIL_LINK_MISSING");
}

export function emailReceiver(config) {
  return async (email, kind, since) => {
    for (let attempt = 0; attempt < 30; attempt++) {
      const list = await request(config.smtp, "/api/v1/messages?limit=500");
      check(list.total <= 500 && Array.isArray(list.messages), "SMTP_INVENTORY_UNEXPECTED");
      for (const m of list.messages) {
        if (m.To?.some((to) => to.Address.toLowerCase() === email) && Date.parse(m.Created) >= since - 1000) {
          const detail = await request(config.smtp, `/api/v1/message/${encodeURIComponent(m.ID)}`);
          try { return extractMailToken(detail, config, kind); }
          catch (error) { if (error.code !== "EXPECTED_MAIL_LINK_MISSING") throw error; }
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new FixtureError("SMTP_DELIVERY_TIMEOUT_NO_RESEND");
  };
}

function envelope(result, identity = false) {
  check(identity ? result?.success === true : result?.statusCode >= 200 && result.statusCode < 300, "API_OPERATION_REJECTED");
  check(result.data !== undefined, "API_DATA_MISSING");
  return result.data;
}

export function verifyJwt(token, config, user) {
  try {
    const [header, payload, signature, extra] = token.split(".");
    const algorithm = JSON.parse(Buffer.from(header, "base64url")).alg;
    const hash = { HS256: "sha256", HS384: "sha384", HS512: "sha512" }[algorithm];
    check(!extra && hash, "JWT_CONTEXT_MISMATCH");
    const expected = createHmac(hash, config.jwt).update(`${header}.${payload}`).digest();
    const supplied = Buffer.from(signature, "base64url");
    check(supplied.length === expected.length && timingSafeEqual(supplied, expected), "JWT_CONTEXT_MISMATCH");
    const claims = JSON.parse(Buffer.from(payload, "base64url"));
    check(claims.sub === user.id && claims.role === user.role.toUpperCase()
      && (claims.organizationId ?? null) === user.organizationId && claims.exp > Date.now() / 1000, "JWT_CONTEXT_MISMATCH");
  } catch { throw new FixtureError("JWT_CONTEXT_MISMATCH"); }
}

export async function verifyLogin(account, snapshot, config, api, operation = async () => {}) {
  const user = snapshot.users.find((u) => u.email === account.email);
  let auth;
  try {
    auth = envelope(await api("/api/v1/auth/login", { method: "POST", body: { username: account.email, password: config.password } }), true);
    check(auth.user?.id === user.id && auth.user.role === user.role.toUpperCase()
      && auth.user.email === user.email && auth.user.organizationId === user.organizationId && auth.user.enabled, "LOGIN_CONTEXT_MISMATCH");
    verifyJwt(auth.accessToken, config, user);
    const profile = envelope(await api("/api/v1/users/me", { bearer: auth.accessToken }));
    check(profile.id === user.id && profile.role === user.role && profile.email === user.email
      && profile.organizationId === user.organizationId && profile.status === "Active"
      && (profile.organizationName ?? null) === account.organization, "PROFILE_CONTEXT_MISMATCH");
    // Keep the Organizer's session open until its invitation work is finished.
    return await operation(auth.accessToken);
  } finally {
    if (auth?.accessToken && auth?.refreshToken) {
      envelope(await api("/api/v1/auth/logout", { method: "POST", bearer: auth.accessToken, body: { refreshToken: auth.refreshToken } }), true);
    }
  }
}

/** Orchestrates real endpoints. The injected adapters enable focused contract tests;
 * only the CLI can select an environment and it always verifies Docker isolation. */
export async function provision(config, { mode = "dry-run", allowMissingAdmin = false, read, api, receive, report = () => {} }) {
  validateManifest();
  const results = manifest.map((a) => ({ email: a.email, role: a.role, organization: a.organization, status: "skipped", reason: "NOT_ATTEMPTED" }));
  const record = (account, status, reason = null) => {
    const result = results.find((r) => r.email === account.email);
    Object.assign(result, { status, reason }); report({ ...result });
  };
  let currentAccount;
  try {
    let snapshot = await read();
    const inventory = inspectInventory(snapshot);
    for (const a of inventory) if (a.state === "blocked") record(a, "blocked", a.reason);
    check(!inventory.some((a) => a.reason === "EXISTING_ACCOUNT_CONFLICT"), "EXISTING_ACCOUNT_CONFLICT");
    for (const org of snapshot.organizations) activeSubscription(snapshot, org.id);
    const adminMissing = inventory[0].state === "blocked";
    if (mode === "status") {
      for (const a of inventory.filter((a) => a.state !== "blocked")) record(a, a.state, "READ_ONLY_NOT_LOGIN_VERIFIED");
      return { complete: !adminMissing && inventory.every((a) => a.state === "existing"), results };
    }
    const plan = selectPlan(envelope(await api("/api/v1/subscription-plans")));
    if (mode === "dry-run") {
      for (const a of inventory.filter((a) => a.state !== "blocked")) record(a, a.state === "missing" ? "would-create" : "existing", "NO_MUTATIONS_OR_LOGINS");
      return { complete: !adminMissing, planId: plan.id, results };
    }
    check(mode === "provision", "INVALID_MODE");
    check(!adminMissing || allowMissingAdmin, "ADMIN_BOOTSTRAP_UNAVAILABLE_USE_EXPLICIT_16_ACCOUNT_MODE");
    // Verify ALL pre-existing identities/passwords before performing business writes.
    for (const a of inventory.filter((a) => a.state === "existing")) {
      currentAccount = a;
      await verifyLogin(a, snapshot, config, api); record(a, "existing");
    }
    for (const org of organizations) {
      const members = manifest.filter((a) => a.organization === org.name);
      const organizer = members[0];
      currentAccount = organizer;
      let orgRow = snapshot.organizations.find((o) => o.name === org.name);
      if (!orgRow) {
        // Recheck immediately before a non-idempotent endpoint; never retry it.
        check(inspectInventory(await read()).find((a) => a.email === organizer.email).state === "missing", "CONCURRENT_CHANGE_REFUSED");
        const since = Date.now();
        envelope(await api("/api/v1/registrations", { method: "POST", body: {
          planId: plan.id, organization: { name: org.name, taxCode: org.taxCode, address: "Isolated development fixture", contactPhone: "+12025550100", contactEmail: organizer.email },
          organizer: { fullName: organizer.fullName, email: organizer.email, password: config.password },
        } }));
        record(organizer, "pending", "REGISTRATION_ACCEPTED");
        const token = await receive(organizer.email, "registration", since);
        const summary = envelope(await api(`/api/v1/registrations/${encodeURIComponent(token)}`));
        check(summary.organizerEmail === organizer.email && summary.organizationName === org.name
          && summary.status === "PendingPayment" && summary.plan.maxInstructors >= 2 && summary.plan.maxLearners >= 5, "REGISTRATION_CONTEXT_MISMATCH");
        const payment = envelope(await api("/api/v1/registrations/payments", { method: "POST", body: { token, simulateFailure: false } }));
        check(payment.paymentStatus === "Succeeded", "PAYMENT_NOT_SUCCEEDED");
        snapshot = await read();
        check(inspectInventory(snapshot).find((a) => a.email === organizer.email).state === "existing", "PROVISIONED_ACCOUNT_MISMATCH");
        orgRow = snapshot.organizations.find((o) => o.name === org.name);
        check(orgRow, "ORGANIZATION_MISSING");
        activeSubscription(snapshot, orgRow.id);
        await verifyLogin(organizer, snapshot, config, api); record(organizer, "created");
      } else {
        check(inspectInventory(snapshot).find((a) => a.email === organizer.email).state === "existing", "ORGANIZATION_WITHOUT_ORGANIZER");
      }
      await verifyLogin(organizer, snapshot, config, api, async (access) => {
       for (const account of members.slice(1)) {
        currentAccount = account;
        snapshot = await read();
        const current = inspectInventory(snapshot).find((a) => a.email === account.email);
        check(current.state !== "blocked", "EXISTING_ACCOUNT_CONFLICT");
        if (current.state === "existing") continue;
        const category = account.role === "Instructor" ? "instructors" : "learners";
        const seats = envelope(await api(`/api/v1/users/${category}/seats`, { bearer: access }));
        check(seats.canCreate === true && seats.subscriptionStatus === "Active" && seats.remaining >= 1, "SEAT_QUOTA_BLOCKED");
        const since = Date.now();
        const pending = envelope(await api(`/api/v1/users/${category}`, { method: "POST", bearer: access,
          body: { email: account.email, fullName: account.fullName, department: "Development fixture" } }));
        check(pending.email === account.email && pending.status === "Pending", "INVITATION_CONTEXT_MISMATCH");
        record(account, "pending", "INVITATION_CREATED");
        const token = await receive(account.email, "invitation", since);
        const invitation = envelope(await api(`/api/v1/invitations/${encodeURIComponent(token)}`));
        check(invitation.email === account.email && invitation.role === account.role && invitation.organizationName === org.name, "INVITATION_CONTEXT_MISMATCH");
        envelope(await api("/api/v1/invitations/accept", { method: "POST", body: { token, password: config.password } }));
        snapshot = await read();
        check(inspectInventory(snapshot).find((a) => a.email === account.email).state === "existing", "PROVISIONED_ACCOUNT_MISMATCH");
        await verifyLogin(account, snapshot, config, api); record(account, "created");
       }
      });
    }
    snapshot = await read();
    const final = inspectInventory(snapshot);
    check(snapshot.organizations.length === 2 && final.slice(1).every((a) => a.state === "existing"), "FINAL_INVENTORY_MISMATCH");
    for (const org of snapshot.organizations) activeSubscription(snapshot, org.id);
    return { complete: !adminMissing, results };
  } catch (e) {
    // Pending rows may already be committed: never delete, resend, reset or repair.
    const error = e instanceof FixtureError ? e.code : "UNEXPECTED_FAILURE_REDACTED";
    if (currentAccount) {
      const current = results.find((r) => r.email === currentAccount.email);
      record(currentAccount, current.status === "pending" ? "pending" : "blocked", error);
    }
    return { complete: false, error, results };
  }
}

export async function main(args = process.argv.slice(2)) {
  try {
    if (args.length === 1 && args[0] === "--manifest") { console.log(JSON.stringify(manifest, null, 2)); return 0; }
    check(args.every((a) => ["--dry-run", "--status", "--provision", "--allow-missing-admin"].includes(a)), "UNKNOWN_ARGUMENT");
    const modes = args.filter((a) => ["--dry-run", "--status", "--provision"].includes(a));
    check(modes.length === 1, "SELECT_EXACTLY_ONE_MODE");
    const config = configuration();
    const services = await inspectRuntime(config);
    // Only this local operator/target can hold the lock. A stale lock fails closed;
    // it is never automatically removed. No credential or token is written to it.
    const lockPath = path.join(tmpdir(), `learnup-demo-${services.postgres.Id}.lock`);
    let lock;
    try { lock = await open(lockPath, "wx", 0o600); }
    catch { throw new FixtureError("TARGET_ALREADY_LOCKED"); }
    try {
      await ensureReady(config, services);
      await request(config.smtp, "/api/v1/info");
      const result = await provision(config, {
        mode: modes[0].slice(2), allowMissingAdmin: args.includes("--allow-missing-admin"), read: databaseReader(services.postgres),
        api: (endpoint, options) => request(config.gateway, endpoint, options), receive: emailReceiver(config),
        report: (row) => console.log(JSON.stringify(row)),
      });
      console.log(JSON.stringify({ complete: result.complete, error: result.error ?? null,
        counts: Object.fromEntries([...new Set(result.results.map((a) => a.status))].map((s) => [s, result.results.filter((a) => a.status === s).length])) }));
      return result.error ? 1 : result.complete ? 0 : 2;
    } finally { await lock.close(); await unlink(lockPath); }
  } catch (e) {
    console.error(JSON.stringify({ complete: false, error: e instanceof FixtureError ? e.code : "UNEXPECTED_FAILURE_REDACTED" }));
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await main();

import fs from "node:fs";

export const STATE_DIR = process.env.E2E_STATE_DIR ?? "/tmp/learnup-e2e";
export const GATEWAY = process.env.E2E_GATEWAY_URL ?? "http://localhost:8080";

/** Direct service URLs, used only where the frontend itself calls a service directly. */
export const DIRECT = {
  tenant: process.env.E2E_TENANT_URL ?? "http://localhost:8084",
  course: process.env.E2E_COURSE_URL ?? "http://localhost:8083",
  learning: process.env.E2E_LEARNING_URL ?? "http://localhost:8085",
  assessment: process.env.E2E_ASSESSMENT_URL ?? "http://localhost:8086",
  achievement: process.env.E2E_ACHIEVEMENT_URL ?? "http://localhost:8087",
};

export function loadClusterEnv() {
  const file = `${STATE_DIR}/cluster.env`;
  if (!fs.existsSync(file)) throw new Error(`${file} not found: start the cluster first (tests/e2e/cluster/start.sh)`);
  const env = { stateDir: STATE_DIR };
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) env[m[1]] = m[2];
  }
  return env;
}

const id = (suffix) => `01900000-0000-7000-8000-${suffix.padStart(12, "0")}`;

/** Fixed IDs from the services' own seeds (tenant seed-account-management, course seed). */
export const SEED = {
  orgA: id("a001"),
  orgB: id("b001"),
  organizerA: { userId: id("a010"), organizationId: id("a001"), email: "organizer@learnup.local", fullName: "Nguyễn Thị Lan" },
  organizerB: { userId: id("b010"), organizationId: id("b001"), email: "hoa.hoang@xyz.vn", fullName: "Hoàng Thị Hoa" },
  // course seed: fixtureId(0xc002, chain * 10 + version)
  coursePublicNoAssignment: `01900000-0000-7000-8000-c002${(151).toString(16).padStart(8, "0")}`,
  coursePublicV2: `01900000-0000-7000-8000-c002${(92).toString(16).padStart(8, "0")}`,
  coursePrivate: `01900000-0000-7000-8000-c002${(101).toString(16).padStart(8, "0")}`,
  courseDraft: `01900000-0000-7000-8000-c002${(11).toString(16).padStart(8, "0")}`,
};

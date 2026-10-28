#!/usr/bin/env node
/**
 * Disposable-cluster fixture bootstrap. Tenant seeds create the canonical Organizers of
 * Organization ABC and XYZ but no credentials (Identity demo seeding is retired). This sets
 * their passwords through Identity's authenticated internal channel, exactly as Tenant does
 * after activation, using the same canonical User IDs. Password comes from cluster.env.
 * Idempotent: re-running overwrites the same two credentials and touches nothing else.
 * No username is sent, as Tenant sends none: Identity derives it from the full user ID.
 */
import fs from "node:fs";
import { loadClusterEnv, SEED } from "../lib/config.mjs";

const env = loadClusterEnv();
const identity = process.env.E2E_IDENTITY_URL ?? "http://localhost:8081";

for (const organizer of [SEED.organizerA, SEED.organizerB]) {
  const res = await fetch(`${identity}/api/internal/credentials`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-internal-key": env.INTERNAL_SERVICE_KEY },
    body: JSON.stringify({
      userId: organizer.userId,
      password: env.FIXTURE_ORGANIZER_PASSWORD,
      email: organizer.email,
      fullName: organizer.fullName,
      role: "ORGANIZER",
      organizationId: organizer.organizationId,
    }),
  });
  if (!res.ok) {
    console.error(`credential bootstrap failed for ${organizer.email}: HTTP ${res.status}`);
    process.exit(1);
  }
  console.log(`credential provisioned for seeded organizer ${organizer.email}`);
}
fs.writeFileSync(`${env.stateDir}/bootstrapped`, new Date().toISOString());

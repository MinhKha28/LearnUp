import { execFileSync } from "node:child_process";
import { loadClusterEnv } from "./config.mjs";

/**
 * Direct SQL against a service database of the disposable cluster. Journeys use it only where
 * no business API exists, and every call site says why. Requires `psql` on the host.
 * Values must be interpolated through `literal`.
 */
export function sql(database, statement) {
  const env = loadClusterEnv();
  const url = `postgresql://${env.DB_USERNAME}@localhost:${env.POSTGRES_PORT ?? 5433}/${database}`;
  return execFileSync("psql", [url, "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", statement], {
    env: { ...process.env, PGPASSWORD: env.DB_PASSWORD },
    encoding: "utf8",
  }).trim();
}

export const literal = (value) => `'${String(value).replace(/'/g, "''")}'`;

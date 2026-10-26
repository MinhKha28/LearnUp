import { execFileSync } from "node:child_process";

// Compose v2 container name of the "kafka" service in the E2E project (cluster/compose.sh).
const CONTAINER = process.env.E2E_KAFKA_CONTAINER ?? `${process.env.E2E_COMPOSE_PROJECT ?? "learnup-e2e"}-kafka-1`;
const BOOTSTRAP = "kafka:29092";

const kafka = (args, timeoutMs = 20000) =>
  execFileSync("docker", ["exec", CONTAINER, ...args], { encoding: "utf8", timeout: timeoutMs, stdio: ["ignore", "pipe", "ignore"] });

/** End offsets per partition, so a later read only scans messages produced after this point. */
export function endOffsets(topic) {
  const out = kafka(["kafka-get-offsets", "--bootstrap-server", BOOTSTRAP, "--topic", topic]);
  const offsets = {};
  for (const line of out.trim().split("\n")) {
    const [, partition, offset] = line.split(":");
    if (partition !== undefined) offsets[partition] = Number(offset);
  }
  return offsets;
}

/** Polls the topic from `since` offsets until a JSON message satisfies `match`. */
export async function waitForEvent(topic, since, match, { timeoutMs = 20000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const [partition, offset] of Object.entries(since)) {
      let out = "";
      try {
        out = kafka([
          "kafka-console-consumer", "--bootstrap-server", BOOTSTRAP, "--topic", topic,
          "--partition", partition, "--offset", String(offset), "--timeout-ms", "2000",
        ]);
      } catch (error) {
        out = error.stdout ?? "";
      }
      for (const line of out.split("\n")) {
        try {
          const event = JSON.parse(line);
          if (match(event)) return event;
        } catch {
          /* not JSON */
        }
      }
    }
  }
  return null;
}

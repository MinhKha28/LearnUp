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

/**
 * Polls the topic from `since` offsets until a JSON message satisfies `match`.
 * Resolves `{ event, raw }` (the parsed event and the message value exactly as stored) or null on timeout.
 */
export async function waitForMessage(topic, since, match, { timeoutMs = 20000 } = {}) {
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
          if (match(event)) return { event, raw: line };
        } catch {
          /* not JSON */
        }
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

/** Polls the topic from `since` offsets until a JSON message satisfies `match`; resolves the parsed event. */
export async function waitForEvent(topic, since, match, options) {
  return (await waitForMessage(topic, since, match, options))?.event ?? null;
}

const KEY_SEPARATOR = "|||";

/** Appends one message (key and value as given, no re-encoding) through the Kafka container's console producer. */
export function produceMessage(topic, key, value) {
  if (/[\r\n]/.test(value) || key.includes(KEY_SEPARATOR) || /[\r\n]/.test(key)) throw new Error("produceMessage: key/value must be single-line");
  execFileSync(
    "docker",
    [
      "exec", "-i", CONTAINER, "kafka-console-producer", "--bootstrap-server", BOOTSTRAP, "--topic", topic,
      "--property", "parse.key=true", "--property", `key.separator=${KEY_SEPARATOR}`,
    ],
    { input: `${key}${KEY_SEPARATOR}${value}\n`, encoding: "utf8", timeout: 20000, stdio: ["pipe", "ignore", "ignore"] },
  );
}

/**
 * Total lag of a consumer group on one topic, computed as LOG-END-OFFSET minus CURRENT-OFFSET
 * (a partition the group never committed counts from 0); null when the group has no rows for the topic.
 */
export function groupLag(group, topic) {
  let out = "";
  try {
    out = kafka(["kafka-consumer-groups", "--bootstrap-server", BOOTSTRAP, "--describe", "--group", group]);
  } catch (error) {
    out = error.stdout ?? "";
  }
  const lines = out.split("\n").filter((l) => l.trim());
  const header = lines.findIndex((l) => /\bTOPIC\b/.test(l) && /\bLOG-END-OFFSET\b/.test(l));
  if (header < 0) return null;
  const columns = lines[header].trim().split(/\s+/);
  const [topicAt, currentAt, endAt] = ["TOPIC", "CURRENT-OFFSET", "LOG-END-OFFSET"].map((c) => columns.indexOf(c));
  let total = 0;
  let rows = 0;
  for (const line of lines.slice(header + 1)) {
    const cells = line.trim().split(/\s+/);
    if (cells[topicAt] !== topic) continue;
    const end = Number(cells[endAt]);
    const current = cells[currentAt] === "-" ? 0 : Number(cells[currentAt]);
    if (!Number.isFinite(end) || !Number.isFinite(current)) return null;
    total += end - current;
    rows++;
  }
  return rows ? total : null;
}

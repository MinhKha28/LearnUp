const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { shape } = require("./test-topics.cjs");
const root = path.resolve(__dirname, "../..");
const load = (service, file) =>
  require(path.join(root, "services", service, "dist/src/modules", file));
for (const [service, id] of [
  ["course-service", "course-events"],
  ["learning-service", "enrollment-events"],
]) {
  test(service + " defaults match the topic manifest", () => {
    const config = load(service, "outbox/relay.config.js").readRelayConfig(
      () => undefined,
    );
    assert.equal(config.topic, shape(id).name);
    assert.equal(config.replicationFactor, shape(id).replicationFactor);
  });
}
test("assessment defaults match all three manifest topics", () => {
  const config = load(
    "assessment-service",
    "outbox/relay.config.js",
  ).readRelayConfig(() => undefined);
  for (const [id, field] of [
    ["assessment-status", "topic"],
    ["peer-review-assigned", "peerReviewTopic"],
    ["submission-finalized", "submissionFinalizedTopic"],
  ]) {
    assert.equal(config[field], shape(id).name);
    assert.equal(config.replicationFactor, shape(id).replicationFactor);
  }
});
test("achievement defaults and bounded metadata setting", () => {
  const read = load(
    "achievement-reporting-service",
    "certificates/issuance.config.js",
  ).issuanceConfig;
  assert.equal(read(() => undefined).topic, shape("enrollment-events").name);
  assert.equal(read(() => undefined).metadataMaxAgeMs, 5000);
  for (const value of ["0", "-1", "1.2", "60001", "NaN"])
    assert.throws(() =>
      read((key) =>
        key === "CERTIFICATE_METADATA_MAX_AGE_MS" ? value : undefined,
      ),
    );
  assert.equal(
    read((key) =>
      key === "CERTIFICATE_KAFKA_TOPIC" ? "test.isolated" : undefined,
    ).topic,
    "test.isolated",
  );
});

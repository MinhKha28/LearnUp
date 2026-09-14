#!/bin/sh
set -e

# ==============================================================================
# LearnUP Kafka Infrastructure Connectivity Verification Script
# Runs inside or alongside the Kafka container
# ==============================================================================

BOOTSTRAP_SERVER=${KAFKA_BOOTSTRAP_SERVER:-"kafka:29092"}
TEST_TOPIC=${KAFKA_TEST_TOPIC:-"learnup.infrastructure.test"}
TEST_MESSAGE='{"eventId":"test-001","eventType":"learnup.infrastructure.verified","occurredAt":"2026-09-14T12:00:00Z","organizationId":"org-test","producer":"infrastructure-test","data":{"status":"OPERATIONAL"}}'

echo "================================================================="
echo " LearnUP Kafka Infrastructure Connectivity Verification"
echo " Bootstrap Server: ${BOOTSTRAP_SERVER}"
echo " Test Topic:       ${TEST_TOPIC}"
echo "================================================================="

echo "\n[1/4] Checking Broker Connectivity & Listing Topics..."
kafka-topics --bootstrap-server "${BOOTSTRAP_SERVER}" --list

echo "\n[2/4] Creating Temporary Test Topic: ${TEST_TOPIC}..."
kafka-topics --bootstrap-server "${BOOTSTRAP_SERVER}" \
  --create --if-not-exists \
  --topic "${TEST_TOPIC}" \
  --partitions 1 \
  --replication-factor 1

echo "\n[3/4] Producing Test Event to: ${TEST_TOPIC}..."
echo "${TEST_MESSAGE}" | kafka-console-producer \
  --bootstrap-server "${BOOTSTRAP_SERVER}" \
  --topic "${TEST_TOPIC}"

echo "\n[4/4] Consuming Test Event from: ${TEST_TOPIC}..."
CONSUMED_PAYLOAD=$(kafka-console-consumer \
  --bootstrap-server "${BOOTSTRAP_SERVER}" \
  --topic "${TEST_TOPIC}" \
  --from-beginning \
  --max-messages 1 \
  --timeout-ms 10000)

echo "Received Payload: ${CONSUMED_PAYLOAD}"

if echo "${CONSUMED_PAYLOAD}" | grep -q "OPERATIONAL"; then
  echo "\n================================================================="
  echo " SUCCESS: Kafka KRaft Infrastructure Verified Successfully!"
  echo "================================================================="
else
  echo "\n================================================================="
  echo " FAILED: Consumed payload did not match expected test message."
  echo "================================================================="
  exit 1
fi

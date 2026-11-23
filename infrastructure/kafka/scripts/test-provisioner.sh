#!/usr/bin/env bash
# Disposable verification only; never uses the developer Compose project.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
PROJECT="learnup-topics-$$-e2e"
COMPOSE="$ROOT/tests/e2e/cluster/compose.e2e.yml"
export DB_USERNAME=postgres DB_PASSWORD=disposable-provisioner-test
compose() { docker compose -p "$PROJECT" -f "$COMPOSE" "$@"; }
LOG=$(mktemp)
cleanup() { compose down -v --remove-orphans; rm -f "$LOG"; }
trap cleanup EXIT

compose up -d kafka
compose run --rm kafka-init > "$LOG" 2>&1
cat "$LOG"
[ "$(grep -c '^TOPIC_READY ' "$LOG")" -eq 9 ]
compose run --rm kafka-init > "$LOG" 2>&1
cat "$LOG"
[ "$(grep -c '^TOPIC_PRESENT ' "$LOG")" -eq 9 ]
printf '%s\n' 'FRESH_AND_IDEMPOTENT_PASS'

# A second fresh broker contains only the deliberately wrong test topic.
compose down -v --remove-orphans
compose up -d kafka
READINESS_TIMEOUT_SECONDS=60
deadline=$((SECONDS + READINESS_TIMEOUT_SECONDS))
until compose exec -T kafka kafka-topics --bootstrap-server kafka:29092 --list >/dev/null 2>&1; do
    [ "$SECONDS" -lt "$deadline" ] || exit 1
    sleep 1
done
topic=$(awk -F '\t' '$1=="submission-finalized" {print $2}' "$ROOT/infrastructure/kafka/topics.tsv")
compose exec -T kafka kafka-topics --bootstrap-server kafka:29092 --create --topic "$topic" --partitions 1 --replication-factor 1
status=0
compose run --rm kafka-init > "$LOG" 2>&1 || status=$?
cat "$LOG"
[ "$status" -eq 4 ]
grep -F "TOPIC_DRIFT topic=$topic expected_partitions=3 actual_partitions=1" "$LOG"
compose exec -T kafka kafka-topics --bootstrap-server kafka:29092 --describe --topic "$topic" | grep 'PartitionCount: 1'
printf '%s\n' 'DRIFT_EXIT_4_UNCHANGED_PASS'

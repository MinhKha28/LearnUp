#!/usr/bin/env bash
# Disposable verification only; never uses the developer Compose project.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
PROJECT="learnup-topics-$$-e2e"
COMPOSE="$ROOT/tests/e2e/cluster/compose.e2e.yml"
NO_HOST_PORTS="$ROOT/infrastructure/kafka/scripts/no-host-ports.compose.yml"
export DB_USERNAME=postgres DB_PASSWORD=disposable-provisioner-test
# Git Bash must not rewrite container paths such as /topics to Windows paths.
# Normalize only the host Compose paths before disabling that conversion.
if command -v cygpath >/dev/null 2>&1; then
  COMPOSE=$(cygpath -m "$COMPOSE")
  NO_HOST_PORTS=$(cygpath -m "$NO_HOST_PORTS")
fi

compose() {
  MSYS_NO_PATHCONV=1 docker compose -p "$PROJECT" -f "$COMPOSE" -f "$NO_HOST_PORTS" "$@"
}

LOG=$(mktemp)
cleanup() {
  compose down -v --remove-orphans
  rm -f "$LOG"
}
trap cleanup EXIT

compose up -d kafka
compose run --rm --entrypoint sh kafka-init /topics/scripts/test-provisioner-cases.sh

assert_broker_stopped() {
  broker_id=$(compose ps -a -q kafka)
  [ -n "$broker_id" ]
  [ "$(docker inspect --format '{{.State.Running}}' "$broker_id")" = false ]
}

# A real stopped broker, not a mocked client error. Only the test project stops.
compose stop kafka
assert_broker_stopped
status=0
compose run --rm --no-deps -e READINESS_TIMEOUT_SECONDS=2 -e COMMAND_TIMEOUT_SECONDS=1 kafka-init > "$LOG" 2>&1 || status=$?
assert_broker_stopped
printf 'BROKER_HELD_STOPPED_PASS\n'
cat "$LOG"
[ "$status" -eq 3 ]
grep -F 'BROKER_NOT_READY' "$LOG"
printf 'BROKER_DOWN_EXIT_3_PASS\n'

# Reuse the same data to verify recovery without any topic creation.
compose up -d kafka
compose run --rm kafka-init > "$LOG" 2>&1
cat "$LOG"
[ "$(grep -c '^TOPIC_PRESENT ' "$LOG")" -eq 9 ]
if grep -q '^TOPIC_READY ' "$LOG"; then exit 1; fi
printf 'BROKER_RECOVERY_PASS\n'

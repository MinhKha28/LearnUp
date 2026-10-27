# Sourced by start.sh and reset.sh: the single place that names the E2E compose project.
# E2E_COMPOSE_PROJECT may be overridden, but only to a name ending in "-e2e".
E2E_PROJECT="${E2E_COMPOSE_PROJECT:-learnup-e2e}"
if [[ ! "$E2E_PROJECT" =~ ^[a-z0-9][a-z0-9_-]*-e2e$ ]]; then
  echo "refusing E2E_COMPOSE_PROJECT='$E2E_PROJECT': it must be lowercase and end in -e2e" >&2
  exit 1
fi
E2E_COMPOSE_FILE="$ROOT/tests/e2e/cluster/compose.e2e.yml"
# The developer's stack: the root docker-compose.yml under its default project name.
DEV_PROJECT="${DEV_COMPOSE_PROJECT:-learnup}"

e2e_compose() { docker compose -p "$E2E_PROJECT" -f "$E2E_COMPOSE_FILE" "$@"; }

# Refuses to continue while any container of the developer's compose stack is running:
# it publishes the same host ports (5433, 9092) and must never be touched by E2E commands.
assert_dev_stack_stopped() {
  local running
  running="$(
    {
      docker ps --filter "label=com.docker.compose.project=$DEV_PROJECT" --format '{{.Names}}'
      docker ps --filter "label=com.docker.compose.project.config_files=$ROOT/docker-compose.yml" --format '{{.Names}}'
    } | sort -u
  )"
  if [[ -n "$running" ]]; then
    echo "The default compose stack ('$DEV_PROJECT') is running: $(echo "$running" | tr '\n' ' ')" >&2
    echo "It uses the same host ports and must not be shared with E2E. Stop it yourself" >&2
    echo "(docker compose stop) and re-run; E2E never stops or deletes the dev stack." >&2
    exit 1
  fi
}

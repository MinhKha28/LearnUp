#!/usr/bin/env bash
# Explicit full reset of the E2E cluster's infrastructure data. Never called by the suite.
#   tests/e2e/cluster/reset.sh          dry run: lists the volumes that would be removed
#   tests/e2e/cluster/reset.sh --yes    stops host processes and removes the E2E project
# Only volumes owned by the E2E compose project are removed. The developer's default stack
# (root docker-compose.yml) is never stopped or touched; any doubt aborts without deleting.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
STATE="${E2E_STATE_DIR:-/tmp/learnup-e2e}"
# shellcheck source=compose.sh
. "$ROOT/tests/e2e/cluster/compose.sh"
[[ -f "$STATE/cluster.env" ]] && { set -a; . "$STATE/cluster.env"; set +a; }
export DB_USERNAME="${DB_USERNAME:-postgres}" DB_PASSWORD="${DB_PASSWORD:-unused}"

abort() { echo "ABORT (nothing deleted): $*" >&2; exit 1; }

labelled="$(docker volume ls -q --filter "label=com.docker.compose.project=$E2E_PROJECT" | sort)"
# Volume names the compose config would remove, as resolved by compose itself.
config_json="$(e2e_compose config --format json)"
targets="$(printf '%s' "$config_json" | node -e '
  let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
    const vols = JSON.parse(s).volumes ?? {};
    for (const [key, v] of Object.entries(vols)) {
      if (v?.external) { console.error(`volume ${key} is external`); process.exit(3); }
      console.log(v?.name ?? key);
    }
  });' | sort)" || abort "compose config declares an external volume"

echo "E2E compose project: $E2E_PROJECT"
echo "Volumes labelled com.docker.compose.project=$E2E_PROJECT:"
echo "${labelled:-  (none)}" | sed 's/^/  /'
echo "Volumes the E2E compose config would remove:"
echo "$targets" | sed 's/^/  /'

for v in $targets; do
  [[ "$v" == "${E2E_PROJECT}_"* ]] || abort "volume '$v' is not prefixed with ${E2E_PROJECT}_ (explicit name:?)"
  if docker volume inspect "$v" > /dev/null 2>&1; then
    owner="$(docker volume inspect -f '{{index .Labels "com.docker.compose.project"}}' "$v")"
    [[ "$owner" == "$E2E_PROJECT" ]] || abort "volume '$v' belongs to project '${owner:-none}', not $E2E_PROJECT"
  fi
done

if [[ "${1:-}" != "--yes" ]]; then
  echo "dry run only; re-run with --yes to stop the E2E host processes and remove these volumes"
  exit 0
fi
"$ROOT/tests/e2e/cluster/stop.sh"
e2e_compose down -v --remove-orphans
rm -f "$STATE/seeded-$E2E_PROJECT"
echo "E2E project $E2E_PROJECT removed; next start.sh migrates and seeds again"

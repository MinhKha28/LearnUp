#!/usr/bin/env bash
# Starts the disposable LearnUP E2E cluster on one Linux host:
#   docker compose: postgres + kafka from cluster/compose.e2e.yml, project learnup-e2e
#                   (never the root docker-compose.yml stack; refuses to run beside it)
#   host processes: eureka, gateway, identity, notification, audit (jars) and
#                   tenant, course, learning, assessment, achievement (node dist)
#   smtp-sink: loopback SMTP capture used instead of a real mail provider
# Prerequisites (built once, see tests/e2e/README.md): Java jars in each target/,
# `npm ci && npx prisma generate && npm run build` in libraries/ts-* and each Node service.
# Configuration and secrets are generated under $E2E_STATE_DIR (default /tmp/learnup-e2e),
# never inside the repository. This script never deletes data.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
# shellcheck source=compose.sh
. "$ROOT/tests/e2e/cluster/compose.sh"
STATE="${E2E_STATE_DIR:-/tmp/learnup-e2e}"
LOGS="$STATE/logs"
PIDS="$STATE/pids"
mkdir -p "$LOGS" "$PIDS" "$STATE/mailbox"

if [[ ! -f "$STATE/cluster.env" ]]; then
  umask 077
  cat > "$STATE/cluster.env" <<EOF
DB_USERNAME=postgres
DB_PASSWORD=postgres
POSTGRES_PORT=5433
JWT_SECRET=$(openssl rand -hex 32)
INTERNAL_SERVICE_KEY=$(openssl rand -hex 32)
EMAIL_OTP_SECRET=$(openssl rand -hex 32)
FIXTURE_ORGANIZER_PASSWORD=E2e-$(openssl rand -hex 12)
SMTP_SINK_PORT=2525
EOF
  umask 022
fi
set -a
# shellcheck disable=SC1091
. "$STATE/cluster.env"
set +a
PG="postgresql://${DB_USERNAME}:${DB_PASSWORD}@localhost:${POSTGRES_PORT}"

log() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*"; }
listening() { lsof -ti "tcp:$1" -sTCP:LISTEN > /dev/null 2>&1; }

start_proc() { # name port dir cmd...
  local name="$1" port="$2" dir="$3"; shift 3
  if listening "$port"; then log "$name already running (port $port)"; return; fi
  (cd "$dir" && nohup "$@" > "$LOGS/$name.log" 2>&1 &)
  echo "$port" > "$PIDS/$name.port"
  log "started $name (port $port)"
}

wait_http() { # name url [timeout_s]
  local name="$1" url="$2" timeout="${3:-180}" t=0
  until curl -s -o /dev/null -m 3 "$url"; do
    sleep 2; t=$((t + 2))
    if (( t >= timeout )); then log "TIMEOUT waiting for $name ($url); see $LOGS/$name.log"; exit 1; fi
  done
  log "$name is serving ($url)"
}

log "infrastructure: postgres + kafka (compose project $E2E_PROJECT)"
assert_dev_stack_stopped
e2e_compose up -d postgres kafka
until e2e_compose exec -T postgres pg_isready -U "$DB_USERNAME" > /dev/null 2>&1; do sleep 2; done
until e2e_compose exec -T kafka kafka-topics --bootstrap-server kafka:29092 --list > /dev/null 2>&1; do sleep 3; done
log "postgres and kafka ready"

start_proc smtp-sink "$SMTP_SINK_PORT" "$ROOT" env MAILBOX_DIR="$STATE/mailbox" SMTP_SINK_PORT="$SMTP_SINK_PORT" \
  node tests/e2e/cluster/smtp-sink.mjs

# ---- Node services: env, migrations, seeds (seeds once, create/upsert only) ----
node_env() { # service -> prints KEY=VALUE lines
  local common="INTERNAL_SERVICE_KEY=$INTERNAL_SERVICE_KEY
NODE_ENV=development
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET="
  case "$1" in
    tenant-service) cat <<EOF
$common
PORT=8084
DATABASE_URL=$PG/tenant_db?schema=public
FRONTEND_URL=http://localhost:3000
IDENTITY_SERVICE_URL=http://localhost:8081
NOTIFICATION_SERVICE_URL=http://localhost:8082
DEV_FAKE_AUTH=false
COURSE_CLIENT_MODE=http
COURSE_SERVICE_URL=http://localhost:8083
COURSE_SERVICE_TIMEOUT_MS=3000
LEARNING_CLIENT_MODE=http
LEARNING_SERVICE_URL=http://localhost:8085
LEARNING_SERVICE_TIMEOUT_MS=3000
EMAIL_OTP_SECRET=$EMAIL_OTP_SECRET
EOF
    ;;
    course-service) cat <<EOF
$common
PORT=8083
DATABASE_URL=$PG/course_db?schema=public
TENANT_SERVICE_URL=http://localhost:8084
LEARNING_SERVICE_URL=http://localhost:8085
EOF
    ;;
    learning-service) cat <<EOF
$common
PORT=8085
VIDEO_PLAYBACK_MODE=fixture
VIDEO_FIXTURE_URL=http://127.0.0.1:9/e2e-fixture.mp4
READING_ACCESS_MODE=fixture
READING_FIXTURE_URL=http://127.0.0.1:9/e2e-fixture.pdf
DATABASE_URL=$PG/learning_db?schema=public
COURSE_SERVICE_URL=http://localhost:8083
COURSE_SERVICE_TIMEOUT_MS=3000
TENANT_SERVICE_URL=http://localhost:8084
TENANT_CLIENT_MODE=http
ASSESSMENT_CLIENT_MODE=http
ASSESSMENT_SERVICE_URL=http://localhost:8086
ASSESSMENT_COMPLETION_CLIENT_MODE=http
KAFKA_BROKERS=localhost:9092
OUTBOX_RELAY_ENABLED=true
OUTBOX_TOPIC=learnup.learning.enrollment-events
OUTBOX_REPLICATION_FACTOR=1
COMPLETION_WORKER_ENABLED=true
EOF
    ;;
    assessment-service) cat <<EOF
$common
PORT=8086
DATABASE_URL=$PG/assessment_db?schema=public
COURSE_SERVICE_URL=http://localhost:8083
COURSE_CLIENT_MODE=http
LEARNING_SERVICE_URL=http://localhost:8085
ENROLLMENT_CLIENT_MODE=http
TENANT_SERVICE_URL=http://localhost:8084
TENANT_CLIENT_MODE=http
EOF
    ;;
    achievement-reporting-service) cat <<EOF
$common
PORT=8087
DATABASE_URL=$PG/achievement_reporting_db?schema=public
TENANT_SERVICE_URL=http://localhost:8084
COURSE_SERVICE_URL=http://localhost:8083
KAFKA_BROKERS=localhost:9092
CERTIFICATE_CONSUMER_ENABLED=false
CERTIFICATE_CLEANUP_ENABLED=false
CERTIFICATE_PROFILE_CLIENT_MODE=http
CERTIFICATE_COURSE_CLIENT_MODE=http
EOF
    ;;
  esac
}

NODE_SERVICES=(tenant-service course-service learning-service assessment-service achievement-reporting-service)
for svc in "${NODE_SERVICES[@]}"; do
  node_env "$svc" > "$STATE/$svc.env"
  ( set -a; . "$STATE/$svc.env"; set +a
    cd "$ROOT/services/$svc"
    npx prisma migrate deploy > "$LOGS/$svc.migrate.log" 2>&1 ) \
    || { log "migration failed for $svc; see $LOGS/$svc.migrate.log"; exit 1; }
  log "$svc migrations applied"
done

SEEDED="$STATE/seeded-$E2E_PROJECT"
if [[ ! -f "$SEEDED" || "${1:-}" == "--reseed" ]]; then
  # NODE_PATH=. lets ts-node resolve the learning seed's baseUrl import ('generated/prisma/client').
  seed() { # service npm-script
    ( set -a; . "$STATE/$1.env"; set +a; cd "$ROOT/services/$1"; NODE_PATH=. npm run -s "$2" ) >> "$LOGS/seed.log" 2>&1 \
      || { log "seed $1:$2 failed; see $LOGS/seed.log"; exit 1; }
    log "seeded $1 ($2)"
  }
  seed tenant-service prisma:seed
  seed tenant-service prisma:seed:accounts
  seed course-service prisma:seed
  seed learning-service db:seed
  seed assessment-service db:seed
  touch "$SEEDED"
fi

# ---- Java services ----
JAVA_COMMON=(EUREKA_CLIENT_SERVICEURL_DEFAULTZONE=http://localhost:8761/eureka/
  INTERNAL_SERVICE_KEY="$INTERNAL_SERVICE_KEY")
start_proc eureka 8761 "$ROOT/infrastructure/eureka-server" java -jar target/eureka-server-1.0.0-SNAPSHOT.jar
wait_http eureka http://localhost:8761/eureka/apps
start_proc identity 8081 "$ROOT/services/identity-service" env "${JAVA_COMMON[@]}" \
  SPRING_DATASOURCE_URL="jdbc:postgresql://localhost:${POSTGRES_PORT}/identity_db" \
  SPRING_DATASOURCE_USERNAME="$DB_USERNAME" SPRING_DATASOURCE_PASSWORD="$DB_PASSWORD" \
  JWT_SECRET="$JWT_SECRET" TENANT_SERVICE_URL=http://localhost:8084 \
  NOTIFICATION_SERVICE_URL=http://localhost:8082 \
  PASSWORD_RECOVERY_FRONTEND_BASE_URL=http://127.0.0.1:5173 LEARNUP_SEED_ENABLED=false \
  java -jar target/identity-service-1.0.0-SNAPSHOT.jar
start_proc notification 8082 "$ROOT/services/notification-service" env "${JAVA_COMMON[@]}" \
  SPRING_DATASOURCE_URL="jdbc:postgresql://localhost:${POSTGRES_PORT}/notification_db" \
  SPRING_DATASOURCE_USERNAME="$DB_USERNAME" SPRING_DATASOURCE_PASSWORD="$DB_PASSWORD" \
  SPRING_MAIL_HOST=127.0.0.1 SPRING_MAIL_PORT="$SMTP_SINK_PORT" MANAGEMENT_HEALTH_MAIL_ENABLED=false \
  LEARNUP_MAIL_ENABLED=true LEARNUP_MAIL_FROM=noreply@learnup.local \
  java -jar target/notification-service-1.0.0-SNAPSHOT.jar
start_proc audit 8093 "$ROOT/services/audit-service" env "${JAVA_COMMON[@]}" SERVER_PORT=8093 \
  SPRING_DATASOURCE_URL="jdbc:postgresql://localhost:${POSTGRES_PORT}/audit_db" \
  SPRING_DATASOURCE_USERNAME="$DB_USERNAME" SPRING_DATASOURCE_PASSWORD="$DB_PASSWORD" \
  java -jar target/audit-service-1.0.0-SNAPSHOT.jar
start_proc gateway 8080 "$ROOT/gateway/api-gateway" env "${JAVA_COMMON[@]}" JWT_SECRET="$JWT_SECRET" \
  TENANT_SERVICE_URL=http://localhost:8084 COURSE_SERVICE_URL=http://localhost:8083 \
  LEARNING_SERVICE_URL=http://localhost:8085 ASSESSMENT_SERVICE_URL=http://localhost:8086 \
  ACHIEVEMENT_REPORTING_SERVICE_URL=http://localhost:8087 \
  java -jar target/api-gateway-1.0.0-SNAPSHOT.jar

for svc in "${NODE_SERVICES[@]}"; do
  # Same entry resolution as the Dockerfiles; package.json start:prod still points at dist/main.
  main=dist/src/main.js; [[ -f "$ROOT/services/$svc/$main" ]] || main=dist/main.js
  port="$(grep '^PORT=' "$STATE/$svc.env" | cut -d= -f2)"
  start_proc "$svc" "$port" "$ROOT/services/$svc" bash -c "set -a; . '$STATE/$svc.env'; set +a; exec node $main"
done

wait_http identity http://localhost:8081/actuator/health
wait_http notification http://localhost:8082/actuator/health
wait_http audit http://localhost:8093/actuator/health
wait_http gateway http://localhost:8080/actuator/health
wait_http tenant-service http://localhost:8084/api/v1/subscription-plans
wait_http course-service http://localhost:8083/api/v1/courses/catalog
wait_http learning-service http://localhost:8085/api/v1/enrollments/me
wait_http assessment-service http://localhost:8086/api/v1/assessments/quizzes
wait_http achievement-reporting-service http://localhost:8087/api/v1/certificates/signer-settings

# Eureka-routed services (identity) must be registered before the gateway can route to them.
t=0
until curl -s -H 'Accept: application/json' http://localhost:8761/eureka/apps | grep -q IDENTITY-SERVICE; do
  sleep 3; t=$((t + 3)); (( t < 120 )) || { log "identity not registered in eureka"; exit 1; }
done

# The gateway refreshes its Eureka cache about every 30 s; wait until it routes to identity.
t=0
until [[ "$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'content-type: application/json' -d '{}' \
  http://localhost:8080/api/v1/auth/login)" != 503 ]]; do
  sleep 3; t=$((t + 3)); (( t < 120 )) || { log "gateway does not route to identity"; exit 1; }
done

(cd "$ROOT" && node tests/e2e/cluster/bootstrap-fixtures.mjs)
log "cluster ready: gateway http://localhost:8080, state $STATE"

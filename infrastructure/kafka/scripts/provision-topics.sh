#!/bin/sh
# The only deployed-topic creator. Topic drift is always an operator decision.
set -eu
MANIFEST=${1:-/topics/topics.tsv}
BOOTSTRAP_SERVER=${BOOTSTRAP_SERVER:-kafka:29092}
READINESS_TIMEOUT_SECONDS=${READINESS_TIMEOUT_SECONDS:-30}
COMMAND_TIMEOUT_SECONDS=${COMMAND_TIMEOUT_SECONDS:-5}
fail() { code=$1; shift; printf '%s\n' "$*" >&2; exit "$code"; }
case "$READINESS_TIMEOUT_SECONDS:$COMMAND_TIMEOUT_SECONDS" in *[!0-9:]*|0:*|*:0) fail 2 'INVALID_TIMEOUT';; esac
[ -r "$MANIFEST" ] || fail 2 'MANIFEST_UNREADABLE'
resolved=$(mktemp)
describe=$(mktemp)
trap 'rm -f "$resolved" "$describe"' EXIT HUP INT TERM
tab=$(printf '\t')
while IFS="$tab" read -r id name partitions replicas key override extra; do
    case "$id" in ''|\#*) continue;; esac
    [ -z "${extra:-}" ] || fail 2 'INVALID_MANIFEST_COLUMNS'
    case "$id:$name:$key:$override" in *' '*|*'/'*) fail 2 'INVALID_MANIFEST_VALUE';; esac
    case "$partitions:$replicas" in *[!0-9:]*|0:*|*:0|:*) fail 2 'INVALID_TOPIC_SHAPE';; esac
    env_name=${override%%+*}
    case "$env_name" in ''|*[!A-Z0-9_]*) fail 2 'INVALID_OVERRIDE_NAME';; esac
    value=$(printenv "$env_name" || true)
    if [ -n "$value" ]; then
        name=$value
        case "$override" in *+*) name="$name${override#*+}";; esac
    fi
    case "$name" in ''|*[!a-zA-Z0-9._-]*|.|..) fail 2 'INVALID_TOPIC_NAME';; esac
    [ "${#name}" -le 249 ] || fail 2 'INVALID_TOPIC_NAME_LENGTH'
    printf '%s\t%s\t%s\t%s\n' "$id" "$name" "$partitions" "$replicas" >> "$resolved"
done < "$MANIFEST"
[ -s "$resolved" ] || fail 2 'EMPTY_MANIFEST'
awk -F '\t' 'seenId[$1]++ || seenName[$2]++ {bad=1} END {exit bad}' "$resolved" || fail 2 'DUPLICATE_TOPIC_ID_OR_NAME'
run_topics() { timeout "$COMMAND_TIMEOUT_SECONDS" kafka-topics --bootstrap-server "$BOOTSTRAP_SERVER" "$@"; }
deadline=$(( $(date +%s) + READINESS_TIMEOUT_SECONDS ))
until run_topics --list >/dev/null 2>&1; do
    [ "$(date +%s)" -lt "$deadline" ] || fail 3 'BROKER_NOT_READY: readiness deadline exhausted'
    sleep 1
done
check_shape() {
    actual_partitions=$(awk '/PartitionCount:/ {for(i=1;i<=NF;i++) if($i=="PartitionCount:") print $(i+1)}' "$describe")
    actual_replicas=$(awk '/Partition:/ {for(i=1;i<=NF;i++) if($i=="Replicas:"){n=split($(i+1),a,","); print n}}' "$describe" | sort -u | paste -sd, -)
    if [ "$actual_partitions" != "$partitions" ] || [ "$actual_replicas" != "$replicas" ]; then
        fail 4 "TOPIC_DRIFT topic=$name expected_partitions=$partitions actual_partitions=$actual_partitions expected_replicas=$replicas actual_replica_counts=$actual_replicas. Pause publishers; check lag of every consumer group. Alter only with lag 0 and accepted key-ordering impact; never repair automatically."
    fi
}
# Inspect every existing topic before creating any missing ones.
while IFS="$tab" read -r id name partitions replicas; do
    if run_topics --describe --topic "$name" > "$describe" 2>/dev/null; then check_shape; fi
done < "$resolved"
while IFS="$tab" read -r id name partitions replicas; do
    if run_topics --describe --topic "$name" > "$describe" 2>/dev/null; then
        check_shape
        printf 'TOPIC_PRESENT topic=%s\n' "$name"
        continue
    fi
    case "$id" in *-dlt|verification) retention_args='';; *) retention_args='--config retention.ms=2592000000';; esac
    # retention_args is a fixed literal, never data from the manifest.
    run_topics --create --if-not-exists --topic "$name" --partitions "$partitions" --replication-factor "$replicas" $retention_args || fail 5 "TOPIC_CREATE_FAILED topic=$name"
    run_topics --describe --topic "$name" > "$describe" || fail 5 "TOPIC_DESCRIBE_FAILED topic=$name"
    check_shape
    printf 'TOPIC_READY topic=%s\n' "$name"
done < "$resolved"

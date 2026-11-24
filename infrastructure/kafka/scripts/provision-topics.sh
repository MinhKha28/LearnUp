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
SOURCE_RETENTION_MS=2592000000
READINESS_RETRY_SECONDS=1
work_directory=$(mktemp -d)
resolved="$work_directory/resolved.tsv"
describe="$work_directory/topic-description"
snapshot="$work_directory/snapshot"
created_topics="$work_directory/created-topics"
touch "$resolved" "$created_topics"
trap 'rm -rf "$work_directory"' EXIT HUP INT TERM
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

run_topics() {
    timeout "$COMMAND_TIMEOUT_SECONDS" kafka-topics --bootstrap-server "$BOOTSTRAP_SERVER" "$@"
}

wait_for_broker() {
    readiness_deadline=$(( $(date +%s) + READINESS_TIMEOUT_SECONDS ))
    until run_topics --list >/dev/null 2>&1; do
        if [ "$(date +%s)" -ge "$readiness_deadline" ]; then
            fail 3 'BROKER_NOT_READY: readiness deadline exhausted'
        fi
        sleep "$READINESS_RETRY_SECONDS"
    done
}

read_topic_snapshot() {
    if ! run_topics --describe > "$snapshot"; then
        fail 5 'TOPIC_DESCRIBE_FAILED: cannot read topic snapshot'
    fi
}

load_topic_description() {
    # Both summary and partition lines begin with Topic:. Compare the complete
    # field as a string: topic names contain dots, so regex matching is unsafe.
    # sprintf produces strings: AWK otherwise equates numeric names like 1/01.
    awk -v expected_topic="$name" '
        BEGIN { expected_name = sprintf("%s", expected_topic) }
        $1 == "Topic:" {
            actual_name = sprintf("%s", $2)
            if (actual_name == expected_name) print
        }
    ' "$snapshot" > "$describe"
}

check_shape() {
    actual_partitions=$(awk '
        /PartitionCount:/ {
            for (field = 1; field <= NF; field++) {
                if ($field == "PartitionCount:") print $(field + 1)
            }
        }
    ' "$describe")
    actual_replicas=$(awk '
        /Partition:/ {
            for (field = 1; field <= NF; field++) {
                if ($field == "Replicas:") {
                    replica_count = split($(field + 1), replicas, ",")
                    print replica_count
                }
            }
        }
    ' "$describe" | sort -u | paste -sd, -)
    if [ "$actual_partitions" != "$partitions" ] || [ "$actual_replicas" != "$replicas" ]; then
        fail 4 "TOPIC_DRIFT topic=$name expected_partitions=$partitions actual_partitions=$actual_partitions expected_replicas=$replicas actual_replica_counts=$actual_replicas. Pause publishers; check lag of every consumer group. Alter only with lag 0 and accepted key-ordering impact; never repair automatically."
    fi
}

validate_existing_topics() {
    # Validate every existing shape before creating anything, so drift cannot
    # leave the broker partially provisioned.
    while IFS="$tab" read -r id name partitions replicas; do
        load_topic_description
        if [ -s "$describe" ]; then
            check_shape
        fi
    done < "$resolved"
}

create_topic() {
    # --if-not-exists handles another provisioner winning the creation race.
    set -- --create --if-not-exists --topic "$name" --partitions "$partitions" --replication-factor "$replicas"
    case "$id" in
        *-dlt|verification) ;;
        *) set -- "$@" --config "retention.ms=$SOURCE_RETENTION_MS" ;;
    esac
    if ! run_topics "$@"; then
        fail 5 "TOPIC_CREATE_FAILED topic=$name"
    fi
    printf '%s\n' "$name" >> "$created_topics"
}

create_missing_topics() {
    while IFS="$tab" read -r id name partitions replicas; do
        load_topic_description
        if [ -s "$describe" ]; then
            printf 'TOPIC_PRESENT topic=%s\n' "$name"
        else
            create_topic
        fi
    done < "$resolved"
}

confirm_topics() {
    while IFS="$tab" read -r id name partitions replicas; do
        load_topic_description
        if [ ! -s "$describe" ]; then
            fail 5 "TOPIC_DESCRIBE_FAILED topic=$name"
        fi
        check_shape
        if grep -Fxq -- "$name" "$created_topics"; then
            printf 'TOPIC_READY topic=%s\n' "$name"
        fi
    done < "$resolved"
}

wait_for_broker
read_topic_snapshot
validate_existing_topics
create_missing_topics
read_topic_snapshot
confirm_topics

#!/bin/sh
# Runs inside the disposable kafka-init image, against the real test broker.
set -eu
BOOTSTRAP_SERVER=${BOOTSTRAP_SERVER:-kafka:29092}
export BOOTSTRAP_SERVER
REAL_KAFKA_TOPICS=$(command -v kafka-topics)
export REAL_KAFKA_TOPICS
TEST_STATE=$(mktemp -d)
export TEST_STATE
trap 'rm -rf "$TEST_STATE"' EXIT HUP INT TERM
mkdir "$TEST_STATE/bin"
printf '#!/bin/sh\nexec sh /topics/scripts/test-kafka-topics.sh "$@"\n' > "$TEST_STATE/bin/kafka-topics"
chmod +x "$TEST_STATE/bin/kafka-topics"
PATH="$TEST_STATE/bin:$PATH"
export PATH
TEST_MODE=normal
TEST_TARGET=''
export TEST_MODE TEST_TARGET
TAB=$(printf '\t')

real_topics() {
    "$REAL_KAFKA_TOPICS" --bootstrap-server "$BOOTSTRAP_SERVER" "$@"
}

reset_calls() {
    : > "$TEST_STATE/calls"
    printf '0\n' > "$TEST_STATE/describe-count"
    rm -f "$TEST_STATE/race-created" "$TEST_STATE/destructive-call"
}

assert_calls() {
    actual=$(awk -v operation="$1" '$1 == operation { count++ } END { print count + 0 }' "$TEST_STATE/calls")
    if [ "$actual" != "$2" ]; then
        cat "$TEST_STATE/calls" >&2
        printf 'Expected %s %s calls, got %s\n' "$2" "$1" "$actual" >&2
        exit 1
    fi
}

run_provisioner() {
    expected_exit=$1
    manifest=$2
    reset_calls
    actual_exit=0
    sh /topics/scripts/provision-topics.sh "$manifest" > "$TEST_STATE/output" 2>&1 || actual_exit=$?
    cat "$TEST_STATE/output"
    if [ -f "$TEST_STATE/destructive-call" ]; then
        printf 'Provisioner attempted to alter or delete a topic\n' >&2
        exit 1
    fi
    if [ "$actual_exit" != "$expected_exit" ]; then
        printf 'Expected exit %s, got %s\n' "$expected_exit" "$actual_exit" >&2
        exit 1
    fi
}

assert_marker_count() {
    actual=$(awk -v marker="$1" '$1 == marker { count++ } END { print count + 0 }' "$TEST_STATE/output")
    [ "$actual" = "$2" ]
}

read_shapes() {
    real_topics --describe > "$TEST_STATE/shapes"
}

assert_shape() {
    checked_topic=$1
    expected_partitions=$2
    expected_replicas=$3
    awk -v topic="$checked_topic" -v partitions="$expected_partitions" -v replicas="$expected_replicas" '
        $1 == "Topic:" && sprintf("%s", $2) == sprintf("%s", topic) {
            for (field = 1; field <= NF; field++) {
                if ($field == "PartitionCount:") {
                    found = 1
                    if ($(field + 1) != partitions) bad = 1
                }
                if ($field == "ReplicationFactor:" && $(field + 1) != replicas) bad = 1
                if ($field == "Replicas:" && split($(field + 1), ids, ",") != replicas) bad = 1
            }
        }
        END { exit !found || bad }
    ' "$TEST_STATE/shapes"
}

write_manifest() {
    printf 'verification\t%s\t%s\t%s\ttest\tPROVISIONER_TEST_TOPIC\n' "$1" "$2" "$3" > "$TEST_STATE/manifest.tsv"
}

run_provisioner 0 /topics/topics.tsv
assert_calls create 9
assert_calls describe 2
assert_marker_count TOPIC_READY 9
read_shapes
while IFS="$TAB" read -r id name partitions replicas key override; do
    case "$id" in ''|\#*) continue ;; esac
    assert_shape "$name" "$partitions" "$replicas"
    summary=$(awk -v topic="$name" '$1 == "Topic:" && sprintf("%s", $2) == sprintf("%s", topic) && /PartitionCount:/ { print }' "$TEST_STATE/shapes")
    case "$id" in
        *-dlt) case "$summary" in *retention.ms=*) exit 1 ;; esac ;;
        *) case "$summary" in *retention.ms=2592000000*) ;; *) exit 1 ;; esac ;;
    esac
done < /topics/topics.tsv
printf 'FRESH_SHAPES_AND_CONFIGS_PASS\n'

run_provisioner 0 /topics/topics.tsv
assert_calls create 0
assert_calls describe 2
assert_marker_count TOPIC_PRESENT 9
assert_marker_count TOPIC_READY 0
printf 'RERUN_ZERO_CREATES_PASS\n'

# Decoys include prefix and regex lookalikes with intentionally different shapes.
real_topics --create --topic learnup.test.exact --partitions 3 --replication-factor 1
real_topics --create --topic learnup.test.exact.extra --partitions 1 --replication-factor 1
real_topics --create --topic learnupXtestXexact --partitions 2 --replication-factor 1
real_topics --create --topic __provisioner_foreign --partitions 1 --replication-factor 1
write_manifest learnup.test.exact 3 1
run_provisioner 0 "$TEST_STATE/manifest.tsv"
assert_calls create 0
assert_marker_count TOPIC_PRESENT 1
read_shapes
assert_shape learnup.test.exact.extra 1 1
assert_shape learnupXtestXexact 2 1
assert_shape __provisioner_foreign 1 1
printf 'EXACT_PREFIX_AND_FOREIGN_PARSING_PASS\n'

# AWK must not treat distinct numeric-looking names as equal numbers.
real_topics --create --topic 1 --partitions 1 --replication-factor 1
real_topics --create --topic 01 --partitions 3 --replication-factor 1
real_topics --create --topic 1.0 --partitions 2 --replication-factor 1
real_topics --create --topic 1e0 --partitions 1 --replication-factor 1
write_manifest 01 3 1
run_provisioner 0 "$TEST_STATE/manifest.tsv"
assert_calls create 0
assert_marker_count TOPIC_PRESENT 1
read_shapes
assert_shape 1 1 1
assert_shape 01 3 1
assert_shape 1.0 2 1
assert_shape 1e0 1 1
printf 'NUMERIC_TOPIC_NAMES_ARE_DISTINCT_PASS\n'


# A missing row before a drifted row must not be created.
write_manifest learnup.test.must-not-create 3 1
printf 'drift\tlearnup.test.exact\t1\t1\ttest\tPROVISIONER_DRIFT_TOPIC\n' >> "$TEST_STATE/manifest.tsv"
run_provisioner 4 "$TEST_STATE/manifest.tsv"
assert_calls create 0
read_shapes
assert_shape learnup.test.exact 3 1
if grep -Fq 'learnup.test.must-not-create' "$TEST_STATE/shapes"; then exit 1; fi
printf 'DRIFT_EXIT_4_UNCHANGED_PASS\n'
write_manifest learnup.test.exact 3 2
run_provisioner 4 "$TEST_STATE/manifest.tsv"
assert_calls create 0
printf 'REPLICA_DRIFT_PASS\n'

TEST_MODE=missing-confirm
for TEST_TARGET in learnup.test.exact 01; do
    write_manifest "$TEST_TARGET" 3 1
    run_provisioner 5 "$TEST_STATE/manifest.tsv"
    grep -F "TOPIC_DESCRIBE_FAILED topic=$TEST_TARGET" "$TEST_STATE/output"
    assert_calls create 0
done
printf 'MISSING_CONFIRMATION_EXIT_5_PASS\n'

for TEST_MODE in snapshot-error confirm-error; do
    run_provisioner 5 "$TEST_STATE/manifest.tsv"
    assert_calls create 0
    grep -F 'TOPIC_DESCRIBE_FAILED' "$TEST_STATE/output"
done
printf 'SNAPSHOT_FAILURE_EXIT_5_PASS\n'

TEST_MODE=race
TEST_TARGET=learnup.test.race
write_manifest "$TEST_TARGET" 3 1
run_provisioner 0 "$TEST_STATE/manifest.tsv"
assert_calls create 1
[ -f "$TEST_STATE/race-created" ]
read_shapes
assert_shape "$TEST_TARGET" 3 1
printf 'CONCURRENT_CREATION_PASS\n'
TEST_MODE=normal
run_provisioner 0 "$TEST_STATE/manifest.tsv"
assert_calls create 0
assert_marker_count TOPIC_PRESENT 1
assert_marker_count TOPIC_READY 0

# A timed-out CLI may have created its topic. A later run must complete only
# the remaining topic, then become a zero-create rerun.
TEST_MODE=create-timeout
TEST_TARGET=learnup.test.partial-first
write_manifest "$TEST_TARGET" 3 1
printf 'partial-later\tlearnup.test.partial-later\t3\t1\ttest\tPROVISIONER_PARTIAL_LATER\n' >> "$TEST_STATE/manifest.tsv"
run_provisioner 5 "$TEST_STATE/manifest.tsv"
assert_calls create 1
read_shapes
assert_shape "$TEST_TARGET" 3 1
if grep -Fq 'learnup.test.partial-later' "$TEST_STATE/shapes"; then exit 1; fi
TEST_MODE=normal
run_provisioner 0 "$TEST_STATE/manifest.tsv"
assert_calls create 1
assert_marker_count TOPIC_PRESENT 1
assert_marker_count TOPIC_READY 1
read_shapes
assert_shape learnup.test.partial-later 3 1
run_provisioner 0 "$TEST_STATE/manifest.tsv"
assert_calls create 0
assert_marker_count TOPIC_PRESENT 2
assert_marker_count TOPIC_READY 0
printf 'PARTIAL_CREATION_TIMEOUT_RECOVERY_PASS\n'

# Empty input must be rejected before touching Kafka.
: > "$TEST_STATE/manifest.tsv"
run_provisioner 2 "$TEST_STATE/manifest.tsv"
assert_calls list 0
assert_calls create 0
printf 'INVALID_INPUT_EXIT_2_PASS\n'
write_manifest learnup.test.impossible-replication 3 2
run_provisioner 5 "$TEST_STATE/manifest.tsv"
printf 'CREATION_FAILURE_EXIT_5_PASS\n'
printf 'PROVISIONER_REGRESSIONS_PASS\n'

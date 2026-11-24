#!/bin/sh
# Test-only CLI spy and deterministic fault injection; never used by deployment.
set -eu
operation=other
topic=''
previous=''
for argument in "$@"; do
    case "$argument" in
        --list) operation=list ;;
        --describe) operation=describe ;;
        --create) operation=create ;;
        --alter|--delete)
            touch "$TEST_STATE/destructive-call"
            printf 'Unexpected destructive CLI call\n' >&2
            exit 99
            ;;
    esac
    if [ "$previous" = --topic ]; then topic=$argument; fi
    previous=$argument
done
printf '%s\t%s\n' "$operation" "$*" >> "$TEST_STATE/calls"
if [ "$operation" = describe ]; then
    describe_count=$(cat "$TEST_STATE/describe-count")
    describe_count=$((describe_count + 1))
    printf '%s\n' "$describe_count" > "$TEST_STATE/describe-count"
    if [ "$TEST_MODE" = snapshot-error ]; then exit 1; fi
    if [ "$TEST_MODE" = confirm-error ] && [ "$describe_count" -eq 2 ]; then exit 1; fi
    if [ "$TEST_MODE" = missing-confirm ] && [ "$describe_count" -eq 2 ]; then
        "$REAL_KAFKA_TOPICS" "$@" > "$TEST_STATE/real-snapshot"
        # Omit only the requested topic from the final successful response.
        awk -v omitted="$TEST_TARGET" '
            !($1 == "Topic:" && $2 == omitted) { print }
        ' "$TEST_STATE/real-snapshot"
        exit 0
    fi
fi
if [ "$TEST_MODE" = race ] && [ "$operation" = create ]; then
    if [ "$topic" = "$TEST_TARGET" ] && [ ! -f "$TEST_STATE/race-created" ]; then
        # A real competing creation, immediately before the provisioner's call.
        "$REAL_KAFKA_TOPICS" "$@" >/dev/null
        touch "$TEST_STATE/race-created"
    fi
fi
exec "$REAL_KAFKA_TOPICS" "$@"

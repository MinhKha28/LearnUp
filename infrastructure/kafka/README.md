# Kafka topic provisioning

`topics.tsv` is the authoritative registry of the nine deployed topics: logical ID,
default name, partitions, replication factor, key description and deployment override.
Services keep their configured names; Node and Java consistency tests check defaults.
The key column documents the producer contract; Kafka does not enforce it.

## Deployment

The shared `scripts/provision-topics.sh` is the only deployed-topic creator. The
Compose `kafka-init` service uses the existing cp-kafka:7.6.0 image. Applications do
not depend on its completion: they start independently and retry unavailable topics.
E2E explicitly waits for this same entry point before starting its applications.

Root Compose waits for Kafka to be healthy and uses a 90-second readiness budget
and a 15-second per-command timeout for `kafka-init`. After a full `docker compose up`,
check `docker compose ps -a kafka-init` for its result: exit 0 means provisioning
succeeded; 3 means the broker readiness deadline was exhausted; 4 means partition
or replica-count drift; 5 means topic creation or confirmation failed.

Run `docker compose run --rm kafka-init` after Kafka is available. Overrides named
in the manifest must match producer and consumer configuration. The `+.DLT` suffix
means the override changes the source prefix and retains its DLT suffix. Provisioning
keeps existing topics intact and checks every existing shape before creating missing
ones. Source topics retain the existing 30-day retention policy; DLTs retain broker
retention defaults. Verification topics are test-only and outside the deployed list.

The script defaults to `BOOTSTRAP_SERVER=kafka:29092`, a 90-second readiness budget
and a 15-second per-command timeout. A failed readiness attempt can finish at most
16 seconds after that budget; no readiness failure keeps an application from starting.
Exit codes: 0 success; 2 invalid input; 3 broker readiness exhausted; 4 partition or
replica-count drift; 5 creation/confirmation failure. It never alters or deletes topics.

## Drift and existing installations

A previously auto-created one-partition topic fails with expected and actual shape.
Do not silently resize it: increasing partitions changes key-to-partition mapping.
Pause publishers and inspect lag of every consumer group. An operator may approve
`kafka-topics --bootstrap-server <broker> --alter --topic <topic> --partitions 3`
only with lag zero and accepted ordering impact. The provisioner prints guidance but
never performs that operation. Replication changes likewise require operator action.

If a DLT is missing, a poison record on that partition is retried until kafka-init has created the DLT; nothing is lost, and the partition waits.

## Adding topics and tests

Add a deployed topic to `topics.tsv` plus provisioning and configuration-consistency
tests. Do not add Admin creation back to a relay or a Spring NewTopic bean.
Test harnesses use manifest shapes with isolated names; `test-topics.cjs` is test-only.
The consumer no-auto-create regression deliberately enables broker auto-creation and
creates its source topic late; keep that independent fault-injection setup.

`verify-kafka.sh` invokes the same entry point with a temporary test-only manifest.
No manual production-topic creation procedure is maintained elsewhere.

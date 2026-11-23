# Check the Learning and Assessment outbox relays

Use a disposable PostgreSQL environment and a reachable Kafka broker. See the service READMEs for [Learning](../../services/learning-service/README.md#l6-outbox-relay) and [Assessment](../../services/assessment-service/README.md#tests).

## Run the broker integration checks

- In Learning, enable `OUTBOX_INTEGRATION=true` and run `npm run test:integration`. The harness provisions an isolated PostgreSQL database.
- In Assessment, supply a developer PostgreSQL `DATABASE_URL` and set `KAFKA_TEST_BROKERS` to the disposable broker address. Run `npm run test:integration`.

Check that each event is keyed as described in the [event contracts](../../contracts/events/README.md), the event ID matches the outbox row ID, and rows are recorded as published after acknowledgement. The relay tests exercise ordering by key when two relay instances claim work and retry safety when a delivery fails.

## Check broker restart recovery

For Learning's [broker restart integration checks](../../services/learning-service/test/integration/outbox-relay.integration-test.ts), additionally set `OUTBOX_KAFKA_CHAOS=true` and name the disposable Kafka container with `OUTBOX_TEST_KAFKA_CONTAINER`. The harness stops and restarts that container.

For a manual check, start the service with the broker unavailable and submit a valid mutation that writes an outbox event. Confirm the API remains available and the pending row has no publication time. Start the broker, confirm publication on the configured stream, then verify that the same service instance records `published_at`. Use the [Kafka connection and inspection commands](../../infrastructure/kafka/README.md#local-operational-commands).

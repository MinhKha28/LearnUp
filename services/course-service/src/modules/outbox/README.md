# Course outbox relay

The relay keeps claim, delivery and publication/backoff updates in one database
transaction. It enqueues every claimed course head before awaiting delivery
reports together. Separate delivery promises preserve the outcome of each event;
librdkafka batches these concurrent sends on the wire. Only individually failed
events receive one concurrent fallback attempt. A broker-wide initial failure
backs off the entire claim and commits, including rows with ambiguous delivery.

The claim selects only the oldest unpublished event for each course version.
Fallback therefore cannot overtake a successor, including across relay workers.
Delivery remains at least once: a database rollback or ambiguous broker failure
can cause an acknowledged event to be sent again with the same event ID.

The transaction timeout must be at least twice the delivery timeout, greater than
5000 ms and no greater than 30000 ms. Defaults are 10000 ms delivery and 30000 ms
transaction, leaving time for database updates after the two delivery windows.
There is one claim per poll; continuous draining is not enabled.

Run unit tests with `npm test -- --runInBand`. For PostgreSQL relay tests, use a
disposable database, apply the existing migrations with
`npx prisma migrate deploy --config prisma7.config.ts` using its `DATABASE_URL`,
then set `OUTBOX_TEST_DATABASE_URL` to that database and run `npm run test:relay:db`.
The database tests use the real claim/update SQL and a fake Kafka transport; they
do not verify a live Kafka broker. They insert isolated fixtures and require a
disposable database because they inspect all outbox rows.

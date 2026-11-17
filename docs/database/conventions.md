# Database conventions

## General

- Use PostgreSQL 16 and one logical database per service. See the [service references](README.md).
- Prefer plural table names and `snake_case` identifiers. Use canonical IDs from the owning service for logical references. Foreign keys stay within the owning database.
- Scope organization-owned data by `organization_id`. Prefer UUIDs for durable identifiers and retain the original IDs in replicas.
- Store absolute timestamps with `timestamptz`. Apply the organization's timezone when deriving calendar deadlines. Apply creation and update timestamps where the data model needs them.
- Store money in integer minor units, media sizes in bytes, and video duration in seconds. Persist snapshots when historical facts must survive later edits to the source.

## Column length and precision

Choose a bound tied to a business rule, external format, an agreed UI limit or a technical constraint. Keep the API validation and database definition aligned. Use `text` for content without an evidenced limit. See the [service references](README.md) for physical limits. Use exact numeric types for values such as scores or amounts.

## Organization scope

Cross-organization lookups require an explicit caller and authorization boundary. Keep these queries identifiable in the owning service. A composite foreign key can enforce identical organization scope in a parent and child table.

## Patterns

| Pattern | Use |
| --- | --- |
| Partial unique index | Enforce uniqueness among active, undeleted or current rows. |
| Deferred constraint | Check a related set at commit when a valid transaction reorders or deletes several records. |
| Transaction lock | Serialize a quota check or contention on a logical entity before applying the write. |
| One-way transition or source timestamp | Apply repeated or delayed updates without regressing a projection. |
| Multirange | Merge overlapping intervals without double counting. |
| Hash of a bearer credential | Store the digest used for matching. |
| Conditional `CHECK` | Include an explicit nullability predicate when a missing value must fail the check. |

## Events and outbox

Write the outbox row and the business change in one transaction. Relays claim pending rows, publish and record acknowledgments. Consumers handle redelivery using event IDs, idempotent writes or business uniqueness. Refer to [transactional outbox](../architecture/event-driven.md#transactional-outbox) and the [event contracts](../../contracts/events/README.md).

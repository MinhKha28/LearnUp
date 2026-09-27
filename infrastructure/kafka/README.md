# Apache Kafka Infrastructure (`infrastructure/kafka`)

## 1. Purpose & Architectural Role
Apache Kafka acts as the **asynchronous domain event bus** for the LearnUP B2B Multi-Tenant Platform. It enables decoupled, eventual consistency workflows (such as certificate generation, notification dispatch, and learning completion propagation) without coupling downstream subscribers into synchronous REST request cycles.

### Fundamental Architecture Rules:
1. **Separation of Concerns**:
   > **Kafka is NOT part of the synchronous REST request path.**
   > Client requests flow strictly: `React Client → API Gateway (:8080) → Microservices (REST/HTTP)`. Kafka is never placed between Gateway and upstream/downstream services.
2. **Current Scope (Phase P7)**:
   > **Phase P7 establishes the Kafka infrastructure foundation only.**
   > Business producers, consumers, and domain event handlers are incrementally introduced in business phases (P8+). No domain business logic, transactional outboxes, sagas, or event sourcing are implemented in P7.

---

## 2. Runtime & Configuration
* **Message Broker**: Apache Kafka 3.6+ / Confluent Platform (`cp-kafka:7.6.0`)
* **Consensus Mode**: **KRaft Mode** (Native Kafka Raft metadata quorum)
* **ZooKeeper Dependency**: **None** (ZooKeeper is completely eliminated)
* **Storage**: Persistent Docker volume (`kafka_data:/var/lib/kafka/data`)

### Connection Endpoints:

| Environment / Caller | Host / Address | Port | Security Protocol |
|---|---|---|---|
| **Host Machine (Local Dev)** | `localhost` | `9092` | `PLAINTEXT` |
| **Docker Containers (Internal Network)** | `kafka` | `29092` | `PLAINTEXT` |
| **Internal KRaft Controller** | `kafka` | `29093` | `PLAINTEXT` |

---

## 3. Topic Naming Convention
All domain topics on the platform adhere to a standardized, hierarchically structured naming pattern:

```text
learnup.<domain>.<event-name>
```

### Format Specification:
* **Prefix**: `learnup.` — Global namespace preventing collisions.
* **`<domain>`**: Lowercase business domain name (e.g., `learning`, `assessment`, `achievement`, `organization`, `email`).
* **`<event-name>`**: Kebab-case past-tense verb representing an immutable domain fact that has occurred.

### Architectural Principles for Future Business Topics:
* Multi-tenancy is strictly preserved via the canonical `organizationId` attribute inside all event payloads.
* Topics represent immutable domain facts in past tense.
* Speculative business topics are NOT pre-created in infrastructure phases; they are defined alongside business service implementations.

---

## 4. Transactional Outbox Requirement
For any service publishing domain events to Kafka resulting from a database mutation:
1. **Atomic Dual-Write Prevention**: Direct writes to Kafka during a database transaction are forbidden due to 2PC / dual-write failure risks.
2. **Transactional Outbox Pattern**: The business entity state change AND the outgoing domain event record MUST be saved within the same local database transaction into an `outbox` table.
3. **Asynchronous Publisher / Relay**: An asynchronous relay (or CDC worker) polls or streams unpublished outbox events and publishes them to Kafka.
4. **Idempotent Consumers**: All downstream Kafka consumers must tolerate duplicate message delivery and enforce idempotency using `eventId` or business deduplication keys.


## 5. Canonical Event Envelope
All messages transmitted across Kafka topics use the shared JSON schema defined in `contracts/events/event-envelope.schema.json` and mirrored in `@learnup/ts-common` / `java-common`:

```json
{
  "eventId": "c2b04f76-80db-4d7a-b108-b2de9db448b1",
  "eventType": "learnup.learning.course-completed",
  "version": "1.0",
  "occurredAt": "2026-09-14T12:00:00Z",
  "organizationId": "org-7a8b9c",
  "producer": "learning-service",
  "data": {
    "courseId": "crs-101",
    "learnerId": "usr-501",
    "completedAt": "2026-09-14T12:00:00Z"
  }
}
```

* Multi-tenancy is strictly preserved via the canonical `organizationId` attribute inside the envelope.

---

## 6. Local Operational & Development Commands

### 5.1 Starting and Inspecting Kafka
```bash
# Start Kafka in the background via Docker Compose
docker compose up -d kafka

# Check container health and status
docker compose ps kafka

# View Kafka startup logs
docker compose logs -f kafka
```

### 5.2 Topic Management Commands (Inside Container)
```bash
# List all active topics
docker exec -it learnup-kafka kafka-topics --bootstrap-server kafka:29092 --list

# Create a topic manually
docker exec -it learnup-kafka kafka-topics --bootstrap-server kafka:29092 \
  --create --topic learnup.infrastructure.test --partitions 1 --replication-factor 1

# Describe topic details (partitions, leaders, ISR)
docker exec -it learnup-kafka kafka-topics --bootstrap-server kafka:29092 \
  --describe --topic learnup.infrastructure.test

# Delete a topic
docker exec -it learnup-kafka kafka-topics --bootstrap-server kafka:29092 \
  --delete --topic learnup.infrastructure.test
```

### 5.3 Producing & Consuming Test Messages
```bash
# Produce a test message to a topic from console
docker exec -it learnup-kafka kafka-console-producer \
  --bootstrap-server kafka:29092 \
  --topic learnup.infrastructure.test

# Consume messages from the beginning of a topic
docker exec -it learnup-kafka kafka-console-consumer \
  --bootstrap-server kafka:29092 \
  --topic learnup.infrastructure.test \
  --from-beginning
```

### 5.4 Host Machine Access (Outside Docker)
If using Kafka CLI tools on the host machine:
```bash
# Connect using localhost:9092
kafka-topics.sh --bootstrap-server localhost:9092 --list
```

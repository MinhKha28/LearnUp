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
* **`<domain>`**: Lowercase business domain name (e.g., `learning`, `assessment`, `certificate`, `organization`, `notification`).
* **`<event-name>`**: Kebab-case past-tense verb representing an immutable domain fact that has occurred.

### Standard Topic Catalog (Planned for Business Phases):

| Domain | Topic Name | Description |
|---|---|---|
| **Organization** | `learnup.organization.member-invited` | Emitted when a new learner/instructor is invited |
| **Learning** | `learnup.learning.course-completed` | Emitted when a learner completes all lessons in a course |
| **Learning** | `learnup.learning.assignment-created` | Emitted when a mandatory course is assigned to a learner cohort |
| **Assessment** | `learnup.assessment.submission-created` | Emitted when a quiz/peer assessment is submitted |
| **Assessment** | `learnup.assessment.passed` | Emitted when an assessment satisfies the passing threshold |
| **Assessment** | `learnup.assessment.peer-review-assigned` | Emitted when peer evaluators are selected |
| **Certificate** | `learnup.certificate.issued` | Emitted when a verified certificate is generated |
| **Notification** | `learnup.notification.event-dispatched` | Internal event notification feed |

---

## 4. Canonical Event Envelope
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

## 5. Local Operational & Development Commands

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

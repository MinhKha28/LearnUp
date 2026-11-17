# Apache Kafka infrastructure

The Compose broker carries asynchronous domain events. See the [configured streams and contracts](../../contracts/events/README.md).

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

Business transactions persist outbox rows. Relays publish those rows and record broker acknowledgments separately. See [transactional outbox](../../docs/architecture/event-driven.md#transactional-outbox).

## Local operational commands

### Starting and Inspecting Kafka
```bash
# Start Kafka in the background via Docker Compose
docker compose up -d kafka

# Check container health and status
docker compose ps kafka

# View Kafka startup logs
docker compose logs -f kafka
```

### Topic Management Commands (Inside Container)
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

### Producing & Consuming Test Messages
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

### Host Machine Access (Outside Docker)
If using Kafka CLI tools on the host machine:
```bash
# Connect using localhost:9092
kafka-topics.sh --bootstrap-server localhost:9092 --list
```

# LearnUP Eureka Discovery Server

Dynamic service registry and heartbeat discovery engine for the LearnUP microservices platform.

---

## 1. Overview

The **Eureka Server** provides centralized service discovery, instance heartbeat tracking, and dynamic routing resolution for the LearnUP platform:
- Microservices automatically register their network location (IP/hostname and port) upon startup.
- **Spring Cloud Gateway** discovers active backend instances dynamically from Eureka, providing load balancing without hardcoded hostnames.
- Unhealthy or crashed instances are automatically evicted from the registry.

---

## 2. Environment Profiles & Configuration

| Configuration Item | Local Development (`dev`) | Production (`prod`) |
| :--- | :--- | :--- |
| **Port** | `8761` | `8761` |
| **Self-Preservation** | `false` (Instant eviction of stopped local containers) | `true` (Protects registry during transient network partitions) |
| **Eviction Interval** | `5000 ms` | `60000 ms` |
| **Response Cache Refresh** | `3000 ms` | `30000 ms` |
| **Peer Replication** | Standalone single node | Multi-node peer replication enabled |
| **Logging** | Human-readable console log | Structured JSON logging |

---

## 3. How Future Spring Boot Services Register with Eureka

To register a new Spring Boot microservice with Eureka:

### 3.1 Step 1: Add Maven Dependency

Add the Eureka Client starter to the service's `pom.xml`:

```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-netflix-eureka-client</artifactId>
</dependency>
```

### 3.2 Step 2: Enable Discovery Client on Main Application

```java
package com.learnup.course;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

@SpringBootApplication
@EnableDiscoveryClient
public class CourseServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(CourseServiceApplication.class, args);
    }
}
```

### 3.3 Step 3: Configure `application.yml`

```yaml
spring:
  application:
    name: course-service # Service ID registered with Eureka

eureka:
  client:
    service-url:
      defaultZone: ${EUREKA_CLIENT_SERVICE_URL_DEFAULTZONE:http://localhost:8761/eureka/}
    register-with-eureka: true
    fetch-registry: true
  instance:
    prefer-ip-address: true
    lease-renewal-interval-in-seconds: 10
    lease-expiration-duration-in-seconds: 30
    instance-id: ${spring.application.name}:${random.uuid}
```

---

## 4. How NestJS / Non-JVM Services Interact

NestJS microservices connect directly to the infrastructure and are routed via Spring Cloud Gateway:
1. **Via Gateway Routing**: The Spring Cloud Gateway handles all external routing to NestJS services based on path mappings (`Path=/api/v1/realtime/**`).
2. **Via Eureka REST API / Sidecar**: If direct inter-service discovery is needed, NestJS services can register using the Eureka HTTP REST API (`POST /eureka/apps/{appID}`) or run behind a lightweight sidecar.

---

## 5. Health & Observability Endpoints

| Endpoint | Method | Purpose |
| :--- | :--- | :--- |
| `/` | `GET` | Eureka Web Dashboard (Active instances, lease statuses). |
| `/actuator/health` | `GET` | Container liveness and readiness probe status (`UP`). |
| `/actuator/info` | `GET` | Application metadata and build version. |
| `/eureka/apps` | `GET` | REST API returning raw XML/JSON of registered services. |

---

## 6. Running the Discovery Server

### 6.1 Using Maven (Local Dev)

```bash
# Run locally with active dev profile
mvn spring-boot:run -pl platform/eureka-server -Dspring-boot.run.profiles=dev
```

### 6.2 Using Docker

```bash
# Start Eureka within the LearnUP Docker platform stack
docker compose -f infrastructure/docker/docker-compose.platform.yml up -d eureka-server
```

Dashboard URL: `http://localhost:8761`

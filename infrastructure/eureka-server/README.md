# Netflix Eureka Discovery Server (`infrastructure/eureka-server`)

Service discovery registry server for the LearnUP microservice platform.

---

## 1. Purpose & Architectural Role

Netflix Eureka Server acts as a **dynamic service registry and instance health tracker**.

### Key Responsibilities:
* Maintains live registration records and network locations of active microservice instances.
* Receives periodic heartbeats from registered services.
* Allows downstream callers (and the API Gateway) to resolve service names to network addresses.

### What Eureka Server is NOT:
* **Eureka is NOT a request proxy or gateway hop**: Eureka is queried only for service registry lookups. Client and inter-service HTTP requests flow directly to the target service instance (or via the API Gateway), **never** through Eureka.
* **No business data**: Eureka contains zero domain entities, database connections, or business logic.
* **No authentication**: Eureka does not authenticate users or validate JWT tokens.

```text
Correct Architecture:
Client ──► API Gateway ──► Business Services (Direct REST)
                 │                   ▲
                 ▼                   │ (Registers)
         Eureka Server (Lookup only) ┘
```

---

## 2. Server Configuration

* **Default Port**: `8761`
* **Dashboard URL**: `http://localhost:8761`
* **Service Registration Endpoint**: `http://localhost:8761/eureka/`
* **Application Name**: `eureka-server`

### Standalone Local Development Configuration
In local development, the Eureka server runs in standalone mode (it does not attempt to register with itself or replicate with peer nodes):

```yaml
server:
  port: 8761

spring:
  application:
    name: eureka-server

eureka:
  instance:
    hostname: localhost
  client:
    register-with-eureka: false
    fetch-registry: false
    service-url:
      defaultZone: http://localhost:8761/eureka/
  server:
    enable-self-preservation: false
    eviction-interval-timer-in-ms: 5000
```

---

## 3. How Downstream Services Register

Future Spring Boot business services and the API Gateway will register with Eureka by adding `spring-cloud-starter-netflix-eureka-client` and configuring:

```yaml
spring:
  application:
    name: organization-service

eureka:
  client:
    service-url:
      defaultZone: ${EUREKA_CLIENT_SERVICEURL_DEFAULTZONE:http://localhost:8761/eureka/}
    register-with-eureka: true
    fetch-registry: true
```

---

## 4. Build & Run Instructions

### Prerequisites
* Java 21
* Maven 3.9+

### Build Application
```bash
# Run tests
mvn clean test

# Build executable JAR
mvn clean package
```

### Run Locally
```bash
# Using Spring Boot plugin
mvn spring-boot:run

# Or using the built JAR
java -jar target/eureka-server-1.0.0-SNAPSHOT.jar
```

### Access Dashboard
Open your browser and navigate to:
```text
http://localhost:8761
```
The Eureka dashboard will display the system status and any currently registered application instances.

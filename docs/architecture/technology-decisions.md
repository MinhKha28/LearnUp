# Technology Decision Principles & Matrix

## 1. Backend Technology Direction

LearnUP adopts a **disciplined polyglot backend strategy**:

- **Spring Boot (Java 21 / Spring Boot 3.x)** is established as the **primary and preferred backend technology**.
- **NestJS (TypeScript / Node.js 20+)** is established as a **fully supported secondary technology**.
- **Technology decisions for future business services are deliberately NOT finalized in P0**. Each future service will be evaluated against the decision matrix when its implementation phase commences.

---

## 2. Technology Decision Matrix

The following criteria guide the selection between Spring Boot and NestJS for future business services:

| Architectural Characteristic | Spring Boot (Java) | NestJS (TypeScript) |
| :--- | :--- | :--- |
| **Primary Domain Suitability** | High-transactional domains, complex business rules, strict ACID requirements, batch computation, enterprise integrations. | I/O-intensive aggregations, real-time WebSocket communication, Backend-For-Frontend (BFF), rapid-prototyping. |
| **Examples in LearnUP** | Identity, Payment, Subscription, Course catalog, Assessment grading. | Real-time Collaboration, In-app Notification push, Lightweight proxy/aggregation services. |
| **Type Safety & Ecosystem** | Compile-time static typing, mature Spring ecosystem (Security, Data JPA, Batch, Cloud Stream). | TypeScript end-to-end alignment with frontend types, rich Node.js async I/O ecosystem. |
| **Database Access Pattern** | Hibernate / Spring Data JPA / QueryDSL / JDBC Template for complex relational mapping. | Prisma / TypeORM / Kysely for structured TypeScript query ergonomics. |
| **Messaging Integration** | Spring Kafka / Spring Cloud Stream with structured concurrency. | NestJS Microservices Kafka Transporter / `kafkajs`. |
| **Performance Profile** | High multi-core CPU throughput, robust garbage collection tuning (G1/ZGC). | Low memory footprint per instance, event-loop asynchronous non-blocking I/O. |

---

## 3. Polyglot Interoperability Mandates

To ensure that polyglot development does not cause architectural fragmentation, all services—regardless of whether they are implemented in Spring Boot or NestJS—MUST adhere to the following shared platform invariants:

1. **Uniform HTTP Ingress Headers**:
   - Every service MUST extract caller context from standard headers injected by the Gateway:
     - `X-User-ID`
     - `X-Organization-ID`
     - `X-Correlation-ID`
2. **Unified REST API Envelope**:
   - Every JSON response MUST be wrapped in the standard `ApiResponse<T>` envelope.
   - Every error response MUST conform to the standard `ApiError` format.
3. **Strict CloudEvent Kafka Payloads**:
   - Every domain event published to Kafka MUST be serialized inside the standard JSON event envelope containing `id`, `source`, `type`, `organizationId`, `correlationId`, `time`, and `data`.
4. **Standard Health Check Endpoints**:
   - Spring Boot services MUST expose `/actuator/health`.
   - NestJS services MUST expose `/healthz`.
5. **No Direct Inter-Service Database Sharing**:
   - A Spring Boot service and a NestJS service must NEVER access each other's database tables or schemas.

# API Gateway (`gateway/api-gateway`)

## Technology Stack
* Spring Boot 3.x
* Spring Cloud Gateway
* Java 21

## Port
* External Entry Port: `8080`

## Responsibilities
* Single external entry point for the frontend client.
* Route request mapping using Eureka dynamic service discovery (`lb://<SERVICE-NAME>`).
* Inbound header sanitization (strips client-spoofed `X-User-ID`, `X-Organization-ID`, `X-User-Role`, `X-Correlation-ID`).
* JWT signature validation and claim extraction (`sub`, `role`, `organizationId`).
* Trusted header injection into downstream requests.
* Global CORS handling and correlation ID tracing.
* Global error handling for unauthenticated or malformed requests.

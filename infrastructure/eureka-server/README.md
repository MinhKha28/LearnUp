# Eureka Discovery Server (`infrastructure/eureka-server`)

## Technology Stack
* Spring Boot 3.x
* Spring Cloud Netflix Eureka Server
* Java 21

## Port & Endpoints
* Default Port: `8761`
* Dashboard: `http://localhost:8761`
* Registration Endpoint: `http://localhost:8761/eureka/`

## Responsibilities
* Dynamic service registry for microservices.
* Heartbeat monitoring and availability status tracking.
* No business logic, no business database, no user authentication.

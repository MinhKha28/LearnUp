# Multi-stage Dockerfile for API Gateway (Root build context)
FROM maven:3.9-eclipse-temurin-21-alpine AS build
WORKDIR /app

# 1. Build and install shared java-common library
COPY libraries/java-common ./libraries/java-common
RUN mvn -f ./libraries/java-common/pom.xml clean install -DskipTests -B

# 2. Build API Gateway service
COPY gateway/api-gateway ./gateway/api-gateway
RUN mvn -f ./gateway/api-gateway/pom.xml clean package -DskipTests -B

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/gateway/api-gateway/target/api-gateway-*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]

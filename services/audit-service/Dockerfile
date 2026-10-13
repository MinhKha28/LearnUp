# Multi-stage Dockerfile for Audit Service (Root build context)
FROM maven:3.9-eclipse-temurin-21-alpine AS build
WORKDIR /app

# 1. Build and install shared java-common library
COPY libraries/java-common ./libraries/java-common
RUN mvn -f ./libraries/java-common/pom.xml clean install -DskipTests -B

# 2. Build Audit Service
COPY services/audit-service ./services/audit-service
RUN mvn -f ./services/audit-service/pom.xml clean package -DskipTests -B

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/services/audit-service/target/audit-service-*.jar app.jar
EXPOSE 8083
ENTRYPOINT ["java", "-jar", "app.jar"]

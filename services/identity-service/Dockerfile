# Multi-stage Dockerfile for Identity Service (Root build context)
FROM maven:3.9-eclipse-temurin-21-alpine AS build
WORKDIR /app

# 1. Build and install shared java-common library
COPY libraries/java-common ./libraries/java-common
RUN mvn -f ./libraries/java-common/pom.xml clean install -DskipTests -B

# 2. Build Identity Service
COPY services/identity-service ./services/identity-service
RUN mvn -f ./services/identity-service/pom.xml clean package -DskipTests -B

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/services/identity-service/target/identity-service-*.jar app.jar
EXPOSE 8081
ENTRYPOINT ["java", "-jar", "app.jar"]

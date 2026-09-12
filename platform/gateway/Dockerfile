FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY platform/gateway/target/*.jar app.jar
EXPOSE 8000
ENTRYPOINT ["java", "-jar", "app.jar"]

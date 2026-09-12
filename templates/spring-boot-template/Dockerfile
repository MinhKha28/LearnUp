FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY templates/spring-boot-template/target/*.jar app.jar
EXPOSE 8082
ENTRYPOINT ["java", "-jar", "app.jar"]

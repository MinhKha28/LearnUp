FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY platform/eureka-server/target/*.jar app.jar
EXPOSE 8761
ENTRYPOINT ["java", "-jar", "app.jar"]

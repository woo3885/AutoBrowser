FROM mcr.microsoft.com/playwright/java:v1.61.0-noble AS build

WORKDIR /workspace

COPY gradlew .
COPY gradle ./gradle
COPY build.gradle settings.gradle ./

RUN chmod +x gradlew

COPY src ./src

RUN ./gradlew clean bootJar --no-daemon

FROM mcr.microsoft.com/playwright/java:v1.61.0-noble

WORKDIR /app

COPY --from=build /workspace/build/libs/backend-0.0.1-SNAPSHOT.jar ./backend.jar

ENV PORT=8080
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

EXPOSE 8080

CMD ["sh", "-c", "exec java -Dserver.port=${PORT:-8080} -jar /app/backend.jar"]

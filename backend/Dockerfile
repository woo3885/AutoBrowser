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
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

RUN ldconfig -p | grep -q "libglib-2.0.so.0" \
    && find /ms-playwright -type f -name chrome-headless-shell -perm /111 \
        -print -quit | grep -q .

EXPOSE 8080

CMD ["sh", "-c", "export PLAYWRIGHT_BROWSERS_PATH=/ms-playwright; exec java -Dserver.port=${PORT:-8080} -jar /app/backend.jar"]

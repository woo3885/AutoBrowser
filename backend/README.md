# Backend Orchestrator

Java 21/Spring Boot 기반의 AutoBrowser 조정 서버입니다. Chrome Extension의 세션을 관리하고, 정제 DOM과 사용자 요청을 AI Engine에 전달하며, 반환된 결정을 계약 및 안전 정책으로 검증합니다.

현재 확장 프로그램 경로에서는 서버가 Playwright 브라우저를 만들거나 직접 조작하지 않습니다. 현재 탭의 DOM 수집과 실행은 확장 프로그램이 담당합니다. 저장소에 남아 있는 Playwright/Viewer API는 과거 원격 브라우저 방식과 테스트를 위한 레거시 경로입니다.

## 실행

Java 21이 필요합니다.

```powershell
cd C:\Project\backend
.\gradlew.bat bootRun
```

```powershell
# 테스트
.\gradlew.bat test

# 배포용 jar
.\gradlew.bat clean bootJar
```

상태 확인:

```text
GET http://127.0.0.1:8080/actuator/health
GET http://127.0.0.1:8080/api/v1/hello
```

## Chrome Extension API

Base path: `/api/v1/extension/sessions`

| Method | Path | 설명 |
|---|---|---|
| `POST` | `/api/v1/extension/sessions` | 현재 메시지와 DOM으로 탭별 AI 세션 생성 |
| `POST` | `/{sessionId}/messages` | 기존 세션에 사용자 메시지 전달 |
| `POST` | `/{sessionId}/continue` | 실행/직접 조작 뒤 새 DOM으로 판단 계속 |

확장 세션은 현재 프로세스 메모리에 저장되며 마지막 접근 후 30분이 지나거나 Backend가 재시작되면 사라집니다.

## 필수 연동 변수

```env
DDD_AI_ENGINE_ENABLED=true
AI_ENGINE_ENDPOINT=http://127.0.0.1:3001/api/ai/action
AI_ENGINE_CONVERSATION_ENDPOINT=http://127.0.0.1:3001/api/ai/conversation/decision
AI_ENGINE_CONNECT_TIMEOUT=3s
AI_ENGINE_REQUEST_TIMEOUT=40s
```

Railway에서는 `AI_ENGINE_*_ENDPOINT`에 AI Engine의 private networking 주소를 권장합니다. 변수 전체 목록과 기본값은 [`application.yaml`](src/main/resources/application.yaml), 배포 예시는 [배포 가이드](../docs/DEPLOYMENT.md)를 참고하세요.

## CORS와 보안

- `/api/v1/extension/**`는 자격 증명 없이 `chrome-extension://*` origin의 `POST`, `OPTIONS`만 허용합니다.
- 일반 `/api/**` origin은 `DDD_REST_CORS_ALLOWED_ORIGINS`로 관리합니다.
- Backend는 AI의 `elementId`, 스냅샷 ID, 상태 전이 및 보호 경계를 검증합니다.
- 비밀번호·OTP 등 민감 입력값은 요청 계약에 포함하지 않습니다.

## Docker/Railway

[`Dockerfile`](Dockerfile)은 Java 21 빌드 이미지와 Playwright Java 런타임 이미지를 사용합니다. 이 이미지에는 레거시 Playwright 경로에 필요한 Chromium 및 Linux 공유 라이브러리가 포함됩니다. Railway 서비스 Root Directory를 `/backend`로 설정하고 Dockerfile 빌더를 사용하세요.

API 계약은 [Backend API 명세](../docs/backend/api-spec.md)를 참고하세요.

# Railway 배포 가이드

기준일: 2026-09-14

표준 배포는 `ai-engine`과 `backend` 두 서비스로 구성합니다. Chrome Extension은 Railway에 배포하지 않고 사용자의 Chrome에 설치합니다. Demo Bank와 루트 Frontend도 필수가 아닙니다.

## 1. AI Engine 서비스

- GitHub 저장소: 이 저장소
- Root Directory: `/ai-engine`
- Build Command: `npm ci`
- Start Command: `npm start`
- Healthcheck Path: `/health`

Variables:

```env
GEMINI_API_KEY=<Railway secret>
GEMINI_MODEL=gemini-3.5-flash
AI_ENGINE_MODEL_TIMEOUT_MS=30000
```

`PORT`는 Railway가 주입하며 코드가 우선 사용합니다. `AI_ENGINE_PORT`는 로컬에서 포트를 바꿀 때만 선택적으로 사용합니다.

AI Engine endpoint:

```text
GET  /health
POST /api/ai/action
POST /api/ai/conversation/decision
```

## 2. Backend 서비스

- Root Directory: `/backend`
- Builder: Dockerfile
- Dockerfile Path: `/backend/Dockerfile` 또는 Root Directory 기준 `Dockerfile`
- Healthcheck Path: `/actuator/health`

필수/권장 Variables:

```env
DDD_AI_ENGINE_ENABLED=true
AI_ENGINE_ENDPOINT=http://${{ai-engine.RAILWAY_PRIVATE_DOMAIN}}:${{ai-engine.PORT}}/api/ai/action
AI_ENGINE_CONVERSATION_ENDPOINT=http://${{ai-engine.RAILWAY_PRIVATE_DOMAIN}}:${{ai-engine.PORT}}/api/ai/conversation/decision
AI_ENGINE_CONNECT_TIMEOUT=3s
AI_ENGINE_REQUEST_TIMEOUT=40s
DDD_SESSION_STORE_TYPE=memory
DDD_SESSION_TTL=30m
```

`ai-engine`은 Railway 서비스 이름 예시입니다. 실제 서비스 이름이 다르면 두 reference variable의 서비스 이름도 바꾸세요. Railway는 배포 시 private domain과 실제 listen port를 참조 값으로 해석합니다. 내부 통신은 `http`, 확장 프로그램이 접근하는 Backend 공개 주소는 `https`를 사용합니다. private networking이 맞지 않으면 AI Engine 공개 HTTPS 도메인을 사용할 수 있습니다.

확장 프로그램만 사용할 때 다음 레거시 변수는 기본값 `false`로 둡니다.

```env
DDD_DEMO_BANK_ENABLED=false
DDD_BROWSER_SITE_ENABLED=false
DDD_DEMO_AGENT_BRIDGE_ENABLED=false
DDD_SECURE_TAKEOVER_DEMO_HEADED_ENABLED=false
```

Backend에는 공개 도메인을 생성해야 합니다. 사용자는 이 주소를 확장 패널 설정에 입력합니다.

## 3. 연결 확인

1. AI Engine의 `/health`가 `200`인지 확인합니다.
2. Backend의 `/actuator/health`와 `/api/v1/hello`가 `200`인지 확인합니다.
3. Backend 로그에서 AI Engine `502`가 없는지 확인합니다.
4. 일반 웹사이트에서 확장 패널을 열고 Backend 공개 Base URL을 저장합니다.
5. `현재 페이지 설명`처럼 읽기 전용 요청으로 전체 경로를 확인합니다.

## 4. 변경 후 재배포

- GitHub 연결 서비스는 `main`에 push하면 자동 배포되도록 설정할 수 있습니다.
- Railway Dashboard에서는 서비스의 Deployments에서 최신 배포를 Redeploy할 수 있습니다.
- Backend Dockerfile이나 AI Engine package 파일이 바뀌면 캐시 없이 재빌드가 필요한지 빌드 로그를 확인합니다.
- 확장 프로그램 변경은 Railway 재배포 대상이 아닙니다. 로컬에서 `npm run build` 후 `chrome://extensions`와 대상 탭을 새로고침합니다.

## 5. 선택 기능 변수

다음은 레거시 Viewer/Demo용이며 확장 프로그램 표준 경로에서는 설정하지 않습니다.

| 변수 | 용도 |
|---|---|
| `DEMO_BANK_BASE_URL` | Playwright Demo Bank 주소 |
| `DDD_DEMO_BANK_ALLOWED_HOSTS` | Demo Bank host allowlist |
| `DDD_BROWSER_SITE_BASE_URL` | 원격 Playwright 범용 사이트 한 개 |
| `DDD_BROWSER_SITE_ALLOWED_HOSTS` | 원격 사이트 host allowlist |
| `DDD_FRAME_WS_ALLOWED_ORIGINS` | 레거시 Viewer WebSocket origin |
| `DDD_DEMO_AGENT_BRIDGE_ALLOWED_ORIGINS` | Demo Bridge origin |
| `REDIS_HOST`, `REDIS_PORT` | `DDD_SESSION_STORE_TYPE=redis`일 때 저장소 |

전체 기본값은 [`backend/src/main/resources/application.yaml`](../backend/src/main/resources/application.yaml)을 기준으로 합니다.

Railway 설정 자체는 [Monorepo Root Directory](https://docs.railway.com/deployments/monorepo), [Dockerfile 감지](https://docs.railway.com/builds/dockerfiles), [Private Networking과 reference variable](https://docs.railway.com/networking/private-networking) 공식 문서를 함께 참고하세요.

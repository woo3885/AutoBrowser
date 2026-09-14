# AutoBrowser

AutoBrowser는 사용자가 보고 있는 Chrome 웹페이지를 이해하고, 자연어 요청에 따라 안전한 범위의 작업을 돕는 범용 웹 에이전트입니다. 별도의 원격 Viewer를 띄우지 않고 현재 탭에 React 플로팅 패널을 주입합니다.

> 현재 기준: Chrome Extension `0.2.2`, Java 21 Backend, Node.js/TypeScript AI Engine

## 현재 구성

```text
사용자
  └─ Chrome Extension (현재 탭의 플로팅 패널)
       ├─ Content Script: 정제 DOM 생성, 대상 강조, 로컬 동작 실행
       └─ Service Worker: Backend HTTPS 요청
            └─ Backend: 세션·계약·안전 정책 검증
                 └─ AI Engine: Gemini 기반 다음 행동 판단
```

- **주 사용자 인터페이스:** `chrome-extension`
- **필수 서버:** `backend`, `ai-engine`
- **선택/레거시:** 루트 React Viewer, `demo/demo-bank`, `security-session`
- **범용성:** 특정 흐름을 미리 재생하지 않고 매 요청마다 현재 페이지의 정제된 DOM을 분석합니다.

## 빠른 시작

### 1. AI Engine

```powershell
cd C:\Project\ai-engine
npm install
$env:GEMINI_API_KEY = "your-key"
npm start
```

기본 포트는 `3001`입니다.

### 2. Backend

Java 21이 필요합니다.

```powershell
cd C:\Project\backend
.\gradlew.bat bootRun
```

기본 포트는 `8080`이며, 로컬 AI Engine의 대화 API를 자동으로 사용합니다.

### 3. Chrome Extension

```powershell
cd C:\Project\chrome-extension
npm install
npm run test
npm run build
```

1. Chrome에서 `chrome://extensions`를 엽니다.
2. **개발자 모드**를 켭니다.
3. **압축해제된 확장 프로그램을 로드합니다**에서 `chrome-extension` 폴더를 선택합니다.
4. 일반 HTTP/HTTPS 사이트를 연 뒤 AutoBrowser 아이콘을 누릅니다.
5. 패널의 설정에서 Backend 주소를 저장합니다. 로컬은 `http://127.0.0.1:8080`, Railway는 공개 HTTPS 주소를 사용합니다.
6. 사이트 접근 및 마이크 권한 요청이 나타나면 필요한 범위에서 허용합니다.

`chrome://` 페이지, Chrome Web Store 등 Chrome 보호 페이지에는 패널을 주입할 수 없습니다.

## Railway 배포

표준 운영 구성은 두 서비스입니다.

| 서비스 | Root Directory | 실행 방식 | 공개 도메인 |
|---|---|---|---|
| `ai-engine` | `/ai-engine` | `npm start` | Backend가 private networking을 쓰면 선택 |
| `backend` | `/backend` | `backend/Dockerfile` | 확장 프로그램 연결을 위해 필수 |

Backend 핵심 변수:

```env
DDD_AI_ENGINE_ENABLED=true
AI_ENGINE_ENDPOINT=http://${{ai-engine.RAILWAY_PRIVATE_DOMAIN}}:${{ai-engine.PORT}}/api/ai/action
AI_ENGINE_CONVERSATION_ENDPOINT=http://${{ai-engine.RAILWAY_PRIVATE_DOMAIN}}:${{ai-engine.PORT}}/api/ai/conversation/decision
AI_ENGINE_CONNECT_TIMEOUT=3s
AI_ENGINE_REQUEST_TIMEOUT=40s
```

AI Engine 핵심 변수:

```env
GEMINI_API_KEY=your-secret
GEMINI_MODEL=gemini-3.5-flash
AI_ENGINE_MODEL_TIMEOUT_MS=30000
```

Railway가 주입하는 `PORT`는 두 서비스 모두 코드에서 처리합니다. Demo Bank와 루트 Frontend는 확장 프로그램 방식에 필요하지 않으므로 배포하지 않아도 됩니다. 전체 절차는 [배포 가이드](docs/DEPLOYMENT.md)를 참고하세요.

## 동작과 안전 경계

AI Engine은 최신 정제 DOM과 사용자 목표를 바탕으로 한 번에 하나의 결정을 반환합니다.

- `AUTO_EXECUTE`: 일반 버튼 클릭이나 비민감 텍스트 입력
- `GUIDE_USER`: 사용자가 직접 조작할 요소를 페이지에서 강조
- `ASK_USER`, `INFORM_USER`: 추가 질문 또는 페이지 설명
- `SECURE_INPUT_REQUIRED`: 비밀번호·OTP 등 직접 입력
- `FINAL_CONFIRMATION_REQUIRED`: 결제·송금·가입 등 최종 승인
- `RISK_WARNING`, `STOP`: 위험하거나 허용되지 않은 요청 중단

확장 프로그램은 비밀번호, OTP, 카드번호 같은 민감 입력과 최종 실행 요소를 로컬에서도 차단합니다. 입력값, 쿠키, 세션 토큰, Authorization Header 또는 전체 화면 이미지를 Gemini에 보내지 않습니다.

## 프로젝트 구조

| 경로 | 상태 | 역할 |
|---|---|---|
| `chrome-extension` | 현재 운영 경로 | Chrome 플로팅 패널, DOM 정제, 로컬 작업 실행 |
| `backend` | 현재 운영 경로 | 확장 세션, AI 계약 검증, 안전 정책, 레거시 Playwright API |
| `ai-engine` | 현재 운영 경로 | Gemini 호출, 구조화 판단, 모델 응답 검증 |
| `contracts` | 공유 | 공통 타입과 스키마 |
| `docs` | 공유 | 현재 운영 문서 및 과거 개발 기록 |
| `src` | 레거시/참고 | 원격 Viewer 방식의 루트 React Frontend |
| `demo/demo-bank` | 선택/레거시 | 과거 E2E용 Mock 금융 사이트 |
| `security-session` | 레거시 | 초기 보안 모듈 설계 자리표시자 |

## 테스트

```powershell
# Chrome Extension
cd chrome-extension
npm test
npm run build

# AI Engine
cd ..\ai-engine
npm test
npm run check
npm run build

# Backend
cd ..\backend
.\gradlew.bat test
```

루트 Viewer와 Demo Bank를 수정할 때만 각 디렉터리의 별도 테스트를 실행합니다.

## 문서

- [문서 색인과 최신/레거시 구분](docs/README.md)
- [현재 아키텍처](docs/CURRENT_ARCHITECTURE.md)
- [Railway 배포](docs/DEPLOYMENT.md)
- [통합 체크리스트](docs/INTEGRATION_CHECKLIST.md)
- [문제 해결](docs/TROUBLESHOOTING.md)
- [Chrome Extension](chrome-extension/README.md)
- [Backend API](docs/backend/api-spec.md)
- [AI Engine 연동](docs/ai-engine-integration-guide.md)

과거 `frontend-d*`, `demo-bank-d*`, Day 문서는 구현 이력을 보존한 참고 자료이며 현재 배포 절차의 기준이 아닙니다.

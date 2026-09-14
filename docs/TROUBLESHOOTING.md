# 문제 해결 가이드

기준일: 2026-09-14

## 패널이 열리지 않음

- `chrome://`, Chrome Web Store, 새 탭 등 보호 페이지가 아닌 일반 HTTP/HTTPS 페이지에서 실행합니다.
- `chrome://extensions`에서 확장 프로그램 오류를 확인합니다.
- `npm run build` 후 확장 프로그램과 대상 탭을 모두 새로고침합니다.
- 첫 실행의 사이트 접근 권한을 허용합니다.

## `process is not defined`

오래된 React 번들이거나 Node 전역이 브라우저 번들에 남은 경우입니다.

```powershell
cd chrome-extension
npm run build
```

현재 빌드는 `verify:bundle`에서 `process.env`와 CommonJS `require()` 잔존을 검사합니다. 빌드 후 확장과 탭을 새로고침하세요.

## `Failed to construct 'URL': Invalid URL`

설정에는 API 경로가 아닌 Backend Base URL을 입력합니다.

```text
http://127.0.0.1:8080
https://backend-production.up.railway.app
```

공백, 따옴표, Railway 변수 참조 문법 또는 `/api/...`만 입력하지 마세요.

## Backend `403`

- 패널 설정에서 Backend 주소를 다시 저장해 해당 origin 권한을 허용합니다.
- Backend 최신 코드가 `/api/v1/extension/**`에 `chrome-extension://*` origin을 허용하는지 확인합니다.
- Railway 공개 URL이 HTTPS인지 확인합니다.
- 응답이 Railway가 아닌 외부 WAF/프록시에서 발생했는지 Network 탭으로 확인합니다.

## Backend `502`, AI 응답 처리 실패

Backend 로그의 `Conversation AI processing failed`와 AI Engine 로그를 같은 요청 시각으로 확인합니다.

- AI Engine 로그 없음: endpoint/hostname/port가 틀렸거나 서비스가 실행 중이 아닙니다.
- `status=400`: Gemini 모델명, 요청 형식 또는 API 키의 프로젝트 설정을 확인합니다.
- `status=429`: Gemini quota/rate limit입니다. 사용량과 결제/할당량을 확인하고 재시도 간격을 둡니다.
- `type=TIMEOUT`: `AI_ENGINE_MODEL_TIMEOUT_MS`와 Backend `AI_ENGINE_REQUEST_TIMEOUT`을 확인합니다. Backend timeout이 모델 timeout보다 길어야 합니다.
- `type=CONTRACT`: 모델 JSON이 계약을 위반했습니다. AI Engine 코드와 prompt/schema 버전이 함께 배포됐는지 확인합니다.

AI Engine이 `npm ... SIGTERM` 후 내려가 있다면 Railway Start Command와 서비스 재시작/메모리 제한을 확인합니다.

## `Session not found`, `SESSION_404`, `SESSION_409`

- 확장 세션은 Backend 메모리에 30분 동안 유지됩니다.
- Backend 재배포/재시작 후 기존 탭의 세션 ID는 사라집니다.
- 패널을 닫았다 다시 열거나 새 메시지를 보내 새 세션을 생성합니다.
- 반복되면 `chrome.storage.session`의 탭별 세션과 Backend replica 수를 확인합니다. 여러 replica에서 인메모리 세션을 사용할 경우 요청이 다른 replica로 갈 수 있습니다.

## 메시지는 오지만 클릭/오버레이가 없음

- Backend 응답의 `mode`가 `AUTO_EXECUTE` 또는 `GUIDE_USER`인지 확인합니다. `INFORM_USER`는 메시지만 표시하는 정상 응답입니다.
- `action`, `targetElementId`, `sourceSnapshotId`가 존재하는지 확인합니다.
- 페이지가 응답 중 변경되면 스냅샷 ID가 만료되어 실행이 거부될 수 있습니다.
- iframe, Canvas 또는 닫힌 Shadow DOM 내부 요소는 현재 지원하지 않을 수 있습니다.
- 페이지 DevTools 콘솔에서 Content Script 오류를, 확장 프로그램 Service Worker DevTools에서 Backend 요청 오류를 확인합니다.

## Playwright 공유 라이브러리 오류

이 문제는 레거시 원격 브라우저 경로에서만 발생합니다. Backend Railway 서비스가 [`backend/Dockerfile`](../backend/Dockerfile)을 실제로 사용하고 있는지 확인하세요. Dockerfile의 Playwright Java 이미지에는 Chromium과 `libglib-2.0.so.0` 등 런타임 의존성이 포함됩니다. 확장 프로그램 표준 경로는 서버 Playwright를 사용하지 않습니다.

## 로그 위치

- Chrome 페이지/플로팅 패널: 대상 페이지 DevTools Console
- Service Worker: `chrome://extensions` → AutoBrowser → Service Worker 검사
- Backend: Railway Backend 서비스의 Deploy/HTTP 로그
- AI Engine: Railway AI Engine 서비스의 Deploy 로그

민감정보, API 키, 전체 쿠키 또는 Authorization Header는 로그로 공유하지 마세요.

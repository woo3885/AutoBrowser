# 범용 웹사이트 AI 에이전트

AI Engine의 Conversation 경로는 특정 예금·이체 시나리오를 선택하지 않는다.
매 단계에서 Backend가 만든 최신 sanitized DOM과 사용자의 원래 목표를 Gemini에
전달하고, Gemini가 한 번에 하나의 `CLICK`, `TYPE`, `GUIDE_USER`, `ASK_USER`,
`INFORM_USER`, `COMPLETE` 결정을 반환한다. Backend는 현재 elementId와 보안
정책을 다시 검증하고 행동을 실행한 뒤 새 DOM으로 이 과정을 반복한다.

`SECURE_INPUT`, `USER_DECISION`, `FINAL_CONFIRMATION`, `BLOCKED` 경계는 모델이
변경할 수 없다. 모델/계약 오류는 세션을 종료하지 않으며 사용자가 다시 요청할
수 있도록 현재 브라우저 상태를 유지한다.

## 외부 사이트 설정

Backend는 클라이언트가 임의의 절대 URL을 전달하도록 허용하지 않는다. 배포마다
운영자가 허용한 한 개의 origin을 설정하고, 클라이언트는 상대 경로만 전달한다.

```text
DDD_BROWSER_SITE_ENABLED=true
DDD_BROWSER_SITE_ID=browser-site
DDD_BROWSER_SITE_BASE_URL=https://docs.example.com
DDD_BROWSER_SITE_ALLOWED_HOSTS=docs.example.com
DDD_DEMO_AGENT_BRIDGE_ALLOWED_ORIGINS=https://docs.example.com
AI_ENGINE_MODEL_TIMEOUT_MS=12000
```

Backend에는 AI Engine의 private Railway URL을 사용한다.

```text
AI_ENGINE_CONVERSATION_ENDPOINT=http://ai-engine.railway.internal:<PORT>/api/ai/conversation/decision
```

Demo 채팅을 외부 사이트 세션의 컨트롤러로 사용할 때는 다음 Build Variable도
설정한다.

```text
VITE_AUTOMATION_SITE_ID=browser-site
VITE_AUTOMATION_INITIAL_PATH=/
```

세션 생성 API 예시:

```json
{
  "requestId": "request-unique-id",
  "messageId": "message-unique-id",
  "content": "현재 사이트에서 설치 가이드를 찾아줘",
  "siteId": "browser-site",
  "initialPath": "/",
  "clientOccurredAt": "2026-09-12T09:00:00Z"
}
```

외부 origin으로 리디렉션되는 로그인, CAPTCHA, 비밀번호·OTP 입력 및 최종 승인
동작은 자동 실행하지 않는다. 새로운 origin이 필요하면 allowlist와 base URL을
명시적으로 변경해 재배포한다.

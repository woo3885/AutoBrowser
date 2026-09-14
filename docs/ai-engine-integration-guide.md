# AI Engine 연동 가이드

기준일: 2026-09-14

이 문서는 현재 Chrome Extension 대화 경로의 기준입니다. 과거 `/api/ai/action`, Demo Bank fixture, 원격 Viewer 연동 세부사항은 코드와 개발 이력 문서를 참고하세요.

## 연결

Backend variables:

```env
DDD_AI_ENGINE_ENABLED=true
AI_ENGINE_ENDPOINT=http://127.0.0.1:3001/api/ai/action
AI_ENGINE_CONVERSATION_ENDPOINT=http://127.0.0.1:3001/api/ai/conversation/decision
AI_ENGINE_CONNECT_TIMEOUT=3s
AI_ENGINE_REQUEST_TIMEOUT=40s
```

AI Engine variables:

```env
GEMINI_API_KEY=your-secret
GEMINI_MODEL=gemini-3.5-flash
AI_ENGINE_MODEL_TIMEOUT_MS=30000
```

Backend request timeout은 모델 timeout보다 길게 둡니다. Railway에서는 Backend에서 AI Engine private hostname을 사용하고, 확장 프로그램은 Backend 공개 HTTPS Base URL만 사용합니다.

Railway 변수 예시는 다음처럼 service reference를 사용합니다. `ai-engine` 부분은 실제 Railway 서비스 이름으로 바꿉니다.

```env
AI_ENGINE_ENDPOINT=http://${{ai-engine.RAILWAY_PRIVATE_DOMAIN}}:${{ai-engine.PORT}}/api/ai/action
AI_ENGINE_CONVERSATION_ENDPOINT=http://${{ai-engine.RAILWAY_PRIVATE_DOMAIN}}:${{ai-engine.PORT}}/api/ai/conversation/decision
```

## 데이터 흐름

```text
ExtensionAgentRequest
  → Backend ExtensionAgentSessionService
  → ConversationAgentRequest
  → POST AI Engine /api/ai/conversation/decision
  → AgentDecision 계약 검증
  → Backend goal/action 재검증
  → ExtensionAgentResponse
  → Chrome의 로컬 실행 또는 사용자 안내
```

## Backend → AI Engine 요청

핵심 필드:

```json
{
  "sessionId": "session-id",
  "requestId": "ext-request-id",
  "requestMessageId": "ext-message-id",
  "conversationSequence": 1,
  "goal": {
    "goalId": "goal-id",
    "revision": 0,
    "status": "ACTIVE",
    "intent": "UNKNOWN",
    "normalizedRequest": "현재 페이지 설명"
  },
  "userMessage": {
    "content": "현재 페이지 설명",
    "answerToQuestionId": null
  },
  "snapshot": {
    "sourceSnapshotId": "snapshot-id",
    "pageIdentity": "tab-id:https://example.com/",
    "sanitizedDomSnapshot": {}
  }
}
```

실제 전체 schema는 `ai-engine/src/conversation/conversationAgent.types.ts`와 Backend의 `ConversationAgentRequest`가 기준입니다.

## AI Engine → Backend 응답

```json
{
  "requestId": "ext-request-id",
  "requestMessageId": "ext-message-id",
  "goalId": "goal-id",
  "baseGoalRevision": 0,
  "mode": "INFORM_USER",
  "message": "현재 페이지에서 검색과 메뉴 탐색을 할 수 있습니다.",
  "confidence": 0.9,
  "reasonCode": "PAGE_SUMMARY",
  "nextCondition": null,
  "sourceSnapshotId": "snapshot-id",
  "goalPatch": null,
  "question": null,
  "actionCandidate": null
}
```

Mode별 필드 규칙은 엄격합니다. 예를 들어 `ASK_USER`만 `question`을 가질 수 있고, 실행/안내 대상이 필요한 mode만 `actionCandidate`를 가질 수 있습니다. 계약을 위반하면 AI Engine 또는 Backend가 실행 전에 거부합니다.

## Action candidate

```json
{
  "actionType": "CLICK",
  "targetElementId": "el-snapshot-token-001",
  "role": "button",
  "accessibleLabel": "검색",
  "guide": "검색 버튼을 선택합니다.",
  "inputValue": null
}
```

- 지원 대화 action: `CLICK`, `TYPE`, `WAIT_FOR_USER`
- `TYPE`은 일반 텍스트 input에만 사용합니다.
- `targetElementId`는 `sourceSnapshotId`의 정제 DOM에 반드시 있어야 합니다.
- AI Engine은 action을 실행하지 않습니다.

## 목표 갱신

모델은 `GOAL_PATCH_PROPOSED`로 현재 goal revision을 기준으로 변경을 제안할 수 있습니다. Backend가 revision과 mutation을 적용한 뒤 같은 사용자 요청에서 다시 판단합니다. 확장 세션은 한 요청에서 목표 갱신 횟수를 제한해 무한 반복을 막습니다.

## 오류와 로그

| 상황 | AI Engine HTTP | Backend에서 보이는 결과 |
|---|---:|---|
| 요청 계약 위반/민감 입력 | `400` | AI 요청 실패 |
| Gemini/응답 계약 실패 | `502` | `CONVERSATION_502_AI_UNAVAILABLE` 계열 |
| 모델 timeout | `504` | AI unavailable/timeout |
| endpoint 연결 실패 | 응답 없음 | Backend transport 오류 |

AI Engine 로그 prefix:

```text
[AI Engine] Conversation decision failed. type=TIMEOUT
[AI Engine] Conversation decision failed. type=CONTRACT ...
[AI Engine] Conversation decision failed. type=TRANSPORT name=ApiError status=429
```

원문 prompt나 SDK 오류 전체는 민감 metadata가 포함될 수 있어 로그에 남기지 않습니다. 진단 절차는 [문제 해결 가이드](TROUBLESHOOTING.md)를 참고하세요.

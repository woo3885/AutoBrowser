# AI Engine

AutoBrowser의 AI 판단 서비스입니다. Backend가 전달한 사용자 목표, 최신 정제 DOM, 페이지 식별자와 대화 문맥을 Gemini에 보내고, 구조화된 단일 결정을 반환합니다.

단순 Gemini API 프록시가 아니라 prompt 구성, 응답 파싱, JSON 계약 검증, 상호작용 정책, 민감정보 차단, timeout 처리를 담당합니다.

## 요구사항과 실행

- Node.js 18 이상
- Gemini API key

```powershell
cd C:\Project\ai-engine
npm install
Copy-Item .env.example .env
npm start
```

개발 모드:

```powershell
npm run dev
```

## 환경 변수

```env
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3.5-flash
AI_ENGINE_MODEL_TIMEOUT_MS=30000
```

| 변수 | 필수 | 기본값 | 설명 |
|---|---:|---|---|
| `GEMINI_API_KEY` | O | 없음 | 시작 시 검증되는 Gemini API key |
| `GEMINI_MODEL` | X | `gemini-3.5-flash` | 실제 요청에 사용할 모델 ID |
| `AI_ENGINE_MODEL_TIMEOUT_MS` | X | `30000` | 대화 모델 한 번의 제한 시간 |
| `PORT` | Railway | Railway 값 | HTTP listen port, 가장 높은 우선순위 |
| `AI_ENGINE_PORT` | X | `3001` | `PORT`가 없을 때 사용할 로컬 port |

`.env`와 실제 API key는 Git에 커밋하지 않습니다. Railway에서는 Variables에 secret으로 저장합니다.

## HTTP API

| Method | Path | 설명 |
|---|---|---|
| `GET` | `/health` | 서비스 상태 확인 |
| `POST` | `/api/ai/action` | 레거시 구조화 action 판단 |
| `POST` | `/api/ai/conversation/decision` | 현재 Chrome Extension이 사용하는 대화 판단 |

대화 endpoint는 요청 계약 위반에 `400`, 모델/응답 계약 실패에 `502`, 모델 timeout에 `504`를 반환합니다. 로그에는 요청 원문 대신 실패 유형만 남깁니다.

## 판단 결과

주요 mode는 다음과 같습니다.

- `AUTO_EXECUTE`: 안전한 `CLICK` 또는 일반 `TYPE`
- `GUIDE_USER`: 페이지 대상 강조 후 사용자 직접 조작
- `INFORM_USER`, `ASK_USER`: 설명 또는 추가 질문
- `SECURE_INPUT_REQUIRED`, `FINAL_CONFIRMATION_REQUIRED`: 보호된 사용자 단계
- `RISK_WARNING`, `STOP`, `COMPLETE`
- `GOAL_PATCH_PROPOSED`: Backend가 목표 revision에 반영하는 내부 결정

AI Engine은 한 번에 최대 하나의 action candidate만 제안합니다. 실제 실행은 하지 않으며 Backend와 Chrome Extension이 다시 검증합니다.

## 검증

```powershell
npm run check
npm run build
npm test
```

실제 Gemini 호출을 사용하는 테스트는 비용과 quota를 소비하므로 필요할 때만 실행합니다.

```powershell
npm run test:live
```

## 주요 코드

| 경로 | 역할 |
|---|---|
| `src/server.ts` | Gemini 모델과 Express 서버 조립 |
| `src/config/env.ts` | API key와 모델 설정 |
| `src/api/conversationDecision.route.ts` | 대화 endpoint, timeout, 오류 매핑 |
| `src/conversation` | prompt, schema, Gemini 응답 계약, 상호작용 정책 |
| `src/policy`, `src/secureInput`, `src/risk` | 안전 경계 |
| `src/actions`, `src/output` | 레거시 action 경로 |

Backend 연결과 요청/응답 설명은 [AI Engine 연동 가이드](../docs/ai-engine-integration-guide.md)를 참고하세요.

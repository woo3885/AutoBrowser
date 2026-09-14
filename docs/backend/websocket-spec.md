# 금융길잡이 AI WebSocket 명세

> **레거시 Viewer 계약:** 현재 Chrome Extension 경로는 WebSocket이나 프레임 스트림을 사용하지 않고 REST `/api/v1/extension/sessions`를 사용합니다. 이 문서는 루트 Viewer 호환 및 개발 이력용입니다.

## 1. 목적

백엔드 자동화 진행 상태, 사용자 선택 요청, 보안 입력 요청 및 오류 정보를 프론트엔드에 실시간으로 전달한다.

## 2. 연결 정보

- WebSocket Endpoint: `/ws`
- 메시지 형식: `JSON`
- 문자 인코딩: `UTF-8`

## 3. 공통 메시지 형식

```json
{
  "type": "SESSION_STATUS",
  "sessionId": "session-123",
  "status": "AI_EXECUTING",
  "message": "화면을 분석하고 있습니다.",
  "data": {},
  "timestamp": "2026-07-27T21:30:00"
}
```

## 4. 서버 메시지 유형

### SESSION_STATUS

자동화 세션의 현재 상태를 전달한다.

```json
{
  "type": "SESSION_STATUS",
  "sessionId": "session-123",
  "status": "PAGE_LOADING",
  "message": "금융사이트를 불러오고 있습니다."
}
```

### PAGE_UPDATED

브라우저 페이지 이동 또는 화면 변경을 전달한다.

```json
{
  "type": "PAGE_UPDATED",
  "sessionId": "session-123",
  "data": {
    "url": "https://example.com/products",
    "title": "금융상품 목록"
  }
}
```

### AI_MESSAGE

AI가 사용자에게 안내할 메시지를 전달한다.

```json
{
  "type": "AI_MESSAGE",
  "sessionId": "session-123",
  "message": "조건에 맞는 적금 상품을 확인했습니다."
}
```

### USER_DECISION_REQUIRED

상품, 계좌, 수취인 또는 약관 등 사용자의 선택이 필요한 경우 전달한다.

```json
{
  "type": "USER_DECISION_REQUIRED",
  "sessionId": "session-123",
  "status": "USER_DECISION_REQUIRED",
  "message": "가입할 상품을 선택해 주세요.",
  "data": {
    "decisionType": "PRODUCT_SELECTION",
    "options": []
  }
}
```

### SECURE_INPUT_REQUIRED

민감정보를 사용자가 직접 입력해야 하는 경우 전달한다.

```json
{
  "type": "SECURE_INPUT_REQUIRED",
  "sessionId": "session-123",
  "status": "SECURE_INPUT_REQUIRED",
  "message": "비밀번호를 직접 입력해 주세요.",
  "data": {
    "inputType": "PASSWORD"
  }
}
```

### FINAL_CONFIRMATION_REQUIRED

최종 금융 실행 직전에 사용자 확인을 요청한다.

```json
{
  "type": "FINAL_CONFIRMATION_REQUIRED",
  "sessionId": "session-123",
  "status": "FINAL_CONFIRMATION_REQUIRED",
  "message": "최종 실행 전 내용을 확인해 주세요.",
  "data": {
    "action": "TRANSFER",
    "summary": {}
  }
}
```

### RISK_WARNING

위험, 수수료, 손실 가능성 등 주의사항을 전달한다.

```json
{
  "type": "RISK_WARNING",
  "sessionId": "session-123",
  "status": "RISK_WARNING",
  "message": "중도 해지 시 이자 손실이 발생할 수 있습니다."
}
```

### ERROR

자동화 과정에서 발생한 오류를 전달한다.

```json
{
  "type": "ERROR",
  "sessionId": "session-123",
  "status": "ERROR",
  "message": "페이지 요소를 찾을 수 없습니다."
}
```

### COMPLETED

자동화 작업이 정상적으로 완료된 경우 전달한다.

```json
{
  "type": "COMPLETED",
  "sessionId": "session-123",
  "status": "COMPLETED",
  "message": "요청한 작업이 완료되었습니다."
}
```

## 5. 보안 입력 처리 원칙

민감정보 입력이 시작되면 다음 기능을 일시 중지한다.

- AI 화면 분석
- DOM 수집
- 화면 캡처
- 입력값 로그 저장

사용자가 입력한 민감정보는 AI 모델로 전달하지 않는다.

민감정보 입력이 끝난 후에는 입력 완료 여부만 전달하고 실제 입력값은 WebSocket 메시지에 포함하지 않는다.

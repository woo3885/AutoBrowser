# 프론트 WebSocket 이벤트

> **개발 이력:** 루트 Viewer/Demo 기반 당시 구현 기록입니다. 현재 운영 구조와 실행 방법은 [문서 색인](README.md)과 [현재 아키텍처](CURRENT_ARCHITECTURE.md)를 우선하세요.

## 1. WebSocket 수신 구조

프론트는 세션 생성 응답으로 받은 WebSocket 주소에 연결하고, JSON 메시지의
`type` 필드를 판별자로 사용해 `ServerWebSocketEvent`를 분기한다. 상태 변경
이벤트는 공통 `WorkflowStatus`를 갱신하고, 요청 이벤트는 현재 업무 상태에
맞는 세부 화면으로 전환한다.

`BROWSER_FRAME`의 JSON 메시지에는 프레임 메타데이터만 포함한다. 실제 화면
이미지는 Base64 JSON이 아니라 **Binary WebSocket 메시지**로 수신한다.

프론트가 보내는 메시지는 `ClientWebSocketEvent`로 제한한다. 클릭·스크롤
등 사용자 브라우저 동작, 업무 일시정지, 업무 취소만 전달하며 비밀번호,
OTP, 계좌번호 원문 등의 실제 민감정보는 이벤트에 포함하지 않는다.

## 2. 이벤트별 역할

### 백엔드 → 프론트

| 이벤트 | 역할 |
| --- | --- |
| `BROWSER_FRAME` | 수신할 브라우저 프레임의 세션, 시각과 1280 × 720 기준 크기를 알린다. 이미지 본문은 Binary로 별도 수신한다. |
| `WORKFLOW_STATUS_CHANGED` | 백엔드가 확정한 전체 업무 상태와 사용자 안내 문구를 전달한다. |
| `TARGET_HIGHLIGHT` | 사용자가 확인할 대상 요소와 강조 좌표를 전달한다. |
| `USER_DECISION_REQUEST` | 상품, 계좌, 수취인 또는 약관에 관한 사용자 선택을 요청한다. |
| `SECURE_INPUT_REQUEST` | 계좌 비밀번호, OTP 또는 인증서 비밀번호를 사용자가 직접 입력하도록 요청한다. |
| `FINAL_CONFIRMATION_REQUEST` | 거래 요약을 보여주고 실행 전 명시적인 최종 승인을 요청한다. |

### 프론트 → 백엔드

| 이벤트 | 역할 |
| --- | --- |
| `USER_BROWSER_ACTION` | 허용된 클릭, 일반 입력, 선택, 스크롤, 키 입력, 뒤로 가기 또는 새로고침 동작을 요청한다. |
| `PAUSE_WORKFLOW` | 현재 AI 업무 실행을 일시정지한다. |
| `CANCEL_WORKFLOW` | 사용자의 요청으로 현재 업무를 취소한다. |

## 3. 이벤트와 화면 상태의 관계

| 이벤트 | WorkflowStatus | 대표 ScreenType |
| --- | --- | --- |
| `BROWSER_FRAME` | 현재 상태 유지 | 현재 화면 유지 |
| `WORKFLOW_STATUS_CHANGED` | 이벤트의 `status`로 갱신 | 상태와 업무 데이터로 결정 |
| `TARGET_HIGHLIGHT` | 주로 `AI_EXECUTING` | `AI_PROGRESS` |
| `USER_DECISION_REQUEST` | `USER_DECISION_REQUIRED` | 요청의 `decisionType`에 대응하는 선택 화면 |
| `SECURE_INPUT_REQUEST` | `SECURE_INPUT_REQUIRED` | 요청의 `secureInputType`에 대응하는 보안 입력 화면 |
| `FINAL_CONFIRMATION_REQUEST` | `FINAL_CONFIRMATION_REQUIRED` | `DEPOSIT_CONFIRMATION` 또는 `TRANSFER_CONFIRMATION` |

`WorkflowStatus`는 백엔드와 프론트가 공유하는 전체 업무 상태이고,
`ScreenType`은 프론트가 표시할 세부 화면이다. 따라서 이벤트를 수신했다고
해서 프론트가 임의로 업무 상태를 건너뛰거나 변경해서는 안 된다.

## 4. 보안 원칙

- `SECURE_INPUT_REQUEST`를 수신하면 AI 실행과 화면 캡처를 즉시 중단한다.
- 민감정보는 사용자가 직접 입력하며 WebSocket 이벤트, 프론트 상태, 로그,
  분석 데이터에 실제 값을 저장하지 않는다.
- 비밀번호, OTP, 인증서 비밀번호와 계좌번호 원문을 서버 또는 AI에
  재전송하지 않는다.
- 보안 입력 완료는 실제 입력값이 아니라 완료 여부만 별도 보안 API로 알린다.
- 최종 거래는 `FINAL_CONFIRMATION_REQUEST` 이후 사용자의 명시적 승인 없이는
  실행하지 않는다.

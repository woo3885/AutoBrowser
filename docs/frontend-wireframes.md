# 프론트 UI Mock 와이어프레임

> **개발 이력:** 루트 Viewer/Demo 기반 당시 구현 기록입니다. 현재 운영 구조와 실행 방법은 [문서 색인](README.md)과 [현재 아키텍처](CURRENT_ARCHITECTURE.md)를 우선하세요.

## 1. 목적과 확인 범위

개발자 A의 1일차 정적 UI Mock으로, 백엔드 연결이나 실제 WebSocket 통신 없이
상태별 화면 구조와 사용자 결정 지점을 확인한다. 디자인 완성본이 아니라
회색·흰색·테두리를 중심으로 한 와이어프레임이다.

구현 화면은 다음과 같다.

- `SESSION_READY`
- `BROWSER_LOADING`
- `AI_PROGRESS`
- `PRODUCT_SELECTION`
- `ACCOUNT_SELECTION`
- `RECIPIENT_SELECTION`
- `TERMS_AGREEMENT`
- `ACCOUNT_PASSWORD`
- `OTP_INPUT`
- `TRANSFER_CONFIRMATION`
- `DEPOSIT_CONFIRMATION`
- `VOICE_PHISHING_WARNING`
- `WORKFLOW_COMPLETED`
- `WORKFLOW_CANCELLED`
- `WORKFLOW_ERROR`
- `INITIAL_SCREEN`

## 2. WorkflowStatus와 ScreenType 연결

| WorkflowStatus | 구현 ScreenType |
| --- | --- |
| `SESSION_CREATED` | `SESSION_READY` |
| `PAGE_LOADING` | `BROWSER_LOADING` |
| `AI_EXECUTING` | `AI_PROGRESS` |
| `USER_DECISION_REQUIRED` | `PRODUCT_SELECTION`, `ACCOUNT_SELECTION`, `RECIPIENT_SELECTION`, `TERMS_AGREEMENT` |
| `SECURE_INPUT_REQUIRED` | `ACCOUNT_PASSWORD`, `OTP_INPUT` |
| `FINAL_CONFIRMATION_REQUIRED` | `TRANSFER_CONFIRMATION`, `DEPOSIT_CONFIRMATION` |
| `RISK_WARNING` | `VOICE_PHISHING_WARNING` |
| `COMPLETED` | `WORKFLOW_COMPLETED` |
| `CANCELLED` | `WORKFLOW_CANCELLED` |
| `ERROR` | `WORKFLOW_ERROR` |
| `TERMINATED` | `INITIAL_SCREEN` |

`WorkflowStatus`는 백엔드와 공유하는 전체 업무 상태이고, `ScreenType`은
프론트 내부의 세부 화면 구분이다. Mock 데이터는 모두
`FrontendScreenState` 형식을 사용한다.

## 3. 공통 1280 × 720 레이아웃

- 기준 캔버스 크기: 1280 × 720
- 좌표 원점: 왼쪽 위 `(0, 0)`
- X 좌표: 오른쪽으로 증가
- Y 좌표: 아래쪽으로 증가
- 브라우저 폭이 1280px보다 작으면 CSS `aspect-ratio: 16 / 9` 기준으로 전체
  비율을 유지하며 축소
- 좌측 상단: 개발용 `WorkflowStatus`, `ScreenType` 표시
- 상단: 서비스명과 WebSocket 연결 상태
- 중앙: 상태별 콘텐츠
- 안내 영역: 현재 AI 작업 또는 사용자 안내 메시지
- 하단: 이전, 취소, 다음, 승인 등 상태별 동작

`AI_PROGRESS` 안의 브라우저 프레임도 1280 × 720 비율의 축소 Mock이며,
좌표 기반 Target Highlight 예시를 표시한다.

## 4. 주요 화면 구성 요소

| 화면 | 주요 요소 |
| --- | --- |
| `SESSION_READY` | 시작 안내, 연결 상태, 시작 버튼 |
| `BROWSER_LOADING` | 로딩 표시, 페이지 로딩 안내, 취소 |
| `AI_PROGRESS` | AI 작업 메시지, 브라우저 프레임, Target Highlight, 일시정지, 취소 |
| 선택 화면 | 후보 카드, 직접 선택 안내, 이전, 취소, 다음 |
| `TERMS_AGREEMENT` | 필수·선택 약관 분리, 개별 체크박스 |
| 보안 입력 화면 | 보호 모드, 마스킹된 모양, AI·캡처 중단 표시, 입력 완료 |
| 최종 확인 화면 | 거래·가입 요약, 최종 승인 체크박스, 취소와 승인 |
| `VOICE_PHISHING_WARNING` | 강한 위험 경고, 자동화 중단, 공식 연락처 확인, 세션 종료 |
| 결과 화면 | 완료·취소·오류 결과와 처음으로·재시도·종료 버튼 |

## 5. 버튼 활성화 조건

- 상품, 계좌, 수취인 선택 화면의 `다음`은 후보를 선택한 뒤 활성화한다.
- 약관 화면의 `다음`은 모든 필수 약관에 개별 동의한 뒤 활성화한다. 선택
  약관 동의 여부는 다음 진행을 막지 않는다.
- 송금과 예금 가입 버튼은 최종 승인 체크박스를 직접 선택한 뒤 활성화한다.
- 위험 경고 화면에는 송금, 이체, 승인 등 금융 Action 버튼을 표시하지 않는다.
- 로딩 화면은 처리 중임을 표시하고 취소만 허용한다.

## 6. 보안 원칙

- 상품, 계좌, 수취인과 약관은 AI가 대신 결정하지 않고 사용자가 직접 선택한다.
- 전체 약관 동의 버튼을 제공하거나 자동으로 체크하지 않는다.
- 계좌번호는 `110-***-**1234` 같은 마스킹된 예시만 표시한다.
- 계좌 비밀번호와 OTP 화면에는 실제 `<input>`을 만들지 않고, 읽기 전용의
  마스킹된 입력 영역 모양만 표시한다.
- 비밀번호, OTP, 인증서 비밀번호의 실제 값은 React 상태, 로그 또는 Mock
  데이터에 저장하지 않는다.
- 보안 입력 중에는 AI 작업과 화면 캡처가 중단된 상태를 명확하게 표시한다.
- 최종 승인 전에는 송금·가입 실행 버튼을 비활성화한다.

## 7. 실행 및 확인 방법

```bash
npm run dev
```

개발 서버가 안내한 로컬 주소를 브라우저에서 연다. 앱 상단의
**개발용 Mock 화면 선택기**에서 원하는 `ScreenType`을 선택하면 각 화면을
확인할 수 있다. 별도 라우터, 백엔드와 WebSocket 연결은 필요하지 않다.

검증 명령은 다음과 같다.

```bash
npm test -- --run src/features/FrontendWireframes/ui/FrontendWireframeGallery.test.tsx
npm test
```

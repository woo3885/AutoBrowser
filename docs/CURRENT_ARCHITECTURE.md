# 현재 아키텍처

기준일: 2026-09-14

## 목표

AutoBrowser는 미리 정의된 사이트별 시나리오를 재생하지 않습니다. 매 단계에서 현재 탭의 접근 가능한 DOM과 사용자 목표를 다시 읽고 AI가 다음 한 동작을 판단하므로, 표준 DOM을 사용하는 여러 HTTP/HTTPS 사이트에 적용할 수 있습니다.

## 실행 경로

```text
Chrome 탭
  ├─ 실제 웹페이지: 사용자가 직접 보고 조작
  ├─ Content Script: 정제 DOM + elementId 레지스트리 + 오버레이 + 로컬 실행
  └─ React Floating Panel: 채팅 + 진행 상태 + 음성 입력 + Backend 설정
         │
         ▼
Chrome Service Worker
  └─ 공개 HTTPS 요청
         │
         ▼
Backend (Spring Boot)
  ├─ 탭별 대화 세션과 목표 상태
  ├─ AI 요청/응답 계약 검증
  └─ 보호 단계와 액션 정책 검증
         │
         ▼
AI Engine (Node.js/TypeScript)
  ├─ Gemini prompt와 JSON 응답
  ├─ 구조·상호작용 계약 검증
  └─ 다음 단일 결정 반환
```

## 구성요소 책임

### Chrome Extension

- 현재 탭에서만 DOM을 읽습니다.
- 폼의 실제 `value`, 쿠키, 토큰, 전체 화면 이미지를 수집하지 않습니다.
- 요소마다 스냅샷 범위의 임시 `elementId`를 부여합니다.
- AI가 선택한 ID가 현재 스냅샷과 일치하는지 확인한 뒤 클릭 또는 일반 텍스트 입력을 실행합니다.
- 사용자 판단이 필요한 대상은 실행하지 않고 오버레이로 안내합니다.
- UI는 닫힌 Shadow DOM에 있어 호스트 페이지 CSS와 충돌을 줄입니다.

### Backend

- `/api/v1/extension/sessions` 계열 API로 탭별 대화를 관리합니다.
- 사용자 목표 revision, 질문, AI 결정 계약을 검증합니다.
- 확장 경로에서는 브라우저를 소유하지 않습니다.
- 기존 Playwright, 프레임 스트림, Demo Bridge 코드는 레거시 Viewer와 E2E 호환을 위해 남아 있습니다.

### AI Engine

- 최신 정제 DOM, 페이지 식별자, 사용자 메시지와 목표 상태를 입력받습니다.
- Gemini가 반환한 JSON을 스키마와 상호작용 정책으로 검증합니다.
- 한 응답에서 하나의 mode와 최대 하나의 action candidate만 반환합니다.
- 모델 timeout 또는 계약 위반은 502/504로 Backend에 전달됩니다.

## 결정 모드

| Mode | 의미 | 실행 주체 |
|---|---|---|
| `AUTO_EXECUTE` | 안전한 클릭/일반 입력 | 확장 프로그램 |
| `GUIDE_USER` | 대상 강조 후 직접 조작 대기 | 사용자 |
| `INFORM_USER` | 페이지 설명 또는 안내 | 패널 |
| `ASK_USER` | 추가 정보 질문 | 사용자 |
| `SECURE_INPUT_REQUIRED` | 비밀번호·OTP 등 보호 입력 | 사용자 |
| `FINAL_CONFIRMATION_REQUIRED` | 외부 효과가 있는 최종 승인 | 사용자 |
| `RISK_WARNING` | 위험 가능성 안내 및 중단 | 사용자 |
| `COMPLETE`, `STOP` | 처리 종료 | 시스템 |
| `GOAL_PATCH_PROPOSED` | 내부 목표 상태 수정 | Backend 내부 처리 |

## 세션 생명주기

- 확장 프로그램은 탭별 `sessionId`를 `chrome.storage.session`에 저장합니다.
- Backend의 확장 세션은 현재 인메모리이며 접근 후 30분 TTL입니다.
- Backend 재시작, Railway 재배포 또는 TTL 만료 시 기존 ID는 유효하지 않습니다.
- 세션 없음 오류가 발생하면 확장 프로그램이 로컬 ID를 제거하고 다음 요청에서 새 세션을 만듭니다.

## 레거시 구성

- 루트 `src`: Canvas/프레임 스트림 기반 원격 Viewer Frontend
- `demo/demo-bank`: 고정 금융 흐름을 검증하던 Mock 사이트
- Backend Playwright/Viewer API: 원격 브라우저 실험 및 과거 테스트

이 구성은 삭제되지 않았지만 표준 배포에는 필요하지 않습니다. 관련 Day 문서는 개발 이력으로만 사용합니다.

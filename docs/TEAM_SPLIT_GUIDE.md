# 역할 분담 개발 가이드

기준일: 2026-09-14

현재 제품 경로는 Chrome Extension, Backend, AI Engine 세 영역입니다. 과거 A=루트 Viewer, B=Playwright, C=금융 intent만으로 나눈 방식은 더 이상 주 구조가 아닙니다.

## A — Chrome Extension와 UX

담당 경로:

```text
chrome-extension/**
```

- React 플로팅 패널, 테마, 진행 상태, 음성 입력
- Content Script의 정제 DOM, 오버레이와 로컬 action
- Service Worker의 탭/권한/Backend 연결
- Chrome 보호 페이지, iframe, Shadow DOM 제한 처리

## B — Backend와 안전 정책

담당 경로:

```text
backend/**
docs/backend/**
```

- 확장 세션 API와 목표 상태
- AI 요청/응답 계약 검증
- 보호 단계와 action 정책
- CORS, TTL, Railway Docker 배포
- 레거시 Playwright 경로의 격리 유지

## C — AI Engine와 모델 계약

담당 경로:

```text
ai-engine/**
docs/ai-engine-integration-guide.md
```

- 현재 DOM/사용자 목표 기반 prompt
- Gemini structured response와 schema
- 계약 위반, timeout, quota 오류 처리
- 범용 페이지 설명과 다음 단일 동작 판단
- 민감정보 및 위험 요청 차단

## 공동 변경

다음 변경은 세 영역의 타입과 테스트를 함께 검토합니다.

- `AgentDecision` mode 또는 action shape
- 정제 DOM field와 element ID 규칙
- 사용자 목표와 question 계약
- endpoint path, timeout, 오류 코드
- 보안 입력, 사용자 선택, 최종 승인 경계

병합 전 [통합 체크리스트](INTEGRATION_CHECKLIST.md)를 사용하고, 현재 실행 문서는 [문서 색인](README.md)에 연결합니다.

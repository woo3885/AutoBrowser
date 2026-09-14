# AutoBrowser 문서 색인

문서의 기준일은 **2026-09-14**입니다. 현재 실행 방식의 기준은 아래 “현재 문서”이며, Day 번호나 Viewer/Demo Bank 이름이 붙은 문서는 개발 이력입니다.

## 현재 문서

| 문서 | 용도 |
|---|---|
| [루트 README](../README.md) | 프로젝트 개요와 빠른 시작 |
| [현재 아키텍처](CURRENT_ARCHITECTURE.md) | 구성요소, 데이터 흐름, 책임 경계 |
| [Railway 배포](DEPLOYMENT.md) | Backend/AI Engine 배포와 변수 |
| [문제 해결](TROUBLESHOOTING.md) | 확장, Backend, AI Engine 장애 진단 |
| [통합 체크리스트](INTEGRATION_CHECKLIST.md) | 변경 전후 검증 항목 |
| [범용 에이전트](site-agnostic-agent.md) | 사이트 비종속 판단 원칙 |
| [Backend API](backend/api-spec.md) | 현재 API 계약과 레거시 API 구분 |
| [Backend 보안 정책](backend/security-policy.md) | 실행·민감정보 보호 원칙 |
| [AI Engine 연동](ai-engine-integration-guide.md) | 대화 판단 endpoint 및 계약 |
| [Extension README](../chrome-extension/README.md) | 빌드, 설치, 권한, 사용법 |
| [AI Engine README](../ai-engine/README.md) | 실행, 환경 변수, 테스트 |

## 유지되는 참고 문서

- `stt-json-spec.md`: 루트 레거시 Frontend의 STT JSON 규격
- `TDD_GUIDE.md`: 저장소 공통 TDD 지침
- `GIT_BRANCH_STRATEGY.md`, `BRANCH_QUICKSTART_3P.md`, `TEAM_SPLIT_GUIDE.md`: 초기 3인 협업 방식. 현재 GitHub 기본 배포 브랜치는 `main`이므로 실제 저장소 설정을 우선합니다.
- `ai-engine/docs/*`, `ai-engine/prompts/*`: 모델 정책과 세부 구현 규격. 코드 변경 시 함께 검토합니다.

## 개발 이력 문서

다음 문서는 당시 구현 결정을 재현하기 위한 기록이며 현재 설치나 배포 절차의 기준이 아닙니다.

- `frontend-d*.md`
- `frontend-agent-chat-day*.md`
- `integration-d17-viewer-action-foundation.md`
- `backend/docs/d*.md`
- `demo/docs/demo-bank-d*.md`
- `demo/docs/demo-bank-*-spec.md`
- `frontend-wireframes.md`, `frontend-screen-state.md`, `frontend-websocket-events.md`, `frontend-design-system.md`

현재 제품은 루트 Viewer나 Demo Bank 대신 Chrome의 실제 탭과 플로팅 패널을 사용합니다. 과거 문서와 현재 문서가 충돌하면 이 색인에 연결된 현재 문서와 실행 코드를 우선합니다.

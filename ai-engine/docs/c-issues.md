# C 파트 이슈 목록

> **개발 이력:** 초기 AI 파트 이슈 기록입니다. 현재 실행 상태와 배포 방법은 [`ai-engine/README.md`](../README.md) 및 [통합 가이드](../../docs/ai-engine-integration-guide.md)를 우선합니다.

## 목적

AI Engine 및 공통 계약 작업에서 팀 합의가 필요하거나 다음 단계에서 해결해야 하는 항목을 정리한다.

---

## 1. Intent 관련

- [ ] 현재 Intent 8종을 MVP 최종 목록으로 확정할지 결정
- [ ] `TRANSFER_MONEY` 세부 Intent 분리 여부 결정
- [ ] 복합 발화에서 단일 Intent만 반환할지 결정
- [ ] 위험 Intent와 일반 업무 Intent가 동시에 검출될 때 우선순위 확정
- [ ] `UNKNOWN`과 `ADDITIONAL_INFORMATION_REQUIRED` 사용 기준 정리

## 2. 개인정보 및 마스킹

- [ ] `originalText`에 개인정보가 포함될 경우 마스킹 책임 주체 결정
- [ ] 수취인 이름을 AI 요청에 전달할 수 있는 범위 확정
- [ ] 출금계좌 표시는 별칭만 허용할지 결정
- [ ] 금액과 기간 외 추가 입력값 허용 목록 확정
- [ ] Backend가 제거해야 하는 민감정보 필드 목록 최종 합의

## 3. AI Response 관련

- [ ] `inputValue`를 허용할 Action 범위 결정
- [ ] `confidence` 최소 기준 결정
- [ ] 낮은 confidence에서 자동 실행을 막을지 결정
- [ ] `options.id`가 DOM `elementId`와 같은 값을 사용할지 결정
- [ ] `summary` 필드의 세부 구조 확정
- [ ] `confirmationId` 생성 책임을 AI와 Backend 중 어디에 둘지 결정

## 4. Backend 검증 관련

- [ ] AI Response Schema 검증 위치 확정
- [ ] Schema 오류 발생 시 `ERROR`와 재요청 중 어떤 방식으로 처리할지 결정
- [ ] 존재하지 않는 `targetElementId` 반환 시 처리 방식 결정
- [ ] 비활성 또는 비가시 요소 선택 시 재시도 정책 결정
- [ ] 현재 Workflow 상태와 맞지 않는 Action 반환 시 처리 방식 결정
- [ ] `requestId` 불일치 응답 폐기 기준 확정

## 5. 위험 탐지 관련

- [ ] 키워드 규칙과 LLM 문맥 판단의 역할 분담 결정
- [ ] 위험 키워드 오탐 시 사용자 복귀 절차 정의
- [ ] `POSSIBLE_VOICE_PHISHING` 외 RiskType 추가 여부 결정
- [ ] 위험 경고 이후 동일 세션의 자동화 재개 허용 여부 결정
- [ ] 위험 로그 저장 범위와 개인정보 비저장 원칙 확정

## 6. LLM 연동 관련

- [ ] 사용할 LLM과 Structured Output 방식 확정
- [ ] JSON Schema를 모델 응답 형식에 직접 적용할 수 있는지 검증
- [ ] 응답 파싱 실패 시 재시도 횟수 결정
- [ ] 프롬프트 버전 관리 방식 결정
- [ ] Mock 응답과 실제 LLM 응답 전환 방식 결정
- [ ] 개발·운영 환경별 API Key 관리 방식 결정

## 7. 테스트 관련

- [ ] 현재 3개 Mock 외 송금 정상 흐름 Mock 추가
- [ ] 보안 입력 요청 Mock 추가
- [ ] 최종 승인 요청 Mock 추가
- [ ] 존재하지 않는 요소 ID를 반환하는 실패 Mock 추가
- [ ] Schema 자동 검증을 CI에 포함할지 결정
- [ ] `npm run validate:ai-schema` 스크립트 추가 여부 결정

## 8. 협업 및 브랜치

- [ ] `feature/ai-schema-and-policy` PR을 `develop`에 병합
- [ ] 병합 후 `feature/ai-engine-integration`에 최신 `develop` 반영
- [ ] 공통 계약 변경 시 A·B 사전 공유 규칙 확정
- [ ] `contracts/api.ts` 변경 승인 담당자 결정

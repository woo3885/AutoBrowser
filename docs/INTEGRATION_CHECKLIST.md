# 통합 체크리스트

기준일: 2026-09-14

Chrome Extension → Backend → AI Engine 경로를 변경할 때 사용합니다. 루트 Viewer와 Demo Bank만 바꾸는 작업에는 해당 프로젝트의 레거시 테스트를 별도로 적용합니다.

## Chrome Extension

- [ ] `npm test` 통과
- [ ] `npm run build` 통과 및 `dist/floating-panel.js` 갱신
- [ ] 번들에 `process.env` 또는 CommonJS `require()`가 남지 않음
- [ ] `manifest.json` 버전과 권한이 변경 내용에 맞음
- [ ] 일반 HTTP/HTTPS 탭에서 아이콘으로 패널 열기·최소화·닫기 동작
- [ ] 페이지 새로고침과 SPA 이동 후 DOM 스냅샷 재생성
- [ ] Backend Base URL 정규화 및 origin 권한 요청
- [ ] 탭별 세션이 다른 탭과 섞이지 않음
- [ ] 음성 결과가 자동 전송되지 않고 입력창에서 검토 가능
- [ ] iframe/Canvas/Chrome 보호 페이지 제한을 사용자에게 명확히 표시

## DOM과 로컬 실행

- [ ] 실제 input `value`, 쿠키, 토큰, Authorization Header를 수집하지 않음
- [ ] 비밀번호·OTP·인증번호·카드번호 요소가 자동 입력 대상에서 제외됨
- [ ] `elementId`가 스냅샷 범위에서만 유효함
- [ ] `sourceSnapshotId`가 현재 스냅샷과 다르면 실행 거부
- [ ] 대상이 존재하고 visible/enabled인지 실행 직전 재검증
- [ ] 최종 승인 및 사용자 선택 요소를 자동 클릭하지 않음
- [ ] `GUIDE_USER` 대상에 오버레이가 표시되고 직접 조작 후 계속 판단

## Backend

- [ ] Java 21에서 `gradlew test` 통과
- [ ] `/actuator/health`, `/api/v1/hello` 정상
- [ ] 확장 세션 생성·메시지·continue API 계약 일치
- [ ] `/api/v1/extension/**` CORS가 `chrome-extension://*`에만 필요한 method/header를 허용
- [ ] 사용자 메시지 길이와 정제 정책 적용
- [ ] goal revision, request/message ID, 질문 응답 관계 검증
- [ ] AI가 제안한 mode/action/target/snapshot 계약 검증
- [ ] Backend 재시작·TTL 만료 시 세션 없음 오류가 안전하게 처리됨
- [ ] AI Engine connect timeout이 request timeout보다 짧음
- [ ] Backend request timeout이 AI 모델 timeout보다 김

## AI Engine

- [ ] `npm run check`, `npm run build`, `npm test` 통과
- [ ] `GEMINI_API_KEY`가 로그/응답/저장소에 노출되지 않음
- [ ] `GEMINI_MODEL` 값이 실제 API key에서 사용 가능한 모델 ID임
- [ ] 요청 schema와 Backend `ConversationAgentRequest` 일치
- [ ] 모든 결정이 단일 mode 및 최대 단일 action 계약을 지킴
- [ ] `question`, `goalPatch`, `actionCandidate`의 mode별 null 규칙 통과
- [ ] 사용자 목표를 한 turn에서 무한 갱신하지 않음
- [ ] 알 수 없는 요청에 페이지 기능 설명 또는 추가 질문을 반환
- [ ] Gemini 400/429, 계약 실패, timeout이 구분된 로그와 HTTP 상태로 매핑됨

## 안전 시나리오

- [ ] 페이지 설명 요청은 화면 변경 없이 안내 가능
- [ ] 일반 메뉴 이동은 안전할 때만 자동 실행
- [ ] 사용자 선택이 필요한 옵션은 강조 후 대기
- [ ] 비밀번호·OTP 단계는 사용자 직접 입력으로 전환
- [ ] 결제·송금·가입·최종 제출은 명시적 사용자 승인 없이 실행하지 않음
- [ ] 위험 요청은 `RISK_WARNING` 또는 `STOP`으로 차단
- [ ] 모델 또는 네트워크 오류가 임의 동작으로 fallback되지 않음

## Railway 배포 후

- [ ] AI Engine `/health` 200
- [ ] Backend `/actuator/health` 200
- [ ] Backend private AI endpoint hostname/port/path 확인
- [ ] 확장 설정에 Backend 공개 HTTPS **Base URL** 저장
- [ ] `현재 페이지 설명` 요청으로 E2E 응답 확인
- [ ] `AUTO_EXECUTE`와 `GUIDE_USER`를 각각 안전한 테스트 페이지에서 확인
- [ ] Backend/AI Engine 로그에 API key 또는 민감 DOM이 없음
- [ ] 여러 Backend replica를 쓸 경우 인메모리 확장 세션 전략 검토

# 범용 웹사이트 AI 에이전트

기준일: 2026-09-14

AutoBrowser의 현재 기본 경로는 Chrome Extension입니다. Backend가 미리 허용한 한 사이트를 Playwright로 여는 방식이 아니라, 사용자가 실제로 열어 둔 HTTP/HTTPS 탭을 확장 프로그램이 분석합니다.

## 판단 원칙

1. 사용자가 현재 탭에서 목표를 입력합니다.
2. Content Script가 접근 가능한 표준 DOM을 정제하고 임시 `elementId`를 부여합니다.
3. Backend가 사용자 목표와 최신 스냅샷을 AI Engine에 전달합니다.
4. AI Engine은 현재 페이지에서 가능한 다음 한 동작을 판단합니다.
5. Backend가 계약과 보호 경계를 검증합니다.
6. 확장 프로그램이 안전한 동작을 실행하거나 사용자가 직접 조작할 대상을 강조합니다.
7. 변경된 DOM을 다시 읽어 목표가 끝날 때까지 반복합니다.

사이트별 selector, URL 흐름 또는 금융 업무 절차를 하드코딩하지 않습니다. 알 수 없는 질문이나 페이지 설명 요청에는 현재 DOM에서 확인 가능한 기능을 설명하는 `INFORM_USER` 결정을 사용할 수 있습니다.

## 범용성의 실제 경계

- 표준 링크, 버튼, select, textarea, 일반 input처럼 접근 가능한 DOM 요소가 가장 잘 동작합니다.
- SPA도 DOM과 URL 변경 후 새 스냅샷을 만들 수 있으면 지원할 수 있습니다.
- 교차 출처 iframe, Canvas/WebGL 내부 UI, 닫힌 Shadow DOM, CAPTCHA는 제한됩니다.
- 로그인이나 다른 origin으로 이동하면 해당 사이트에 대한 Chrome 권한이 필요합니다.
- 페이지의 서비스 약관과 자동화 정책은 사용자가 준수해야 합니다.

## 고정 안전 경계

아래 판단은 모델이 임의로 완화할 수 없습니다.

- 비밀번호, OTP, 인증번호, 보안카드, 카드번호 입력
- 사용자가 직접 선택해야 하는 약관과 상품/수취인 선택
- 결제, 송금, 가입, 제출 같은 외부 효과의 최종 승인
- 위험하거나 기만 가능성이 있는 요청
- 현재 스냅샷에 없거나 변경된 `elementId` 실행

## 레거시 원격 사이트 설정

`DDD_BROWSER_SITE_*`, `DEMO_BANK_BASE_URL`, Demo Agent Bridge는 루트 Viewer/Playwright 경로를 위한 호환 설정입니다. Chrome Extension 표준 경로에는 필요하지 않습니다. 새 배포는 [Railway 배포 가이드](DEPLOYMENT.md)를 따르세요.

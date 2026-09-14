# TDD 가이드라인

기준일: 2026-09-14

AutoBrowser의 실행 모듈별 테스트 도구가 다르므로 변경한 경로에서 가장 가까운 테스트부터 실행한 뒤 전체 모듈 검증으로 넓힙니다.

## 기본 원칙

1. 요구사항을 Given/When/Then 또는 재현 절차로 먼저 정리합니다.
2. 실패하는 테스트를 추가해 문제를 재현합니다.
3. 최소 변경으로 테스트를 통과시킵니다.
4. 계약·안전 경계의 회귀 테스트를 추가합니다.
5. 리팩터링 후 빌드까지 확인합니다.

## 모듈별 명령

```powershell
# Chrome Extension
cd chrome-extension
npm test
npm run build

# AI Engine
cd ..\ai-engine
npm test
npm run check
npm run build

# Backend
cd ..\backend
.\gradlew.bat test

# 레거시 루트 Viewer
Set-Location ..
npm test
npm run build

# 선택형 Demo Bank
cd demo\demo-bank
npm test
npm run build
```

실제 Gemini를 호출하는 `ai-engine`의 `npm run test:live`는 API key, quota와 비용을 확인한 뒤 명시적으로 실행합니다.

## 필수 회귀 경계

- 정제 DOM에 실제 입력값과 인증정보가 포함되지 않는가
- stale `snapshotId`와 존재하지 않는 `elementId` 실행을 거부하는가
- 비밀번호·OTP·카드번호와 최종 실행 요소를 자동 조작하지 않는가
- AI 계약 위반과 network 오류가 임의 동작으로 이어지지 않는가
- 확장 번들에 Node 전역이 남지 않는가
- 세션 만료·Backend 재시작 후 새 세션으로 안전하게 복구하는가

## 테스트 이름

구현 방법보다 관찰 가능한 동작을 설명합니다.

```text
잘못된 예: validator 함수를 호출한다
좋은 예: 비밀번호 input을 자동 입력 대상으로 반환하지 않는다
```

한 커밋에는 가능하면 하나의 의도를 담고, PR 또는 커밋 설명에 실행한 테스트와 수동 확인 환경을 기록합니다.

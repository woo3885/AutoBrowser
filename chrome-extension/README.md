# AutoBrowser Chrome Extension

Viewer 없이 사용자가 보고 있는 Chrome 탭에서 직접 동작하는 Manifest V3 확장 프로그램입니다.

## 로컬 설치

1. Chrome에서 `chrome://extensions`를 엽니다.
2. 우측 상단의 **개발자 모드**를 켭니다.
3. **압축해제된 확장 프로그램을 로드합니다**를 누릅니다.
4. 이 `chrome-extension` 디렉터리를 선택합니다.
5. 일반 HTTP/HTTPS 페이지에서 AutoBrowser 아이콘을 누릅니다.
6. 설정에서 Railway Backend 공개 주소를 저장합니다. `https://`를 생략하고
   `backend-production.up.railway.app`처럼 도메인만 입력해도 됩니다.
7. 패널에 **현재 사이트 연결**이 표시되면 버튼을 누르고 사이트 접근 권한을 허용합니다.

Backend는 `POST /api/v1/extension/sessions` 계약을 제공해야 합니다. 확장 프로그램은
비밀번호, OTP, 카드번호 자동 입력과 최종 실행 동작을 로컬에서 차단합니다.

## 동작 경계

- Content Script: 현재 탭의 정제된 DOM 생성, 오버레이, 검증된 로컬 동작 실행
- Side Panel: 채팅, 탭별 세션, 사용자 상태 표시
- Service Worker: 탭 주입과 Backend HTTPS 통신
- Backend/AI Engine: 대화 상태, 정책 검증, 다음 행동 판단

Chrome 내부 페이지, 권한이 없는 교차 출처 iframe, Canvas 기반 UI는 지원 범위 밖입니다.

# AutoBrowser Chrome Extension

현재 사용자가 보고 있는 Chrome 탭에 React 플로팅 패널을 주입하고, 정제된 페이지 구조를 Backend/AI Engine에 전달해 웹 작업을 돕는 Manifest V3 확장 프로그램입니다. 별도 Side Panel이나 원격 Viewer를 사용하지 않습니다.

## 구성

- `manifest.json`: MV3 권한과 Service Worker 등록
- `service-worker.js`: 패널 주입, 활성 탭 중계, Backend 요청
- `content-script.js`: 정제 DOM, 요소 레지스트리, 강조 오버레이, 안전한 로컬 실행
- `src/floating.tsx`: 닫힌 Shadow DOM과 플로팅 패널 마운트
- `src/App.tsx`: 채팅, 진행 상태, 테마, 설정, 음성 입력
- `dist/floating-panel.js`: Chrome이 실제로 주입하는 빌드 결과물

## 빌드와 검증

```powershell
cd C:\Project\chrome-extension
npm install
npm test
npm run build
```

빌드는 TypeScript 검사, Vite IIFE 번들 생성, `process.env`/`require()` 잔존 여부 검사를 순서대로 수행합니다.

## Chrome에 설치

1. `chrome://extensions`에서 **개발자 모드**를 켭니다.
2. **압축해제된 확장 프로그램을 로드합니다**를 누릅니다.
3. 이 `chrome-extension` 폴더를 선택합니다.
4. 일반 HTTP/HTTPS 페이지에서 툴바의 AutoBrowser 아이콘을 누릅니다.
5. 플로팅 패널의 설정에서 Backend 주소를 저장합니다.
6. 첫 사용 시 사이트 접근 권한을 허용합니다.

소스 수정 후 `npm run build`를 다시 실행하고 `chrome://extensions`에서 확장 프로그램의 새로고침 버튼을 눌러야 합니다. 이미 열려 있던 페이지도 새로고침한 뒤 아이콘을 다시 누르세요.

## Backend 주소

- 로컬: `http://127.0.0.1:8080`
- Railway: `https://<backend-service>.up.railway.app`
- 프로토콜을 생략한 도메인은 `https://`로 정규화됩니다.
- 경로나 API endpoint가 아니라 서버의 **Base URL**만 입력합니다.
- Gemini API 키는 확장 프로그램에 저장하지 않습니다.

저장 시 Backend origin에 대한 선택적 host permission을 요청합니다. 현재 사이트 분석 권한은 `http://*/*`, `https://*/*` 범위로 별도 요청합니다.

## 사용 흐름

1. 요청을 텍스트 또는 음성으로 입력합니다.
2. 확장 프로그램이 현재 탭의 정제 DOM을 생성합니다.
3. Backend가 대화 세션과 안전 정책을 적용하고 AI Engine에 판단을 요청합니다.
4. 일반 작업은 현재 탭에서 실행합니다.
5. 사용자 판단, 보안 입력, 최종 승인은 페이지에서 직접 수행합니다.
6. 안내 대상은 페이지 위 오버레이로 강조되고, 조작 후 새 DOM으로 판단을 이어갑니다.

세션은 탭별로 `chrome.storage.session`에 보관되며 Backend의 인메모리 확장 세션 TTL은 현재 30분입니다. Backend 재배포나 세션 만료 후에는 새 요청으로 새 세션을 만듭니다.

## 음성 입력

Web Speech API와 `navigator.mediaDevices.getUserMedia()`를 사용합니다. `audioCapture` manifest 권한은 사용하지 않습니다. 인식 결과는 즉시 전송하지 않고 입력창에 넣어 사용자가 검토한 뒤 전송합니다.

## 지원 경계

- 지원: 일반 HTTP/HTTPS 문서의 표준 DOM 기반 버튼·링크·일반 텍스트 입력
- 제한: 권한 없는 교차 출처 iframe, Canvas/WebGL 내부 UI, 닫힌 Shadow DOM 내부 요소
- 미지원: `chrome://`, Chrome Web Store, 새 탭 등 Chrome 보호 페이지
- 자동 실행 금지: 비밀번호, OTP, 인증번호, 카드번호, 최종 결제·송금·가입, 위험 요청

## 자주 발생하는 문제

- `process is not defined`: 최신 `dist/floating-panel.js`를 빌드하고 확장 및 탭을 새로고침합니다.
- 패널이 안 열림: 일반 웹사이트인지 확인하고 사이트 접근 권한을 허용합니다.
- Backend `403`: 설정에서 Backend origin 권한을 다시 허용하고 Backend가 `/api/v1/extension/**`에 `chrome-extension://*` CORS를 허용하는지 확인합니다.
- 응답 후 동작 없음: AI 결정의 `mode`, `action`, `sourceSnapshotId`와 Backend/AI Engine 로그를 함께 확인합니다.

더 자세한 진단은 [문제 해결 가이드](../docs/TROUBLESHOOTING.md)를 참고하세요.

# 프론트 D2 기반 구성

> **개발 이력:** 루트 Viewer/Demo 기반 당시 구현 기록입니다. 현재 운영 구조와 실행 방법은 [문서 색인](README.md)과 [현재 아키텍처](CURRENT_ARCHITECTURE.md)를 우선하세요.

## 1. 프로젝트 구조

프론트엔드는 React 18, Vite, TypeScript 기반의 단일 페이지 애플리케이션이다.
`src/app/App.tsx`가 앱 진입 컴포넌트이며 기능은 `src/features`, 공통 코드는
`src/shared`, 상태와 이벤트 계약은 `src/types`에 둔다.

## 2. Tailwind CSS 설정

Tailwind CSS 3, PostCSS와 Autoprefixer가 설치되어 있다.
`tailwind.config.ts`는 `index.html`과 `src` 아래의 TypeScript·TSX 파일을
스캔한다. `src/index.css`에서 Tailwind의 `base`, `components`, `utilities`를
불러오며 컴포넌트는 utility class를 사용한다.

## 3. 공통 AppLayout

`src/shared/ui/AppLayout.tsx`는 화면별 콘텐츠와 상태 표시가 동일한 구조를
사용하도록 다음 영역을 제공한다.

- 상단 헤더와 서비스명
- WebSocket 연결 상태
- 개발용 `WorkflowStatus`, `ScreenType` 표시
- 중앙 콘텐츠
- 사용자 안내 메시지
- 하단 Action 버튼

### Props

| prop | 타입 | 설명 |
| --- | --- | --- |
| `workflowStatus` | `WorkflowStatus` | 백엔드와 공유하는 전체 업무 상태 |
| `screenType` | `ScreenType` | 프론트가 표시하는 세부 화면 |
| `message` | `string` | 사용자 안내 또는 현재 작업 메시지 |
| `isConnected` | `boolean` | WebSocket 연결 상태 표시값 |
| `children` | `ReactNode` | 중앙 콘텐츠 |
| `actions` | `ReactNode` | 하단 버튼 및 Action 영역 |
| `title` | `string` | 선택 서비스명. 기본값은 `금융길잡이 AI` |
| `isLoading` | `boolean` | 선택 처리 중 표시 |
| `tone` | `default`, `danger`, `secure` | 선택 화면 강조 스타일 |

`WorkflowStatus`와 `ScreenType`은 `src/types/frontend-state.ts`의 기존 타입을
재사용한다.

## 4. Mock 화면 적용

`FrontendWireframeGallery`의 16개 Mock 화면은 상태별
`FrontendScreenState`를 `AppLayout` props로 변환해 사용한다. 화면별 중앙
콘텐츠와 Action 버튼은 기존 구현을 유지하고, 중복되던 헤더·상태·메시지·
하단 영역만 공통 컴포넌트로 이동했다.

개발용 `ScreenType` 선택 드롭다운과 `App.tsx`의 Mock 갤러리 진입 방식도
그대로 유지한다.

## 5. 실행

개발 서버:

```bash
npm run dev
```

프로덕션 빌드:

```bash
npm run build
```

Windows PowerShell에서 실행 정책으로 `npm.ps1`이 차단되면 각각
`npm.cmd run dev`, `npm.cmd run build`를 사용한다.

## 6. D2 기반 작업 완료 조건

- React 18 + Vite + TypeScript 프로젝트 구조가 확인되어야 한다.
- Tailwind CSS와 전역 스타일이 정상 적용되어야 한다.
- 상태별 화면이 재사용 가능한 `AppLayout`을 사용해야 한다.
- `AppLayout`의 콘텐츠, 안내, 연결 상태, 개발 상태와 Action 영역 테스트가
  통과해야 한다.
- 기존 16개 Mock 화면과 상호작용 테스트가 유지되어야 한다.
- `npm run build`와 전체 테스트가 통과해야 한다.
- `npm run dev`가 정상 기동되어야 한다.

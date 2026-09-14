# 프론트 디자인 및 접근성 스타일 가이드

> **개발 이력:** 루트 Viewer/Demo 기반 당시 구현 기록입니다. 현재 운영 구조와 실행 방법은 [문서 색인](README.md)과 [현재 아키텍처](CURRENT_ARCHITECTURE.md)를 우선하세요.

## 1. 목적

이 문서는 개발자 A의 D3 프론트 디자인 시스템 기준을 정의한다. 고령층 사용자가 금융 자동화 과정에서 현재 상태와 다음 행동을 쉽게 이해하고, 키보드나 포인터로 충분히 큰 조작 영역을 사용할 수 있도록 일관된 글자, 버튼, 패널 규칙을 제공한다.

공통 컴포넌트로 `Button`, `Text`, `Panel`, `StatusBadge`, `NoticeBox`를 제공한다. `AppLayout`은 공통 상태·안내 컴포넌트를 사용하고, 기존 16개 Mock 화면의 하단 Action은 `Button`을 사용한다.

### D3 공통 컴포넌트

| 컴포넌트 | 기본 사용 목적 |
| --- | --- |
| `Button` | 주요 진행, 보조 행동, 취소·종료와 로딩 상태를 일관되게 표현 |
| `Text` | 제목, 본문, 안내, 보조 문구의 글자 계층 제공 |
| `Panel` | 서로 관련된 콘텐츠를 제목·설명과 함께 하나의 영역으로 구성 |
| `StatusBadge` | 연결 여부와 업무 상태를 짧은 텍스트로 표시 |
| `NoticeBox` | 현재 작업, 사용자 안내, 보안 상태, 경고와 오류를 문장으로 전달 |

## 2. 의미 기반 디자인 토큰

기존 `brand` 색상은 유지하며 다음 최소 의미 기반 색상 토큰을 사용한다.

| 토큰 | 값 | 용도 |
| --- | --- | --- |
| `primary` | `#0369a1` | 주요 행동과 강조 |
| `danger` | `#b91c1c` | 취소, 종료, 위험 행동 |
| `secure` | `#1e293b` | 보안 입력 및 보호 상태 |
| `surface` | `#ffffff` | 패널과 버튼 표면 |
| `border` | `#cbd5e1` | 기본 테두리 |
| `text-primary` | `#0f172a` | 제목과 본문 |
| `text-secondary` | `#475569` | 보조 설명 |

Tailwind의 기본 색상과 기존 `brand` 단계는 제거하지 않는다.

## 3. 고령층 접근성 기준

- 일반 본문은 최소 16px, 주요 안내는 최소 18px로 표시한다.
- 화면 제목은 28px 이상으로 표시한다. `Text`의 `title`은 30px를 사용한다.
- 보조 문구도 14px보다 작게 만들지 않는다.
- 본문과 안내 문구에는 넉넉한 줄 간격을 사용한다.
- 기본 버튼은 높이 48px 이상, 대형 버튼은 56px 이상으로 유지한다.
- 버튼을 나란히 둘 때는 최소 12px 간격을 둔다.
- 키보드 포커스는 색상 대비가 분명한 외곽선 또는 ring으로 표시한다.
- 운영체제의 `prefers-reduced-motion` 설정을 존중해 애니메이션과 전환을 최소화한다.
- 비활성화와 로딩 상태는 색상만으로 표현하지 않고 네이티브 `disabled`와 접근성 속성을 함께 사용한다.

## 4. 글자 기준과 Text

`Text`는 내용의 역할에 맞는 기본 HTML 태그와 크기를 제공한다.

| variant | 기본 태그 | 크기 | 용도 |
| --- | --- | --- | --- |
| `title` | `h1` | 30px | 화면 제목 |
| `heading` | `h2` | 24px | 패널 및 영역 제목 |
| `body` | `p` | 16px | 일반 본문 |
| `guide` | `p` | 18px | 현재 행동 안내 |
| `caption` | `span` | 14px | 보조 설명 |

`as`로 필요한 태그를 바꿀 수 있지만 시각적 variant와 문서 제목 계층이 어긋나지 않게 사용한다.

```tsx
<Text variant="title">송금 내용을 확인해 주세요.</Text>
<Text variant="guide">수취인과 금액을 확인해 주세요.</Text>
<Text variant="caption">필수 항목입니다.</Text>
```

## 5. 버튼 기준과 Button

`Button`은 `primary`, `secondary`, `danger` variant와 `md`, `lg` 크기를 제공한다.

- `md`: 최소 높이 48px, 본문 크기 16px
- `lg`: 최소 높이 56px, 글자 크기 18px
- 기본값: `variant="primary"`, `size="md"`, `type="button"`
- `disabled` 또는 `isLoading`이면 네이티브 `disabled`가 적용되어 중복 클릭을 막는다.
- 로딩 중에는 `aria-busy`와 polite live region으로 상태를 전달한다.
- hover, disabled, `focus-visible` 상태를 구분한다.
- 외부 `className`은 기본 스타일 뒤에 추가한다.

```tsx
<div className="flex gap-3">
  <Button variant="secondary">이전</Button>
  <Button size="lg">다음</Button>
  <Button variant="danger">세션 종료</Button>
</div>
```

## 6. Panel 사용 기준

`Panel`은 흰색 표면, 2px 테두리, 일관된 모서리와 충분한 내부 여백을 제공한다. 관련된 내용 한 묶음을 표현할 때 사용하며, 화면 전체를 불필요하게 여러 패널로 나누지 않는다.

`title`이 있으면 `aria-labelledby`, `description`이 있으면 `aria-describedby`로 `section`과 연결한다. 각 ID는 React `useId`로 생성하므로 한 화면에 여러 패널을 배치해도 충돌하지 않는다.

```tsx
<Panel
  title="송금 정보"
  description="수취인과 금액을 확인해 주세요."
>
  <Text>홍길동에게 100,000원을 송금합니다.</Text>
</Panel>
```

제목이나 설명이 필요 없는 단순 묶음에서는 생략할 수 있다. 의미 있는 영역 이름이 필요하면 `title` 또는 적절한 `aria-label`을 제공한다.

## 7. StatusBadge 사용 기준

`StatusBadge`는 연결 여부나 업무 진행 상태처럼 짧은 상태를 표시한다. `neutral`, `success`, `progress`, `secure`, `warning`, `danger` variant를 제공하며 기본값은 `neutral`이다.

- 글자 크기는 14px 이상, 조작 요소와 구분되는 충분한 padding을 사용한다.
- 장식용 점은 `aria-hidden="true"`로 접근성 트리에서 제외한다.
- 점과 배경색만으로 의미를 전달하지 않고 `연결됨`, `처리 중`, `보안 입력 필요`, `위험`처럼 명시적인 텍스트를 함께 제공한다.
- 긴 안내 문장이나 사용자의 행동 요청에는 Badge 대신 `NoticeBox`를 사용한다.

```tsx
<StatusBadge variant="success">WebSocket 연결됨</StatusBadge>
<StatusBadge variant="secure">보안 입력 필요</StatusBadge>
```

## 8. NoticeBox 사용 기준

`NoticeBox`는 현재 작업, 사용자 안내, 보안 상태, 경고와 오류를 문장으로 전달한다. `info`, `progress`, `secure`, `warning`, `danger` variant를 제공한다.

- `info`, `progress`, `secure`는 기본적으로 `role="status"`를 사용한다.
- `warning`, `danger`는 즉시 확인해야 하는 내용이므로 기본적으로 `role="alert"`를 사용한다.
- `announce="polite"`는 현재 읽기를 방해하지 않고 변경 내용을 알린다.
- `announce="assertive"`는 위험이나 즉시 중단 상황에만 제한적으로 사용한다.
- `announce="off"`는 명시적 `aria-live`를 제거한다. 이때도 `status`와 `alert` 역할의 기본 의미는 유지된다.
- 위험·오류 안내는 명확한 테두리, 배경, 제목과 본문을 함께 사용한다.

```tsx
<NoticeBox variant="progress" title="처리 중" announce="polite">
  금융 페이지를 불러오고 있습니다.
</NoticeBox>

<NoticeBox variant="danger" title="위험 안내" announce="assertive">
  위험 표현이 감지되어 작업을 중단했습니다.
</NoticeBox>
```

## 9. 상태별 variant 매핑

`AppLayout`은 다음 기준으로 공통 상태를 표시한다.

| 상태 | StatusBadge | NoticeBox |
| --- | --- | --- |
| WebSocket 연결됨 | `success` | 해당 없음 |
| WebSocket 연결 안 됨 | `danger` | 해당 없음 |
| `PAGE_LOADING`, `AI_EXECUTING` | `progress` | `progress` |
| `SECURE_INPUT_REQUIRED` | `secure` | `secure` |
| `RISK_WARNING`, `ERROR` | `danger` | `danger` |
| `COMPLETED` | `success` | `info` |
| 그 외 일반 상태 | `neutral` | `info` |

모든 상태는 색상 외에 `WorkflowStatus`, `ScreenType`, 연결 상태 문구, 안내 제목과 본문을 함께 표시한다.

## 10. Mock 화면의 Button 적용 기준

기존 16개 Mock 화면의 하단 Action 버튼은 공통 `Button`을 사용한다.

- 시작, 다음, 입력 완료, 처음으로: `primary`
- 이전, 일시정지, 재시도: `secondary`
- 취소, 종료, 세션 종료: `danger`
- 최종 송금 및 가입 승인: `primary`, `size="lg"`
- 필수 약관 동의 전 다음 버튼과 최종 확인 전 승인 버튼은 실제 `disabled` 상태를 유지한다.

선택 카드, 체크박스, 마스킹 입력 영역은 서로 다른 역할을 가지므로 `Button`으로 교체하지 않는다.

`AppLayout`에는 `Text`, `StatusBadge`, `NoticeBox`를 적용했으며 Mock 화면에는 공통 하단 Action `Button`을 적용했다. 기존 Mock 본문의 모든 제목, 설명, 선택 카드와 패널을 디자인 시스템 컴포넌트로 교체한 것은 아니다. 남은 마이그레이션은 각 화면을 실제로 구현하거나 수정할 때 필요한 범위에서 진행한다.

## 11. 안내 문장 정책

개발자 C의 안내 문장 정책을 UI 문구에도 동일하게 적용한다.

- 안내는 한 문장으로 작성한다.
- 기본 길이는 공백을 포함해 15~40자로 유지한다.
- 짧고 쉬운 한국어를 사용한다.
- 사용자가 현재 해야 할 행동만 설명한다.
- 여러 행동이 필요하면 한 문장에 나열하지 않고 단계별로 안내한다.
- 비밀번호, OTP, 계좌번호 원문 등 민감정보를 안내 문장과 로그에 포함하지 않는다.

문장 길이는 TypeScript 타입으로 강제하지 않는다. `validateGuideMessage`로 권장 길이 15~40자와 줄바꿈 여부를 검사한다.

```ts
import { validateGuideMessage } from '@/shared/validation/guide-message';

const result = validateGuideMessage('송금 내용을 확인하고 승인해 주세요.');

if (!result.isValid) {
  // result.issues를 개발 단계의 문구 검토에 사용한다.
}
```

유틸은 앞뒤 공백을 제거한 결과를 반환하고 Unicode 문자 단위로 길이를 계산한다. 빈 문자열, 너무 짧은 문장, 너무 긴 문장과 줄바꿈은 각각 `EMPTY`, `TOO_SHORT`, `TOO_LONG`, `MULTILINE`으로 자동 검사한다. 입력 원문을 수정하거나 40자에 맞춰 자르지 않는다.

다음 의미 규칙은 자동 판정하지 않고 작성자와 검토자가 직접 확인한다.

- 한 문장으로 작성했는지
- 짧고 쉬운 한국어인지
- 사용자의 현재 행동만 설명하는지
- 비밀번호, OTP, 계좌번호 원문 등 민감정보가 포함되지 않았는지

## 12. 후속 작업

- 기존 16개 Mock 화면의 본문 제목, 안내 패널 중 재사용 가치가 확인된 부분에 `Text`와 `Panel`을 단계적으로 적용한다.
- `ActionBar`의 실제 중복과 필요성을 다시 확인한 뒤 최소 단위로 추가한다.
- 필요하면 `validateGuideMessage`를 콘텐츠 등록 또는 개발 검증 흐름에 연결한다.
- 실제 화면에서 키보드 탐색 순서, 포커스 가시성, 색상 대비, 확대 환경을 수동 검증한다.

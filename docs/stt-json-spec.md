# STT 입력 결과 JSON 규격

> **레거시 Frontend 규격:** 현재 Chrome Extension은 Web Speech API의 최종 인식 텍스트를 전송 전 입력창에 반영하며 이 이벤트 JSON을 Backend로 보내지 않습니다.

## 1. 목적

프론트 음성 입력이 시작된 시점부터 중간 인식, 최종 인식과 오류까지 동일한
JSON 구조로 전달하기 위한 규격이다. 모든 이벤트는 `type`, `sessionId`,
`utteranceId`, `timestamp`를 공통으로 가진다.

## 2. 이벤트별 역할

| 이벤트 | 역할 | 화면 표시 |
| --- | --- | --- |
| `STT_STARTED` | 사용자의 음성 입력 시작을 알린다. | 듣는 중 상태 표시 |
| `STT_PARTIAL_RESULT` | 입력 중인 인식 문장을 순서대로 갱신한다. | 임시 문장 갱신 |
| `STT_FINAL_RESULT` | 확정된 최종 인식 결과와 선택적 타임라인을 전달한다. | 최종 문장 표시 |
| `STT_ERROR` | 오류 내용과 재시도 가능 여부를 전달한다. | 오류 및 재시도 안내 |

## 3. 공통 필드

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `type` | string literal | STT 이벤트 종류 |
| `sessionId` | string | 브라우저 업무 세션 식별자 |
| `utteranceId` | string | 한 번의 발화 시작부터 종료까지를 묶는 식별자 |
| `timestamp` | number | 이벤트가 생성된 Unix epoch millisecond |

## 4. 결과 필드

`STT_PARTIAL_RESULT`와 `STT_FINAL_RESULT`는 다음 필드를 공유한다.

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `text` | string | 인식된 문장 |
| `language` | `"ko-KR"` | 기본 인식 언어 |
| `sequence` | number | 같은 발화 안에서 결과가 생성된 순서 |
| `isFinal` | boolean literal | 중간 결과는 `false`, 최종 결과는 `true` |
| `confidence` | number 또는 null | 전체 인식 신뢰도. 제공되지 않으면 `null` |

`STT_FINAL_RESULT`에는 다음 선택 필드를 추가할 수 있다.

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `startedAt` | number | 발화 시작 Unix epoch millisecond |
| `endedAt` | number | 발화 종료 Unix epoch millisecond |
| `durationMs` | number | 전체 발화 길이 |
| `words` | array | 구간별 인식 결과와 상대 시간 |

각 `words` 항목은 `text`, `startMs`, `endMs`, `confidence`를 가진다.
`startMs`와 `endMs`는 발화 시작점을 기준으로 한 상대 millisecond이다.

`STT_ERROR`는 다음 필드를 가진다.

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `code` | `SttErrorCode` | 허용된 오류 분류 코드 |
| `message` | string | 사용자에게 표시할 오류 안내 |
| `retryable` | boolean | 같은 화면에서 다시 시도할 수 있는지 여부 |

허용 오류 코드는 `NO_SPEECH_DETECTED`, `MICROPHONE_UNAVAILABLE`,
`PERMISSION_DENIED`, `STT_TIMEOUT`, `STT_SERVER_ERROR`, `UNKNOWN_ERROR`이다.

## 5. 중간 결과와 최종 결과의 차이

- 중간 결과는 발화 도중 여러 번 전달될 수 있고 `isFinal`이 `false`이다.
- 프론트는 더 큰 `sequence`의 중간 결과로 현재 임시 문장을 교체한다.
- 최종 결과는 발화당 한 번 전달하며 `isFinal`이 `true`이다.
- 최종 결과는 전체 발화 시간과 단어별 구간 정보를 선택적으로 포함한다.
- 최종 결과를 받은 뒤 같은 `utteranceId`의 늦은 중간 결과는 무시한다.

## 6. JSON 예시

### 중간 결과

```json
{
  "type": "STT_PARTIAL_RESULT",
  "sessionId": "bs-20260727-001",
  "utteranceId": "utt-001",
  "timestamp": 1785140001200,
  "text": "1년 동안 천만 원을",
  "language": "ko-KR",
  "sequence": 1,
  "isFinal": false,
  "confidence": null
}
```

### 최종 결과

```json
{
  "type": "STT_FINAL_RESULT",
  "sessionId": "bs-20260727-001",
  "utteranceId": "utt-001",
  "timestamp": 1785140002800,
  "text": "1년 동안 천만 원을 넣을 정기예금에 가입하고 싶어.",
  "language": "ko-KR",
  "sequence": 2,
  "isFinal": true,
  "confidence": 0.96,
  "startedAt": 1785140000000,
  "endedAt": 1785140002800,
  "durationMs": 2800,
  "words": [
    {
      "text": "1년 동안",
      "startMs": 0,
      "endMs": 700,
      "confidence": 0.97
    }
  ]
}
```

### 오류

```json
{
  "type": "STT_ERROR",
  "sessionId": "bs-20260727-001",
  "utteranceId": "utt-002",
  "timestamp": 1785140010000,
  "code": "NO_SPEECH_DETECTED",
  "message": "음성이 감지되지 않았습니다. 다시 말씀해 주세요.",
  "retryable": true
}
```

실행 가능한 전체 예시는 `mocks/stt-partial-result.json`,
`mocks/stt-final-result.json`, `mocks/stt-error.json`에 둔다.

## 7. 화면 상태와 연결

- `STT_STARTED`: 사용자의 음성 입력 시작을 표시한다. 기존 WorkflowStatus는
  유지하고 음성 컨트롤의 듣는 중 상태만 갱신한다.
- `STT_PARTIAL_RESULT`: 입력 중 문장을 갱신한다. 확정된 업무 요청으로
  처리하거나 AI 실행을 시작하지 않는다.
- `STT_FINAL_RESULT`: 최종 인식 결과를 표시하고 사용자가 내용을 확인할 수
  있게 한다. 이후 업무 흐름에 필요한 경우에만 상태 전환을 요청한다.
- `STT_ERROR`: 오류 메시지와 `retryable`에 따른 재시도 가능 여부를 표시한다.
  STT 오류만으로 전체 금융 업무 상태를 임의로 변경하지 않는다.

## 8. 보안 및 로그 원칙

- STT 결과에는 비밀번호, OTP, 인증서 비밀번호, 계좌번호 원문 등
  민감정보를 포함하지 않는다.
- 보안 입력 화면에서는 STT 수집을 중단하며 민감정보 발화를 유도하지 않는다.
- 민감정보가 감지되면 해당 인식 결과를 업무 이벤트나 AI 요청으로 전달하지
  않고 즉시 폐기한다.
- 음성 원문과 인식 결과는 개인정보 또는 금융정보가 될 수 있으므로 로그에
  저장하기 전에 보안·개인정보 검토와 명시적인 보관 정책이 필요하다.
- 운영 로그에는 필요한 식별자, 이벤트 종류와 오류 코드 등 최소 정보만
  남기고 `text`와 `words`는 기본적으로 기록하지 않는다.

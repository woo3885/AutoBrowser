# Security & Session (legacy placeholder)

이 디렉터리는 초기 분업 단계에서 별도 보안·세션 모듈을 계획했던 자리표시자입니다. 현재 실행 가능한 독립 서비스는 없습니다.

현재 구현 위치:

- Backend 세션 및 TTL: `backend/src/main/java/com/ddd/backend`
- 보안 입력·최종 승인 정책: Backend 및 `chrome-extension/content-script.js`
- Gemini 전송 전 계약·안전 검증: `ai-engine/src`

새 코드는 이 디렉터리에 추가하지 말고 해당 실행 모듈에 추가하세요. 현재 구조는 [아키텍처 문서](../docs/CURRENT_ARCHITECTURE.md)를 기준으로 합니다.

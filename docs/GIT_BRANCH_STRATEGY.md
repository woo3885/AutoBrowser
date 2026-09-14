# Git 브랜치 전략

기준일: 2026-09-14

`main`은 GitHub와 Railway가 배포하는 안정 브랜치입니다. 기능 작업은 짧은 `feature/*` 또는 `fix/*` 브랜치에서 수행하고 검증 후 `main`으로 병합합니다. 저장소에 별도 보호 규칙이나 `develop` 통합 브랜치가 설정되어 있다면 GitHub의 실제 branch protection을 우선합니다.

## 권장 흐름

```powershell
git switch main
git pull --ff-only
git switch -c feature/short-description

# 구현과 테스트
git add <files>
git commit -m "feat: describe the change"
git push -u origin feature/short-description
```

Pull Request에서 관련 모듈 테스트와 [통합 체크리스트](INTEGRATION_CHECKLIST.md)를 확인한 뒤 `main`에 병합합니다. 긴급 수정은 `main`에서 `fix/*` 또는 `hotfix/*`를 만듭니다.

## 커밋 prefix

- `feat`: 사용자 기능
- `fix`: 오류 수정
- `docs`: 문서만 변경
- `test`: 테스트 추가/수정
- `refactor`: 동작을 유지하는 구조 개선
- `chore`: 빌드, 버전, 도구 변경

API key, `.env`, 고객정보, 쿠키, 토큰과 민감 로그는 커밋하지 않습니다. 빌드 결과물을 추적하는 `chrome-extension/dist/floating-panel.js`는 소스 변경과 함께 갱신합니다.

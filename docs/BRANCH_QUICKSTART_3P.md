# 브랜치 Quick Start

이 문서는 현재 `main` 중심 흐름의 빠른 요약입니다. 자세한 내용은 [Git 브랜치 전략](GIT_BRANCH_STRATEGY.md)을 참고하세요.

```powershell
git switch main
git pull --ff-only

# 담당 영역에 맞는 이름 사용
git switch -c feature/extension-floating-ui
# 또는 feature/backend-extension-api
# 또는 feature/ai-conversation-policy
```

작업 후:

```powershell
git status --short
git add <changed-files>
git commit -m "feat: 변경 목적"
git push -u origin HEAD
```

각 담당 영역의 최소 검증:

```powershell
cd chrome-extension
npm test
npm run build

cd ..\backend
.\gradlew.bat test

cd ..\ai-engine
npm test
npm run check
npm run build
```

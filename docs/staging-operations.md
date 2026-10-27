# 프론트엔드 스테이징 운영

스테이징 웹: https://staging.chaekdojang.com

## Vercel 환경 변수

스테이징(Preview) 배포에는 아래 값을 넣습니다. 운영 환경 변수에 스테이징 값을 넣지 않습니다.

```text
BACKEND_URL=https://staging-api.chaekdojang.com
NEXT_PUBLIC_API_BASE_URL=https://staging-api.chaekdojang.com
NEXT_PUBLIC_SITE_URL=https://staging.chaekdojang.com
```

## 배포

- `staging` 브랜치에 push하면 Vercel이 Preview 배포를 자동으로 만듭니다(`vercel.json`의 `git.deploymentEnabled.staging`).
- 새 빌드를 `staging.chaekdojang.com`에 직접 연결하려면 GitHub Actions에서 `Deploy staging frontend` workflow를 수동 실행합니다. 실행하면 Vercel Preview를 만들고 `staging.chaekdojang.com` alias를 새 배포로 연결합니다.
- workflow에 필요한 GitHub Secrets:
  - `VERCEL_TOKEN`
  - `VERCEL_ORG_ID`
  - `VERCEL_PROJECT_ID`
  - `NEXT_PUBLIC_GA_MEASUREMENT_ID_STAGING` (없으면 비워둬도 됨)
  - `NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY_STAGING`

## 배포 후 점검

```bash
# 스테이징
WEB_BASE=https://staging.chaekdojang.com npm run smoke:prod

# 운영
npm run smoke:prod
```

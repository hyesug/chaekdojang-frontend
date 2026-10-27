# Frontend Staging Operations

The backend staging API is available at:

```text
https://staging-api.chaekdojang.com
```

Recommended Vercel setup:

- Create a separate Vercel project for staging, or use a dedicated staging environment.
- Set the staging domain to `staging.chaekdojang.com`.
- Set these environment variables for the staging deployment:

```text
BACKEND_URL=https://staging-api.chaekdojang.com
NEXT_PUBLIC_API_BASE_URL=https://staging-api.chaekdojang.com
NEXT_PUBLIC_SITE_URL=https://staging.chaekdojang.com
```

Smoke test after deploying staging:

```bash
WEB_BASE=https://staging.chaekdojang.com npm run smoke:prod
```

Staging deployment:

- `staging` 브랜치에 push하면 Vercel이 Preview 배포를 자동으로 만듭니다. `vercel.json`의 `git.deploymentEnabled.staging`이 `true`입니다. 2026-06-25에 꺼졌다가 2026-09-25 `eed7028`에서 다시 켰습니다.
- 새 빌드를 `staging.chaekdojang.com`에 직접 연결하려면 GitHub Actions에서 `Deploy staging frontend` workflow를 수동 실행합니다.
- workflow에 필요한 GitHub Secrets:
  - `VERCEL_TOKEN`
  - `VERCEL_ORG_ID`
  - `VERCEL_PROJECT_ID`
  - `NEXT_PUBLIC_GA_MEASUREMENT_ID_STAGING` (없으면 비워둬도 됨)
  - `NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY_STAGING`
- workflow를 실행하면 Vercel Preview를 만들고 `staging.chaekdojang.com` alias를 새 배포로 연결합니다.

Production smoke test:

```bash
npm run smoke:prod
```

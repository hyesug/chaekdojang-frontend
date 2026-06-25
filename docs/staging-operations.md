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

Manual staging deployment:

- GitHub Actions에서 `Deploy staging frontend` workflow를 수동 실행합니다.
- `vercel.json`에서 `staging` 브랜치의 Vercel Git 자동 배포를 꺼두었습니다. 스테이징 반영은 위 workflow로만 진행합니다.
- 필요한 GitHub Secrets:
  - `VERCEL_TOKEN`
  - `VERCEL_ORG_ID`
  - `VERCEL_PROJECT_ID`
  - `NEXT_PUBLIC_GA_MEASUREMENT_ID_STAGING` (없으면 비워둬도 됨)
- 실행하면 Vercel Preview를 만들고 `staging.chaekdojang.com` alias를 새 배포로 연결합니다.

Production smoke test:

```bash
npm run smoke:prod
```

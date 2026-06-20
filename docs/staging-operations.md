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

Production smoke test:

```bash
npm run smoke:prod
```

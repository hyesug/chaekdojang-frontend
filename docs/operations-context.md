# Chaekdojang Operations Context

This document is the handoff note for future Codex chats.
It intentionally excludes passwords, access keys, private keys, API secrets, and database credentials.

When starting a new Codex chat, say:

```text
AGENTS.md와 chaekdojang-web/docs/operations-context.md 읽고 책도장 운영 상태 이어서 봐줘.
```

## Service

- Product: 책도장, a reading-focused social network.
- Backend repo: `chaekdojang-api`
- Frontend repo: `chaekdojang-web`
- Backend stack: Java 21, Spring Boot 3.x, PostgreSQL 17, Flyway.
- Frontend stack: Next.js, TypeScript, Tailwind CSS, Vercel.
- Infrastructure: AWS EC2 + RDS for backend, Vercel for frontend, Cloudflare DNS.

## Environments

Production:

- Web: `https://chaekdojang.com`
- Web alias: `https://www.chaekdojang.com`
- API: `https://api.chaekdojang.com`
- CDN: `https://cdn.chaekdojang.com`

Staging:

- Web: `https://staging.chaekdojang.com`
- API: `https://staging-api.chaekdojang.com`
- CDN: same CloudFront-backed CDN is available as `https://cdn.chaekdojang.com`

Important rule:

- Test risky changes on staging first.
- Only promote to production after Codex verification and owner screen check.

## Frontend Deployment

Vercel project: `chaekdojang-web`

Branches:

- `main`: production deployment.
- `staging`: preview/staging deployment.

Vercel environment variables:

Production:

```text
NEXT_PUBLIC_API_BASE_URL=https://api.chaekdojang.com
```

Preview:

```text
BACKEND_URL=https://staging-api.chaekdojang.com
NEXT_PUBLIC_API_BASE_URL=https://staging-api.chaekdojang.com
NEXT_PUBLIC_SITE_URL=https://staging.chaekdojang.com
```

Do not set production API variables to staging values.

Frontend smoke tests:

```bash
npm run smoke:prod
```

```bash
WEB_BASE=https://staging.chaekdojang.com npm run smoke:prod
```

Known staging status on 2026-06-20:

- `https://staging.chaekdojang.com` returned 200.
- `https://staging.chaekdojang.com/api/reviews?page=0&size=1&sort=recent` returned 200.
- Smoke test passed for home, login, search, sitemap, and reviews API.

## Backend Deployment

Backend is hosted on AWS EC2 and connects to AWS RDS PostgreSQL.

Operational notes:

- Flyway is enabled and should manage schema migrations.
- Production and staging backend health checks have been verified.
- Staging API readiness endpoint:

```text
https://staging-api.chaekdojang.com/actuator/health/readiness
```

Before backend deployment:

```bash
./gradlew test
```

After backend deployment, check:

- Health/readiness endpoint.
- Main API endpoints used by frontend smoke tests.
- CloudWatch alarms and application logs if there is an issue.

Related backend operation document:

```text
chaekdojang-api/docs/ops-hardening-checklist.md
```

## AWS And Monitoring

AWS account is accessed from the owner's local machine through an AWS CLI profile.
Do not store access keys or secret keys in this repository.

Configured operational items:

- Cost alert email has been confirmed.
- CloudWatch alarm emails are configured for alarm state only, not normal recovery emails.
- CloudFront 5xx alarm exists for the CDN.
- Security group review has been performed.
- Database index review has been performed.
- S3/CDN-backed file upload foundation has been prepared.

If an AWS email alarm arrives:

1. Copy the full email content into Codex.
2. Include the exact time and affected alarm name.
3. Do not unsubscribe from SNS or budget emails.

## Admin And Audit

Admin features currently prepared:

- User management.
- Review hide/unhide.
- Customer inquiry responses.
- Access logs.
- Page visit metrics.
- Error logs.
- Admin audit logs.

Audit log UI exists in:

```text
chaekdojang-web/app/admin/page.tsx
```

Audit log API is expected at:

```text
/api/admin/audit-logs
```

Admin UI was adjusted for desktop and mobile:

- Wider desktop layout.
- Horizontally scrollable admin tabs on mobile.
- Mobile card layout for admin audit logs.

## Safe Operating Rules

The owner does not need to understand every implementation detail.
Codex can handle code, AWS checks, logs, deployment verification, and debugging.
The owner should keep final control over accounts, billing, and operational decisions.

Never do these without clear intent:

- Delete Cloudflare DNS records.
- Change production Vercel environment variables to staging values.
- Disable budget or alarm emails.
- Share AWS secret access keys, private keys, or database passwords in chat.
- Run destructive Git commands such as hard reset unless explicitly requested and understood.

Preferred change flow:

```text
1. Implement on local branch or staging path.
2. Run tests/build/smoke checks.
3. Push to staging or preview.
4. Owner checks the screen.
5. Promote to production.
```

## What The Owner Should Report

For user-facing bugs, provide:

- Page URL.
- Account role: guest, normal user, or admin.
- What was clicked or typed.
- Expected result.
- Actual result.
- Screenshot if available.

For AWS/Vercel/GitHub issues, provide:

- Screenshot.
- Full error text.
- Alarm email content if applicable.
- Approximate time in Korea time.

## Current Stability Baseline

As of 2026-06-20:

- Production frontend build passed.
- Frontend lint passed with existing warnings only.
- Production smoke test passed.
- Staging frontend smoke test passed.
- Staging API readiness check passed.
- Frontend `main` and `staging` branches exist.
- Latest frontend admin responsive UI change was pushed.

The next major work should generally be user-facing product features or UX polish, not more infrastructure, unless alarms or real user load reveal a bottleneck.

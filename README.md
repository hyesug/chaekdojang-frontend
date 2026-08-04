# chaekdojang-web

책도장 프론트엔드입니다. 독서 SNS의 독후감 피드, 책 검색, 책 상세 페이지, 내 서재, 프로필, 팔로우, 좋아요, 댓글, 관리자 화면을 제공합니다.

## 기술 스택

- Next.js
- React
- TypeScript
- Tailwind CSS
- Vercel

## 주요 기능

- 독후감 피드와 정렬
- 독후감 작성, 수정, 삭제, 공개/비공개 관리
- 책 검색과 책 상세 페이지
- SEO용 공개 책 상세 페이지
- 내 서재와 독서 캘린더
- 프로필, 팔로우, 팔로워
- 좋아요, 댓글, 북마크
- 관리자 화면
- sitemap, robots, GA4 연동

## 프로젝트 구조

```text
chaekdojang-frontend/
├─ app
│  ├─ books
│  ├─ reviews
│  ├─ profile
│  ├─ library
│  ├─ admin
│  ├─ components
│  └─ lib
├─ public
├─ package.json
└─ next.config.ts
```

## 로컬 실행

```bash
npm install
npm run dev
```

기본 주소:

```text
http://localhost:3000
```

## 환경 변수

로컬 민감 정보는 커밋하지 않습니다. 로컬에서는 `.env.local`을 사용합니다.

```text
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
BACKEND_URL=http://localhost:8080
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_GA_MEASUREMENT_ID=
NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY=
```

스테이징 예시:

```text
NEXT_PUBLIC_API_BASE_URL=https://staging-api.chaekdojang.com
BACKEND_URL=https://staging-api.chaekdojang.com
NEXT_PUBLIC_SITE_URL=https://staging.chaekdojang.com
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-BM572DG5WW
NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY=
```

## 주요 명령

```bash
npm run lint
npm run build
npm run smoke:prod
```

스테이징 배포 후 smoke 테스트:

```bash
WEB_BASE=https://staging.chaekdojang.com npm run smoke:prod
```

## 백엔드 연동

백엔드 API는 `chaekdojang-api` 레포지토리에서 관리합니다. API 계약이 바뀌면 프론트와 백엔드를 함께 수정합니다.

로그인이 필요한 요청은 JWT 토큰을 사용합니다.

```text
Authorization: Bearer <token>
```

## 배포

- `staging` 브랜치: 스테이징 프론트 배포
- `main` 브랜치: 운영 프론트 배포

스테이징:

```text
https://staging.chaekdojang.com
```

운영:

```text
https://www.chaekdojang.com
```

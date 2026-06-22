# chaekdojang-web

## 2026-06 staging/visibility update

- Staging frontend is served from Vercel at `https://staging.chaekdojang.com`.
- Staging API is `https://staging-api.chaekdojang.com`.
- The frontend includes a service-status guard. When the API readiness check fails, users see a maintenance/error screen instead of a blank page.
- Review cards now understand the backend `hidden` field.
- On the profile page, authors can switch their own reviews between public and private.
- Private reviews remain visible to their author in `GET /api/users/me/reviews`, but public feeds and book review collection pages do not expose them.
- In the library page, clicking a book cover or title opens the book detail page at `/books/{bookId}`.
- The book detail page remains the main entry point for book information, purchase links, writing a review, and reading the review collection.
- The standalone stats menu was removed. Reading stats now use the monthly calendar page, reachable from the library page.
- The monthly calendar only shows finished books that still have a visible own review. Reviews switched to private or deleted are excluded from calendar display.
- Search results include a library add button and use full-cover rendering so book covers are not cropped.
- Feed session-list restoration was removed so the feed always reloads current server data after staging DB refreshes or review visibility changes.

책도장 프론트엔드입니다. 독후감 피드, 책 검색, 내 서재, 팔로우, 좋아요, 댓글, 도서 구매 링크, 관리자 화면을 제공합니다.

## 기술 스택

- Next.js
- TypeScript
- React
- Tailwind CSS

## 로컬 실행

```bash
npm install
npm run dev
```

기본 주소는 `http://localhost:3000`입니다.

## 주요 환경 변수

```text
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
BACKEND_URL=http://localhost:8080
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

운영에서는 백엔드 배포 주소를 `NEXT_PUBLIC_API_BASE_URL`에 설정합니다.

스테이징에서는 아래 값을 사용합니다.

```text
NEXT_PUBLIC_API_BASE_URL=https://staging-api.chaekdojang.com
BACKEND_URL=https://staging-api.chaekdojang.com
NEXT_PUBLIC_SITE_URL=https://staging.chaekdojang.com
```

## 자주 쓰는 명령

```bash
npm run lint
npm run build
```

## 백엔드 연동

로그인이 필요한 요청은 `Authorization: Bearer <token>` 헤더를 사용합니다. API 계약이 바뀌면 `chaekdojang-api`와 함께 수정합니다.

현재 프론트가 의존하는 주요 API 계약:

- `GET /api/reviews`: 공개 피드. 삭제/비공개 독후감은 내려오지 않아야 합니다.
- `GET /api/users/me/reviews`: 내 독후감 관리와 캘린더에 사용합니다. 내 공개/비공개 독후감을 모두 내려주되 `hidden` 값을 포함해야 합니다.
- `PATCH /api/reviews/{id}/hidden`: 작성자 본인의 독후감 공개/비공개 전환에 사용합니다.
- `GET /api/library`: 내 서재와 월별 캘린더의 책 목록에 사용합니다.

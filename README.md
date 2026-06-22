# chaekdojang-web

## 2026-06 스테이징/공개 범위 업데이트

- 스테이징 프론트엔드는 Vercel에서 `https://staging.chaekdojang.com`으로 제공합니다.
- 스테이징 API 주소는 `https://staging-api.chaekdojang.com`입니다.
- 프론트엔드에 서비스 상태 확인 방어 로직이 있습니다. API 준비 상태 확인에 실패하면 빈 화면 대신 점검/오류 화면을 보여줍니다.
- 독후감 카드는 백엔드의 `hidden` 필드를 인식합니다.
- 프로필 페이지에서 작성자는 본인 독후감을 공개/비공개로 전환할 수 있습니다.
- 비공개 독후감은 작성자 본인의 `GET /api/users/me/reviews` 응답에는 포함되지만, 공개 피드와 책별 독후감 모음 페이지에는 노출되지 않습니다.
- 서재 페이지에서 책 표지나 제목을 누르면 `/books/{bookId}` 책 상세 페이지로 이동합니다.
- 책 상세 페이지는 책 정보, 구매 링크, 독후감 작성, 독후감 모음 확인의 주요 진입점입니다.
- 별도 통계 메뉴는 제거했습니다. 독서 통계는 서재 페이지에서 이동할 수 있는 월별 캘린더 페이지를 사용합니다.
- 월별 캘린더는 공개 상태인 내 독후감이 남아 있는 완독 책만 보여줍니다. 비공개로 전환했거나 삭제한 독후감은 캘린더에서 제외됩니다.
- 검색 결과에는 서재 추가 버튼이 있고, 책 표지가 잘리지 않도록 전체 표지 비율로 렌더링합니다.
- 피드 세션 목록 복원 기능은 제거했습니다. 스테이징 DB 초기화나 독후감 공개 상태 변경 뒤에도 피드는 항상 서버의 최신 데이터를 다시 불러옵니다.

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

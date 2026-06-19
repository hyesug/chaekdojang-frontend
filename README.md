# chaekdojang-web

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
```

운영에서는 백엔드 배포 주소를 `NEXT_PUBLIC_API_BASE_URL`에 설정합니다.

## 자주 쓰는 명령

```bash
npm run lint
npm run build
```

## 백엔드 연동

로그인이 필요한 요청은 `Authorization: Bearer <token>` 헤더를 사용합니다. API 계약이 바뀌면 `chaekdojang-api`와 함께 수정합니다.

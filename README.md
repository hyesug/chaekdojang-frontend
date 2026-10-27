# 책도장 Web

책도장 독서 SNS의 프론트엔드입니다. 백엔드 API는 [chaekdojang-api](https://github.com/hyesug/chaekdojang-backend)에 있습니다.

| 환경 | 주소 |
| --- | --- |
| 운영 | https://www.chaekdojang.com |
| 스테이징 | https://staging.chaekdojang.com (스테이징 API EC2가 2026-10-14부터 중지 상태라 데이터는 불러오지 못함) |

## 주요 기능

상단 메뉴: 피드 · 검색 · 서재 · 독서모임 · 도장단 · 공모전 · 독서 인생지도 · 운세 · 고객센터

- 독후감 피드, 작성(도장 코멘트·예약 공개), 좋아요·댓글·저장, AI 독서카드 이미지 저장
- 책 검색, 책 상세, 구매 링크
- 서재, 독서 캘린더, 독서 목표, 독서 인생지도(통계)
- 프로필, 팔로우, 알림
- 독서모임: 모임 만들기·가입, 카카오톡 초대 공유
- 도장단(서평단, 베타), 독후감 공모전
- 운세(`/unse`)와 AI 풀이(Claude Opus), AI 질문권
- 고객센터, 앱 설치 안내(PWA)
- 관리자 화면

**미공개 기능**: 책별 채팅(`/chat/[bookId]`), 독서 리캡 구독(`/subscription`). 화면은 운영에 배포되어 있지만 메뉴나 링크로 열지 않았습니다.

## 기술 스택

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Vercel

## 시작하기

필요한 것: Node.js 20 이상, 로컬 백엔드(`http://localhost:8080`, [실행 방법](https://github.com/hyesug/chaekdojang-backend#시작하기))

`.env.local`을 만듭니다.

```text
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
BACKEND_URL=http://localhost:8080
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

```bash
npm install
npm run dev
```

http://localhost:3000 에서 확인합니다.

- `/api/*`, `/oauth2/*`, `/login/oauth2/*` 요청은 `next.config.ts`의 rewrite로 `BACKEND_URL`에 전달됩니다.
- 로그인 상태는 백엔드가 발급하는 HttpOnly 쿠키로 유지합니다.

## 환경 변수

| 변수 | 설명 |
| --- | --- |
| `NEXT_PUBLIC_API_BASE_URL`, `BACKEND_URL`, `NEXT_PUBLIC_SITE_URL` | 백엔드 주소, 사이트 주소 (필수) |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | GA4 |
| `NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY` | 독서모임 카카오톡 공유 |
| `ANTHROPIC_API_KEY` | 운세 AI 풀이 |
| `NEXT_PUBLIC_PORTONE_STORE_ID`, `NEXT_PUBLIC_PORTONE_CHANNEL_KEY` | AI 질문권 결제 |
| `NEXT_PUBLIC_BUSINESS_*`, `NEXT_PUBLIC_CUSTOMER_SERVICE_CONTACT` | 결제 화면에 표시할 사업자 정보 |
| `NEXT_PUBLIC_MAINTENANCE_MODE` | `true`면 점검 화면 표시 |

운영·스테이징 값은 Vercel 프로젝트 설정에서 관리합니다.

## 명령어

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 |
| `npm run build` | 운영 빌드 |
| `npm run lint` | ESLint 검사 |
| `npm test` | 운세 엔진 테스트 |
| `npm run smoke:prod` | 운영 스모크 테스트 (`WEB_BASE`로 대상 변경) |

## 배포

| 환경 | 방법 |
| --- | --- |
| 운영 | `main`에 push하면 Vercel이 자동 배포 |
| 스테이징 | `staging`에 push하면 Vercel Preview 자동 배포. 스테이징 도메인에 연결하려면 GitHub Actions `Deploy staging frontend`를 수동 실행 |

GitHub Actions 봇도 `main`에 커밋합니다. 로또 전향 원장(토·수)과 운세 피드백 수정(월)입니다. 작업 전에 `git pull`로 최신 상태를 받습니다.

## 프로젝트 구조

```text
app/            페이지와 라우트 (Next.js App Router)
├─ components/  공용 컴포넌트
├─ lib/         API 호출, 인증
└─ fortune-ai/  운세 AI 라우트 (Claude)
public/unse/    운세 사이트 (바닐라 JS)
tests/          node:test 테스트
scripts/        빌드·검증 스크립트
```

## 관련 문서

- [스테이징 운영](docs/staging-operations.md): 스테이징 환경 변수, 배포, GitHub Secrets

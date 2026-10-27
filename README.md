# 책도장 Web

책도장(독서 SNS)의 프론트엔드입니다. 독후감 피드·서재·독서모임·서평단(도장단)·공모전 화면과 운세 사이트, 관리자 화면을 제공합니다.

- 운영: https://www.chaekdojang.com
- 스테이징: https://staging.chaekdojang.com
- 백엔드 API: [hyesug/chaekdojang-backend](https://github.com/hyesug/chaekdojang-backend)

## 목차

- [주요 기능](#주요-기능)
- [기술 스택](#기술-스택)
- [시작하기](#시작하기)
- [환경 변수](#환경-변수)
- [스크립트](#스크립트)
- [프로젝트 구조](#프로젝트-구조)
- [배포](#배포)
- [자동 작업 (GitHub Actions)](#자동-작업-github-actions)
- [개발 규칙](#개발-규칙)
- [관련 문서](#관련-문서)

## 주요 기능

### 서비스 중

상단 메뉴: 피드 · 검색 · 서재 · 독서모임 · 도장단 · 공모전 · 독서 인생지도 · 운세 · 고객센터 · 독후감 쓰기

| 영역 | 내용 | 주요 경로 |
| --- | --- | --- |
| 피드·독후감 | 피드, 독후감 작성·수정·삭제, 공개 범위·예약 공개, 좋아요·댓글·저장 | `/`, `/write`, `/reviews`, `/bookmarks` |
| AI 독후감 도우미 | 도장 코멘트(작성 중 피드백), AI 독서카드(이미지 저장), 다시 읽기 질문 | `/write`, `/reviews` |
| 책 | 책 검색, 책 상세, 구매 링크, 검색엔진용 공개 책 페이지 | `/search`, `/books` |
| 서재·기록 | 내 서재, 독서 캘린더, 독서 목표, 독서 인생지도(통계) | `/library`, `/calendar`, `/reading-goal`, `/stats` |
| 프로필 | 내 프로필, 공개 프로필, 팔로우, 알림, 공식 프로필 | `/profile`, `/u/[nickname]`, `/notifications`, `/profiles/[slug]` |
| 독서모임 | 모임 만들기·가입, 초대 링크, 함께 읽는 책, 질문·답변 | `/groups`, `/invite/groups` |
| 도장단 (베타) | 서평단 모집·신청, 전자책 열람, 운영자 관리 화면 | `/dojangdan` |
| 공모전 | 독후감 공모전 응모, 주최자 관리 화면 | `/contests` |
| 운세 | 운세 정적 사이트와 AI 풀이(Claude Opus), AI 질문권 | `/unse`, `/fortune-ai`, `/ai-credits` |
| 고객센터 | 문의, 이용약관, 개인정보처리방침, 결제 안내 | `/cs`, `/terms`, `/privacy`, `/payment-info` |
| 기타 | 앱 설치 안내(PWA), 온보딩·닉네임 설정, sitemap·robots·llms.txt, GA4 | `/install`, `/onboarding` |
| 관리자 | 운영 대시보드, 회원·독후감 관리, AI 질문권·운세 운영, 로또 미래검증 원장 | `/admin` |

> 운세 AI는 `app/fortune-ai/route.ts`에서 Claude만 호출합니다. 질문권 차감·환불과 사용 기록은 백엔드가 맡습니다.

### 미공개 기능

화면 코드는 있지만 메뉴나 링크로 열지 않은 기능입니다. `robots.ts`에서도 검색 수집을 막고 있습니다.

| 기능 | 경로 | 상태 |
| --- | --- | --- |
| 책별 채팅 (STOMP/SockJS) | `/chat/[bookId]` | 책 상세의 채팅 진입 링크가 주석 처리됨 |
| 독서 리캡 구독 | `/subscription` | 메뉴·링크 없음 |

프리미엄 구독과 번역(DeepL)은 백엔드 API만 있고 화면은 없습니다.

## 기술 스택

| 구분 | 기술 |
| --- | --- |
| 프레임워크 | Next.js 16 (App Router), React 19 |
| 언어·스타일 | TypeScript 5, Tailwind CSS 4, Pretendard·Noto Serif KR |
| AI | Anthropic SDK (운세 AI 풀이) |
| 결제 | PortOne (AI 질문권) |
| 실시간 | STOMP, SockJS (채팅, 미공개) |
| 운세 엔진 | 바닐라 ES 모듈 + esbuild 번들 (`public/unse`) |
| 테스트·도구 | node:test, ESLint 9, Playwright(스크립트용) |
| 배포·분석 | Vercel, GA4 |

## 시작하기

### 요구 사항

- Node.js 20 이상, npm
- 로컬 백엔드 (`http://localhost:8080`) — 실행 방법은 [chaekdojang-api README](https://github.com/hyesug/chaekdojang-backend#시작하기) 참고

### 설치와 실행

```bash
npm install
npm run dev
```

http://localhost:3000 에서 확인합니다.

- `npm run dev`와 `npm run build`는 먼저 `unse:bundle`을 실행해 운세 사이트를 번들링합니다.
- `/api/*`, `/oauth2/*`, `/login/oauth2/*` 요청은 `next.config.ts`의 rewrite로 `BACKEND_URL`에 전달됩니다.
- 로그인이 필요한 API 요청에는 JWT를 붙입니다: `Authorization: Bearer <token>`

## 환경 변수

로컬에서는 `.env.local`을 만들어 씁니다. 실제 키는 커밋하지 않습니다.

```text
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
BACKEND_URL=http://localhost:8080
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

| 구분 | 변수 | 설명 |
| --- | --- | --- |
| 기본 | `NEXT_PUBLIC_API_BASE_URL`, `BACKEND_URL`, `NEXT_PUBLIC_SITE_URL` | 백엔드 주소와 사이트 주소 |
| 분석·로그인 | `NEXT_PUBLIC_GA_MEASUREMENT_ID`, `NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY` | GA4, 카카오 SDK |
| 운세 AI | `ANTHROPIC_API_KEY`, `FORTUNE_AI_DISABLED`, `FORTUNE_AI_REQUIRE_LOGIN`, `FORTUNE_AI_CACHE_TTL` | Claude 호출. `FORTUNE_AI_DISABLED=1`이면 끔, `FORTUNE_AI_REQUIRE_LOGIN=0`이면 로그인 없이 허용, 캐시는 `5m`(기본) 또는 `1h` |
| 질문권 결제 | `NEXT_PUBLIC_PORTONE_STORE_ID`, `NEXT_PUBLIC_PORTONE_CHANNEL_KEY` | PortOne 결제창 |
| 사업자 정보 | `NEXT_PUBLIC_BUSINESS_NAME`, `NEXT_PUBLIC_BUSINESS_REPRESENTATIVE`, `NEXT_PUBLIC_BUSINESS_REGISTRATION_NUMBER`, `NEXT_PUBLIC_BUSINESS_SALES_REGISTRATION_NUMBER`, `NEXT_PUBLIC_BUSINESS_ADDRESS`, `NEXT_PUBLIC_CUSTOMER_SERVICE_CONTACT` | 결제 화면·결제 안내 페이지 표기 |
| 점검 | `NEXT_PUBLIC_MAINTENANCE_MODE` | `true`면 점검 화면 표시 |
| 내부 API | `LOTTO_PREDICTION_INTERNAL_TOKEN` | `app/api/internal/*` 로또 미래검증 API 인증 |
| 스크립트 | `WEB_BASE`, `FORTUNE_API_BASE`, `FORTUNE_FEEDBACK_EXPORT_TOKEN` | 스모크 테스트·운세 피드백 보고 대상 |

스테이징 값은 [docs/staging-env.example](docs/staging-env.example)을 참고합니다.

## 스크립트

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 실행 |
| `npm run build` | 운영 빌드 |
| `npm run start` | 빌드 결과 실행 |
| `npm run lint` | ESLint 검사 |
| `npm test` | 운세 엔진 테스트 (`test:unse`와 같음) |
| `npm run test:design` | 디자인 시스템 테스트 |
| `npm run smoke:prod` | 운영 스모크 테스트 (`WEB_BASE`로 대상 변경) |
| `npm run unse:bundle` | 운세 사이트 번들링 (`unse:watch`는 감시 모드) |

`tests/` 바로 아래의 디자인·로또·독후감 테스트는 `node --test tests/*.test.mjs`로 한 번에 실행합니다. 운세 검증·벤치마크용 `unse:*` 스크립트는 `package.json`에 있습니다.

스테이징 배포 후 점검:

```bash
WEB_BASE=https://staging.chaekdojang.com npm run smoke:prod
```

## 프로젝트 구조

```text
chaekdojang-frontend/
├─ app/                      # Next.js App Router
│  ├─ page.tsx               # 피드 (홈)
│  ├─ write/  reviews/  books/  search/  library/  calendar/  stats/
│  ├─ profile/  u/  users/  profiles/  notifications/
│  ├─ groups/  dojangdan/  contests/  cs/  admin/
│  ├─ fortune-ai/            # 운세 AI 스트리밍 라우트 (Claude)
│  ├─ ai-credits/            # AI 질문권 잔액·구매
│  ├─ api/internal/          # 로또 미래검증 내부 API (토큰 필요)
│  ├─ chat/  subscription/   # 미공개 기능
│  ├─ components/            # 공용 컴포넌트
│  └─ lib/                   # API 호출, 인증, 공용 유틸
├─ public/unse/              # 운세 정적 사이트 (바닐라 ES 모듈, 자체 AGENTS.md)
├─ lib/lotto-future/         # 로또 미래검증 엔진 (고정 사본)
├─ scripts/                  # 운세 번들·검증, 스모크 테스트, 피드백 보고
├─ tests/                    # node:test 테스트 (운세, 디자인 시스템, 로또)
├─ analysis/                 # 운세·로또 연구 기록
├─ validation/               # 운세 검증 사례 스키마·예시
├─ docs/                     # 운영·운세·설계 문서
└─ .github/workflows/        # 스테이징 배포, 모니터링, 자동 작업
```

## 배포

Vercel 프로젝트 `chaekdojang-web`으로 배포합니다.

| 환경 | 방법 | 주소 |
| --- | --- | --- |
| 운영 | `main` 브랜치에 push하면 Vercel이 자동 배포 | https://www.chaekdojang.com |
| 스테이징 | `staging` 브랜치에 push하면 Vercel Preview 자동 배포. `Deploy staging frontend` workflow를 수동 실행하면 새로 빌드해 스테이징 도메인에 연결 | https://staging.chaekdojang.com |

`main` push는 곧 운영 반영입니다. 아래 자동 작업도 `main`에 커밋하므로, 작업 전에 `git pull`로 최신 상태를 받습니다.

## 자동 작업 (GitHub Actions)

| Workflow | 실행 시점 | 하는 일 |
| --- | --- | --- |
| `Deploy staging frontend` | 수동 | 스테이징 빌드·배포 |
| `Monitor Production` | 매시 10분 | 운영 스모크 테스트 |
| `Unse Tests` | `public/unse`·`tests/unse` 변경 시 | 운세 엔진 테스트 |
| `Lotto Forward Ledger Weekly` | 토 22:30, 수 09:17 (KST) | 로또 전향 원장을 봉인해 `main`에 커밋 |
| `Unse Feedback Weekly Fix` | 월 10:00 (KST) | 운세 피드백에서 비추천이 몰린 해석 문장을 고쳐 `main`에 커밋 |

## 개발 규칙

- API 계약을 바꾸면 백엔드와 호출부를 함께 확인하고, 기존 JWT 처리 방식을 따릅니다.
- `public/unse/`를 고칠 때는 그 폴더의 `AGENTS.md`와 관련 테스트를 먼저 봅니다.
- 운세 AI는 기존 Claude 경로만 씁니다. 다른 AI 제공자를 추가하지 않습니다.
- 커밋 메시지는 `type(scope): 한국어 설명` 형식을 따릅니다. 예: `fix(reading-card): 독서카드 잘림 수정`

자세한 작업 지침은 [AGENTS.md](AGENTS.md)에 있습니다.

## 관련 문서

- [운영 현황 정리](docs/operations-context.md)
- [스테이징 운영](docs/staging-operations.md)
- [OAuth 운영 점검표](docs/oauth-operations-checklist.md)
- [운세·프론트엔드 메모](docs/fortune-and-frontend-notes.md)
- [운세 검증 데이터](validation/README.md)

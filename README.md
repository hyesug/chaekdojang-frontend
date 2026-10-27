<div align="center">

# 📚 책도장 Web

**독서 기록 SNS [책도장](https://www.chaekdojang.com)의 프론트엔드**

![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white)

[서비스 바로가기](https://www.chaekdojang.com) · [백엔드 저장소](https://github.com/hyesug/chaekdojang-backend)

</div>

## 📖 소개

책도장은 읽은 책을 독후감으로 기록하고 다른 독자와 나누는 독서 SNS입니다. 이 저장소는 웹 화면과 운세 사이트를 담고 있습니다.

## ✨ 주요 기능

| 기능 | 설명 |
| --- | --- |
| 피드 | 독후감 피드, 좋아요·댓글·저장 |
| 독후감 쓰기 | 작성·수정, 공개 범위·예약 공개, 도장 코멘트(AI 피드백), AI 독서카드 이미지 저장 |
| 검색 | 책 검색, 책 상세, 구매 링크 |
| 서재 | 내 서재, 독서 캘린더, 독서 목표 |
| 독서 인생지도 | 내 독서 기록 통계 |
| 독서모임 | 모임 만들기·가입, 카카오톡 초대 공유 |
| 도장단 (베타) | 서평단 모집·신청 |
| 공모전 | 독후감 공모전 응모 |
| 운세 | 운세 보기, Claude AI 풀이, AI 질문권 |
| 프로필 | 내 프로필·공개 프로필, 팔로우, 알림 |
| 고객센터 | 문의, 이용약관, 개인정보처리방침 |
| 관리자 | 운영 대시보드, 회원·독후감 관리 |

## 🛠 기술 스택

| 분류 | 기술 |
| --- | --- |
| Framework | Next.js 16 (App Router), React 19 |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 |
| AI | Claude API (운세 풀이) |
| 결제 | PortOne |
| Analytics | Google Analytics 4 |
| Deploy | Vercel |

## 📁 프로젝트 구조

```text
chaekdojang-frontend
├─ app/                 페이지와 라우트 (Next.js App Router)
│  ├─ components/       공용 컴포넌트
│  ├─ lib/              API 호출, 인증
│  └─ fortune-ai/       운세 AI 라우트
├─ public/unse/         운세 사이트
├─ scripts/             빌드·검증 스크립트
└─ tests/               테스트
```

## 🚀 시작하기

**필요한 것**: Node.js 20 이상, 로컬 백엔드 서버 ([실행 방법](https://github.com/hyesug/chaekdojang-backend#-시작하기))

### 1. 환경 변수 설정

프로젝트 루트에 `.env.local`을 만듭니다.

```text
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
BACKEND_URL=http://localhost:8080
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 2. 실행

```bash
npm install
npm run dev
```

http://localhost:3000 에서 확인합니다.

- `/api/*`, `/oauth2/*`, `/login/oauth2/*` 요청은 `next.config.ts`의 rewrite로 `BACKEND_URL`에 전달됩니다.
- 로그인 상태는 백엔드가 발급하는 HttpOnly 쿠키로 유지합니다.

## ⚙️ 환경 변수

| 변수 | 설명 |
| --- | --- |
| `NEXT_PUBLIC_API_BASE_URL`<br/>`BACKEND_URL`<br/>`NEXT_PUBLIC_SITE_URL` | 백엔드 주소, 사이트 주소 (필수) |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Google Analytics 4 |
| `NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY` | 독서모임 카카오톡 공유 |
| `ANTHROPIC_API_KEY` | 운세 AI 풀이 |
| `NEXT_PUBLIC_PORTONE_STORE_ID`<br/>`NEXT_PUBLIC_PORTONE_CHANNEL_KEY` | AI 질문권 결제 |
| `NEXT_PUBLIC_BUSINESS_*`<br/>`NEXT_PUBLIC_CUSTOMER_SERVICE_CONTACT` | 결제 화면에 표시할 사업자 정보 |
| `NEXT_PUBLIC_MAINTENANCE_MODE` | `true`면 점검 화면 표시 |

## 📜 명령어

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 실행 |
| `npm run build` | 운영 빌드 |
| `npm run lint` | ESLint 검사 |
| `npm test` | 운세 엔진 테스트 |

## 📦 배포

`main` 브랜치에 push하면 Vercel이 자동으로 배포합니다.

/**
 * 운영 배포인가. Vercel 이 빌드·실행 때 넣어 준다 — 운영은 production, staging 은 preview.
 * 검색 공개(운세 색인·AI 수집 허용·llms.txt)는 운영에서만 켠다. next.config.ts 와 같은 기준이다.
 */
export const IS_PRODUCTION = process.env.VERCEL_ENV === "production";

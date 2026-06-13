// API 호출은 빈 문자열 → next.config.ts의 rewrite가 /api/** → EC2로 프록시
export const API_BASE = "";

// OAuth 리다이렉트는 브라우저가 직접 이동하므로 EC2 URL 직접 사용
export const OAUTH_BASE = process.env.NEXT_PUBLIC_OAUTH_URL ?? "http://52.79.196.7:8080";

// 모든 요청은 빈 문자열 → next.config.ts rewrite가 /api/**, /oauth2/**, /login/oauth2/** → EC2로 프록시
export const API_BASE = "";
export const OAUTH_BASE = "";

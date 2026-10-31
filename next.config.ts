import type { NextConfig } from "next";
import { HTML_LIMITED_BOT_UA_RE } from "next/dist/shared/lib/router/utils/html-bots";

// title·description·canonical 을 <head> 에 담아 보내야 하는 수집기.
// Next 기본 목록에 없는 AI 검색 수집기와 Googlebot·다음 수집기를 더한다.
// 기본 목록에 없으면 메타데이터가 본문 뒤쪽에 스트리밍되어, JS 를 돌리지 않는 수집기는 제목·설명을 놓친다.
const HTML_LIMITED_BOTS = new RegExp(
  [
    HTML_LIMITED_BOT_UA_RE.source,
    "Googlebot",
    "Daum",
    "OAI-SearchBot",
    "ChatGPT-User",
    "GPTBot",
    "Claude-SearchBot",
    "Claude-User",
    "ClaudeBot",
    "PerplexityBot",
    "Perplexity-User",
  ].join("|"),
  "i",
);

const DEFAULT_BACKEND_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:8080"
    : "https://api.chaekdojang.com";

// 운영 배포인가. Vercel 이 빌드 때 넣어 준다 — 운영은 production, staging 은 preview.
// 검색 공개(운세 색인·AI 수집 허용·llms.txt)는 운영에서만 켠다.
const IS_PRODUCTION = process.env.VERCEL_ENV === "production";

const BACKEND_URL = (
  process.env.BACKEND_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  DEFAULT_BACKEND_URL
).replace(/\/$/, "");

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "img-src 'self' data: blob: https:",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://t1.kakaocdn.net https://cdn.portone.io",
      "style-src 'self' 'unsafe-inline'",
      "connect-src 'self' https: wss:",
      "font-src 'self' data:",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  htmlLimitedBots: HTML_LIMITED_BOTS,
  images: {
    remotePatterns: [
      { hostname: "search1.kakaocdn.net" },
      { hostname: "search2.kakaocdn.net" },
      { hostname: "t1.daumcdn.net" },
      { hostname: "books.google.com" },
      { hostname: "cdn.chaekdojang.com" },
      { hostname: "novel-phinf.pstatic.net" },
      { hostname: "comicthumb-phinf.pstatic.net" },
      { hostname: "page-images.kakaoentcdn.com" },
      { hostname: "dn-img-page.kakao.com" },
      { hostname: "img.ridicdn.net" },
      { hostname: "cdn1.munpia.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      // 검색 색인은 **운영에서만** 연다. staging 이 운영과 같은 글을 색인시키면
      // 검색 결과에서 운영 주소와 겹친다(운세·llms.txt 포함 전체 경로).
      ...(IS_PRODUCTION ? [] : [
        { source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      ]),
    ];
  },
  async redirects() {
    return [
      // 예전 독서 기록 소개 페이지는 서비스 소개(/about)로 합쳤다. 같은 내용 페이지가 둘이 되지 않게 옮긴다.
      { source: "/reading-log", destination: "/about", permanent: true },
    ];
  },
  async rewrites() {
    return [
      // 종합 운세 — public/ 아래의 정적 사이트.
      // public 은 /폴더/index.html 로만 서빙되므로 디렉터리 주소를 이어준다.
      { source: "/unse", destination: "/unse/index.html" },
      { source: "/unse/", destination: "/unse/index.html" },

      { source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` },
      { source: "/oauth2/:path*", destination: `${BACKEND_URL}/oauth2/:path*` },
      { source: "/login/oauth2/:path*", destination: `${BACKEND_URL}/login/oauth2/:path*` },
    ];
  },
};

export default nextConfig;

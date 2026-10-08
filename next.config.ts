import type { NextConfig } from "next";

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
      // 운세는 **운영에서만** 검색에 연다. AI 질문은 결제 전까지 화면에서 막혀 있어
      // 열어도 비용이 들지 않는다. staging·개발에서는 계속 색인하지 않는다.
      ...(IS_PRODUCTION ? [] : [
        { source: "/unse", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
        { source: "/unse/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
        { source: "/llms.txt", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      ]),
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

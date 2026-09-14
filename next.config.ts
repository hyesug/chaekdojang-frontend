import type { NextConfig } from "next";

const DEFAULT_BACKEND_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:8080"
    : "https://api.chaekdojang.com";

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
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://t1.kakaocdn.net",
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
      {
        // robots.txt 에는 적지 않는다. 그 파일은 공개라서 적는 순간
        // 주소를 아는 사람만 들어오게 한다는 전제가 깨진다.
        // 색인 차단은 페이지의 meta 와 이 헤더로만 건다.
        source: "/unse-8f3k2m/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive, nosnippet" }],
      },
      {
        source: "/unse-8f3k2m",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive, nosnippet" }],
      },
    ];
  },
  async rewrites() {
    return [
      // 종합 운세 — public/ 아래의 정적 사이트.
      // public 은 /폴더/index.html 로만 서빙되므로 디렉터리 주소를 이어준다.
      // 메뉴에 걸지 않고 주소를 아는 사람만 들어오는 페이지다.
      { source: "/unse-8f3k2m", destination: "/unse-8f3k2m/index.html" },
      { source: "/unse-8f3k2m/", destination: "/unse-8f3k2m/index.html" },

      { source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` },
      { source: "/oauth2/:path*", destination: `${BACKEND_URL}/oauth2/:path*` },
      { source: "/login/oauth2/:path*", destination: `${BACKEND_URL}/login/oauth2/:path*` },
    ];
  },
};

export default nextConfig;

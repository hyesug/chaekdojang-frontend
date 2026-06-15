import type { NextConfig } from "next";

// 서버 측 rewrite 대상. 로컬 개발에서는 로컬 백엔드를 기본값으로 사용한다.
const BACKEND_URL =
  process.env.BACKEND_URL ??
  (process.env.NODE_ENV === "development" ? "http://localhost:8080" : "http://52.79.196.7:8080");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { hostname: "search1.kakaocdn.net" },
      { hostname: "search2.kakaocdn.net" },
      { hostname: "t1.daumcdn.net" },
      { hostname: "books.google.com" },
    ],
  },
  // Vercel 서버가 EC2에 대신 요청 → Mixed Content 없음
  async rewrites() {
    return [
      { source: "/api/:path*",            destination: `${BACKEND_URL}/api/:path*` },
      { source: "/oauth2/:path*",         destination: `${BACKEND_URL}/oauth2/:path*` },
      { source: "/login/oauth2/:path*",   destination: `${BACKEND_URL}/login/oauth2/:path*` },
    ];
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { hostname: "search1.kakaocdn.net" },
      { hostname: "search2.kakaocdn.net" },
      { hostname: "t1.daumcdn.net" },
    ],
  },
};

export default nextConfig;

import type { MetadataRoute } from "next";
import { SITE_URL } from "./lib/serverApi";
import { IS_PRODUCTION } from "./lib/deployEnv";

const DISALLOW = [
  "/admin",
  "/admin/",
  "/ai-credits",
  "/fortune-ai",
  "/auth",
  "/auth/",
  "/bookmarks",
  "/bookmarks/",
  "/chat",
  "/chat/",
  "/library",
  "/library/",
  "/notifications",
  "/notifications/",
  "/profile",
  "/profile/",
  "/setup-nickname",
  "/subscription",
  "/write",
  "/write/",
];

// AI 검색·답변에 쓰이는 수집기. 운영에서만 공개 페이지(운세 포함)를 명시적으로 허용한다.
const AI_CRAWLERS = [
  "GPTBot", "OAI-SearchBot", "ChatGPT-User",
  "ClaudeBot", "Claude-SearchBot", "Claude-User",
  "PerplexityBot", "Perplexity-User",
  "Google-Extended", "Applebot-Extended", "Bingbot",
];

export default function robots(): MetadataRoute.Robots {
  const publicPaths = ["/", "/reviews/", "/books/", ...(IS_PRODUCTION ? ["/unse", "/unse/", "/llms.txt"] : [])];
  return {
    rules: [
      { userAgent: "*", allow: publicPaths, disallow: DISALLOW },
      ...(IS_PRODUCTION ? [{ userAgent: AI_CRAWLERS, allow: publicPaths, disallow: DISALLOW }] : []),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}

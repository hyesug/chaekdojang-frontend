import type { MetadataRoute } from "next";
import { SITE_URL } from "./lib/serverApi";
import { IS_PRODUCTION } from "./lib/deployEnv";

// 로그인해야 쓰는 화면·내부 주소. 검색 결과에 나올 내용이 없거나 개인 기록이라 수집하지 않는다.
const DISALLOW = [
  "/admin",
  "/admin/",
  "/ai-credits",
  "/api/",
  "/fortune-ai",
  "/auth",
  "/auth/",
  "/bookmarks",
  "/bookmarks/",
  "/books/work",
  "/calendar",
  "/chat",
  "/chat/",
  "/contests/manage",
  "/contests/me",
  "/cs/",
  "/demo/",
  "/dojangdan/manage",
  "/dojangdan/my",
  "/groups/new",
  "/invite/",
  "/library",
  "/library/",
  "/login/",
  "/notifications",
  "/notifications/",
  "/oauth2/",
  "/onboarding",
  // robots.txt 는 앞부분 일치라 "/profile" 만 쓰면 공개 공식 프로필(/profiles/…)까지 막힌다.
  "/profile$",
  "/profile/",
  "/reading-goal",
  "/setup-nickname",
  "/stats",
  "/subscription",
  "/write",
  "/write/",
];

// 검색 결과·AI 답변에서 출처로 인용하려고 읽는 수집기(ChatGPT·Claude·Perplexity·Gemini). 검색 엔진과 같은 범위를 연다.
// Claude-SearchBot 은 Claude 검색 색인, Claude-User 는 사용자가 물을 때 페이지를 가져온다(막으면 Claude 답변에서 빠진다).
// Google-Extended 는 학습뿐 아니라 Gemini 앱의 검색 근거(grounding)에도 쓰여 여기에 둔다.
// (Googlebot·Bingbot·Yeti(네이버)·Daum 같은 검색 엔진은 "*" 규칙을 따른다. Copilot 은 Bingbot 색인을 쓴다.)
const AI_SEARCH_CRAWLERS = [
  "OAI-SearchBot", "ChatGPT-User",
  "Claude-SearchBot", "Claude-User",
  "PerplexityBot", "Perplexity-User",
  "Google-Extended",
];

// 모델 학습용 수집기. 책도장을 AI 가 알게 하려고 검색 엔진과 같은 범위를 연다(운영자 결정, 2026-10-31).
// 다시 좁히려면 이 그룹의 allow 를 바꾼다. 이용자 독후감까지 학습에 쓰일 수 있다는 점을 알고 정한 것이다.
const AI_TRAINING_CRAWLERS = [
  "GPTBot",
  "ClaudeBot",
  "Applebot-Extended",
  "CCBot",
  "Meta-ExternalAgent",
  "Bytespider",
];

export default function robots(): MetadataRoute.Robots {
  // staging·개발은 X-Robots-Tag: noindex 로 색인을 막는다(next.config.ts).
  // 수집까지 막으면 이미 색인된 주소에 붙은 noindex 를 검색 엔진이 다시 읽지 못한다.
  if (!IS_PRODUCTION) {
    return { rules: [{ userAgent: "*", allow: "/", disallow: DISALLOW }] };
  }

  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: DISALLOW },
      { userAgent: AI_SEARCH_CRAWLERS, allow: "/", disallow: DISALLOW },
      { userAgent: AI_TRAINING_CRAWLERS, allow: "/", disallow: DISALLOW },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}

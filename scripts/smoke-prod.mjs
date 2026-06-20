const WEB_BASE = (process.env.WEB_BASE ?? "https://www.chaekdojang.com").replace(/\/$/, "");

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function checkStatus(name, path) {
  const url = `${WEB_BASE}${path}`;
  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    throw new Error(`${name}: expected 2xx, got ${response.status} ${url}`);
  }
  console.log(`OK ${name}: ${response.status}`);
  return response;
}

async function checkReviewsApi() {
  const response = await checkStatus("reviews-api", "/api/reviews?page=0&size=5&sort=recent");
  const body = await response.json();
  const content = body?.data?.content;
  if (!Array.isArray(content) || content.length < 1) {
    throw new Error("reviews-api: expected at least one review");
  }
  console.log(`OK reviews-api-data: ${content.length} reviews, first id ${content[0]?.id}`);
}

await checkStatus("home", "/");
await checkStatus("login", "/auth/login");
await checkStatus("search", "/search");
await checkStatus("sitemap", "/sitemap.xml");
await checkReviewsApi();

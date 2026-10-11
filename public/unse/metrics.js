// 운세 페이지 유입·체류 기록.
// Next 페이지의 app/components/AnalyticsTracker.tsx 와 같은 이벤트·식별값을 써서
// 관리자 '유입·사용자 행동' 메뉴에 다른 페이지와 똑같이 /unse 로 남게 한다.
// 계산 엔진과 무관한 독립 스크립트라 app.js 번들에 넣지 않는다.

const SESSION_KEY = "chaekdojang_session_id";
const DEVICE_KEY = "chaekdojang_device_id";
const REFERRER_MAX_LENGTH = 500;
const PATH = "/unse";

function setIdentifierCookie(name, value, persistent) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  const maxAge = persistent ? "; Max-Age=31536000" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax${maxAge}${secure}`;
}

function readIdentifierCookie(name) {
  const prefix = `${name}=`;
  const found = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix));
  return found ? decodeURIComponent(found.slice(prefix.length)) : undefined;
}

function getSessionId() {
  let value;
  try { value = sessionStorage.getItem(SESSION_KEY) ?? undefined; } catch { /* 쿠키만 사용 */ }
  value ||= readIdentifierCookie(SESSION_KEY);
  if (!value) {
    value = crypto.randomUUID();
    try { sessionStorage.setItem(SESSION_KEY, value); } catch { /* 쿠키가 유지 */ }
  }
  setIdentifierCookie(SESSION_KEY, value, false);
  return value;
}

function getDeviceId() {
  let value = readIdentifierCookie(DEVICE_KEY);
  try { value ||= localStorage.getItem(DEVICE_KEY) ?? undefined; } catch { /* 쿠키만 사용 */ }
  if (!value) {
    value = crypto.randomUUID();
    try { localStorage.setItem(DEVICE_KEY, value); } catch { /* 쿠키가 유지 */ }
  }
  setIdentifierCookie(DEVICE_KEY, value, true);
  return value;
}

function deviceType() {
  const width = window.innerWidth;
  if (width < 768) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}

function normalizeReferrer(referrer) {
  if (!referrer) return null;
  try {
    const url = new URL(referrer);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return `${url.origin}${url.pathname}`.slice(0, REFERRER_MAX_LENGTH);
    }
  } catch { /* URL 이 아니면 그대로 */ }
  return referrer.slice(0, REFERRER_MAX_LENGTH);
}

function track(eventType, durationMs = 0) {
  const body = JSON.stringify({
    eventType,
    sessionId: getSessionId(),
    path: PATH,
    referrer: normalizeReferrer(document.referrer),
    durationMs,
    device: deviceType(),
    deviceId: getDeviceId(),
  });
  fetch("/api/metrics/events", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer cookie-session" },
    body,
    credentials: "include",
    keepalive: true,
  }).catch(() => {});
}

let enteredAt = Date.now();
let ended = false;

track("page_view");

setInterval(() => {
  if (!ended) track("heartbeat", Date.now() - enteredAt);
}, 30000);

function endVisit() {
  if (ended) return;
  ended = true;
  track("session_end", Date.now() - enteredAt);
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    endVisit();
  } else if (ended) {
    // 다른 탭에 갔다가 돌아오면 새 체류 구간으로 센다.
    ended = false;
    enteredAt = Date.now();
  }
});
window.addEventListener("pagehide", endVisit);

// 운세 페이지 헤더의 로그인 상태 단추 (관리자·알림·프로필·로그아웃 / 로그인·회원가입).
// Next 쪽 AuthButtons·AdminNavLink·NotificationBell·MobileMenu 와 같은 API·저장 키를 쓴다.
// 로그인 확인은 app/lib/auth.ts 의 isAuthenticated·logout 동작을 그대로 옮겼다.

const LOGGED_OUT_KEY = "chaekdojang:logged-out";
const LOGGED_OUT_COOKIE = "chaekdojang_logged_out";
const AUTH_STATE_KEY = "chaekdojang:authenticated";

function isLogoutBlocked() {
  try { return localStorage.getItem(LOGGED_OUT_KEY) === "true"; } catch { return false; }
}

function setAuthState(authenticated) {
  try { sessionStorage.setItem(AUTH_STATE_KEY, authenticated ? "true" : "false"); } catch { /* 무시 */ }
}

async function fetchJson(url, init) {
  const res = await fetch(url, { cache: "no-store", credentials: "include", ...init });
  if (!res.ok) return { res, json: null };
  return { res, json: await res.json().catch(() => null) };
}

async function isAuthenticated() {
  if (isLogoutBlocked()) return false;
  try {
    const { json } = await fetchJson("/api/auth/session");
    const authenticated = Boolean(json?.data?.authenticated);
    setAuthState(authenticated);
    return authenticated;
  } catch {
    setAuthState(false);
    return false;
  }
}

// authFetch 처럼 401 이면 한 번 갱신 후 다시 시도한다.
async function authJson(url) {
  const headers = { Authorization: "Bearer cookie-session" };
  let { res, json } = await fetchJson(url, { headers });
  if (res.status === 401 && !isLogoutBlocked()) {
    const refreshed = await fetch("/api/auth/refresh", { method: "POST", credentials: "include" }).catch(() => null);
    if (refreshed?.ok) ({ res, json } = await fetchJson(url, { headers }));
  }
  return res.ok ? json : null;
}

function show(state) {
  document.querySelectorAll("[data-auth]").forEach((el) => {
    const want = el.getAttribute("data-auth");
    el.hidden = !(want === state.mode || (want === "admin" && state.admin));
  });
  const account = document.getElementById("cdAccount");
  if (account) account.hidden = false;
}

function showUnread(count) {
  const bell = document.getElementById("cdBell");
  const badge = document.getElementById("cdBadge");
  if (!bell || !badge) return;
  badge.hidden = count <= 0;
  badge.textContent = count > 9 ? "9+" : String(count);
  bell.setAttribute("aria-label", count > 0 ? `알림 ${count}개 안 읽음` : "알림");
}

async function logout() {
  try { localStorage.setItem(LOGGED_OUT_KEY, "true"); } catch { /* 무시 */ }
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${LOGGED_OUT_COOKIE}=true; Max-Age=31536000; Path=/; SameSite=Lax${secure}`;
  setAuthState(false);
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
  location.href = "/";
}

async function sync() {
  try {
    if (!(await isAuthenticated())) {
      show({ mode: "out", admin: false });
      return;
    }
    show({ mode: "in", admin: false });

    const [me, unread] = await Promise.all([
      authJson("/api/users/me").catch(() => null),
      authJson("/api/notifications/unread-count").catch(() => null),
    ]);
    const role = me?.data?.role ?? me?.role;
    show({ mode: "in", admin: role === "ADMIN" || role === "SUPER_ADMIN" });
    showUnread(Number(unread?.data ?? 0));
  } catch {
    show({ mode: "out", admin: false });
  }
}

document.querySelectorAll("[data-logout]").forEach((el) => el.addEventListener("click", logout));
sync();

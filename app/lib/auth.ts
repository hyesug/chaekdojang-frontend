const LOGGED_OUT_KEY = "chaekdojang:logged-out";

function isLogoutBlocked() {
  return typeof window !== "undefined" && sessionStorage.getItem(LOGGED_OUT_KEY) === "true";
}

export function markLoggedIn() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(LOGGED_OUT_KEY);
}

export function getValidToken(): string | null {
  if (typeof window === "undefined") return null;
  if (isLogoutBlocked()) return null;
  return "cookie-session";
}

export function clearToken() {
  // 이전 버전에서 저장했던 JWT를 정리하기 위한 호환 함수.
}

export async function logout() {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(LOGGED_OUT_KEY, "true");
  }

  const logoutTargets = ["/api/auth/logout"];
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
  if (apiBase) {
    logoutTargets.push(`${apiBase}/api/auth/logout`);
  }

  try {
    await Promise.allSettled(
      [...new Set(logoutTargets)].map((url) =>
        fetch(url, { method: "POST", credentials: "include" })
      )
    );
  } catch {
    // 로컬 상태는 이미 비웠으므로 네트워크 실패는 무시한다.
  }
}

export async function isAuthenticated() {
  if (isLogoutBlocked()) return false;

  try {
    const res = await fetch("/api/auth/session", { cache: "no-store", credentials: "include" });
    if (res.ok) {
      const json = await res.json();
      if (json.data?.authenticated) return true;
    }
    return await refreshSession();
  } catch {
    return false;
  }
}

export async function refreshSession() {
  if (isLogoutBlocked()) return false;

  try {
    const res = await fetch("/api/auth/refresh", { method: "POST", credentials: "include" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const requestInit = { ...init, credentials: init.credentials ?? "include" } satisfies RequestInit;
  const res = await fetch(input, requestInit);
  if (res.status !== 401) return res;

  if (isLogoutBlocked()) return res;

  const refreshed = await refreshSession();
  if (!refreshed) return res;
  return fetch(input, requestInit);
}

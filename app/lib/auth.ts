export function getValidToken(): string | null {
  if (typeof window === "undefined") return null;
  return "cookie-session";
}

export function clearToken() {
  // 이전 버전에서 저장했던 JWT를 정리하기 위한 호환 함수.
}

export async function logout() {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    // 로컬 상태는 이미 비웠으므로 네트워크 실패는 무시한다.
  }
}

export async function isAuthenticated() {
  try {
    const res = await fetch("/api/auth/session", { cache: "no-store" });
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
  try {
    const res = await fetch("/api/auth/refresh", { method: "POST" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const res = await fetch(input, init);
  if (res.status !== 401) return res;

  const refreshed = await refreshSession();
  if (!refreshed) return res;
  return fetch(input, init);
}

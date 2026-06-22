export function getValidToken(): string | null {
  if (typeof window === "undefined") return null;

  const token = localStorage.getItem("token");
  if (!token || token === "undefined" || token === "null" || isExpiredJwt(token)) {
    clearToken();
    return null;
  }

  return token;
}

export function clearToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("token");
}

function isExpiredJwt(token: string) {
  try {
    const [, payload] = token.split(".");
    if (!payload) return true;

    const normalizedPayload = payload
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(payload.length / 4) * 4, "=");
    const decoded = JSON.parse(atob(normalizedPayload)) as { exp?: number };

    if (!decoded.exp) return true;
    return decoded.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

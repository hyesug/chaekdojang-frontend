const SESSION_KEY = "chaekdojang_session_id";
const DEVICE_KEY = "chaekdojang_device_id";

function setIdentifierCookie(name: string, value: string, persistent: boolean) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  const maxAge = persistent ? "; Max-Age=31536000" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax${maxAge}${secure}`;
}

function readIdentifierCookie(name: string) {
  const prefix = `${name}=`;
  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length);
}

export function getSessionId() {
  if (typeof window === "undefined") return "";
  let value: string | undefined;
  try {
    value = sessionStorage.getItem(SESSION_KEY) ?? undefined;
  } catch {
    // 저장소 접근이 차단된 브라우저에서는 세션 쿠키만 사용한다.
  }
  value ||= readIdentifierCookie(SESSION_KEY);
  if (!value) {
    value = crypto.randomUUID();
    try {
      sessionStorage.setItem(SESSION_KEY, value);
    } catch {
      // 세션 쿠키가 동일 탭의 식별값을 유지한다.
    }
  }
  setIdentifierCookie(SESSION_KEY, value, false);
  return value;
}

export function getDeviceId() {
  if (typeof window === "undefined") return "";
  let value = readIdentifierCookie(DEVICE_KEY);
  try {
    value ||= localStorage.getItem(DEVICE_KEY) ?? undefined;
  } catch {
    // 저장소 접근이 차단된 브라우저에서는 영속 쿠키만 사용한다.
  }
  if (!value) {
    value = crypto.randomUUID();
    try {
      localStorage.setItem(DEVICE_KEY, value);
    } catch {
      // 영속 쿠키가 임의 기기 식별값을 유지한다.
    }
  }
  setIdentifierCookie(DEVICE_KEY, value, true);
  return value;
}

export function activityHeaders() {
  if (typeof window === "undefined") return {};
  return {
    "X-Chaekdojang-Session-Id": getSessionId(),
    "X-Chaekdojang-Device-Id": getDeviceId(),
  };
}

/**
 * profile.js — 로그인한 사람의 출생 정보 저장
 *
 * 책도장 백엔드(/api/fortune-profiles/me)에 한 벌만 저장한다. 로그인은
 * 책도장 쿠키 세션을 그대로 쓰므로, 로그인하지 않았으면 401 이 온다.
 * 접근 토큰이 만료됐을 수 있어 401 이면 한 번만 갱신하고 다시 묻는다
 * (app/lib/auth.ts 의 authFetch 와 같은 순서).
 *
 * boot.js 가 첫 화면에서 폼을 채우는 데 쓰므로 여기에는 import 를 두지 않는다.
 */

const ENDPOINT = '/api/fortune-profiles/me';

async function call(method, body) {
  const init = {
    method,
    credentials: 'include',
    cache: 'no-store',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  };
  let res = await fetch(ENDPOINT, init);
  if (res.status === 401) {
    const refreshed = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
      .then((r) => r.ok).catch(() => false);
    if (refreshed) res = await fetch(ENDPOINT, init);
  }
  return res;
}

/**
 * @returns {Promise<{loggedIn: boolean, profile: object|null}>}
 *   네트워크가 끊겼거나 서버가 내려가 있으면 로그인하지 않은 것처럼 다룬다.
 */
export async function loadProfile() {
  try {
    const res = await call('GET');
    if (res.status === 401 || res.status === 403) return { loggedIn: false, profile: null };
    if (!res.ok) return { loggedIn: false, profile: null };
    const json = await res.json();
    return { loggedIn: true, profile: json.data ?? null };
  } catch {
    return { loggedIn: false, profile: null };
  }
}

/** 화면의 form(양력으로 바꾼 값)을 그대로 저장한다 */
export async function saveProfile(form) {
  const res = await call('PUT', {
    name: form.name,
    gender: form.gender,
    year: form.year, month: form.month, day: form.day,
    hour: form.hour, minute: form.hour == null ? null : form.minute,
    birthPlace: form.birthPlace,
    homePlace: form.homePlace,
    dst: !!form.dst,
  });
  if (res.status === 401 || res.status === 403) throw new Error('로그인이 필요합니다.');
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.message ?? '저장하지 못했습니다.');
  }
}

export async function deleteProfile() {
  const res = await call('DELETE');
  if (!res.ok) throw new Error('삭제하지 못했습니다.');
}

/** 로그인 뒤 운세 화면으로 돌아오게 한다 */
export const loginUrl = () => '/auth/login?returnTo=' + encodeURIComponent(location.pathname);

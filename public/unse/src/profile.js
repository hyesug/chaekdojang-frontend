/**
 * profile.js — 로그인한 사람이 저장해 둔 출생 정보
 *
 * 책도장 백엔드에 여러 벌을 저장한다 — 본인 하나(`self`)와 가족·지인(최대 20).
 *   GET    /api/fortune-profiles        목록 (본인이 맨 앞)
 *   POST   /api/fortune-profiles        새로 저장 (처음 저장한 것이 본인 프로필)
 *   PUT    /api/fortune-profiles/{id}   고치기
 *   DELETE /api/fortune-profiles/{id}   지우기
 *   /api/fortune-profiles/me             본인 프로필 — 예전 화면과 호환
 * 로그인은 책도장 쿠키 세션을 그대로 쓰므로, 로그인하지 않았으면 401 이 온다.
 * 접근 토큰이 만료됐을 수 있어 401 이면 한 번만 갱신하고 다시 묻는다
 * (app/lib/auth.ts 의 authFetch 와 같은 순서).
 *
 * boot.js 가 첫 화면에서 폼을 채우는 데 쓰므로 여기에는 import 를 두지 않는다.
 */

const BASE = '/api/fortune-profiles';

async function call(method, path = '', body) {
  const init = {
    method,
    credentials: 'include',
    cache: 'no-store',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  };
  let res = await fetch(BASE + path, init);
  if (res.status === 401) {
    const refreshed = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
      .then((r) => r.ok).catch(() => false);
    if (refreshed) res = await fetch(BASE + path, init);
  }
  return res;
}

async function fail(res, fallback) {
  if (res.status === 401 || res.status === 403) throw new Error('로그인이 필요합니다.');
  const json = await res.json().catch(() => null);
  throw new Error(json?.message ?? fallback);
}

/** 화면의 form(양력으로 바꾼 값)에서 저장할 칸만 */
const bodyOf = (form) => ({
  name: (form.name || '').trim() || '이름 없음',
  gender: form.gender,
  year: form.year, month: form.month, day: form.day,
  hour: form.hour, minute: form.hour == null ? null : form.minute,
  birthPlace: form.birthPlace,
  homePlace: form.homePlace,
  dst: !!form.dst,
});

/**
 * 본인 프로필 하나.
 * @returns {Promise<{loggedIn: boolean, profile: object|null}>}
 *   네트워크가 끊겼거나 서버가 내려가 있으면 로그인하지 않은 것처럼 다룬다.
 */
export async function loadProfile() {
  try {
    const res = await call('GET', '/me');
    if (!res.ok) return { loggedIn: false, profile: null };
    const json = await res.json();
    return { loggedIn: true, profile: json.data ?? null };
  } catch {
    return { loggedIn: false, profile: null };
  }
}

/**
 * 저장한 사람 전부 — 본인이 맨 앞.
 * 서버가 아직 목록을 모르면(예전 판) 본인 프로필 하나로 대신한다.
 * @returns {Promise<{loggedIn: boolean, profiles: object[]}>}
 */
export async function loadProfiles() {
  try {
    const res = await call('GET');
    if (res.status === 401 || res.status === 403) return { loggedIn: false, profiles: [] };
    if (res.ok) {
      const json = await res.json();
      return { loggedIn: true, profiles: Array.isArray(json.data) ? json.data : [] };
    }
    const one = await loadProfile();
    return { loggedIn: one.loggedIn, profiles: one.profile ? [{ ...one.profile, self: true }] : [] };
  } catch {
    return { loggedIn: false, profiles: [] };
  }
}

/** 새 사람으로 저장한다 */
export async function createProfile(form) {
  const res = await call('POST', '', bodyOf(form));
  if (!res.ok) await fail(res, '저장하지 못했습니다.');
}

/** 저장해 둔 사람을 이 정보로 고친다 */
export async function updateProfile(id, form) {
  const res = await call('PUT', `/${id}`, bodyOf(form));
  if (!res.ok) await fail(res, '저장하지 못했습니다.');
}

export async function removeProfile(id) {
  const res = await call('DELETE', `/${id}`);
  if (!res.ok) await fail(res, '삭제하지 못했습니다.');
}

/** 로그인 뒤 운세 화면으로 돌아오게 한다 */
export const loginUrl = () => '/auth/login?returnTo=' + encodeURIComponent(location.pathname);

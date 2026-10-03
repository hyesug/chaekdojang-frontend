/** 현재 로그인 계정의 질문권 상태를 화면에만 전달한다. */
export async function loadCreditStatus(request = fetch) {
  try {
    const res = await request('/api/fortune-ai/credits/me', { credentials: 'include', cache: 'no-store' });
    if (res.status === 401 || res.status === 403) return { kind: 'logged-out' };
    if (!res.ok) return { kind: 'unavailable' };
    const json = await res.json();
    const totalBalance = json?.data?.balance?.totalBalance;
    if (!Number.isFinite(totalBalance)) return { kind: 'unavailable' };
    return totalBalance > 0 ? { kind: 'available', totalBalance } : { kind: 'exhausted', totalBalance: 0 };
  } catch {
    return { kind: 'unavailable' };
  }
}

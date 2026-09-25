/**
 * scenario/locationEvidence.js — **위치를 말할 계산 근거가 실제로 있는가**
 *
 * 구체성 게이트의 5단계(도시권)는 "위치 근거가 있을 때만" 열린다. 그런데
 * 그 근거를 아무도 만들어 주지 않아서 여태 **늘 닫혀 있었다.** 여기서
 * `hires/location.js` 의 릴로케이션·아스트로카토그래피를 그 자리에 잇는다.
 *
 * ── 이어 놓고 보니 대개 닫힌다 ─────────────────────────────
 * 명반 24장으로 재 봤다. 직업 주제에서 도시 후보가 하나라도 나온 명반은
 * **2장(8%)** 이고, 그중 **한 도시로 좁힌 것은 0장**이었다. 국내는 경도
 * 폭이 3도라 도시를 옮겨도 커스프가 몇 도 움직일 뿐이기 때문이다
 * (`compareZones` 주석에 이미 적혀 있던 사실이다).
 *
 * 그러니 이 모듈이 하는 일은 대부분 **"근거 없음"을 정확히 말하는 것**이다.
 * 열리는 드문 경우에만 열고, 그때도 한 도시로 좁히지 못하면 도시를 짚지
 * 않고 방위까지만 말한다.
 */

import { natalFortune } from '../index.js';
import {
  compareZones, localSpace, directionSignals, bearing, dir8,
} from '../../hires/location.js';

/** 분야 → 릴로케이션이 보는 주제 (`FOCUS_HOUSE` 와 같은 말) */
export const DOMAIN_FOCUS = {
  career: '직업', wealth: '돈',
  relationship: '관계', marriage: '관계',
  residence: '주거', movement: '주거',
};

/** "대전(북북서 140km — 달이 5하우스로)" 에서 도시와 방위를 꺼낸다 */
const parseRow = (s) => {
  const m = String(s).match(/^([^(]+)\(([^\s]+)\s+(\d+)km(?:\s*—\s*(.*))?\)$/);
  return m ? { city: m[1], dir: m[2], km: Number(m[3]), why: m[4] ?? null } : null;
};

/**
 * 그 분야에서 위치를 말할 근거가 있는가.
 *
 * @param {object} o birth · domain · (선택) fortune
 * @returns {{available, metro, candidates, direction, origin, basis, why, ...}}
 */
export function locationEvidenceFor(o = {}) {
  const { birth, domain } = o;
  const focus = DOMAIN_FOCUS[domain] ?? null;
  const no = (why, extra = {}) => ({
    available: false, metro: null, candidates: [], direction: null,
    what: '릴로케이션 · 아스트로카토그래피', domain, focus, why, ...extra,
  });

  if (!focus) return no('이 분야는 릴로케이션으로 볼 자리가 없다');

  let fortune = o.fortune ?? null;
  try {
    if (!fortune) ({ fortune } = natalFortune(birth));
  } catch {
    return no('명반을 세우지 못했다');
  }
  const input = fortune?.input;
  if (!input) return no('명반을 세우지 못했다');
  if (!input.timeKnown) return no('출생 시각을 알아야 하우스를 세울 수 있다');

  let z = null;
  try { z = compareZones(input); } catch { return no('도시 비교를 계산하지 못했다'); }
  if (!z || z.unavailable) return no(z?.unavailable ?? '도시 비교를 계산하지 못했다');
  if (z.noDifference) {
    return no('국내 어느 도시로 옮겨도 이 명반의 하우스 배치가 사실상 같다', {
      origin: z.origin, checked: z.checked, noDifference: true,
    });
  }

  const rows = (z.byFocus?.[focus] ?? []).map(parseRow).filter(Boolean);
  if (!rows.length) {
    return no(`기준 ${z.origin} 과 견주어 ${focus} 자리가 달라지는 도시가 없다`, {
      origin: z.origin, checked: z.checked,
      otherFocusHits: Object.entries(z.byFocus ?? {})
        .filter(([, v]) => v.length).map(([k]) => k),
    });
  }

  // 여러 신호가 같은 쪽을 가리키는가 (보강 근거)
  let repeated = [];
  try {
    const ls = localSpace(input.jdUT, input.home.lat, input.home.lon);
    const br = bearing(input.place, input.home);
    repeated = directionSignals({ localSpaceRows: ls, moveBearing: br }).repeated ?? [];
  } catch { /* 보강일 뿐이라 없으면 없는 대로 간다 */ }

  const dirs = [...new Set(rows.map((r) => r.dir))];
  const oneDir = dirs.length === 1 ? dirs[0] : null;
  const corroborated = oneDir
    ? repeated.find((x) => x.dir === dir8FromKo(oneDir)) ?? null : null;

  // **한 도시로 좁히는 것은 후보가 하나일 때뿐이다.** 넷이 나란히 걸리면
  // 그중 하나를 고르는 일은 계산이 아니라 목록 순서를 고르는 일이다
  const metro = rows.length === 1 ? rows[0].city : null;

  return {
    available: true,
    metro,
    candidates: rows,
    direction: oneDir
      ? { dir: oneDir, corroborated: !!corroborated, from: corroborated?.from ?? [] }
      : null,
    origin: z.origin,
    checked: z.checked,
    focus, domain,
    what: '릴로케이션 · 아스트로카토그래피',
    basis: rows.map((r) => `${r.city}(${r.dir} ${r.km}km)${r.why ? ` — ${r.why}` : ''}`),
    why: metro
      ? null
      : `${focus} 자리가 달라지는 도시가 ${rows.length}곳 나란히 걸려 한 곳으로 좁히지 못한다`,
    caveat: '같은 명반을 그 도시 좌표에 다시 세웠을 때 달라지는 것을 적은 것이고, '
      + '명반이 그 도시를 가리킨 것이 아니다',
  };
}

/** 16방위 한글 → 8방위 (directionSignals 가 8방위로 묶는다) */
function dir8FromKo(ko) {
  const DEG = {
    북: 0, 북북동: 22.5, 북동: 45, 동북동: 67.5, 동: 90, 동남동: 112.5,
    남동: 135, 남남동: 157.5, 남: 180, 남남서: 202.5, 남서: 225, 서남서: 247.5,
    서: 270, 서북서: 292.5, 북서: 315, 북북서: 337.5,
  };
  const d = DEG[ko];
  return d == null ? null : dir8(d);
}

/**
 * 게이트에 넘길 근거로 쓸 수 있는가.
 *
 * **도시를 한 곳으로 좁혔을 때만** 5단계를 연다. 후보가 여럿이면 그것은
 * 방위까지의 이야기이고, 도시권을 말할 근거가 아니다.
 */
export const asGateEvidence = (ev) => (ev?.available && ev.metro ? ev : null);

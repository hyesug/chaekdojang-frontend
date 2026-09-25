/**
 * timing.js — **분야마다 어느 해가 켜지는가. 사건마다 창을 따로.**
 *
 * 여태 시기는 "2028년이 가장 강합니다" 한 줄로 나갔다. 창이 하나뿐이라
 * "첫째는 언제, 둘째는 언제"를 물으면 답할 자리가 없었다. 그런데 계산은
 * 이미 다 하고 있었다 — 세운 십성, 대한 사화가 떨어지는 궁, 다샤 전환일.
 * **꺼내서 한 축에 놓지 않았을 뿐이다.**
 *
 * ── 세 체계를 한 축에 놓는다 ────────────────────────────────
 *   사주 — 그 해 세운의 십성이 그 분야를 뜻하는 무리인가 (천간·지지 따로)
 *   자미 — 대한·유년 사화가 그 분야의 궁에 떨어지는가
 *   베딕 — 그 분야를 켜는 행성(activators)의 다샤가 시작되는가 (**날짜까지**)
 *
 * 점수를 섞지 않는다. **몇 체계가 같은 해를 짚었는지**로만 줄을 세운다 —
 * 이 저장소에서 가중합은 세 번 다 실패했다(README 의 융합 표).
 *
 * ── 반드시 함께 읽을 것 ─────────────────────────────────────
 * **이 순위는 검증에서 기준선을 넘지 못했다.** 달 단위 p=0.868, 해 단위
 * p=0.196. 그러니 이것은 "그 해에 일어난다"가 아니라 **"이 사람의 여러 해
 * 가운데 앞쪽"** 이라는 뜻이고, `MEASURED` 에 그 문장을 담아 함께 내보낸다.
 * 다만 **한 번만** 말한다 — 문장마다 붙이면 답이 아니라 면책조항이 된다.
 */
import { TEN_GOD_GROUP } from '../../core/ganzhi.js';
import { j } from '../../core/josa.js';
import { annualTrack } from '../../hires/bazi.js';
import { buildBoard, decadeLimits, annualLayer, sihwaOn, palaceBranch, DOMAIN_PALACES }
  from '../../hires/ziwei.js';
import { dashaTree, dashaChanges } from '../../hires/vedic.js';
import { packFor } from '../../hires/vedicExt.js';

/** 시기 순위에 반드시 따라붙는 실측. **답 전체에서 한 번만** 쓴다 */
export const MEASURED =
  '이 순위는 저희가 검증했을 때 기준선을 넘지 못했습니다(해 단위 p=0.196, 달 단위 p=0.868).'
  + ' "그 해에 일어난다"가 아니라 "이 사람의 여러 해 가운데 앞쪽"이라는 뜻입니다.';

/**
 * 분야를 보는 십성 무리 — 성별로 갈린다.
 *
 * **건강은 넣지 않았다.** 사주에서 건강은 일간의 강약과 조후로 보는 것이라
 * 십성 하나로 옮길 수가 없다. 억지로 배정하면 없는 규칙을 만드는 것이다.
 */
export const DOMAIN_GOD = {
  자녀: { female: '식상', male: '관성' },
  결혼: { female: '관성', male: '재성' },
  관계: { female: '관성', male: '재성' },
  직업: { female: '관성', male: '관성' },
  재물: { female: '재성', male: '재성' },
  학업: { female: '인성', male: '인성' },
  주거: { female: '인성', male: '인성' },
  이사: { female: '인성', male: '인성' },
};

/** 사주 — 세운 십성이 그 분야의 무리인가 */
function sajuYears(input, chart, domain, from, to) {
  const g = DOMAIN_GOD[domain]?.[chart.gender === 'female' ? 'female' : 'male'];
  if (!g) return [];
  let track = [];
  try { track = annualTrack(input, chart, from, to); } catch { return []; }

  const out = [];
  for (const r of track) {
    const why = [];
    if (TEN_GOD_GROUP[r.god] === g) why.push(`천간 ${r.god}`);
    if (TEN_GOD_GROUP[r.branchGod] === g) why.push(`지지 ${r.branchGod}`);
    if (!why.length) continue;
    out.push({
      year: r.year, age: r.age, system: '사주', n: why.length,
      why: `세운 ${r.gz?.hanja ?? ''} ${why.join('·')} — ${g}이 그 해에 들어온다`,
    });
  }
  return out;
}

/**
 * 그 분야를 보는 **주궁 하나**.
 *
 * `DOMAIN_PALACES` 는 "몇 겹이 겹치는가"를 세려고 곁궁까지 넣은 표라
 * 시기에 그대로 쓰면 안 된다. 실제로 그대로 썼더니 **자녀 시기에
 * "태음 화록→부처궁"이 표로 들어왔다** — 배우자 자리가 켜진 것을 자녀
 * 시기로 센 것이다. 시기는 그 분야의 자리가 켜져야 시기다.
 */
export const PRIMARY_PALACE = {
  자녀: '자녀궁', 결혼: '부처궁', 관계: '부처궁', 직업: '관록궁',
  재물: '재백궁', 주거: '전택궁', 이사: '천이궁', 학업: '관록궁', 건강: '질액궁',
};

/** 자미 — 유년 사화가 그 분야의 **주궁**에 떨어지는 해 */
function ziweiYears(input, domain, from, to) {
  let b = null;
  try { b = buildBoard(input); } catch { return []; }
  const name = PRIMARY_PALACE[domain];
  if (!name) return [];
  const target = palaceBranch(b.myeong, name);
  if (target == null) return [];

  const out = [];
  for (let y = from; y <= to; y++) {
    try {
      const hits = (annualLayer(b, y).sihwa ?? []).filter((s) => s.branch === target);
      if (!hits.length) continue;
      out.push({
        year: y, age: y - input.year, system: '자미두수', n: 1,
        why: `유년 사화 ${j(hits.map((h) => `${h.star} ${h.kind}`).join('·'), '이')} ${name}에`,
      });
    } catch { /* 그 해만 건너뛴다 */ }
  }
  return out;
}

/**
 * 자미 대한 — **열 해짜리 배경이라 표를 주지 않는다.**
 *
 * 처음에는 대한이 켜진 열 해에 해마다 한 표씩 줬는데, 그러면 십 년이
 * 통째로 켜져서 창이 16년까지 벌어졌다. **십 년 구간은 어느 해인지 고를
 * 수 없다.** 배경으로 따로 적고 해를 고르는 일에서는 뺀다.
 */
function ziweiBackground(input, domain, from, to) {
  let b = null;
  try { b = buildBoard(input); } catch { return []; }
  const name = PRIMARY_PALACE[domain];
  if (!name) return [];
  const target = palaceBranch(b.myeong, name);
  if (target == null) return [];

  const out = [];
  try {
    for (const d of decadeLimits(input, b)) {
      if (d.toYear < from || d.fromYear > to) continue;
      const hits = sihwaOn(b.board, d.stem).filter((s) => s.branch === target);
      if (!hits.length) continue;
      out.push(`대한 ${d.fromYear}~${d.toYear}(${d.fromAge}~${d.toAge}세) — `
        + `${j(hits.map((h) => `${h.star} ${h.kind}`).join('·'), '이')} ${name}에 든다`);
    }
  } catch { /* 배경만 건너뛴다 */ }
  return out;
}

/**
 * 베딕 — 그 분야를 켜는 행성의 다샤가 시작되는 해. **날짜까지 낸다.**
 *
 * **MD·AD 만 센다.** PD 까지 세었더니 한 해에 여섯 번씩 울려서 베딕이
 * 모든 해에 표를 줬다 — PD 는 몇 주에서 몇 달짜리 하위 구간이라 해를
 * 고르는 눈금이 아니다.
 */
function vedicYears(input, domain, from, to) {
  let act = [];
  try { act = packFor(input, domain)?.data?.activators ?? []; } catch { return []; }
  if (!act.length) return [];

  let changes = [];
  try { changes = dashaChanges(dashaTree(input), from, to); } catch { return []; }

  return changes
    .filter((c) => (c.level === 'MD' || c.level === 'AD') && act.includes(c.lord))
    .map((c) => ({
      year: c.from.y, age: c.from.y - input.year, system: '베딕',
      n: c.level === 'MD' ? 2 : 1,   // MD 는 십수 년짜리 큰 전환이라 두 표
      why: `${c.level} ${c.lord} 시작 (${c.from.y}년 ${c.from.m}월`
        + `${c.from.d ? ` ${c.from.d}일` : ''}) — ${c.lord}은 이 분야를 켜는 행성`,
    }));
}

/**
 * 한 분야의 해를 줄 세운다.
 *
 * **몇 체계가 짚었는가**를 먼저 보고, 같으면 표 수로 가른다. 한 체계가
 * 여러 표를 몰아줘서 이기지 못하게 하려는 것이다 — 이 저장소에서 수가 많은
 * 쪽(간접 11개)이 이겨 버린 적이 있다.
 */
export function timingFor(input, chart, domain, { from, to } = {}) {
  const y0 = from ?? input.currentYear;
  const y1 = to ?? (y0 + 15);

  const all = [
    ...sajuYears(input, chart, domain, y0, y1),
    ...ziweiYears(input, domain, y0, y1),
    ...vedicYears(input, domain, y0, y1),
  ];
  if (!all.length) return { rows: [], windows: [], measured: MEASURED };

  const byYear = new Map();
  for (const r of all) {
    if (!byYear.has(r.year)) {
      byYear.set(r.year, { year: r.year, age: r.age, n: 0, systems: new Set(), why: [] });
    }
    const y = byYear.get(r.year);
    y.n += r.n;
    y.systems.add(r.system);
    y.why.push(`${r.system}: ${r.why}`);
  }

  const rows = [...byYear.values()]
    .map((y) => ({ ...y, systems: [...y.systems] }))
    .sort((a, b) => b.systems.length - a.systems.length || b.n - a.n || a.year - b.year);

  return {
    rows,
    windows: windowsOf(rows, 2, input.year),
    background: ziweiBackground(input, domain, y0, y1),
    measured: MEASURED,
  };
}

/**
 * 붙어 있는 해를 창으로 묶는다.
 *
 * 달까지 좁히지 않는다 — 달 단위는 검증에서 기준선보다 나빴다(p=0.868).
 * 해를 묶어 "2028~2029" 까지가 이 엔진이 낼 수 있는 폭이다.
 */
export function windowsOf(rows, minSystems = 2, birthYear = null) {
  const lit = rows.filter((r) => r.systems.length >= minSystems).map((r) => r.year).sort((a, b) => a - b);
  if (!lit.length) return [];

  const spans = [];
  let s = lit[0], p = lit[0];
  for (const y of lit.slice(1)) {
    if (y === p + 1) { p = y; continue; }
    spans.push([s, p]); s = y; p = y;
  }
  spans.push([s, p]);

  const by = birthYear ?? (rows[0] ? rows[0].year - rows[0].age : null);
  // 창의 힘 = 그 창 안에서 가장 센 해의 체계 수
  return spans.map(([a, b]) => {
    const inside = rows.filter((r) => r.year >= a && r.year <= b);
    const best = inside.reduce((x, y) => (y.systems.length > x.systems.length ? y : x), inside[0]);
    return {
      from: a, to: b,
      span: a === b ? `${a}년` : `${a}~${b}년`,
      ageLabel: by == null ? '' : a === b ? `${a - by}세` : `${a - by}~${b - by}세`,
      systems: best.systems, n: best.n, best: best.year,
    };
  }).sort((x, y) => y.systems.length - x.systems.length || y.n - x.n || x.from - y.from);
}

/**
 * 같은 분야에서 **일이 두 번 있을 수 있는 자리**에 창을 나눠 준다.
 *
 * 자녀(첫째·둘째)처럼 되풀이되는 일이 그렇다. 규칙은 하나뿐이다 —
 * **첫 창 다음에 오는 창을 둘째로 본다.** 없는 계산을 만드는 것이 아니라
 * 창 목록을 순서대로 읽는 것이고, 그 규칙을 밝혀서 적는다.
 */
export function sequenceOf(windows, labels) {
  // **시간 순으로** 이름을 붙인다. `windows` 는 센 순으로 정렬돼 있어서
  // 그대로 쓰면 나중 창이 '첫째'가 된다 — 첫째는 먼저 오는 창이다.
  const inTime = [...windows].sort((a, b) => a.from - b.from);
  return labels
    // 스프레드가 뒤에 오면 창의 필드가 label 을 덮어쓴다. 순서를 지킬 것
    .map((label, i) => (inTime[i] ? { ...inTime[i], label } : null))
    .filter(Boolean);
}

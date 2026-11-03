/**
 * evidence.js — 답이 인용할 수 있는 계산값에 번호를 붙인다 (근거 추적)
 *
 * AI 는 계산값을 문장으로 옮기다가 궁·사화·층을 바꿔 적거나 없는 배치를 만든다.
 * 그래서 중요한 계산값마다 번호([SJ3]·[ZW8]·[TM4])를 붙여 문맥에 싣고, 답은 그 번호를
 * 인용하게 한다. 화면은 번호를 **엔진이 만든 이름표**로 바꿔 보여 주므로, 근거 줄에 찍히는
 * 계산값은 모델이 쓴 글자가 아니라 계산 결과 그대로다. 문맥에 없는 번호는 answerCheck 가 지운다.
 *
 * - 출생 명반(캐시되는 문맥): 체계별 facts 에 번호를 붙인다. 번호는 facts 배열의 원래 순서라
 *   aiContext.js 의 접은 줄과 이 파일의 근거 목록이 늘 같은 번호를 쓴다.
 * - 시기·층(질문마다 바뀌는 문맥): 고해상도 계산 JSON 에서 핵심 값만 골라 TM 번호를 붙인다.
 *   질문마다 번호가 바뀌므로 저장·이력에는 번호 대신 이름표로 바꿔 둔다(resolveEvidence).
 *
 * 화면·서버가 함께 쓰는 순수 함수만 둔다(DOM 없음).
 */

/** 체계 id → 번호 머리 두 글자 */
export const EVIDENCE_PREFIX = {
  saju: 'SJ', jamidusu: 'ZW', astrology: 'WS', vedic: 'VD', juyeok: 'JY', yukim: 'YI',
  hongguk: 'HG', taeeul: 'TE', gujeong: 'GJ', sukyo: 'SY', tojeong: 'TJ', kabbalah: 'KB',
  mahabote: 'MB', thai: 'TH', tarot: 'TR',
};
/** 시기·층 값(질문마다 새로 계산)의 머리 */
export const TIME_PREFIX = 'TM';

/** 답에서 번호를 찾는 정규식. "[A]"·"[직업]" 같은 문맥 꼬리표와 겹치지 않게 대문자 둘 + 숫자로만 */
export const EVIDENCE_ID = /\[([A-Z]{2}\d{1,3})\]/g;
/** 확인을 거쳐 이름표로 바뀐 근거. 모델이 직접 쓴 것은 answerCheck 가 풀어 버린다 */
export const CHIP = /⟦([^⟦⟧\n]{1,80})⟧/g;

/** 접은 facts 줄과 근거 목록이 함께 쓰는 개수 상한 (aiContext.js foldFacts 기본값과 같다) */
export const FACTS_MAX = 10;

const CHIP_MAX = 46;
const clip = (s, n = CHIP_MAX) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`;
};

/** facts 하나의 번호. 값이 비어 접은 줄에서 빠진 칸은 번호도 없다 */
export function factId(sysId, index) {
  const p = EVIDENCE_PREFIX[sysId];
  return p ? `${p}${index + 1}` : null;
}
export const hasValue = (f) => !!f?.value && f.value !== '—';

/**
 * 계산값을 읽을 때 걸리기 쉬운 한계. 근거 이름표의 풀이(title)로 붙인다.
 * 프롬프트의 '계산값을 잘못 읽기 쉬운 자리'와 같은 내용을 값 옆에 둔다.
 */
function limitsOf(sysId, label, value) {
  const v = String(value ?? '');
  if (sysId === 'saju' && label === '십신') return '천간·대표 지장간만 센 값 — 0이어도 지장간에 숨어 있을 수 있다';
  if (sysId === 'saju' && label === '오행') return '사주 원국 기준 — 다른 체계의 오행과 더하지 않는다';
  if (sysId === 'jamidusu' && /공궁/.test(v)) return '공궁은 맞은편 궁의 별을 빌려 읽는다';
  if (sysId === 'vedic' && /D\d/.test(label + v)) return 'D1·D9·D10 의 하우스와 궁주를 섞지 않는다';
  return '';
}

/**
 * 출생 명반의 근거 목록.
 * @param {{results: {id,name,facts}[]}} r readFortune 결과
 * @returns {{id,system,field,value,note,limits}[]}
 */
export function natalLedger(r) {
  const out = [];
  for (const sys of r?.results ?? []) {
    (sys.facts ?? []).slice(0, FACTS_MAX).forEach((f, i) => {
      const id = factId(sys.id, i);
      if (!id || !hasValue(f)) return;
      out.push({ id, system: sys.name, field: f.label, value: String(f.value), note: f.note ?? '', limits: limitsOf(sys.id, f.label, f.value) });
    });
  }
  return out;
}

/**
 * 궁합의 근거 목록 — 체계별로 두 사람을 견준 facts(compareFortune 결과). 번호 매기는 법은 natalLedger 와 같다.
 * 이름표 체계 이름에 '궁합'을 붙여 한 사람의 값이 아니라 두 사람을 견준 값임을 드러낸다.
 * @param {{results: {id,name,facts}[]}} c compareFortune 결과
 */
export function pairLedger(c) {
  return natalLedger({ results: (c?.results ?? []).map((x) => ({ ...x, name: `${x.name} 궁합` })) });
}

/**
 * 궁합의 시기·층 근거 — 두 사람의 결혼 자리 신호가 해마다 어디서 켜지는지(hires/pair.js marriageWindow).
 * 결혼 시기를 점치는 값이 아니라 두 사람의 흐름이 겹치는 해라는 한계를 붙인다.
 */
export function pairTimeLedger(mw, max = 12) {
  const rows = [];
  const sys = (x) => (x?.systems?.length ? x.systems.join('·') : '없음');
  for (const r of mw?.rows ?? []) {
    rows.push({ system: '두 사람', field: `${r.year} 관계 자리 신호`,
      value: `첫째 ${sys(r.a)} / 둘째 ${sys(r.b)}${r.both ? ` · 함께 켜짐${r.sharedSystems?.length ? `(같은 체계 ${r.sharedSystems.join('·')})` : ''}` : ''}`,
      note: '', limits: '두 사람 흐름이 겹치는 해 — 결혼 시기 예측이 아니다(사례 검증 미통과)' });
  }
  return rows.slice(0, max).map((x, i) => ({ id: `${TIME_PREFIX}${i + 1}`, ...x }));
}

/** 자미두수 궁 한 줄 — 고해상도 ziweiPalaces 의 행 */
function palaceRow(row) {
  const bits = [`${row.layer} ${row.palace} ${row.branchName}${row.natalPalace && row.natalPalace !== row.palace ? `(원국 ${row.natalPalace})` : ''}`];
  bits.push(row.main?.length ? `주성 ${row.main.join('·')}` : '공궁');
  if (row.sihwa?.length) bits.push(`사화 ${row.sihwa.join('·')}`);
  if (row.lucky?.length) bits.push(`길성 ${row.lucky.join('·')}`);
  if (row.evil?.length) bits.push(`살성 ${row.evil.join('·')}`);
  if (!row.main?.length && row.opposite) bits.push(`대궁 ${row.opposite}`);
  return bits.join(' · ');
}

/**
 * 질문마다 다시 만드는 시기·층 근거 목록. 고해상도 계산 JSON(buildHiRes().json)에서
 * **경계가 확정 계산인 값**만 고른다 — 10년 운·그해 운·대한·유년·다샤·분야 핵심 궁·교차 신호.
 * 해석 문장은 싣지 않는다. 그건 문맥 본문에 이미 있다.
 * @param {object} j buildHiRes().json
 * @param {number} [max] 상한 — 질문마다 정가로 나가는 자리라 짧게
 */
export function timeLedger(j, max = 26) {
  if (!j) return [];
  const rows = [];
  const add = (system, field, value, limits = '') => { if (value) rows.push({ system, field, value: String(value), note: '', limits }); };

  const d = j.bazi?.decadeLuck;
  if (d) add('사주', '지금 10년 운(대운)', `${d.gz}(${d.god}) ${d.fromAge}~${d.toAge}세 · 다음 ${d.next ?? '없음'}`);
  for (const y of (j.bazi?.annual ?? []).slice(0, 6)) {
    add('사주', `${y.year} 그해 운(세운)`, `${y.gz} ${y.god}${y.hits?.length ? ` · ${y.hits.join('·')}` : ''}${y.daeunTurn ? ' · 대운 전환' : ''}`);
  }

  const z = j.ziwei;
  if (z && !z.unavailable) {
    if (z.natal?.sihwa?.length) add('자미두수', '생년사화', z.natal.sihwa.join(' '), '별@지지 — 그 지지에 놓인 원국 궁에서 읽는다');
    if (z.decade) add('자미두수', `대한 ${z.decade.span}`, `명궁 ${z.decade.myeong}(원국 ${z.decade.natalPalace}) ${z.decade.stars?.join('·') || '공궁'} · 대한사화 ${z.decade.sihwa?.join(' ') ?? ''}`.trim(), '사주 대운과 다른 10년 운');
    for (const y of (z.annual ?? []).slice(0, 4)) add('자미두수', `${y.year} 유년`, `명궁 ${y.myeong}(원국 ${y.natalPalace}) · 유년사화 ${y.sihwa?.join(' ') ?? ''}`.trim());
    // 분야 핵심 궁(직업=관록궁, 재물=재백궁 …)의 층별 행. 명궁은 어느 분야에나 끼니 핵심 궁을 먼저
    for (const g of (j.ziweiPalaces ?? []).slice(0, 2)) {
      const core = g.palaces?.find((p) => p.palace !== '명궁') ?? g.palaces?.[0];
      for (const row of (core?.rows ?? []).slice(0, 3)) add('자미두수', `[${g.domain}] ${row.layer} ${row.palace}`, palaceRow(row));
    }
  }

  const v = j.vedic?.dasha;
  if (v?.now) add('베딕', '다샤(지금 구간)', v.now);
  const ad = (v?.changes ?? []).filter((c) => /^AD /.test(c)).slice(0, 2);
  if (ad.length) add('베딕', '다음 안타르다샤 전환', ad.join(' / '));

  for (const s of (j.yearTiming?.solarArc ?? []).slice(0, 2)) {
    add('점성술', `${s.year} 솔라 아크`, `${s.label} (오차 ${Number(s.orb).toFixed(2)}°)`, '연 1° 진행 — 해 단위로만 읽는다');
  }
  for (const w of (j.timingWindows ?? []).slice(0, 3)) {
    add('종합', `[${w.domain}] 시기 창`, `${w.label} ${w.band}${w.systems?.length ? ` (${w.systems.join('·')})` : ''}`, '여러 체계가 함께 켜진 구간 — 사건 확정이 아님');
  }
  // 단언 등급 — 사건 판정의 리딩 신뢰도 상한이 여기에 묶인다(prompt.ts MODULES.event)
  for (const t of j.tiers ?? []) {
    if (t.tier) add('종합', `[${t.domain}] 단언 등급`, `${t.tier}${t.voice ? `(${t.voice})` : ''}${t.window ? ` · 핵심 구간 ${t.window}` : ''}`, '근거가 모인 세기 — 어떤 사건인지가 아니라 그 분야가 움직이는 세기');
  }
  for (const c of j.crossValidation?.byDomain ?? []) {
    if (c.confidence?.grade) add('종합', `[${c.domain}] 교차 신호`, `${c.confidence.grade} — ${c.systems?.join('·') || '없음'}${c.conflicts?.length ? ` · 상충 ${c.conflicts.join('·')}` : ''}`, '같은 출생 정보를 다르게 읽은 것이라 독립된 검증이 아니다');
  }
  return rows.slice(0, max).map((x, i) => ({ id: `${TIME_PREFIX}${i + 1}`, ...x }));
}

/** 근거 목록을 문맥에 싣는 글 (질문별 고해상도 계산 뒤에 붙는다) */
export function formatLedger(entries, title = '근거 번호 — 이 질문의 시기·층 값') {
  if (!entries?.length) return '';
  // 같은 한계 문구는 처음 한 번만 — 질문마다 정가로 나가는 자리다
  const said = new Set();
  const note = (e) => { if (!e.limits || said.has(e.limits)) return ''; said.add(e.limits); return ` ※${e.limits}`; };
  return [`## ${title}`,
    '답에서 중요한 근거는 이 번호를 그대로 인용한다(예: [TM2]). 화면에서 번호가 이 값의 이름표로 바뀐다.',
    ...entries.map((e) => `[${e.id}] ${e.system} · ${e.field}: ${e.value}${note(e)}`),
  ].join('\n');
}

/** 화면에 찍힐 이름표 — 체계 · 항목 값 */
export function chipLabel(e) {
  return clip(`${e.system} · ${e.field} ${e.value}`);
}

/** 번호 → 근거 */
export function ledgerMap(...lists) {
  const m = new Map();
  for (const list of lists) for (const e of list ?? []) m.set(e.id, e);
  return m;
}

/**
 * 답의 번호를 이름표로 바꾼다. 목록에 없는 번호는 지운다(answerCheck 가 먼저 지우지만 한 번 더).
 * 같은 줄에서 같은 근거가 되풀이되면 한 번만 남긴다.
 * @param {string} text
 * @param {Map<string, object>} map ledgerMap
 */
export function resolveEvidence(text, map) {
  return String(text ?? '').split('\n').map((line) => {
    const seen = new Set();
    return line.replace(/\s?\[([A-Z]{2}\d{1,3})\]/g, (all, id) => {
      const e = map?.get(id);
      if (!e || seen.has(id)) return '';
      seen.add(id);
      return `${all.startsWith(' ') ? ' ' : ''}⟦${chipLabel(e)}⟧`;
    });
  }).join('\n');
}

/**
 * 모델에게 되돌려 보낼 때(대화 이력)는 이름표를 평문으로 푼다.
 * 이름표 꼴을 그대로 보내면 모델이 그 꼴을 흉내 내 **확인되지 않은 이름표**를 쓸 수 있다.
 */
export function plainEvidence(text) {
  return String(text ?? '').replace(CHIP, (_, label) => `(${label})`);
}

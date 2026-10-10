/**
 * multilayerInterpretation.js — 계산 결과를 '해석 근거'로 다시 정리한다
 *
 * 여기서는 아무것도 새로 계산하지 않는다. engine·forecast 가 이미 구한 값을
 * 세는 일만 한다. 계산식을 한 줄이라도 여기로 옮기면 화면에 뜨는 숫자와
 * 모델이 보는 숫자가 갈라지므로, 원본에서 뽑아 쓰기만 한다.
 *
 * 왜 필요한가.
 *   열다섯 체계를 그대로 실어 주면 모델은 "직장운이 좋습니다"까지밖에
 *   못 간다. 어느 체계 몇 개가 같은 쪽을 가리키는지, 그게 어느 달에
 *   겹치는지를 모델이 매번 눈대중으로 세기 때문이다. 세는 일은 코드가
 *   정확하므로 코드가 하고, 모델은 그 위에서 사건을 추론하게 한다.
 *
 * 핵심 넷(사주·자미두수·점성술·베딕)만 센다. 나머지 열하나는 확인용이라
 * 여기에 넣지 않는다 — 넣으면 요일 하나로 보는 체계가 여덟 항목을 따지는
 * 체계와 같은 한 표가 되어 개수가 곧 잡음이 된다.
 */

import { SYSTEMS } from './engine.js';

/** 명반을 통째로 세우는 넷. 결론의 무게는 여기서만 나온다 */
export const CORE_IDS = ['saju', 'jamidusu', 'astrology', 'vedic'];

/**
 * 주제 — forecast 가 실제로 계산하는 영역만 쓴다.
 *
 * '이사', '창업', '주거' 같은 것은 지금 엔진이 따로 재지 않는다. 주제로
 * 세워 두면 모델이 근거 없이 그 칸을 채우게 되므로 만들지 않는다.
 */
export const THEMES = [
  { key: '직업', area: '직장운', domain: '직업' },
  { key: '재물', area: '금전운', domain: '재물' },
  { key: '관계', area: '애정운', domain: '관계' },
  { key: '학업', area: '학업운', domain: '학업' },
  { key: '건강', area: '건강운', domain: '건강' },
];

// 50이 보통이다. ±5 안쪽은 '그 체계가 이 주제에 대해 할 말이 없다'로 본다.
// 트랜싯이 없는 해의 점성술이 정확히 50을 내놓는 것이 그 예다.
const UP = 55;
const DOWN = 45;

const NAME_TO_ID = new Map(SYSTEMS.map((s) => [s.meta.name, s.meta.id]));
const ID_TO_NAME = new Map(SYSTEMS.map((s) => [s.meta.id, s.meta.name]));

const dir = (v) => (v == null ? null : v >= UP ? '순풍' : v <= DOWN ? '역풍' : '중립');

/**
 * 한 주제에 대해 핵심 넷이 어느 쪽을 가리키는지 센다.
 *
 * 원국(타고난 구성)과 올해(시기)를 따로 들고 다닌다. 둘이 어긋나는 것은
 * 오류가 아니라 정보다 — 타고나길 약한 자리에 올해만 힘이 실리는 경우와
 * 그 반대는 사람에게 전혀 다르게 나타난다.
 */
function scoreTheme(theme, natalById, yearById) {
  const rows = [];
  for (const id of CORE_IDS) {
    const natal = natalById.get(id)?.signals?.domains?.[theme.domain] ?? null;
    const year = yearById.get(id)?.areas?.[theme.area] ?? null;
    const present = natalById.has(id) || yearById.has(id);
    if (!present) continue; // 시각 미상으로 아예 안 돌아간 체계
    rows.push({ id, name: ID_TO_NAME.get(id) ?? id, natal, year, dir: dir(year) });
  }

  const up = rows.filter((x) => x.dir === '순풍');
  const down = rows.filter((x) => x.dir === '역풍');
  const flat = rows.filter((x) => x.dir === '중립');

  const agree = Math.max(up.length, down.length);
  const oppose = Math.min(up.length, down.length);
  const level = agree >= 3 && oppose < agree ? '강함'
    : agree >= 2 && oppose < agree ? '중간'
    : '약함';

  return {
    key: theme.key,
    area: theme.area,
    rows,
    up: up.map((x) => x.name),
    down: down.map((x) => x.name),
    flat: flat.map((x) => x.name),
    conflict: up.length > 0 && down.length > 0,
    level,
    // 현실 조건(회사 규모·지역 같은 것)까지 좁혀도 되는지. 약한 신호에서는 막는다.
    mayNarrow: level !== '약함',
  };
}

/** 절기월 열둘 가운데 앞 여섯이 상반기(입춘~입추 전), 뒤 여섯이 하반기다 */
const half = (startI, endI) =>
  endI < 6 ? '상반기' : startI >= 6 ? '하반기' : '상·하반기 걸침';

/** 이어지는 절기월을 한 구간으로 묶는다 */
function groupWindows(months, timeline) {
  const out = [];
  let run = null;
  for (const m of months) {
    if (run && m.i === run.endI + 1) { run.endI = m.i; run.who = [...new Set([...run.who, ...m.who])]; continue; }
    if (run) out.push(run);
    run = { startI: m.i, endI: m.i, who: [...m.who] };
  }
  if (run) out.push(run);

  return out.map((w) => {
    const from = timeline[w.startI].from;
    const next = timeline[w.endI + 1];
    return {
      // 마지막 절기월(축월)은 이듬해 입춘에 끝난다. '연말'이라 적으면 달력 12월로 읽힌다.
      label: next
        ? `${from.m}/${from.d}~${next.from.m}/${next.from.d}`
        : `${from.m}/${from.d}~ 입춘 전`,
      half: half(w.startI, w.endI),
      who: w.who,
      months: w.endI - w.startI + 1,
    };
  });
}

// 한 해에서 뽑을 구간의 최대 달 수. 열두 달 중 열 달이 '적기'로 잡히면
// 시기를 좁힌 것이 아니다. 절대 점수만 보면 실제로 그렇게 된다 —
// 달마다의 점수가 원래 50 위쪽에 몰려 있기 때문이다.
const PICK = 3;

/**
 * 절기월 열둘 가운데 '이 사람의 한 해 안에서' 가장 두드러진 구간을 찾는다.
 *
 * 기준이 둘이다. 하나는 순위 — 열두 달을 핵심 넷의 평균으로 세워 위아래
 * 세 달씩만 고른다. 다른 하나는 합의 — 그 달에 핵심 둘 이상이 실제로 같은
 * 쪽이어야 한다. 순위만 쓰면 평탄한 해에도 억지로 적기가 생기고, 합의만
 * 쓰면 열 달이 전부 적기가 된다. 둘 다 넘은 달만 남긴다.
 */
function timingWindows(theme, timeline) {
  const rows = timeline.map((m, i) => {
    const voices = m.areas?.[theme.area]?.voices ?? [];
    const core = voices
      .map((v) => ({ id: NAME_TO_ID.get(v.name), name: v.name, score: v.score }))
      .filter((v) => CORE_IDS.includes(v.id));
    const mean = core.length
      ? core.reduce((a, v) => a + v.score, 0) / core.length
      : null;
    return {
      i, mean,
      up: core.filter((v) => v.score >= UP).map((v) => v.name),
      down: core.filter((v) => v.score <= DOWN).map((v) => v.name),
    };
  }).filter((x) => x.mean != null);

  const byScore = rows.slice().sort((a, b) => b.mean - a.mean);
  const topI = new Set(byScore.slice(0, PICK).filter((x) => x.mean > 50).map((x) => x.i));
  const botI = new Set(byScore.slice(-PICK).filter((x) => x.mean < 50).map((x) => x.i));

  const upM = rows.filter((x) => topI.has(x.i) && x.up.length >= 2)
    .map((x) => ({ i: x.i, who: x.up }));
  const downM = rows.filter((x) => botI.has(x.i) && x.down.length >= 2)
    .map((x) => ({ i: x.i, who: x.down }));

  return {
    up: groupWindows(upM, timeline),
    down: groupWindows(downM, timeline),
  };
}

/**
 * 해석 근거 한 벌을 만든다.
 *
 * @param {object} r readFortune 결과
 * @param {object|null} f readForecast 결과. 없으면 시기 부분을 비운다
 */
export function buildMultilayer(r, f = null) {
  const natalById = new Map(r.results.map((x) => [x.id, x]));
  const yearById = new Map((f?.year?.results ?? []).map((x) => [x.id, x]));

  const coreActive = CORE_IDS.filter((id) => natalById.has(id) || yearById.has(id));
  const coreMissing = CORE_IDS.filter((id) => !coreActive.includes(id))
    .map((id) => ID_TO_NAME.get(id) ?? id);

  const facts = coreActive.map((id) => {
    const n = natalById.get(id);
    const y = yearById.get(id);
    return {
      id,
      name: ID_TO_NAME.get(id) ?? id,
      natalHeadline: n?.headline ?? '',
      yearHeadline: y?.headline ?? '',
      // 대운·다샤처럼 시기의 기준점이 되는 사실은 각 체계가 이미 facts 에 적어 두었다.
      // 여기서 다시 계산하지 않고 그 줄을 그대로 가져온다.
      anchors: (n?.facts ?? []).filter((x) => /대운|다샤|유년|대한|트랜싯|세운/.test(x.label)),
      confidence: n?.confidence ?? null,
    };
  });

  const themes = THEMES.map((t) => {
    const s = scoreTheme(t, natalById, yearById);
    s.windows = f?.timeline ? timingWindows(t, f.timeline) : { up: [], down: [] };
    // 월까지 좁히려면 시기 교집합이 실제로 있어야 한다. 없으면 없다고 적는다.
    s.monthEvidence = s.windows.up.length > 0 || s.windows.down.length > 0;
    return s;
  });

  const caveats = [];
  if (!r.input.timeKnown) {
    caveats.push('태어난 시각을 몰라 자미두수가 빠졌다. 핵심 체계가 셋뿐이라 "강한 신호"가 나오기 어렵고, 나온 결론도 한 단계 낮춰 읽어야 한다.');
  }
  if (coreMissing.length) {
    caveats.push(`핵심 체계 가운데 이번 계산에 없는 것: ${coreMissing.join(', ')}`);
  }
  if (!f) {
    caveats.push('시기 계산이 없어 연·월을 좁힐 수 없다. 시기를 묻는 질문에는 근거가 없다고 답할 것.');
  }
  const weak = themes.filter((t) => t.level === '약함').map((t) => t.key);
  if (weak.length) {
    caveats.push(`약한 신호인 주제: ${weak.join('·')} — 회사 규모·지역·이동 방향 같은 현실 조건까지 좁히지 말 것.`);
  }

  return { core: facts, coreCount: coreActive.length, coreMissing, themes, caveats };
}

/** 위 결과를 프롬프트에 실을 글로 편다. 토큰을 아끼려고 한 줄씩 접는다 */
export function formatMultilayer(m) {
  const out = [];
  out.push('## 다층 해석 근거');
  out.push('아래는 위 계산 결과를 다시 센 것이다. 새로 계산하지 말고 이 개수를 그대로 쓸 것.');
  out.push(`핵심 넷(사주·자미두수·점성술·베딕) 가운데 이번에 선 것 ${m.coreCount}개.`);
  out.push('');

  out.push('### 계산 사실 — 핵심 넷');
  for (const c of m.core) {
    const bits = [c.natalHeadline, c.yearHeadline && `올해 ${c.yearHeadline}`]
      .filter(Boolean).join(' | ');
    out.push(`${c.name}: ${bits || '—'}`);
    for (const a of c.anchors) {
      out.push(`  · ${a.label} ${a.value}${a.note ? ` (${a.note})` : ''}`);
    }
  }
  out.push('');

  out.push('### 활성 주제 — 핵심 넷이 같은 쪽을 가리킨 개수');
  out.push('순풍·역풍은 좋고 나쁨이 아니라 그 영역이 움직이는 방향이다. 중립은 그 체계가 이 주제에 할 말이 없다는 뜻이다.');
  for (const t of m.themes) {
    const parts = [
      `순풍 ${t.up.length}${t.up.length ? `(${t.up.join('·')})` : ''}`,
      `역풍 ${t.down.length}${t.down.length ? `(${t.down.join('·')})` : ''}`,
    ];
    if (t.flat.length) parts.push(`중립 ${t.flat.length}(${t.flat.join('·')})`);
    out.push(`${t.key} [${t.level}] — ${parts.join(' / ')}${t.conflict ? ' ※ 상충' : ''}`);
  }
  out.push('');

  out.push('### 시기 교집합 — 올해 열두 절기월 가운데 두드러진 구간');
  out.push('열두 달을 핵심 넷의 평균으로 세워 위아래 끝만 골랐고, 그 달에 핵심 둘 이상이 실제로 같은 쪽인 것만 남겼다. 여기 없는 달은 "그 주제로는 평범한 달"이다.');
  for (const t of m.themes) {
    const line = (w) => w.map((x) => `${x.label} ${x.half}(${x.who.join('·')})`).join(' / ') || null;
    const up = line(t.windows.up);
    const down = line(t.windows.down);
    if (!up && !down) { out.push(`${t.key}: 겹치는 구간 없음 — 월 단위까지 좁힐 근거 부족`); continue; }
    if (up) out.push(`${t.key} 순풍: ${up}`);
    if (down) out.push(`${t.key} 역풍: ${down}`);
  }
  out.push('');

  if (m.caveats.length) {
    out.push('### 이 자료의 한계');
    for (const c of m.caveats) out.push(`- ${c}`);
    out.push('');
  }

  out.push('### 이 근거를 쓰는 법');
  out.push('- 강함/중간인 주제만 현실 조건(이동의 자발성·조직 성격·직무 변화 같은 것)까지 좁힌다. 약함이면 좁히지 말고 약하다고 적는다.');
  out.push('- 월을 말할 때는 위 "시기 교집합"에 실제로 적힌 구간만 쓴다. 적혀 있지 않으면 "월 단위까지 좁힐 근거가 부족하다"고 적는다.');
  out.push('- 보조 열한 체계는 확인용이다. 핵심 넷의 결론을 뒤집는 근거로 쓰지 않는다.');
  out.push('- 상충으로 표시된 주제는 양쪽 근거를 함께 적는다. 한쪽을 지우지 않는다.');

  return out.join('\n');
}

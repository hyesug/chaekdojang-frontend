/**
 * aiContext.js — 엔진 결과를 프롬프트에 실을 형태로 정리한다
 *
 * 이 파일이 이 프로젝트 전체의 이유에 해당한다.
 *
 * 언어 모델에게 "1992년 1월 30일 16시 28분 여주 출생 사주 봐줘"라고 물으면
 * 그럴듯한 여덟 글자가 나오지만 대개 틀린다. 입춘 시각을 알아야 하고,
 * 율리우스일을 60으로 돌려야 하고, 경도와 균시차로 43분을 빼야 하기 때문이다.
 * 날짜 산술은 언어 모델이 가장 자주 틀리는 자리다.
 *
 * 그래서 계산은 엔진이 하고, 모델에게는 **이미 구해진 값**만 넘긴다.
 * 모델은 계산하지 않고 해석만 한다. 열다섯 체계를 한 번에 다룰 수 있는 것도
 * 같은 이유다 — 매번 명반을 말로 설명할 필요 없이 한 덩어리로 실으면 된다.
 *
 * 토큰을 아끼려고 줄임말을 쓰되, 모델이 알아볼 수 없을 만큼 줄이지는 않는다.
 */

import { ELEMENTS } from './core/ganzhi.js';
import { AREAS } from './forecast.js';

const p2 = (n) => String(n).padStart(2, '0');

/** facts 배열을 한 줄로 접는다 */
function foldFacts(facts, max = 10) {
  return facts
    .slice(0, max)
    .filter((f) => f.value && f.value !== '—')
    .map((f) => `${f.label} ${f.value}${f.note ? `(${f.note})` : ''}`)
    .join(' · ');
}

/**
 * @param {object} form   사용자 입력
 * @param {object} r      readFortune 결과
 * @param {object} f      readForecast 결과 (없으면 생략)
 */
export function buildContext(form, r, f = null) {
  const out = [];
  const { chart, lunar, birth, input, synthesis: s } = r;

  // ── 기본 ──
  const when = `${form.year}년 ${form.month}월 ${form.day}일` +
    (input.timeKnown ? ` ${p2(form.hour)}시 ${p2(form.minute)}분` : ' (시각 미상)');
  const tst = input.timeKnown
    ? ` → 진태양시 ${birth.tst.h}시 ${p2(birth.tst.mi)}분 (경도·균시차 보정 ${birth.totalShiftMinutes >= 0 ? '+' : '−'}${Math.abs(birth.totalShiftMinutes).toFixed(0)}분)`
    : '';

  out.push('## 기본');
  out.push(`${form.name} · ${form.gender === 'male' ? '남성' : '여성'} · 만 ${input.age}세`);
  out.push(`양력 ${when}${tst}`);
  out.push(`음력 ${lunar.year}.${lunar.isLeap ? '윤' : ''}${lunar.month}.${lunar.day}`);
  out.push(`출생 ${form.birthPlace} · 거주 ${form.homePlace} (${input.moveDirection}쪽으로 이동)`);
  out.push(
    `사주 연도 ${chart.sajuYear}년 ${chart.zodiac}띠` +
    (chart.sajuYear !== form.year
      ? `  ※ 양력으로는 ${form.year}년생이지만 입춘 전이라 명리에서는 ${chart.sajuYear}년으로 본다`
      : '')
  );
  if (!input.timeKnown) {
    out.push('※ 출생 시각을 몰라 시주가 없다. 자미두수·육임·홍국기문은 계산하지 않았고 나머지도 정확도가 떨어진다.');
  }
  out.push('');

  // ── 체계별 ──
  out.push('## 열다섯 체계');
  out.push('');
  for (const sys of r.results) {
    out.push(`### ${sys.name}${sys.hanja ? ` (${sys.hanja})` : ''}`);
    out.push(sys.headline);
    const folded = foldFacts(sys.facts);
    if (folded) out.push(folded);
    if (sys.confidence < 1) {
      out.push(`※ 재료가 부족해 종합 반영 ${Math.round(sys.confidence * 100)}%`);
    }
    out.push('');
  }
  if (r.skipped?.length) {
    out.push(`계산하지 못한 체계: ${r.skipped.map((x) => x.system).join(', ')} — ${r.skipped[0].reason}`);
    out.push('');
  }

  // ── 종합 ──
  out.push('## 종합');
  out.push(
    `합의도 ${s.consensus.ratio}%` +
    (s.consensus.word ? ` — ${s.consensus.total}개 중 ${s.consensus.count}개가 '${s.consensus.word}'을 가리킴 (${s.consensus.from.join(', ')})` : '')
  );
  out.push(`합산 오행 ${ELEMENTS.map((e, i) => `${e}${s.elements.pct[i]}%`).join(' ')} — 강한 ${s.elements.strongestName}, 약한 ${s.elements.weakestName}`);
  if (s.sharedTags.length) {
    out.push(`겹친 낱말 ${s.sharedTags.map((t) => `${t.word}×${t.count}`).join(' ')}`);
  }
  out.push(
    '기질 ' +
    Object.entries(s.traits)
      .map(([k, v]) => `${k}${v.value >= 0 ? '+' : ''}${v.value}`)
      .join(' ') +
    '  (−1~+1, 0이 중립)'
  );
  out.push(`영역 ${s.ranked.map((d) => `${d.key}${d.score}`).join(' ')}  (0~100, 50이 보통)`);
  if (s.summary?.length) out.push(`요약 — ${s.summary.join(' ')}`);
  out.push('');

  // ── 시기 ──
  if (f) {
    const t = f.today;
    out.push(`## 시기 운세 (기준일 ${t.y}년 ${t.m}월 ${t.d}일)`);
    out.push('');
    for (const [label, block] of [['오늘', f.day], ['이번 달', f.month], ['올해', f.year]]) {
      const gz = block.period.ruling;
      out.push(
        `${label} ${block.period.label} · ${gz.hanja}(${gz.kr}) — ` +
        AREAS.map((a) => `${a.replace('운', '')}${block.areas[a].score}`).join(' ')
      );
      const top = block.results
        .slice()
        .sort((x, y) => (y.areas?.총운 ?? 0) - (x.areas?.총운 ?? 0))
        .slice(0, 4)
        .map((x) => `${x.name}(${x.headline})`)
        .join(', ');
      out.push(`  주요 근거: ${top}`);
    }
    out.push('');
    out.push('올해 열두 달 (절기 기준)');
    out.push(
      f.timeline
        .map((m) => `${m.from.m}/${m.from.d}~ ${m.gz.hanja} ${m.score}`)
        .join('  ')
    );
    // 연간 평균이 무난해도 특정 절기에는 건강 흐름이 크게 내려갈 수 있다.
    // AI가 연간 점수 하나로 그 저점을 지워버리지 않도록 별도 근거로 준다.
    const healthLow = f.timeline.slice()
      .sort((a, b) => (a.areas.건강운?.score ?? 50) - (b.areas.건강운?.score ?? 50))
      .slice(0, 3)
      .map((m) => `${m.from.m}월 ${m.from.d}일 이후`)
      .join(' / ');
    out.push(`올해 건강 흐름이 낮게 잡힌 절기: ${healthLow}. 연간 평균이 무난하더라도 건강 질문에서는 이 구간을 먼저 짚을 것.`);
    out.push('※ 점수는 열다섯 체계 평균을 눈금만 벌린 값이다. 50이 보통. 절대 수치가 아니라 영역끼리·달끼리 견주는 용도다.');
    out.push('');
  }

  out.push('## 읽는 법');
  out.push('위 값은 모두 천문 계산으로 구한 것이다. 간지·절기·음력·행성 위치를 다시 계산하지 말고 그대로 쓸 것.');
  out.push('체계마다 보는 대상이 다르므로 결론이 갈릴 수 있다. 갈리면 갈린다고 말할 것.');

  return out.join('\n');
}

/** 사람이 처음 열었을 때 자동으로 받는 전체 풀이 요청문 */
export const READING_PROMPT =
  '위 명반을 바탕으로 이 사람의 전체 풀이를 써 주세요. ' +
  '소제목을 넣어 (1) 타고난 기질 (2) 지금의 흐름 (3) 올해 눈여겨볼 시기 (4) 조심할 지점 순으로 정리해 주세요. ' +
  '열다섯 체계가 어긋나는 지점이 있으면 그것도 짚어 주세요.';

/**
 * 궁합용 명반 — 두 사람 것을 한 덩이로
 *
 * 개인용과 같은 이유로 만든다. "이 두 사람 궁합 봐줘"라고 물으면 모델이
 * 두 사람 사주를 각각 세우고 합·충까지 따져야 하는데, 그 앞단에서 이미
 * 틀린다. 여기서는 열다섯 체계가 견준 결과를 그대로 넘긴다.
 *
 * @param {object} formA 첫 번째 사람
 * @param {object} formB 두 번째 사람
 * @param {object} c     compareFortune 결과
 */
export function buildCompatContext(formA, formB, c, forecastA = null, forecastB = null) {
  const out = [];
  const s = c.synthesis;
  const who = (f) => `${f.name} · ${f.gender === 'male' ? '남성' : '여성'} · ` +
    `양력 ${f.year}년 ${f.month}월 ${f.day}일` +
    (f.hour == null ? ' (시각 미상)' : ` ${p2(f.hour)}시 ${p2(f.minute)}분`) +
    ` · ${f.birthPlace} 출생`;

  out.push('## 두 사람');
  out.push(who(formA));
  out.push(who(formB));
  out.push('');

  out.push('## 체계별로 견준 결과');
  out.push('');
  for (const x of c.results) {
    out.push(`### ${x.name}`);
    out.push(`${x.verdict} — ${x.headline}`);
    const folded = foldFacts(x.facts);
    if (folded) out.push(folded);
    for (const v of (x.readings ?? []).slice(0, 2)) {
      out.push(`${v.title}: ${String(v.text).replace(/\n+/g, ' ')}`);
    }
    out.push('');
  }
  if (c.skipped?.length) {
    out.push(`견주지 못한 체계: ${c.skipped.map((x) => x.system).join(', ')} — ${c.skipped[0].reason}`);
    out.push('');
  }

  out.push('## 종합');
  out.push(`견준 ${s.count}개 가운데 좋게 본 것 ${s.buckets['좋음'].length}개(${s.buckets['좋음'].join(', ') || '없음'}), ` +
    `무난 ${s.buckets['무난'].length}개(${s.buckets['무난'].join(', ') || '없음'}), ` +
    `어렵게 본 것 ${s.buckets['어려움'].length}개(${s.buckets['어려움'].join(', ') || '없음'})`);
  if (s.best) out.push(`가장 좋게 보는 곳 — ${s.best.name}: ${s.best.headline}`);
  if (s.worst) out.push(`가장 어렵게 보는 곳 — ${s.worst.name}: ${s.worst.headline}`);
  if (s.summary?.length) out.push(`요약 — ${s.summary.join(' ')}`);
  out.push('');

  // 궁합은 관계의 성질이고, 결혼 시기는 각자에게 들어오는 흐름을 겹쳐야 한다.
  // 같은 절기 순서의 월별 점수를 나란히 놓아 둘 다 편한 달만 추린다.
  if (forecastA && forecastB) {
    const months = forecastA.timeline.map((a, i) => {
      const b = forecastB.timeline[i];
      return {
        from: a.from,
        a: a.score,
        b: b?.score ?? 50,
        together: a.score + (b?.score ?? 50),
      };
    });
    const best = months.slice().sort((a, b) => b.together - a.together).slice(0, 3);
    const careful = months.slice().sort((a, b) => a.together - b.together).slice(0, 3);
    const describe = (x) => `${x.from.m}월 ${x.from.d}일 이후 (첫째 ${x.a}, 둘째 ${x.b})`;

    out.push('## 결혼 시기 자료 — 두 사람의 개인 흐름을 겹친 값');
    out.push(`기준 연도 ${forecastA.today.y}년. 아래 달은 절기 시작일 기준이다.`);
    out.push(`두 사람 모두에게 비교적 힘이 실리는 시기: ${best.map(describe).join(' / ')}`);
    out.push(`두 사람 모두에게 부담이 될 수 있어 피하는 편이 좋은 시기: ${careful.map(describe).join(' / ')}`);
    out.push('이 자료가 있으면 결혼 시기를 물을 때 반드시 위의 좋은 시기에서 1~2개를 구체적으로 골라 답할 것. 날짜 단위 자료는 없으므로 특정 일자를 지어내지 말고 월·절기 단위로 답할 것.');
    out.push('');
  }

  out.push('## 읽는 법');
  out.push('위 값은 모두 천문 계산으로 구한 것이다. 간지·절기·음력·행성 위치를 다시 계산하지 말고 그대로 쓸 것.');
  out.push('체계마다 잣대가 다르다. 베딕 아쉬타쿠타처럼 혼인을 전제로 만든 잣대는 박하고, 요일 하나로 보는 체계는 후하다. 점수를 가로로 견주지 말 것.');
  out.push('궁합은 두 사람 사이의 경향이지 판결이 아니다. 헤어지라거나 결혼하라고 말하지 말 것. 결혼 시기를 물으면 위의 결혼 시기 자료를 근거로 준비하기 좋은 달을 답할 것. "시기 자료가 없다"거나 두 사람 개인 운세를 따로 보라고 말하지 말 것.');

  return out.join('\n');
}

/** 궁합 화면을 열었을 때 자동으로 받는 요청문 */
export const COMPAT_PROMPT =
  '위 결과를 바탕으로 두 사람의 궁합을 풀어 주세요. ' +
  '소제목을 넣어 (1) 서로 끌리는 지점 (2) 부딪치기 쉬운 지점 (3) 오래 가려면 무엇이 필요한지 순으로 정리하고, ' +
  '열다섯 체계가 어긋나는 지점이 있으면 그것도 짚어 주세요.';

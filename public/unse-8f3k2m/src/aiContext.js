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

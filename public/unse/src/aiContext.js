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

import { ELEMENTS, computeDaeun } from './core/ganzhi.js';
import { AREAS } from './forecast.js';
import { candidatesToward, DIR8 } from './hires/location.js';
import { yearDirections } from './systems/gujeong.js';
import { dayRange, rankSurgeryDays, structureReading, patternReading,
         yearTimeline, innerReading, tabooReading } from './reading.js';
import { buildMultilayer, formatMultilayer } from './multilayerInterpretation.js';
import { lifeChapters, chaptersAt, chapterTurns } from './semantic/compose/life.js';
import { readChildren, childPalaceStars, childrenVerdict } from './semantic/structure/children.js';
import { childrenPack } from './hires/vedicExt.js';

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
 * 자녀 — 체계마다 따로. **수와 성별을 포함한다.**
 *
 * 오래도록 "자녀 수·성별은 만들지 않는다"로 막아 두었는데, 그 결정은 열다섯을
 * 하나로 합쳐 단정하던 때에 나온 것이다. 지금은 체계마다 따로 말하고 갈리면
 * 갈린다고 적으므로 막을 이유가 없다 — "자미 전서의 수 표로는 둘"은 예언이
 * 아니라 그 전통의 규칙이 무엇인지를 옮긴 것이다.
 */
function formatChildren(input, chart) {
  let reads = [];
  try {
    reads = readChildren(
      { ...chart, gender: input.gender },
      childPalaceStars(input),
      childrenPack(input),
    );
  } catch { return ''; }
  if (!reads.length) return '';

  const L = ['## 자녀 — 체계마다 무엇이라 하는가', ''];
  for (const r of reads) L.push(`- **${r.system}** (${r.what}): ${r.text}  [출전: ${r.source}]`);

  // 규칙대로 종합한 결과. 갈린 자리는 여기서 이미 빠져 있다
  const v = childrenVerdict(reads);
  L.push('');
  L.push('**종합 (겹치면 단정 · 갈리면 뺌 · 하나뿐이면 보수적):**');
  for (const line of v.lines) L.push(`  ${line}`);
  L.push('');
  L.push('위 종합은 이미 규칙대로 정리한 것이다. **다시 종합하지 말고 그대로 쓸 것.**');
  L.push('갈린다고 적힌 자리는 답에서 빼고, 겹친 자리는 단정해서 말할 것.');
  return L.join('\n');
}

/**
 * 평생 구간을 문맥에 싣는 모양으로.
 *
 * **경계가 확정 계산인 것만 넣는다.** 대운·대한·다샤·ZR·9년 주기·24년 주기는
 * 천문과 셈으로 정해지는 값이라 지어낼 여지가 없다. 모델이 "내년 어때요"에
 * 분위기로 답하던 것은 이 표가 문맥에 없었기 때문이다.
 *
 * 사람마다 고정이라 캐시에 함께 태운다 — 질문마다 다시 보내지 않는다.
 */
function formatLife(input, chart) {
  let chapters = [];
  try { chapters = lifeChapters(input, chart, input.isMale); } catch { return ''; }
  if (!chapters.length) return '';

  const now = input.currentYear;
  const L = [];
  L.push('## 평생 구간 (경계는 확정 계산)');
  L.push('시간축이 있는 체계의 구간을 한 축에 놓은 것이다. 주기가 저마다 달라(10·9·24년·가변) 시작과 끝이 어긋난다.');
  L.push('');

  const bySys = {};
  for (const c of chapters) (bySys[c.system] ??= []).push(c);
  for (const [sys, list] of Object.entries(bySys)) {
    const near = list.filter((c) => c.toYear >= now - 10 && c.fromYear <= now + 40);
    if (!near.length) continue;
    L.push(`${sys} — ${near.map((c) => `${c.fromYear}~${c.toYear} ${c.label}`).join(' | ')}`);
  }
  L.push('');

  const here = chaptersAt(chapters, now);
  if (here.length) {
    L.push(`지금(${now}년) 걸려 있는 구간: ` +
      here.map((c) => `${c.system} ${c.label}(${c.fromYear}~${c.toYear})`).join(' · '));
  }

  const turns = chapterTurns(chapters, { from: now, to: now + 40, minSystems: 2, birthYear: input.year });
  if (turns.length) {
    L.push('');
    L.push('둘 이상이 함께 바뀌는 해 (주기가 어긋나 있어 드물다):');
    for (const t of turns) L.push(`  ${t.year}년 (${t.age}세) — ${t.systems.join(' + ')}`);
  }
  return L.join('\n');
}

/** 120일은 해를 넘긴다. 표에 연도를 다 적으면 길어지니 한 줄로 일러둔다 */
function yearNote(days) {
  const first = days[0], last = days[days.length - 1];
  return first.y === last.y
    ? `아래 날짜는 모두 ${first.y}년이다.`
    : `아래 날짜 가운데 ${first.m}월~12월은 ${first.y}년, 1월 이후는 ${last.y}년이다.`;
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
    // 부처궁·관록궁·올해 열린 방위 같은 해석은 facts가 아니라 readings에만 있다
    for (const v of sys.readings ?? []) {
      out.push(`- ${v.title}: ${String(v.text).replace(/\n+/g, ' ')}`);
    }
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

  // ── 다층 해석 근거 ──
  // 위까지는 체계별 결과를 늘어놓은 것이고, 여기서부터는 그걸 센 것이다.
  // 모델이 "몇 개가 같은 말을 하는가"를 눈대중으로 세면 매번 답이 달라지므로
  // 세는 일은 코드가 하고 개수만 넘긴다.
  out.push(formatMultilayer(buildMultilayer(r, f)));
  out.push('');

  // ── 이동 방위 ──
  // "어디로 옮길까"에 방위만 주면 모델이 도시를 지어낸다. 거주지에서 그 방위에
  // 실제로 있는 도시를 좌표로 골라 둔다. 구성학 연반은 입춘에 바뀌므로 내년 것도 싣는다.
  out.push(`## 이동 방위와 도시 후보 (거주지 ${input.home.name} 기준, 구성학 연반)`);
  for (const year of [input.currentYear, input.currentYear + 1]) {
    const d = yearDirections(input.sajuYear, year);
    const bad = new Set(d.bad.map((x) => x.dir));
    const good = d.good.filter((x) => !bad.has(x.dir));
    out.push(`${year}년(입춘~이듬해 입춘)`);
    out.push(good.length
      ? good.map((x) => {
          const near = candidatesToward(input.home, DIR8.indexOf(x.dir) * 45, { spread: 22.5, limit: 3 });
          return `- 열린 방위 ${x.dir}: ${near.length ? near.map((c) => `${c.name}(${c.km}km)`).join(', ') : '목록에 해당 도시 없음'}`;
        }).join('\n')
      : '- 열린 방위 없음 — 큰 이동보다 자리를 지키는 해');
    if (d.bad.length) out.push(`- 피할 방위: ${d.bad.map((x) => `${x.dir}(${x.kind})`).join(', ')}`);
  }
  out.push('도시는 방위에 맞는 후보일 뿐 운세가 특정 도시를 고른 것이 아니다. 동네·회사까지 단정하지 말 것.');
  out.push('');

  // ── 타고난 구성 ──
  // 시기 점수는 '그 시기'를 재는 값이라, 구조가 무너진 명반도 평범하게 나온다.
  // 사람의 삶에 실제로 들어맞은 건 늘 이쪽이었다. 그래서 따로 싣는다.
  const st = structureReading(r.input, r.chart);
  const pat = patternReading(r.input, r.chart);
  if (st.lines.length || pat.length) {
    out.push('## 타고난 구성 (원국을 그대로 읽은 것 — 시기와 무관하게 평생 간다)');
    if (st.head) out.push(st.head);
    for (const t of st.lines) out.push(`- ${t}`);
    for (const x of pat) out.push(`- ${x.name}: ${x.text}`);
    out.push('');
  }

  // ── 내면과 금기 ──
  // 사람이 가장 세게 반응하는 자리다. 모델이 이걸 모르면 앞날 이야기만 한다.
  const inner = innerReading(r.input, r.chart);
  if (inner.length) {
    out.push('## 내면 (원국의 십신 분포에서 읽은 것)');
    for (const x of inner) out.push(`- ${x.title}: ${x.text}`);
    out.push('');
  }
  const taboo = tabooReading(r.input, r.chart);
  if (taboo.length) {
    out.push('## 이 사람에게 되풀이되기 쉬운 패턴 (금지가 아니라 경향이다. 명령하듯 옮기지 말 것)');
    for (const x of taboo) out.push(`- ${x.head}: ${x.text}`);
    out.push('');
  }

  // ── 대운 ──
  const daeun = computeDaeun(r.chart, r.input.isMale, r.input.jdUT);
  if (daeun?.list?.length) {
    out.push('## 대운 (십 년 단위)');
    out.push(daeun.list
      .map((p) => `${p.fromAge}~${p.toAge}세 ${p.hanja}(${p.kr})`)
      .join(' · '));
    out.push('');
  }

  // ── 연도별 ──
  // "2019년에 무슨 일 있었나요" 같은 질문에 답하려면 해마다의 값이 있어야 한다.
  if (f) {
    const tl = yearTimeline(r.input, r.chart,
      Math.max(r.input.sajuYear + 8, f.today.y - 15), f.today.y + 10);
    out.push('## 연도별 (지난 해는 맞춰보는 자리, 앞으로는 준비하는 자리)');
    for (const x of tl) {
      out.push(`${x.year}(${x.age}세) ${x.gz.hanja} [${x.tag}]` +
        `${x.bond ? ' 인연' : ''}${x.daeunFrom ? ' 대운시작' : ''} — ${x.text}`);
    }
    out.push('특정 연도를 물으면 위 줄을 근거로 답할 것. 지난 해는 단정해서 말하고, 앞날은 경향으로 말할 것.');
    out.push('');
  }

  // ── 일자별 달력 ──
  // 이 표가 이 파일에서 두 번째로 중요한 대목이다. 없으면 모델은 날짜를
  // 물어도 "11월 초쯤"이라고밖에 답하지 못한다 — 없는 날을 지어내지 않으려면
  // 그럴 수밖에 없다. 등급은 이 구간 안에서의 순위다.
  if (f) {
    const days = dayRange(r.input, r.chart, f.today, 120);
    out.push(`## 일자별 (${f.today.y}년 ${f.today.m}월 ${f.today.d}일부터 120일)`);
    out.push('형식: 월/일(요일) 일진 등급 [황도|흑도] [천의=치료·수술에 쓰는 날] [일지충=본인과 부딪치는 날] 신살');
    out.push(yearNote(days));
    for (const x of days) {
      const t = x.taekil;
      const tags = [
        t.good ? '황도' : '흑도',
        t.cheonui ? '천의' : '',
        t.clashDay ? '일지충' : '',
        t.clashYear ? '띠충' : '',
        ...x.sinsal,
      ].filter(Boolean).join(' ');
      out.push(`${x.m}/${x.d}(${x.weekday}) ${x.gz.hanja} ${x.grade} ${tags}`);
    }
    out.push('');

    // 해를 넘기는 구간이라 월·일이 아니라 원래 순서로 되돌려야 한다
    const order = new Map(days.map((x, i) => [x, i]));
    const tops = (key, n = 5) => days.slice()
      .sort((a, b) => b[key] - a[key]).slice(0, n)
      .sort((a, b) => order.get(a) - order.get(b))
      .map((x) => `${x.m}/${x.d}`).join(', ');
    out.push('120일 가운데 영역별로 앞서는 날');
    out.push(`재물 ${tops('wealth')} · 관계 ${tops('love')} · 일 ${tops('work')} · 몸 ${tops('health')}`);
    out.push('');

    // 수술은 일반 일진과 별도로 우선순위를 고정한다.
    // 모델이 '좋음' 등급 하나만 보고 흑도 날짜를 위로 올리지 못하게,
    // 엔진이 먼저 순서를 계산해서 그대로 넘긴다.
    const surgery = rankSurgeryDays(r.input, r.chart, days);
    const topSurgery = surgery.candidates.slice(0, 10);
    out.push('## 수술·시술 택일 전용 순위');
    out.push('이 순서는 이미 엔진에서 계산한 것이다. 수술·시술 날짜를 물으면 아래 순서를 임의로 재정렬하지 말 것.');
    out.push('우선순위: 일지충·양인 제외 → 천의 → 황도 → 원국의 다른 지지·그 날짜 대운의 충 감점 → 형·해·파 감점 → 해당 절기월 건강 흐름 → 당일 건강 흐름 → 일반 일진 등급.');
    out.push('황도/흑도보다 일반 일진 등급을 앞세우지 말 것. 년지·월지·시지·대운의 충은 탈락이 아니라 감점이며, 일지충만 강하게 제외한다. 대운 전환 표시는 주의 정보일 뿐 자동 감점·가점하지 않는다.');
    for (const [i, x] of topSurgery.entries()) {
      const s = x.surgery;
      const t = s.daeunTransition;
      const trans = t
        ? ` · 대운전환 약 ${Math.abs(t.delta)}일 ${t.delta < 0 ? '전' : '후'}(${t.from}→${t.to}, 약 ${t.date.y}.${t.date.m}.${t.date.d})`
        : '';
      out.push(
        `${i + 1}순위 ${x.y}.${x.m}.${x.d}(${x.weekday}) ${x.gz.hanja} · ` +
        `${s.cheonui ? '천의' : '천의 아님'} · ${s.hwangdo ? '황도' : '흑도'} ${s.hwangdoName} · ` +
        `충감점 ${s.clashPenalty} · 형해파감점 ${s.minorPenalty} · ` +
        `대운 ${s.activeDaeun?.hanja ?? '없음'} · 절기월 건강 ${s.monthHealth} · 당일 건강 ${s.dayHealth} · 일반등급 ${x.grade}${trans}` +
        (s.branchRisk.length ? ` · 지지관계 ${s.branchRisk.map((r) => `${r.label}${r.relation}`).join(', ')}` : '')
      );
    }
    out.push('※ 이 순위는 전통 택일 규칙을 사이트 내부 기준으로 정렬한 것이며, 실제 수술의 안전성·예후를 예측하는 의학적 근거는 아니다. 실제 날짜는 집도의와 병원의 판단을 우선할 것.');
    out.push('');
  }

  // ── 평생 축 ──
  // 여기가 없어서 모델이 "내년 어때요"에 분위기로만 답했다. 대운·다샤·ZR 처럼
  // **경계가 확정 계산인** 구간을 그대로 실어 주면, 지어내지 않고도 연도를
  // 말할 수 있다. 사람마다 고정이라 캐시에 함께 태워도 값이 붙지 않는다.
  out.push(formatLife(input, r.chart));
  out.push('');
  out.push(formatChildren(input, r.chart));
  out.push('');

  out.push('## 읽는 법');
  out.push('위 값은 모두 천문 계산으로 구한 것이다. 간지·절기·음력·행성 위치를 다시 계산하지 말고 그대로 쓸 것.');
  out.push('체계마다 보는 대상이 다르므로 결론이 갈릴 수 있다. 갈리면 갈린다고 말할 것.');
  out.push('"평생 구간" 표의 시작·끝 연도는 확정 계산이다. **연도를 물으면 이 표에서 골라 답하고, 표에 없는 해를 지어내지 말 것.** 구간이 바뀌는 해를 물으면 "둘 이상이 함께 바뀌는 해"를 쓸 것.');
  out.push('다만 **구간의 경계가 곧 사건은 아니다.** "2028년에 다샤와 구성 주기가 함께 바뀐다"까지가 계산이고, "그래서 이직한다"는 계산이 아니다. 시기 예측은 이 사이트가 독립된 두 표본으로 재서 두 번 다 신호를 찾지 못했다(달 단위 p=0.868, 해 단위 p=0.196). 구간과 그 구간에 든 것을 말하되 사건을 단정하지 말 것.');
  out.push('**달을 짚지 말 것.** 달 단위는 위 두 표본에서 모두 기준선보다 나빴다. 해까지만 단정하고, 굳이 달을 물으면 "이 해 안에서 굳이 꼽자면"이라고 밝히고 순위로만 답할 것.');
  out.push('**양쪽을 다 말하는 문장을 쓰지 말 것.** "정리하면서 동시에 결실이 나오는 해"처럼 쓰면 틀릴 수가 없어서 아무 말도 아니다. 체계끼리 갈리면 누가 어느 쪽인지 밝힐 것.');
  out.push('**좋은 해·나쁜 해로 말하지 말 것.** \'전성기\'·\'화려한 시기\' 같은 말을 쓰지 않는다. 충이 많으면 나쁘다는 것은 유파가 갈리고 이 사이트가 검증한 적이 없다. 대신 **어디가** 부딪히는지를 말할 것 — 재성이 부딪히는 것과 배우자궁이 흔들리는 것은 전혀 다른 이야기이고 그 구별은 확정 계산이다.');
  out.push('"다층 해석 근거"에 적힌 개수와 구간은 이미 센 것이다. 다시 세지 말고 그대로 쓸 것. 거기에 없는 달·구간을 만들어내지 말 것.');
  out.push('날짜를 물으면 위 일자별 표에서 실제 날짜를 골라 답할 것. 표에 있는 날은 이미 계산된 날이므로 지어내는 것이 아니다. "월 초"처럼 뭉개지 말고 "11월 3일(화)"처럼 날짜와 요일을 적고, 왜 그 날인지 한 줄로 밝힐 것. 두세 개를 우선순위대로 주고, 함께 피할 날도 같이 적을 것.');
  out.push('택일의 기준: 몸에 손대는 일(수술·시술·치료 시작)은 위의 "수술·시술 택일 전용 순위"를 그대로 쓸 것. 일지충·양인을 먼저 제외하고, 천의 → 황도 → 다른 원국 지지·그날 대운의 충 감점 → 형·해·파 감점 → 절기월 건강 → 당일 건강 → 일반 일진 등급 순으로 본다. 년지·월지·시지·대운 충은 후보를 전부 없애지 않도록 차등 감점하고, 일지충만 강하게 제외한다. 일반 등급이 높다는 이유로 흑도 날짜를 황도 날짜보다 앞세우지 말 것. 계약·문서·면접은 황도이면서 등급이 높은 날을 고른다. 이사·출발은 역마, 부탁·지원 요청은 천을을 참고한다.');
  out.push('표 밖의 날짜(120일 이후)를 물으면 그때는 월·절기 단위로만 답하고 표가 거기까지 없다고 한 줄로 밝힐 것.');

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
  if (s.coreBuckets) {
    const cb = s.coreBuckets;
    out.push(`명반을 통째로 세우는 넷(사주·자미두수·점성술·베딕)만 세면 — 좋음 ${cb['좋음'].length} / 무난 ${cb['무난'].length} / 어려움 ${cb['어려움'].length}. 개수만 볼 때는 이쪽을 먼저 볼 것. 요일 하나로 보는 잣대와 여덟 항목을 따지는 잣대가 같은 한 표일 수 없다.`);
  }
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
    out.push('이 자료가 있으면 결혼 시기를 물을 때 반드시 위의 좋은 시기에서 1~2개를 구체적으로 골라 답할 것.');
    out.push('');

    // 달까지만 알려주면 "가을쯤이 좋겠습니다"에서 끝난다. 실제로 사람들이
    // 묻는 건 예식 날짜, 상견례 날짜처럼 하루짜리다. 두 사람의 일진을
    // 각각 계산해 겹쳐두면 그 질문에 답할 수 있다.
    const dA = dayRange(c.A.input, c.A.chart, forecastA.today, 120);
    const dB = dayRange(c.B.input, c.B.chart, forecastB.today, 120);
    const RANK = { '아주 좋음': 5, '좋음': 4, '무난': 3, '조심': 2, '나쁨': 1, '특히 조심': 0 };
    const rows = dA.map((a, i) => {
      const b = dB[i];
      return {
        a, b, i,
        sum: (RANK[a.grade] ?? 3) + (RANK[b.grade] ?? 3),
        bad: a.taekil.clashDay || b.taekil.clashDay ||
             a.sinsal.includes('양인') || b.sinsal.includes('양인'),
      };
    });
    const label = (x) => {
      const tags = [x.a.taekil.good && x.b.taekil.good ? '둘 다 황도' : x.a.taekil.good || x.b.taekil.good ? '한쪽 황도' : '흑도'];
      if (x.bad) tags.push('한쪽에 충·양인');
      return `${x.a.m}/${x.a.d}(${x.a.weekday}) ${x.a.gz.hanja} ${formA.name} ${x.a.grade} / ${formB.name} ${x.b.grade} · ${tags.join(' ')}`;
    };
    // 120일은 해를 넘기므로 월·일로 정렬하면 1월이 9월 앞에 선다. 원래 순서로 되돌린다.
    const bestDays = rows.filter((x) => !x.bad).sort((x, y) => y.sum - x.sum).slice(0, 12)
      .sort((x, y) => x.i - y.i);
    const avoidDays = rows.filter((x) => x.bad).sort((x, y) => x.sum - y.sum).slice(0, 8)
      .sort((x, y) => x.i - y.i);

    out.push(`## 두 사람에게 같이 맞는 날 (${forecastA.today.y}년 ${forecastA.today.m}월 ${forecastA.today.d}일부터 120일)`);
    out.push('두 사람의 일진을 각각 계산해 겹친 것이다. 예식·상견례·여행처럼 날을 잡는 질문에는 여기서 실제 날짜를 골라 답할 것.');
    out.push(yearNote(dA));
    for (const x of bestDays) out.push(`좋음 ${label(x)}`);
    for (const x of avoidDays) out.push(`피함 ${label(x)}`);
    out.push('');
    out.push('');
  }

  out.push('## 읽는 법');
  out.push('위 값은 모두 천문 계산으로 구한 것이다. 간지·절기·음력·행성 위치를 다시 계산하지 말고 그대로 쓸 것.');
  out.push('체계마다 잣대가 다르다. 베딕 아쉬타쿠타처럼 혼인을 전제로 만든 잣대는 박하고, 요일 하나로 보는 체계는 후하다. 점수를 가로로 견주지 말 것.');
  out.push('궁합은 두 사람 사이의 경향이지 판결이 아니다. 헤어지라거나 결혼하라고 말하지 말 것. 시기를 물으면 위의 자료를 근거로 답할 것 — 달을 물으면 결혼 시기 자료에서, 날짜를 물으면 두 사람에게 같이 맞는 날 표에서 실제 날짜와 요일을 적어 두세 개를 골라 주고 피할 날도 함께 적을 것. "시기 자료가 없다"거나 두 사람 개인 운세를 따로 보라고 말하지 말 것.');

  return out.join('\n');
}

/** 궁합 화면을 열었을 때 자동으로 받는 요청문 */
export const COMPAT_PROMPT =
  '위 결과를 바탕으로 두 사람의 궁합을 풀어 주세요. ' +
  '소제목을 넣어 (1) 서로 끌리는 지점 (2) 부딪치기 쉬운 지점 (3) 오래 가려면 무엇이 필요한지 순으로 정리하고, ' +
  '열다섯 체계가 어긋나는 지점이 있으면 그것도 짚어 주세요.';

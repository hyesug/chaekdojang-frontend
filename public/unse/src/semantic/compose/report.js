/**
 * report.js — **칸에 담긴 것을 읽을 수 있는 글로**
 *
 * `slots.js`(지금 어떤 사람인가) · `life.js`(평생을 장으로) · `year.js`(한 해)
 * 가 만든 칸을 하나의 글로 잇는다.
 *
 * ── 형식 ───────────────────────────────────────────────────
 * 줄마다 끝에 **`(체계: 근거)`** 를 붙인다. 이게 이 글의 뼈대다 — 어느 말이
 * 어느 체계의 어느 자리에서 나왔는지 붙어 있지 않으면, 읽는 사람은 그럴듯한
 * 분위기만 받고 확인할 방법이 없다. 실제로 그렇게 쓴 답을 받아 보고
 * *"이거 내년 운세를 볼 줄 모르는 거야?"* 라는 말을 들었다.
 *
 * ── 하지 않는 것 ───────────────────────────────────────────
 * **좋은 해·나쁜 해를 말하지 않는다.** '전성기', '화려한 시기' 같은 말을 쓰지
 * 않는다. 충이 많으면 나쁘다는 것은 유파가 갈리고 이 저장소가 검증한 적이 없다.
 * 대신 **어디가** 움직이는지를 적는다.
 *
 * **달을 짚지 않는다.** 달 단위 시기는 독립된 두 표본에서 모두 기준선보다
 * 나빴다(p=0.868). 해까지만 단정한다.
 *
 * **양쪽을 다 말하는 문장을 쓰지 않는다.** "정리하면서 동시에 결실이 나오는,
 * 방향이 둘로 갈린 해" 같은 문장은 틀릴 수가 없어서 아무 말도 아니다.
 * 체계끼리 엇갈리면 엇갈린다고 적고 누가 어느 쪽인지 밝힌다.
 */
import { fillSlots } from './slots.js';
import { readStructures } from '../structure/saju.js';
import { lifeChapters, chaptersAt, chapterTurns } from './life.js';
import { yearSlots } from './year.js';

/** 한 줄 — `**꼬리표:** 말 (체계: 근거)` */
const bullet = (label, text, system, what, cite = null) => ({
  label,
  // 줄바꿈을 그냥 공백으로 누르면 "갑자기 식는다 이 별들이" 처럼 두 문장이
  // 붙어 버린다. 문장이 안 끝난 자리에서만 마침표를 넣고 잇는다.
  text: String(text ?? '')
    .replace(/([^.!?:·])\n+/g, '$1. ')
    .replace(/\s+/g, ' ')
    .trim(),
  cite: cite ?? (system ? `${system}: ${what}` : null),
});

const renderBullet = (b) =>
  `*   **${b.label}:** ${b.text}${b.cite ? ` (${b.cite})` : ''}`;

/** 문장 하나만 — 칸 하나에서 제일 앞의 주장 */
const firstOf = (voices, n = 1) => voices.slice(0, n);

/**
 * ① 핵심 엔진 — 평생 바뀌지 않는 바탕.
 *
 * 장이 바뀌어도 그대로인 것들이다. 명궁 주성·일간·상승점은 물론이고,
 * **평생 고정인 체계**(숙요 본명숙·마하보테·태국 요일)도 여기에 들어간다 —
 * 그것들은 시간축이 없어서 연표에는 못 들어가지만 바탕으로는 제 몫을 한다.
 */
function coreSection(fortune, structures) {
  const bullets = [];
  const style = fillSlots(fortune, structures, 'career').find((s) => s.key === 'style');
  const setting = fillSlots(fortune, structures, 'career').find((s) => s.key === 'setting');

  for (const v of firstOf(style?.filled ?? [], 3)) {
    bullets.push(bullet(v.system, v.text, null, null, v.what));
  }
  for (const v of firstOf(setting?.filled ?? [], 2)) {
    bullets.push(bullet(v.system, v.text, null, null, v.what));
  }

  // 시간축이 없는 체계 — 평생 바탕으로만 쓴다
  for (const v of Object.values(fortune?.results ?? {})) {
    if (!['숙요', '마하보테', '태국 점성술'].includes(v.name)) continue;
    const r = (v.readings ?? []).find((x) => !x.mono);
    if (r) bullets.push(bullet(v.name, r.text, null, null, r.title));
  }

  return {
    heading: '1. 핵심 엔진 — 평생 바뀌지 않는 바탕',
    lead: '장이 바뀌어도 그대로인 것들입니다. 아래 로드맵은 전부 이 바탕 위에서 읽습니다.',
    bullets,
  };
}

/** 장 하나를 한 절로 */
function chapterSection(n, chapters, year, input, label) {
  const here = chaptersAt(chapters, year);
  if (!here.length) return null;
  const saju = here.find((c) => c.system === '사주');
  const span = saju ?? here[0];

  return {
    heading: `${n}. ${label} (${span.fromYear}년~${span.toYear}년 · ${span.fromAge}~${span.toAge}세)`,
    lead: `이 구간에 걸쳐 있는 것이 ${here.length}가지입니다. 주기가 저마다 달라서`
      + ` 시작과 끝이 어긋납니다 — 겹치는 폭이 곧 그 장의 두께입니다.`,
    bullets: here.map((c) => bullet(
      c.system,
      `${c.fromYear}~${c.toYear}년, ${c.label}${c.detail ? ` — ${c.detail}` : ''}`,
      null, null, c.what,
    )),
  };
}

/** 한 해를 한 절로 */
function yearSection(n, input, chart, year, chapters) {
  const slots = yearSlots(input, chart, year, chapters);
  const bullets = [];
  for (const s of slots) {
    if (s.empty || s.key === 'chapter') continue;      // 장은 위 절에서 이미 말했다
    for (const v of s.voices) bullets.push(bullet(v.system, v.text, null, null, `${s.label} · ${v.what}`));
  }
  const turn = slots.find((s) => s.key === 'turn');
  return {
    heading: `${n}. ${year}년`,
    // 다샤 하위 구간(AD)만 바뀌는 것을 '장의 경계'라고 부르면 과장이다.
    // 실제로 구간이 시작하는 것이 있을 때만 그렇게 적는다.
    lead: (turn?.voices ?? []).some((v) => /시작$/.test(v.what))
      ? '이 해에 구간 하나가 새로 시작합니다. 아래에 무엇이 바뀌는지 적었습니다.'
      : '구간 안쪽의 해입니다. 큰 틀은 위와 같고, 그 해에만 들어오는 것이 아래입니다.',
    bullets,
  };
}

/** 마지막 — 몸과 말조심. 근거가 있는 것만 */
function adviceSection(n, fortune, structures) {
  const out = [];
  const health = structures.filter((s) => s.domain === 'health');
  for (const st of health) out.push(bullet('몸', st.text, null, null, `사주 격 · ${st.name}`));

  const ziwei = Object.values(fortune?.results ?? {}).find((v) => v.name === '자미두수');
  const lead = (ziwei?.readings ?? []).find((r) => /명궁 주성/.test(r.title));
  if (lead && /시비|구설|말의 온도/.test(lead.text)) {
    out.push(bullet('말', lead.text, null, null, `자미두수 · ${lead.title}`));
  }
  return out.length
    ? { heading: `${n}. 조심해서 볼 자리`, lead: '근거가 있는 것만 적습니다.', bullets: out }
    : null;
}

/**
 * 평생 보고서.
 *
 * @param {object} deps `readFortune(...)` 의 `{ input, chart, results }` 와 이름
 * @param {number} year 자세히 볼 해
 */
export function lifeReport({ input, chart, fortune }, year, name = null) {
  const structures = (() => {
    try { return readStructures({ ...chart, gender: input.gender }).structures; }
    catch { return []; }
  })();
  const chapters = lifeChapters(input, chart, input.isMale);

  const sections = [];
  sections.push(coreSection(fortune, structures));

  const now = chapterSection(2, chapters, year, input, '지금 지나는 장');
  if (now) sections.push(now);

  sections.push(yearSection(now ? 3 : 2, input, chart, year, chapters));

  // 다음 사주 대운이 시작되는 해
  const nextDaeun = chapters
    .filter((c) => c.system === '사주' && c.fromYear > year)
    .sort((a, b) => a.fromYear - b.fromYear)[0];
  if (nextDaeun) {
    const nx = chapterSection(sections.length + 1, chapters, nextDaeun.fromYear, input, '다음 장');
    if (nx) sections.push(nx);
  }

  const adv = adviceSection(sections.length + 1, fortune, structures);
  if (adv) sections.push(adv);

  // 장이 겹쳐 바뀌는 해 — 드문 자리라 따로 적는다
  const turns = chapterTurns(chapters, {
    from: year, to: year + 40, minSystems: 2, birthYear: input.year,
  });

  const head = `${name ? `${name} 님, ` : ''}열다섯 체계 가운데 **시간축이 있는 아홉**을 한 축에 놓고`
    + ` 평생을 장으로 잘랐습니다. 주기가 저마다 달라(10·9·24년·가변) 시작과 끝이 어긋나며 돕니다.`
    + ` 줄마다 끝에 어느 체계의 어느 자리에서 나온 말인지 붙였습니다.`;

  const tail = turns.length
    ? `\n### 둘 이상이 함께 바뀌는 해\n\n`
      + turns.map((t) => `*   **${t.year}년 (${t.age}세):** ${t.systems.join(' + ')}`).join('\n')
      + `\n\n주기가 어긋나 있어 이런 해는 드뭅니다. 드물다는 것이 요점입니다 — 흔하면 아무 뜻이 없습니다.`
      + ` 다만 **그 해에 무슨 일이 난다고는 말하지 않습니다.** 구간의 경계는 확정 계산이지만,`
      + ` 거기서 사건을 끌어내는 것은 이 저장소가 두 번 재서 두 번 다 신호를 찾지 못했습니다.`
    : '';

  const text = [
    head, '',
    ...sections.flatMap((s) => [
      `### ${s.heading}`, '', s.lead, '',
      ...s.bullets.map(renderBullet), '',
    ]),
    tail,
  ].join('\n');

  return { sections, turns, text };
}

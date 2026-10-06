/**
 * report.js — **AI 없이 쓰는 통합 해석 문서**
 *
 * AI 질문 한 번에 수백 원이 나갔는데, 모델이 하던 일의 대부분은 **엔진이
 * 이미 써 둔 문장 가운데 그 주제에 맞는 것을 골라 배열하는 것**이었다.
 * 그 고르기와 배열을 코드로 옮기면 값이 들지 않는다.
 *
 * ── 한 번 크게 틀렸던 것 ───────────────────────────────────
 * 처음에는 각 체계의 `readings` 를 통째로 주제별 제목 아래에 붙였다. 그래서
 * "1-1. 직장 이동과 재물" 밑에 "하고 싶은 말과 재주가 밖으로 나오는 해"가
 * 실렸다. **제목이 약속한 주제와 내용이 따로 놀았다.**
 *
 * 지금은 `semantic/` 의 분야 모듈에서 가져온다 — `timingFor('직업')` 은 그
 * 해에 관성이 들어오는지를 말하고, `natureOf(관록궁)` 은 일할 때의 결을
 * 말한다. **제목이 묻는 것에 답하는 값**이라야 그 자리에 놓는다.
 *
 * ── 여기서 문장을 새로 짓지 않는다 ─────────────────────────
 * 고르고 배열만 한다. 새로 지으면 어느 계산에서 나온 말인지 추적할 수 없다.
 */
import { areaText } from './forecast.js';
import { currentDaeun, computeDaeun, TEN_GOD_GROUP, elementDistribution } from './core/ganzhi.js';
import { buildBoard, decadeLimits } from './hires/ziwei.js';
import { yearTimeline } from './reading.js';
import { j } from './core/josa.js';
import { yearDirections } from './systems/gujeong.js';
import { timingFor } from './semantic/compose/timing.js';
import { palaceStars, natureOf } from './semantic/structure/stars.js';
import { readSpouse, spousePalaceStars, spouseVerdict } from './semantic/structure/spouse.js';
import { readChildren, childPalaceStars, childrenVerdict } from './semantic/structure/children.js';
import { childrenPack, marriagePack } from './hires/vedicExt.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ── 쉬운 말 거르개 ─────────────────────────────────────────
   이 문서는 처음 보는 사람이 읽는다. 체계 모듈의 풀이에는 근거로 붙은 간지·궁·하우스·다샤
   같은 말이 섞여 있는데, 그 근거는 계산 화면과 AI 문맥에 이미 있다. 여기서는
   ① 강조 표시(**) 를 지우고 ② 용어가 든 괄호를 걷어내고 ③ 그래도 용어가 남은 문장은 뺀다.
   문장을 새로 짓지 않고 덜어내기만 하므로 뜻이 바뀌지 않는다. */
const PALACE = '(?:명|형제|부처|자녀|재백|질액|천이|노복|관록|전택|복덕|부모|신)궁';
const JARGON = new RegExp([
  // 흔한 낱말과 겹치는 용어는 뒤를 좁혀 둔다: 상관없다·이에 대한·세운 계획·지지해·사과·화기애애
  '[\\u4E00-\\u9FFF]', PALACE, '\\d+궁', '기궁', '하우스', '사화', '화록', '화권', '화과', '화기(?!애)',
  '대운', '대한 ?[\\d(]', '유년 ?사화', '원국', '월지', '일지', '년지', '시지', '일간', '천간', '지장간',
  '다샤', '라그나', '삽탐샤', '분할도', '나박샤', '아스타쿠타', '\\bD\\d+\\b', '\\bAD\\b', '\\bMD\\b',
  '세피라', '천반', '지반', '상신', '초전', '중전', '말전', '삼전', '본괘', '동효', '지배성', '상승점', 'MC',
  '본명성', '월명성', '본명숙', '연반', '월반', '세파', '오황살', '암검살', '본명살', '본명적살', 'p=',
  '정관', '편관', '정재', '편재', '식신', '상관(?!없|이 없)', '정인', '편인', '비견', '겁재', '관성', '재성', '식상',
  '인성이', '비겁', '십신', '자평', '판본', '전서', '묘왕', '명식',
  '숙요', '구성학', '기문', '육임', '태을', '베딕', '자미두수', '점성술', '카발라', '수비학', '마하보테', '토정',
  '라이프 패스', '개인년', '삼방', '공궁', '좌보', '우필', '문창', '문곡', '천동', '천기', '태음', '세차',
  '찬드라', '수르야', '득표', '표\\)', '오행', '사주', '자미', '천부', '별이 \\d', '별들', '한 곳에서만', '이 궁',
  '못의 자리', '이자 [가-힣]+입니다', '제\\d효', '초효',
  // 정의만 하는 문장 — "처음 만난 사람이 보는 얼굴입니다" 같은 것은 제목과 겹친다
  '^처음 만난 사람이 보는 얼굴', '^평생 되어 가려는 방향', '^태양이 속이라면',
  // 궁합 쪽 용어: 별자리 각도·지지 관계·인도 궁합 항목·생명나무
  '사각', '삼각', '육각', '°', '시너스트리', '각을 이루', '삼형', '육합', '반합', '원진',
  '(^|\\s)(해|파|충|형): ', '아쉬타쿠타', '바르나', '요니', '나디', '생명나무', '네차흐', '케테르',
  '[목화토금수]극[목화토금수]', '[일이삼사오육칠팔구][백흑벽록황적자][수토목화금]성',
].join('|'));
/** 앞 문장을 빼고 나면 뜻이 끊기는 이음말 */
const DANGLING = /^(그런데|그런데도|그래서|그러니|그러나|하지만|이런|이 때문|그 때문|따라서|오히려)/;
/** 오행 한 글자는 일상어로 — "금이 강합니다" → "쇠 기운이 강합니다" */
const ELEM = { 목: '나무', 화: '불', 토: '흙', 금: '쇠', 수: '물' };
function plain(text) {
  if (text == null) return '';
  // 원문은 문단(빈 줄)과 줄(한 줄짜리 항목)로 나뉘어 있다. 문단 단위로 판단해야
  // 용어 문장을 뺀 뒤에도 앞뒤가 이어지는지 볼 수 있다.
  const paras = String(text).replace(/\*\*/g, '').split(/\n{2,}/);
  const out = [];
  let prevDropped = false;
  for (const raw of paras) {
    // 용어나 한자가 든 괄호는 통째로 걷는다 — "(사주·자미두수)", "(태음)", "(心宿)" 같은 근거 표시
    const p = raw.replace(/[ \t]+/g, ' ').replace(/\s*\(([^()]*)\)/g, (m, inner) => (JARGON.test(inner) ? '' : m)).trim();
    const all = p.split(/(?<=[.!?。])\s+|\n+/).map((x) => x.trim()).filter(Boolean);
    if (!all.length) continue;
    // 용어가 든 문장, 뜻 없이 짧은 상징 문장("절뚝입니다.")은 뺀다
    const ok = all.map((x) => !(x.length < 8 && /[.!?]$/.test(x)) && !JARGON.test(x));
    const keptCount = ok.filter(Boolean).length;
    // 문단의 절반 이상이 걸러지면 남은 문장끼리 이어지지 않는다 — 문단째 뺀다
    if (keptCount === 0 || (all.length >= 3 && keptCount * 2 <= all.length)) { prevDropped = true; continue; }
    const kept = [];
    all.forEach((x, i) => {
      if (!ok[i]) return;
      const cutBefore = i === 0 ? prevDropped : !ok[i - 1];
      // 바로 앞이 빠졌는데 "그런데도…", "드문 일이 아닙니다." 처럼 앞에 기대는 문장이면 같이 뺀다
      // 마침표 없는 꼬리표('기본 기질이 닮았는가')도 앞 줄이 빠지면 혼자 뜻이 없다
      if (cutBefore && (DANGLING.test(x) || x.length < 15 || !/[.!?]$/.test(x))) { ok[i] = false; return; }
      kept.push(x);
    });
    prevDropped = kept.length === 0;
    if (kept.length) out.push(kept.join(' '));
  }
  return out.join(' ')
    // 번역투 다듬기: "~한 결입니다" → "~한 편입니다", "~하는 자리입니다" → "~하는 편입니다"
    .replace(/결(입니다|이라|이고|이에요)/g, '편$1')
    .replace(/([가-힣]+[는은운한]) 자리입니다/g, '$1 편입니다')
    .replace(/되는 자리는/g, '되는 경우는')
    .replace(/자녀 자리는 열리는 쪽/g, '자녀 인연이 넉넉한 쪽')
    .replace(/자녀 자리는 눌리는 쪽/g, '자녀 인연이 적은 쪽')
    .replace(/(^|\s)([목화토금수])(이|가) (강|약)합니다/g, (m, sp, e, _j, w) => `${sp}${ELEM[e]} 기운이 ${w}합니다`)
    .replace(/약한 ([목화토금수])(를|을)/g, (m, e) => `약한 ${ELEM[e]} 기운을`)
    .trim();
}
/** 제목: "일간 을목 — 덩굴과 화초" 처럼 앞이 용어면 뒤쪽 쉬운 말만, 다 용어면 버린다 */
function plainTitle(title) {
  const t = String(title ?? '').replace(/\*\*/g, '').replace(/의 결$/, '의 흐름').trim();
  if (!t || !JARGON.test(t)) return t;
  // "아쉬타쿠타 23.5 / 36점 — 무난" 처럼 점수가 든 제목은 앞의 용어 한 낱말만 뗀다
  if (/\d+(\.\d+)? \/ \d+점/.test(t)) {
    const rest = t.replace(/^\S+\s+/, '');
    if (!JARGON.test(rest)) return rest;
  }
  const tail = t.split(/\s+—\s+/).slice(1).join(' — ');
  return tail && !JARGON.test(tail) ? tail : '';
}

const sysOf = (r, name) =>Object.values(r.results ?? {}).find((v) => v?.name === name) ?? null;

/** 풀이 목록 — 제목을 한 줄 위에 두고 본문을 아래에. 긴 문단이 이어 붙지 않게 항목마다 끊는다 */
const readItems = (items) => {
  const rows = items.map(([title, text]) => [plainTitle(title), plain(text)]).filter(([, text]) => text);
  return !rows.length ? '' : `<ul class="rp-reads">${rows.map(([title, text]) =>
    `<li>${title ? `<strong>${esc(title)}</strong>` : ''}<span>${esc(text)}</span></li>`).join('')}</ul>`;
};

function readings(r, name, max = 99) {
  const s = sysOf(r, name);
  if (!s?.readings?.length) return '';
  return readItems(s.readings.slice(0, max).map((x) => [x.title, x.text]));
}

/** viewmodel 은 칸마다 모양이 다르다 — 그냥 글이거나 `{text, sources}` 다 */
function withSrc(x) {
  if (!x) return null;
  if (typeof x === 'string') return x;
  if (typeof x.text !== 'string') return null;
  return x.sources?.length ? `${x.text} (${x.sources.join('·')})` : x.text;
}

/**
 * '이름 — 풀이' 짝. 예전에는 2열 표였는데 휴대폰 폭에서 첫 칸이 세 글자씩 끊겨
 * 읽기 어려웠다. 넓은 화면에서는 나란히, 좁은 화면에서는 위아래로 쌓는다.
 * (머리글은 화면에 보이지 않지만 호출부가 무엇을 짝짓는지 알 수 있게 남겨 둔다)
 */
const table2 = (_head, rows) => {
  const kept = rows.map(([a, b]) => [a, plain(b)]).filter(([, b]) => b);
  return !kept.length ? '' : `<dl class="rp-kv">${kept.map(([a, b]) =>
    `<div><dt>${esc(a)}</dt><dd>${esc(b)}</dd></div>`).join('')}</dl>`;
};

/** 시기 목록 — 연도 표 대신 세로 타임라인 */
const timeline = (rows) => {
  const kept = rows.map(([when, what]) => [when, plain(what)]).filter(([, what]) => what);
  return !kept.length ? '' : `<ol class="rp-tl">${kept.map(([when, what]) =>
    `<li><span class="rp-tl-k">${esc(when)}</span><p>${esc(what)}</p></li>`).join('')}</ol>`;
};

const para = (t) => { const x = plain(t); return x ? `<p class="rp-t">${esc(x)}</p>` : ''; };

/** 장 — 제목과 한 줄 안내만 보이고 누르면 펼친다. 문서 전체가 한 덩어리로 이어지지 않게 한다 */
const sec = (n, title, body, lead = '') => !body ? '' : `
  <details class="rp-ch">
    <summary><span class="rp-no" aria-hidden="true">${esc(n)}</span><span class="rp-ch-t">${esc(title)}${lead ? `<small>${esc(lead)}</small>` : ''}</span></summary>
    <div class="rp-ch-body">${body}</div>
  </details>`;
/** 장 안의 소제목. 번호는 문서 안 참조용이라 작게 남긴다 */
const sub = (n, title, body) => !body ? '' :
  `<div class="rp-sub"><h4 class="rp-h4">${n ? `<span>${esc(n)}</span>` : ''}${esc(title)}</h4>${body}</div>`;

/** 분야 모듈이 낸 읽기 목록. 체계 이름·궁 이름은 제목으로 쓰지 않는다 */
const readList = (reads, max = 4) => readItems((reads ?? [])
  .filter((x) => x?.text).slice(0, max)
  .map((x) => ['', x.text]));

/**
 * 한 분야의 시기 — **그 분야의 근거로만** 만든 연도표.
 *
 * 문서의 "2027 丁未 | 丑未冲으로 직장·조직 변화" 가 이 모양이다. 주제와
 * 무관한 연운 문구를 쓰면 제목과 내용이 따로 논다.
 */
const TIMING_LABEL = { 결혼: '결혼·인연', 자녀: '자녀', 이사: '이사·이동', 직업: '일의 변화', 재물: '목돈' };
/** "2027~2028년 (35~36세)" → "2027~2028년(35~36세)" */
const spanText = (w) => `${w.span}${w.ageLabel ? `(${w.ageLabel})` : ''}`;

function timingOf(r, domain, span = 10) {
  let t = null;
  try {
    const from = r.input.currentYear;
    t = timingFor(r.input, { ...r.chart, gender: r.input.gender }, domain,
      { from, to: from + span - 1 });
  } catch { return ''; }
  if (!t) return '';

  // 해마다의 근거(간지·사화·다샤)는 전문 계산이라 싣지 않는다. 여러 점술이 겹쳐 짚은 시기를
  // 순서대로 "가장 유력 → 그다음"으로 한 문장에 적는다 ("2가지 방식이…"는 뜻이 안 읽혔다)
  const spans = (t.windows ?? []).slice(0, 3).map(spanText);
  if (!spans.length) return '';
  const label = TIMING_LABEL[domain] ?? domain;
  const first = (t.windows ?? [])[0];
  const josa = j(first.span, '이').slice(first.span.length);
  return `<p class="rp-t rp-when"><span aria-hidden="true">📌</span> ${esc(label)} 시기는 <strong>${esc(spans[0])}</strong>${josa} 가장 유력하고${spans.length > 1 ? `, 그다음은 ${esc(spans.slice(1).join(', '))}` : ''}입니다.</p>`;
}

/* ═══════════════════════════════════════════════════════════
   통합 해석 보고서의 형식

   참고 보고서에서 가져온 것은 차례·제목·표 머리글 같은 편집 형식뿐이다.
   특정인의 결론, 날짜, 관계 평가는 복사하지 않는다. 각 절은 지금 계산한
   명반의 facts·readings·viewmodel만 재배열하므로 대상이 달라지면 내용도
   달라진다. 엔진에 없는 지표(서비스 실적, 추첨 번호, 질문 시각 점시)는
   그럴듯한 답으로 채우지 않고 계산 범위를 적는다.
   ═══════════════════════════════════════════════════════════ */

function readingText(r, sysName, contains) {
  const s = sysOf(r, sysName);
  return s?.readings?.find((x) => String(x.title).includes(contains))?.text ?? '';
}
const labeled = (k, t) => t ? readItems([[k, t]]) : '';

/**
 * 머리글이 여럿인 표 → 작은 카드 묶음. 4열 표는 휴대폰에서 칸마다 두세 글자씩 끊겼다.
 * 첫 칸을 카드 제목으로, 나머지는 머리글을 작은 이름표로 붙인다.
 */
const tableN = (head, rows) => !rows.length ? '' :
  `<ul class="rp-cards">${rows.map((cs) => `<li><b>${esc(cs[0])}</b>${cs.slice(1)
    .map((c, i) => { const x = plain(c); return x ? `<p>${head[i + 1] ? `<span class="rp-lab">${esc(head[i + 1])}</span>` : ''}${esc(x)}</p>` : ''; })
    .join('')}</li>`).join('')}</ul>`;

/** 십성 무리가 그 해에 건드리는 것 — 고정표 */
const GOD_FIELD = {
  관성: '자리와 역할', 재성: '돈과 조건', 식상: '드러냄과 표현',
  인성: '배움과 문서', 비겁: '경쟁과 동료',
};

/* ── 1. 일과 돈 ─────────────────────────────────────────── */

/** 그 해에 들어오는 기운(십성 무리)이 실제로 어떤 일로 나타나기 쉬운가 */
const YEAR_GOD = {
  관성: '직장에서 책임·직함·평가가 걸린 일이 생기기 쉽습니다.',
  재성: '돈이 들어오고 나가는 일, 계약·거래가 많아지기 쉽습니다.',
  식상: '내 생각과 결과물을 밖에 보여줄 일이 많아집니다.',
  인성: '공부·자격·문서·집과 관련된 일이 생기기 쉽습니다.',
  비겁: '동료·경쟁자와 얽히는 일이 많아집니다.',
};

/**
 * 앞으로 십 년, 해마다.
 * 그 해에만 붙는 흐름 문장을 앞에 두고, 생기기 쉬운 일과 대처법은 목록 전체에서 한 번씩만 쓴다
 * — 같은 문장이 해마다 되풀이되면 무엇이 다른 해인지 알 수 없다는 피드백을 받았다.
 */
function s11(v, r) {
  const rows = [];
  const said = new Set();
  const once = (t) => (t && !said.has(t) ? (said.add(t), t) : '');
  try {
    const from = r.input.currentYear;
    const chart = { ...r.chart, gender: r.input.gender };
    const godOf = new Map();
    for (const domain of ['직업', '재물']) {
      for (const x of timingFor(r.input, chart, domain, { from, to: from + 9 }).rows ?? []) {
        for (const w of x.why) {
          const m = w.match(/(정관|편관|정재|편재|식신|상관|정인|편인|비견|겁재)/);
          if (m && !godOf.has(x.year)) godOf.set(x.year, TEN_GOD_GROUP[m[1]]);
        }
      }
    }
    for (const y of yearTimeline(r.input, r.chart, from, from + 9)) {
      const parts = [
        once(firstOf(y.text)),
        once(YEAR_GOD[godOf.get(y.year)]),
        once(y.hit?.kind ? HIT_TIP[y.hit.kind] : ''),
        y.daeunFrom ? '이 해부터 새 라이프 시즌이 시작됩니다.' : '',
      ].filter(Boolean);
      if (!parts.length) continue;
      const mark = y.hit ? (y.hit.good ? '🟢 ' : '🟡 ') : '';
      rows.push([`${mark}${y.year}년 (${y.year - r.input.year}세)`, parts.join(' ')]);
    }
  } catch { /* 목록만 건너뛴다 */ }

  return rows.length
    ? '<p class="rp-fine rp-fine-top">해마다 그 해의 분위기와 생기기 쉬운 일을 적었습니다. 🟢는 넓히기 좋은 해, 🟡는 한 번 더 따져볼 해입니다. 같은 설명은 처음 나온 해에만 적었습니다.</p>'
      + timeline(rows)
    : '';
}

/** 사회에서 드러나는 나 — 점성술 풀이 가운데 쉬운 문장만 */
function s12(r) {
  return labeled('평생 되어 가려는 방향', readingText(r, '점성술', '태양'))
    + labeled('사회에서 이루려는 것', readingText(r, '점성술', '중천'))
    + labeled('처음 만난 사람이 보는 나', readingText(r, '점성술', '상승'));
}

/** 커리어 무기와 자산 스타일 */
const AREA = {
  명궁: '나 자신', 형제궁: '형제·동료', 부처궁: '배우자·관계', 자녀궁: '자녀', 재백궁: '돈',
  질액궁: '건강', 천이궁: '바깥 활동과 이동', 노복궁: '주변 사람', 관록궁: '일과 명예',
  전택궁: '집과 재산', 복덕궁: '마음의 여유', 부모궁: '부모·윗사람',
};
function s13(r) {
  let b = null;
  try { b = buildBoard(r.input); } catch { /* */ }
  const nat = natureOf(palaceStars(r.input, '관록궁'), '일할 때의 본인');
  let nextLine = '';
  try {
    const lim = decadeLimits(r.input, b);
    const cur = lim.find((d) => r.input.currentYear >= d.fromYear && r.input.currentYear <= d.toYear);
    const nxt = cur ? lim.find((d) => d.fromYear > cur.toYear) : null;
    const area = nxt ? AREA[nxt.palaceOfNatal] : null;
    if (area) nextLine = `다음 ${nxt.fromAge}~${nxt.toAge}세(${nxt.fromYear}~${nxt.toYear}년)에는 '${area}' 쪽이 삶의 앞으로 나옵니다.`;
  } catch { /* 생략 */ }

  return labeled('커리어 무기', readingText(r, '자미두수', '관록궁'))
    + labeled('자산 스타일', readingText(r, '자미두수', '재백궁'))
    + labeled('일할 때 주의할 점', nat?.risk?.length ? `${nat.risk.join(', ')}.` : '')
    + para(nextLine);
}

const careerLife = (v, r) =>
  sub('', '앞으로 십 년, 해마다', s11(v, r))
  + sub('', '내 커리어 무기와 자산 스타일', s13(r))
  + sub('', '사회에서 보이는 나', s12(r))
  + sub('', '타고난 성향', readings(r, '사주', 3))
  + sub('', '인생의 세 시기', timeline([['초년', firstOf(withSrc(v.life?.early), 4)], ['중년', firstOf(withSrc(v.life?.middle), 4)],
    ['말년', firstOf(withSrc(v.life?.late), 4)]].filter(([, t]) => t)));

/* ── 2. 사랑과 가족 ─────────────────────────────────────── */

function relations(v, r) {
  const chart = { ...r.chart, gender: r.input.gender };
  let sp = [], spv = { lines: [] }, ch = [], chv = { lines: [] };
  try {
    sp = readSpouse(chart, spousePalaceStars(r.input), marriagePack(r.input), palaceStars(r.input, '부처궁'));
    spv = spouseVerdict(sp);
  } catch { /* */ }
  try {
    ch = readChildren(chart, childPalaceStars(r.input), childrenPack(r.input), palaceStars(r.input, '자녀궁'));
    chv = childrenVerdict(ch);
  } catch { /* */ }

  return sub('', '배우자 — 어떤 사람이고 언제인가',
      para(withSrc(v.life?.spouse)) + (spv.lines ?? []).map(para).join('') + readList(sp, 2) + timingOf(r, '결혼'))
    + sub('', '자녀',
      para(withSrc(v.life?.child)) + (chv.lines ?? []).map(para).join('') + readList(ch, 2) + timingOf(r, '자녀'))
    + sub('', '형제·동료', para(withSrc(v.life?.sibling)));
}

/* ── 3. 올해 흐름 ───────────────────────────────────────── */

function thisYear(v, f, r) {
  const yr = f.year?.period?.sajuYear ?? r.input.currentYear;
  const AREAS = ['금전운', '직장운', '애정운', '학업운', '건강운'];
  // 운세의 한 해는 입춘(2월 초)에 시작해 다음 해 1월에 끝난다. 그래서 '1월'이 맨 끝에 온다 —
  // 헷갈리지 않게 달마다 연도를 붙이고 이번 달을 표시한다.
  const nowKey = f.today.y * 100 + f.today.m;
  const moods = [];
  const months = (f.timeline ?? []).map((m) => {
    const a = m.areas ?? {};
    const pick = (k) => a[k]?.score ?? null;
    const ranked = AREAS.map((k) => [k, pick(k)]).filter(([, s]) => s != null).sort((x, y) => y[1] - x[1]);
    const best = ranked[0], worst = ranked.at(-1);
    const mood = areaText('총운', pick('총운') ?? m.score, 'month');
    if (mood && !moods.includes(mood)) moods.push(mood);
    const tag = String(mood ?? '').split(/(?<=[.!?])\s/)[0].replace(/입니다\.$/, '');
    const key = m.from.y * 100 + m.from.m;
    return [
      `${m.from.y}년 ${m.from.m}월${key === nowKey ? ' · 이번 달' : ''}`,
      tag,
      best ? best[0].replace('운', '') : '',
      worst ? worst[0].replace('운', '') : '',
    ];
  });
  const legend = moods.map((x) => {
    const [head, ...rest] = x.split(/(?<=[.!?])\s/);
    return [head.replace(/입니다\.$/, ''), rest.join(' ') || head];
  });

  const areas = ['총운', '금전운', '직장운', '애정운', '학업운', '건강운']
    .map((a) => {
      const s = f.year?.areas?.[a]?.score;
      return s == null ? null : [a === '총운' ? '전체' : a.replace('운', ''), areaText(a, s, 'year')];
    }).filter(Boolean);

  return sub('', `${yr}년 분야별 흐름`, table2(['영역', '풀이'], areas))
    + sub('', '올해의 메인 테마', readings(r, '토정비결', 2) + readings(r, '태을신수', 1))
    + sub('', '타고난 요일의 성향', readings(r, '태국 점성술', 1))
    + sub('', '달마다의 흐름',
      '<p class="rp-fine rp-fine-top">운세의 한 해는 입춘(2월 초)에 시작해 다음 해 1월에 끝나서 1월이 맨 뒤에 옵니다. 달의 경계도 1일이 아니라 절기(매달 4~8일 무렵)입니다.</p>'
      + table2(['분위기', '뜻'], legend)
      + tableN(['달', '', '잘 풀리는 쪽', '조심할 쪽'], months)
      + '<p class="rp-fine">어느 달이 더 좋다는 순위가 아니라, 그 달에 어느 쪽이 상대적으로 잘 풀리고 어느 쪽을 조심할지로 읽어 주세요.</p>');
}

/* ── 4. 방향과 이동 ─────────────────────────────────────── */

function direction(r, f) {
  let d = null;
  try { d = yearDirections(r.input.sajuYear, f.year?.period?.sajuYear ?? r.input.currentYear); }
  catch { /* */ }
  const uniq = (xs) => [...new Set(xs)];
  const rows = [];
  if (d?.good?.length) rows.push(['좋은 방향', uniq(d.good.map((g) => g.dir)).join(', ')]);
  if (d?.bad?.length) rows.push(['피할 방향', uniq(d.bad.map((b) => b.dir)).join(', ')]);
  const thai = sysOf(r, '태국 점성술')?.facts ?? [];
  const lucky = thai.filter((x) => /색|요일/.test(x.label)).map((x) => `${x.label} ${x.value}`).join(' · ');

  return table2(['구분', '방향'], rows)
    + (lucky ? labeled('나의 행운 상징', lucky) : '')
    + (rows.length ? '<p class="rp-fine">지금 사는 곳에서 본 올해 기준 방향입니다. 실제 이사는 날짜와 목적지가 정해지면 다시 확인하세요.</p>' : '')
    + sub('', '타고난 기질', readings(r, '구성학', 1))
    + sub('', '옮기기 좋은 시기', timingOf(r, '이사', 8));
}

/* ── 5. 내면의 패턴 ─────────────────────────────────────── */

function inner(r) {
  // 일이 풀리고 막히는 흐름 — 고정 3행
  const pattern = [
    ['잘 풀릴 때', '분석 → 기준 결정 → 실행 → 공개 → 평가 → 확장'],
    ['멈출 때', '분석 → 재분석 → 새 변수 발견 → 다시 설계 → 미완성'],
    ['새어 나갈 때', '흥분 → 여러 개 동시 시작 → 비용·시간 과투입 → 피로 → 중단'],
  ];
  return sub('', '일이 풀리고 막히는 흐름', timeline(pattern))
    + sub('', '생일 숫자로 본 나', readings(r, '카발라', 1))
    + sub('', '타고난 과제', readings(r, '주역', 2))
    + sub('', '타로 카드', readings(r, '타로', 2));
}

/* ── 6. 시기 한눈에 보기 ────────────────────────────────── */

function finale(r) {
  const items = [];
  for (const [domain, icon, what] of [
    ['직업', '💼', '일에서 가장 큰 기회와 변화가 오는 때'],
    ['재물', '💰', '돈이 가장 크게 들어오는 때'],
    ['결혼', '💞', '인연·관계가 가장 무르익는 때'],
    ['자녀', '👶', '자녀 인연이 가장 강한 때'],
    ['이사', '🏠', '이사·이동하기 가장 좋은 때'],
  ]) {
    try {
      const from = r.input.currentYear;
      const t = timingFor(r.input, { ...r.chart, gender: r.input.gender }, domain,
        { from, to: from + 14 });
      const w = (t.windows ?? [])[0];
      if (w) items.push(`<li><span class="rp-ic" aria-hidden="true">${icon}</span><div><p>${esc(what)}는 <strong>${esc(spanText(w))}</strong>입니다.</p></div></li>`);
    } catch { /* */ }
  }
  const principles = [
    '한 번에 크게 키우는 일은 하나만 둡니다.',
    '분석은 기한을 두고 끝냅니다. 충분히 모였다고 판단되면 실행합니다.',
    '능력은 숫자·문서·결과물처럼 밖에 보이는 증거로 남깁니다.',
    '재물은 횡재보다 본업 경쟁력 → 추가 현금흐름 → 자산 축적 순서로 키웁니다.',
    '관계는 말보다 생활과 책임에서 실제 행동이 바뀌는지를 봅니다.',
    '운세는 선택을 대신하는 도구가 아니라, 되풀이되는 패턴을 점검하는 보조 자료입니다.',
  ];
  return sub('', '앞으로 15년, 분야마다 가장 유력한 때', (items.length ? `<ul class="rp-bul">${items.join('')}</ul>` : '')
      + '<p class="rp-fine">시기는 참고로만 보세요. 실제 사례로 맞혀 봤을 때 연도를 짚는 정확도는 높지 않았습니다.</p>')
    + sub('', '실행 원칙', `<ul class="rp-ul">${principles.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`);
}

/* ── 문서 전체 ──────────────────────────────────────────── */

/* ═══════════════════════════════════════════════════════════
   인생 데이터 분석 리포트 — 문서 맨 위의 네 장
   점술 용어를 일상·커리어 말로 옮겨 [이모지 + 핵심 한 줄 + 요약 + 실행] 모양으로 보여준다.
   여기서도 새 판단을 짓지 않는다. 엔진이 이미 쓴 문장 가운데 그 칸에 맞는 것을 골라
   쉬운 말 거르개(plain)를 거쳐 앞 한두 문장만 싣는다.
   용어 번역: 십 년 흐름 → 라이프 시즌, 충·형·파 → 성장통, 관록궁 → 커리어 무기, 재백궁 → 자산 스타일
   ═══════════════════════════════════════════════════════════ */

const sentencesOf = (text) => plain(text).split(/(?<=[.!?])\s+/).filter(Boolean);
const firstOf = (text, n = 1) => sentencesOf(text).slice(0, n).join(' ');
/** 문장 가운데 조건(다만·주의…)에 맞는 첫 문장, 없으면 빈 값 */
const pickOf = (text, re) => sentencesOf(text).find((x) => re.test(x)) ?? '';
const readingBy = (r, sys, re) => sysOf(r, sys)?.readings?.find((x) => re.test(String(x.title))) ?? null;
const CAUTION = /다만|주의|조심|쉽습니다|놓치|무너|지치|마찰|부딪/;

const bullet = (icon, label, text) => !text ? '' :
  `<li><span class="rp-ic" aria-hidden="true">${icon}</span><div><b>${esc(label)}</b><p>${esc(text)}</p></div></li>`;
const card = (icon, title, body) => !body ? '' :
  `<section class="rp-card"><h3 class="rp-card-h"><span aria-hidden="true">${icon}</span> ${esc(title)}</h3>${body}</section>`;
const bullets = (...items) => { const x = items.join(''); return x ? `<ul class="rp-bul">${x}</ul>` : ''; };

/**
 * 라이프 시즌(십 년 흐름)마다 실제로 어떤 시기인지.
 * 십성 무리의 뜻을 생활 언어로 옮긴 고정표다 — '경쟁과 동료' 같은 이름만으로는
 * 무슨 일이 생기는지 알 수 없다는 피드백을 받아 붙였다.
 */
const SEASON = {
  비겁: {
    what: '주변에 비슷한 목표를 가진 사람이 많아지는 시기입니다. 동료·친구·경쟁자와 얽히는 일이 늘고, 내 힘으로 버티고 스스로 결정하는 힘이 커집니다.',
    good: '마음 맞는 사람과 힘을 합치면 혼자일 때보다 판이 커집니다.',
    watch: '같은 자리나 같은 돈을 두고 겨루면 사람을 잃기 쉽습니다. 동업·공동 투자는 몫과 역할을 문서로 정해 두세요.',
    act: '함께할 사람을 고르고 역할을 나누세요',
  },
  식상: {
    what: '내 재주와 생각을 밖으로 꺼내는 시기입니다. 만든 것·말한 것·쓴 것이 평가를 받고, 이름이 알려지기 쉽습니다.',
    good: '결과물을 꾸준히 보여줄수록 기회가 따라옵니다.',
    watch: '말이 앞서면 윗사람이나 조직과 부딪칩니다. 옳은 말도 전하는 순서와 자리를 고르세요.',
    act: '만든 것을 밖에 보여주세요',
  },
  재성: {
    what: '돈과 현실 조건이 삶의 중심에 오는 시기입니다. 벌 기회가 늘고, 수입 구조나 거래·계약이 바뀌기 쉽습니다.',
    good: '실제로 손에 남는 돈을 기준으로 움직이면 자산이 쌓입니다.',
    watch: '들어오는 만큼 나가는 돈도 커집니다. 큰 지출·투자는 한 번에 몰지 말고 나눠서 결정하세요.',
    act: '수입 구조를 하나 더 만드세요',
  },
  관성: {
    what: '직함·책임·조직 안의 자리가 주제가 되는 시기입니다. 승진·이동·역할 변경처럼 맡는 일이 바뀌기 쉽습니다.',
    good: '맡은 자리에서 믿음을 쌓으면 그것이 그대로 다음 자리로 이어집니다.',
    watch: '책임이 커지는 만큼 압박도 커집니다. 성과보다 소진으로 무너지지 않게 쉬는 시간을 일정에 넣으세요.',
    act: '맡은 자리에서 책임의 크기를 키우세요',
  },
  인성: {
    what: '배우고 자격을 갖추고 기반을 다지는 시기입니다. 공부·자격·문서·집과 관련된 일이 앞으로 나오고, 도와주는 사람이 붙기 쉽습니다.',
    good: '당장의 성과보다 실력과 자격에 시간을 쓰면 다음 시즌에 크게 돌아옵니다.',
    watch: '준비만 길어지고 실행이 늦어지기 쉽습니다. 배운 것은 기한을 정해 써먹으세요.',
    act: '자격·공부에 시간을 투자하세요',
  },
};

/** 그 해에 겹치는 일(합·충 등)을 생활 언어로 — 무엇이 일어나기 쉬운가 + 어떻게 하면 좋은가 */
const HIT_TIP = {
  육합: '협업·계약·만남을 시작하기 좋습니다. 함께할 사람이나 파트너를 정하기 좋은 해입니다.',
  반합: '주변의 추천·제안이 들어오기 쉽습니다. 받은 제안은 한 번 더 들여다보세요.',
  충: '이직·이사·역할 변경처럼 자리가 바뀌는 일이 생기기 쉽습니다. 떠밀려 바뀌기 전에 미리 계획을 세워 두세요.',
  삼형: '같은 문제로 말이 반복해서 오가기 쉽습니다. 중요한 합의는 말보다 문서로 남기세요.',
  상형: '같은 문제로 말이 반복해서 오가기 쉽습니다. 중요한 합의는 말보다 문서로 남기세요.',
  자형: '혼자 떠안고 지치기 쉽습니다. 일을 나눠 맡기고 도움을 요청하세요.',
  해: '겉으로는 조용해도 속으로 서운함이 쌓이기 쉽습니다. 불만은 작을 때 말로 풀어 두세요.',
  파: '정해둔 계획이나 약속이 틀어지기 쉽습니다. 계약·약속은 조건을 한 번 더 확인하세요.',
};

/** 약한 기운을 생활에서 채우는 법 — 오행표를 행동으로 옮긴 고정표 */
const ELEM_FILL = {
  목: { name: '나무', means: '시작하고 성장하는 힘', how: '새로운 것을 배우거나 작은 일을 먼저 시작해 보세요. 아침 운동·산책처럼 몸을 깨우는 습관과 장기 계획 세우기가 도움이 됩니다.' },
  화: { name: '불', means: '표현하고 드러내는 힘', how: '생각을 글이나 말로 밖에 꺼내는 연습을 해 보세요. 사람을 만나는 자리, 햇볕 아래 활동, 결과물을 공개하는 일이 도움이 됩니다.' },
  토: { name: '흙', means: '중심을 잡고 버티는 힘', how: '규칙적인 생활 리듬을 만들고, 저축처럼 꾸준히 쌓는 일을 하나 정해 두세요. 한 곳에 오래 머무르며 신뢰를 쌓는 것이 도움이 됩니다.' },
  금: { name: '쇠', means: '결단하고 정리하는 힘', how: '마감과 기준을 먼저 정하고 움직이세요. 주변 정리정돈, 버릴 것 버리기, 할 일 목록 줄이기가 도움이 됩니다.' },
  수: { name: '물', means: '쉬고 생각하고 유연하게 흘려보내는 힘', how: '잠과 휴식을 일정에 먼저 넣고, 혼자 생각하는 시간을 따로 확보하세요. 독서·기록·물가 산책처럼 속도를 늦추는 습관이 도움이 됩니다.' },
};
const ELEM_KEYS = ['목', '화', '토', '금', '수'];

function lifeSeasons(r) {
  let ds = null, dae = null;
  try { ds = computeDaeun(r.chart, r.input.isMale, r.input.jdUT); dae = currentDaeun(ds, r.input.age); } catch { /* */ }
  let years = [];
  try { years = yearTimeline(r.input, r.chart, r.input.currentYear, r.input.currentYear + 9); } catch { /* */ }
  const ageOf = (year) => year - r.input.year;
  const group = dae ? TEN_GOD_GROUP[dae.god] : null;
  const info = group ? SEASON[group] : null;
  const fromYear = dae ? r.input.year + dae.fromAge : null;
  const next = dae && ds?.list ? ds.list.find((x) => x.fromAge > dae.fromAge) : null;
  const nextInfo = next ? SEASON[TEN_GOD_GROUP[next.god]] : null;

  // 한 해씩 — 그 해의 흐름 한두 문장 + 겹치는 일과 대처법
  const yearLine = (y) => {
    const head = firstOf(y.text, 1);
    const tip = y.hit?.kind ? HIT_TIP[y.hit.kind] : '';
    const bond = y.bond ? '연애·결혼처럼 사람과의 인연이 움직이기 쉬운 해이기도 합니다.' : '';
    return [head, tip, bond].filter(Boolean).join(' ');
  };
  const good = years.filter((y) => y.hit?.good || y.bond).slice(0, 3);
  const check = years.filter((y) => y.hit && !y.hit.good).slice(0, 3);
  return {
    season: info
      ? `${dae.fromAge}~${dae.toAge}세(${fromYear}~${fromYear + 9}년)는 '${GOD_FIELD[group]}'의 라이프 시즌입니다. ${info.what}`
      : '',
    seasonTips: info ? [['👍', '이 시즌을 잘 쓰는 법', info.good], ['🧭', '이 시즌에 조심할 점', info.watch]] : [],
    next: next && nextInfo ? `${next.fromAge}세부터는 '${GOD_FIELD[TEN_GOD_GROUP[next.god]]}'의 시즌으로 넘어갑니다. ${firstOf(nextInfo.what)}` : '',
    act: info?.act ?? '',
    good: good.map((y) => [`${y.year}년 (${ageOf(y.year)}세)`, yearLine(y)]),
    check: check.map((y) => [`${y.year}년 (${ageOf(y.year)}세)`, yearLine(y)]),
  };
}

/**
 * 실행 3가지 — 한 줄 제목 + 왜 그런지 두세 문장.
 * 세 칸이 같은 문장을 되풀이하지 않게 이미 쓴 문장은 건너뛴다.
 */
function actionItems(r, v, me, s) {
  const used = new Set();
  const take = (...cands) => {
    const t = cands.find((x) => x && !used.has(x));
    if (t) used.add(t);
    return t ?? '';
  };
  const strip = (t) => String(t ?? '').replace(/^다만\s+/, '');

  // DO — 지금 시즌에 맞는 움직임 + 일하는 방식
  const doWhy = [take(pickOf(withSrc(v.work?.job), /편이 낫|잘 됩니다|좋습니다/)), s.seasonTips?.[0]?.[2] ? take(s.seasonTips[0][2]) : ''].filter(Boolean).join(' ');

  // DON'T — 돈·결정 습관에서 반복되기 쉬운 실수
  const dontHead = strip(take(pickOf(withSrc(v.work?.money), /마세요|말고/), pickOf(withSrc(v.work?.money), CAUTION)));
  const dontWhy = dontHead
    ? '돈이 들어오면 쓰기 전에 일정 몫을 먼저 따로 떼어 두세요. 저축·비상금 통장으로 자동이체를 걸어 두면 손에 닿기 전에 남길 수 있습니다.'
    : '';

  // KEY — 가장 약한 기운을 생활에서 채우는 법
  let weak = null;
  try { weak = ELEM_KEYS[elementDistribution(r.chart.pillars).weakest]; } catch { /* */ }
  const fill = weak ? ELEM_FILL[weak] : null;

  return [
    ['DO', s.act ? `${s.act}.` : '', doWhy],
    ["DON'T", dontHead, dontWhy],
    ['KEY', fill ? `약한 '${fill.name}' 기운을 생활 습관으로 채우세요.` : '', fill ? `${fill.name} 기운은 ${fill.means}입니다. 타고난 구성에서 이 힘이 가장 옅어 쉽게 무리하거나 한쪽으로 치우칩니다. ${fill.how}` : ''],
  ].filter(([, head, why]) => head || why);
}

function lifeReport(form, r, f, v) {
  const me = readingBy(r, '사주', /^일간/);
  const strong = readingBy(r, '사주', /우세/);
  const asc = readingText(r, '점성술', '상승');
  let risk = '';
  try { risk = natureOf(palaceStars(r.input, '관록궁'), '일할 때의 본인')?.risk?.[0] ?? ''; } catch { /* */ }
  const essence = [plainTitle(me?.title), firstOf(me?.text)].filter(Boolean).join(' — ');
  const kw = v.hero?.keywords ?? [];

  const s = lifeSeasons(r);
  const yearText = withSrc(v.now?.year);

  return card('⚡', '한눈에 보는 내 인생의 핵심 키워드',
      (kw.length ? `<p class="rp-chips">${kw.map((k) => `<span>#${esc(k)}</span>`).join('')}</p>` : '')
      + (essence ? `<blockquote class="rp-quote">${esc(essence)}</blockquote>` : '')
      + bullets(
        bullet('🎯', '타고난 강점', firstOf(strong?.text, 2) || firstOf(withSrc(v.life?.career))),
        bullet('💡', '사회적 역할', firstOf(asc, 3) || firstOf(withSrc(v.work?.job))),
        bullet('⚠️', '주의할 패턴', pickOf(me?.text, CAUTION) || (risk ? `${risk}.` : '')),
      ))
    + card('🚀', '커리어 & 재물: 나의 시장 가치와 돈 버는 법',
      `<h4 class="rp-h4">🛠️ 내 대표 스킬 & 무기</h4>`
      + bullets(
        bullet('', '어떤 일을 할 때 빛나는가', firstOf(withSrc(v.life?.career), 2)),
        bullet('', '성공 방정식', firstOf(withSrc(v.work?.job), 3)),
      )
      + `<h4 class="rp-h4">💰 돈이 들어오는 흐름</h4>`
      + bullets(
        bullet('', '수익 스타일', firstOf(readingText(r, '자미두수', '재백궁'), 2) || firstOf(withSrc(v.work?.money), 2)),
        bullet('', '돈 관리 주의점', pickOf(withSrc(v.work?.money), CAUTION)),
      ))
    + card('📅', '타임라인: 지금 나는 어느 계절을 지나고 있는가',
      bullets(bullet('🌊', '지금 내 삶의 메인 테마', s.season))
      + (s.seasonTips.length ? bullets(...s.seasonTips.map(([ic, k, t]) => bullet(ic, k, t))) : '')
      + (yearText ? bullets(bullet('📍', `올해(${r.input.currentYear}년)는`, firstOf(yearText, 3))) : '')
      + (s.good.length ? `<h4 class="rp-h4">🟢 기회의 구간 — 노 저어야 할 때</h4>
        <p class="rp-fine rp-fine-top">일과 사람이 잘 맞물려, 새로 시작하거나 넓히기 좋은 해입니다.</p>${timeline(s.good)}` : '')
      + (s.check.length ? `<h4 class="rp-h4">🟡 점검의 구간 — 내실 다질 때</h4>
        <p class="rp-fine rp-fine-top">나쁜 해라는 뜻이 아니라, 변화나 마찰이 생기기 쉬워 큰 결정 전에 한 번 더 따져볼 해입니다.</p>${timeline(s.check)}` : '')
      + (s.next ? bullets(bullet('🔭', '다음 라이프 시즌', s.next)) : '')
      + `<p class="rp-fine">시기는 참고로만 보세요. 실제 사례로 맞혀 봤을 때 연도를 짚는 정확도는 높지 않았습니다.</p>`)
    + card('🎯', '당장 실행해볼 수 있는 Action Item 3가지',
      `<ol class="rp-act">`
      + actionItems(r, v, me, s)
        .map(([k, head, why]) => `<li><span class="rp-tag rp-tag-${k === 'DO' ? 'do' : k === 'KEY' ? 'key' : 'dont'}">${esc(k)}</span><div>${head ? `<b>${esc(head)}</b>` : ''}${why ? `<p>${esc(why)}</p>` : ''}</div></li>`).join('')
      + `</ol>`);
}

export function renderReport(form, r, f, v) {
  const today = `${f.today.y}.${String(f.today.m).padStart(2, '0')}.${String(f.today.d).padStart(2, '0')}`;
  const yr = f.year?.period?.sajuYear ?? r.input.currentYear;
  const name = v.who?.name ?? form.name ?? '';
  // 예전 문서에서 뺀 것: '프로젝트·사업·수익화'(모든 사람에게 같은 면책 문구), '전반 신수'(올해 장과 같은 표),
  // '질문별 답변 색인'(요약과 같은 내용). 계산이나 문장을 바꾼 것이 아니라 겹친 자리를 걷어낸 것이다.
  const chapters = [
    sec(1, '일과 돈', careerLife(v, r), '평생의 커리어와 현금 흐름'),
    sec(2, '사랑과 가족', relations(v, r), '배우자·자녀·형제'),
    sec(3, `${yr}년과 열두 달`, thisYear(v, f, r), '올해의 분야별 흐름과 달마다의 흐름'),
    sec(4, '방향과 이동', direction(r, f), '나에게 열린 방향과 옮기기 좋은 시기'),
    sec(5, '내면의 패턴', inner(r), '일이 풀릴 때와 막힐 때'),
    sec(6, '시기 한눈에 보기', finale(r), '일·돈·인연·이사가 가장 유력한 해'),
  ].filter(Boolean).join('');

  return `
    <section class="rp" aria-labelledby="rp-title">
      <header class="rp-cover">
        <p class="rp-kicker">인생 데이터 분석 · ${esc(today)}</p>
        <h2 class="rp-title" id="rp-title"><span aria-hidden="true">🔮</span> ${esc(name ? `${name}님의` : '나의')} 인생 데이터 분석 리포트</h2>
        <p class="rp-lead">열다섯 가지 동양·서양 점술이 함께 가리키는 것을 나만을 위한 결과지로 정리했습니다.</p>
      </header>
      ${lifeReport(form, r, f, v)}
      <h3 class="rp-more">더 자세히 보기</h3>
      <div class="rp-chs">${chapters}</div>
      <p class="rp-note">여러 점술의 해석을 모은 기록이며 과학적으로 검증된 예측이 아닙니다.
        이직·투자·건강·관계 결정에서는 현실 조건과 객관적 자료를 우선해 주세요.</p>
    </section>`;
}

/* ═══════════════════════════════════════════════════════════
   궁합 — 통합 관계 해석 보고서
   개인 문서와 같은 원칙이다. 여기서 문장을 짓지 않고, 각 체계가 두 사람을
   맞대 보고 이미 써 둔 말을 절마다 골라 놓는다.
   ═══════════════════════════════════════════════════════════ */

/** 궁합 결과에서 체계 하나 */
const pSys = (c, name) => (c.results ?? []).find((x) => x?.name === name) ?? null;


/** 그 체계의 풀이 */
function pRead(c, name, max = 2) {
  const s = pSys(c, name);
  if (!s?.readings?.length) return '';
  return readItems(s.readings.slice(0, max).map((x) => [x.title, x.text]));
}

function pFirstText(c, name) {
  const item = pSys(c, name)?.readings?.[0];
  if (!item) return '';
  return [item.title, item.text].filter(Boolean).join(' — ');
}

/** 한 체계 절 — 쉬운 제목 + 풀이 */
const pBlock = (c, n, title, name, max = 2) => sub(n, title, pRead(c, name, max));

const pairAxisText = (v, key) => {
  const axis = v?.eightAxes?.find((item) => item.key === key);
  if (!axis) return '';
  return [axis.conclusion, axis.reality, axis.good, axis.bad].filter(Boolean).join(' ');
};

function pairCommonYear(v, year) {
  const lifeRows = [
    ['생활의 기준', pairAxisText(v, '생활')],
    ['돈·일의 조율', pairAxisText(v, '돈')],
    ['역할 나누기', pairAxisText(v, '역할분담')],
  ].filter(([, value]) => value);
  const impactRows = [
    ['끌림', pairAxisText(v, '끌림')],
    ['감정', pairAxisText(v, '감정')],
    ['대화', pairAxisText(v, '대화')],
  ].filter(([, value]) => value);

  return sub('', '결혼·생활 계획',
    table2(['공동 과제', `${year}년 해석`], lifeRows)
    + `<p class="rp-fine">실제 결혼·주거·재정 일정은 두 사람의 합의와 현실 조건으로 정해야 합니다. 관계 명반에서 반복되는 점검 항목입니다.</p>`)
    + sub('', '서로에게 미치는 영향',
      table2(['관계 축', '관계에서 읽힌 축'], impactRows));
}

function pairCurrentChecklist(c, v) {
  const rows = [
    ['생활', pairAxisText(v, '생활')],
    ['돈', pairAxisText(v, '돈')],
    ['대화', pairAxisText(v, '대화')],
    ['오래 가려면', pairAxisText(v, '장기유지')],
  ];
  return table2(['관계 축', '지금 확인할 점'], rows)
    + `<p class="rp-fine">달별 관계 예측은 계산하지 않습니다. 지금의 관계에서 확인할 축을 모은 것입니다.</p>`;
}

function pairGoodTime(c) {
  return pRead(c, '주역', 1) + pRead(c, '카발라', 1)
    + `<p class="rp-fine">날짜를 길일로 판정하는 별도 계산은 하지 않습니다. 실제 일정은 건강·계약·가족 상황을 먼저 확인하세요.</p>`;
}

export function renderPairReport(formA, formB, c, v, elementDist) {
  const A = c.A?.input?.name ?? formA.name;
  const B = c.B?.input?.name ?? formB.name;
  const s = c.synthesis ?? {};
  const today = new Date();
  const stamp = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;
  const year = c.A?.input?.currentYear ?? today.getFullYear();

  // 오행 보완성 — 두 사람 수치를 나란히 놓고 적은 쪽을 짚는다(수치는 싣지 않고 결론만)
  const ea = elementDist?.a, eb = elementDist?.b;
  const elemRows = (ea && eb) ? ['목', '화', '토', '금', '수'].map((e, i) => {
    const x = Math.round(ea[i] * 10) / 10, y = Math.round(eb[i] * 10) / 10;
    // 0.8 이상 벌어지면 한쪽으로 기운 것으로 본다. 오행 수치는 지장간까지
    // 가중해 더한 값이라 1.0 을 문턱으로 잡으면 눈에 띄는 차이도 '비슷함'이 된다
    const note = (x < 1 && y < 1) ? '두 사람 모두 약합니다. 서로 채워주지 못하는 기운입니다.'
      : x - y >= 0.8 ? `${A}님 쪽이 강합니다.` : y - x >= 0.8 ? `${B}님 쪽이 강합니다.` : '두 사람이 비슷합니다.';
    return [`${ELEM[e]} 기운`, note];
  }) : [];

  const omen = [['주역', '주역 점괘'], ['토정비결', '토정비결'], ['타로', '타로']]
    .filter(([name]) => pSys(c, name))
    .map(([name, label]) => [label, pFirstText(c, name).split(' — ').slice(1).join(' — ') || pFirstText(c, name)]);
  const count = (k) => s.buckets?.[k]?.length ?? 0;

  const chapters = [
    sec(1, '두 사람의 기본 성향',
      sub('', '성격이 맞물리는 방식', pRead(c, '사주'))
      + sub('', '서로 채워주는 기운', table2(['기운', '두 사람'], elemRows)
        + (elemRows.length ? '<p class="rp-fine">두 사람 모두 약한 기운은 상대가 채워주지 못합니다. 생활 습관으로 의식해서 메워 주세요.</p>' : '')),
      '성격과 기운의 궁합'),
    sec(2, '감정과 끌림',
      pBlock(c, '', '서로 끌리는 방식', '점성술')
      + pBlock(c, '', '함께 사는 모습', '자미두수')
      + pBlock(c, '', '타고난 별자리로 본 사이', '숙요'),
      '끌림·감정·대화'),
    sec(3, '생활의 궁합',
      pBlock(c, '', '태어난 요일로 본 사이', '태국 점성술', 1)
      + pBlock(c, '', '인도식 궁합', '베딕')
      + pBlock(c, '', '생활 리듬', '구성학')
      + pBlock(c, '', '생일 숫자로 본 사이', '카발라'),
      '돈·역할·생활 리듬'),
    sec(4, `${year}년 두 사람`,
      pairCommonYear(v, year)
      + sub('', '지금 확인할 점', pairCurrentChecklist(c, v))
      + sub('', '화합하기 좋은 흐름', pairGoodTime(c))
      + sub('', '올해의 점괘', readItems(omen)),
      '함께 맞이할 올해'),
  ].filter(Boolean).join('');

  return `
    <section class="rp" aria-labelledby="rp-title">
      <header class="rp-cover">
        <p class="rp-kicker">관계 데이터 분석 · ${esc(stamp)}</p>
        <h2 class="rp-title" id="rp-title"><span aria-hidden="true">💞</span> ${esc(A)} · ${esc(B)} 관계 분석 리포트</h2>
        <p class="rp-lead">두 사람의 출생 정보를 열다섯 가지 점술로 맞대어 본 결과를 한 장으로 정리했습니다.</p>
      </header>
      ${card('⚡', '한눈에 보는 두 사람', (s.verdict ? `<p class="rp-verdict">${esc(s.verdict)}</p>` : '')
        + para(firstOf([s.summary].flat().filter(Boolean).join(' '), 2))
        + bullets(
          bullet('🟢', '잘 맞는다고 본 점술', count('좋음') ? `${count('좋음')}가지` : ''),
          bullet('⚪', '무난하다고 본 점술', count('무난') ? `${count('무난')}가지` : ''),
          bullet('🟡', '어렵다고 본 점술', count('어려움') ? `${count('어려움')}가지 — 여기서 짚는 점이 실제로 부딪칠 자리일 가능성이 큽니다.` : ''),
        ))}
      <h3 class="rp-more">더 자세히 보기</h3>
      <div class="rp-chs">${chapters}</div>
      <p class="rp-note">점술은 상징적 해석 도구이며 실제 미래를 확정하지 않습니다. 결혼·이별·임신·투자·건강과 관련된 결정은
        두 사람의 대화와 전문가의 객관적 조언을 우선해 주세요.</p>
    </section>`;
}

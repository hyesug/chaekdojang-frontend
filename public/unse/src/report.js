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
import { currentDaeun, computeDaeun, TEN_GOD_GROUP, elementDistribution, tenGod, tenGodDistribution, branchRelations } from './core/ganzhi.js';
import { buildBoard, decadeLimits } from './hires/ziwei.js';
import { yearTimeline } from './reading.js';
import { j } from './core/josa.js';
import { timingFor } from './semantic/compose/timing.js';
import { reportTimingPolicy } from './semantic/timing/policy.js';
import { selectedWindows, selectedSpan, pastWindows, isMarried, PAST_DOMAINS } from './semantic/timing/selected.js';
import { palaceStars, natureOf } from './semantic/structure/stars.js';
import { readSpouse, spousePalaceStars, spouseVerdict } from './semantic/structure/spouse.js';
import { readChildren, childPalaceStars, childrenVerdict } from './semantic/structure/children.js';
import { childrenPack, marriagePack } from './hires/vedicExt.js';
import { verifiedCareer } from './semantic/index.js';
import { distinctReadings, ownSentences } from './semantic/distinct.js';
import { dictEntries, dictField, coreField, daeunEntry, ziweiPalaceEntry, pairReading, themeContrast, eventEntry, dictLoaded } from './semantic/dict.js';
import { lifeChapters, chapterTurns } from './semantic/compose/life.js';

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
  <details class="rp-ch" open>
    <summary><span class="rp-no" aria-hidden="true">${esc(n)}</span><span class="rp-ch-t">${esc(title)}${lead ? `<small>${esc(lead)}</small>` : ''}</span></summary>
    <div class="rp-ch-body">${body}</div>
  </details>`;
/** 장 안의 소제목. 번호는 문서 안 참조용이라 작게 남긴다 */
const sub = (n, title, body) => !body ? '' :
  `<div class="rp-sub"><h4 class="rp-h4">${n ? `<span>${esc(n)}</span>` : ''}${esc(title)}</h4>${body}</div>`;

/**
 * 한 분야의 시기 — **그 분야의 근거로만** 만든 연도표.
 *
 * 문서의 "2027 丁未 | 丑未冲으로 직장·조직 변화" 가 이 모양이다. 주제와
 * 무관한 연운 문구를 쓰면 제목과 내용이 따로 논다.
 */
const TIMING_LABEL = { 결혼: '결혼식·인연', 자녀: '출산·가족 확장', 이사: '이사·이동', 직업: '일의 변화', 재물: '목돈' };

/** 사례 검증에서 떨어진 분야 — 연도를 내지 않고, 따로 안내 문구도 달지 않는다 (docs/unse/rebuild-result.md) */
const UNVERIFIED_TIMING = new Set(['결혼', '자녀']);
/** 한 사람 이력·사전 후보로만 고른 시기 — 연도 옆에 그렇다고 적는다 */

function timingOf(r, domain, span = 10) {
  if (UNVERIFIED_TIMING.has(domain)) return '';
  // 이미 결혼한 사람에게 "결혼 시기는 ○년이 유력"은 틀린 말이다 — 지나온 신호를 보여 준다
  if (domain === '결혼' && isMarried(r)) {
    const past = pastWindows(r, '결혼').map((w) => selectedSpan(r, w));
    if (!past.length) {
      return '<p class="rp-t rp-when">이미 결혼하셨다고 입력하셔서 앞으로의 결혼 시기는 따로 짚지 않았습니다. 위 풀이는 배우자와의 관계를 읽는 데 참고하세요.</p>';
    }
    const rest = past.length > 1 ? `가장 높았고, 그다음은 ${esc(past.slice(1).join(', '))}입니다` : '가장 높았습니다';
    return `<p class="rp-t rp-when">지나온 때 중 결혼·인연 신호는 <strong>${esc(past[0])}</strong>에 ${rest}. 실제로 결혼하신 때와 견주어 보세요.</p>`;
  }
  const policy = reportTimingPolicy(domain);
  const label = TIMING_LABEL[domain] ?? domain;
  // 실제 사례에서 기존 방식보다 나은 규칙을 아직 확인하지 못한 분야에는
  // 그럴듯한 연도를 찍지 않는다. 구조 해석을 흐리지 않되, 맞는 척하는 시기
  // 문장만 멈춘다. 검증을 통과한 정책이 생기면 아래 계산이 다시 열린다.
  if (!policy) {
    return '';
  }
  const windows = selectedWindows(r, domain, span);
  const spans = windows.map((w) => selectedSpan(r, w));
  if (!spans.length) return '';
  const rest = spans.length > 1 ? `가장 높고, 그다음은 ${esc(spans.slice(1).join(', '))}입니다` : '가장 높습니다';
  // 결혼·자녀는 지나온 신호도 함께 — 실제로 겪은 때와 견주어 보면 앞의 신호를 읽기 쉽다
  const past = PAST_DOMAINS.has(domain) && policy.scope !== 'prior'
    ? pastWindows(r, domain, 2).map((w) => selectedSpan(r, w)) : [];
  const pastLine = past.length ? ` 지나온 때 중에서는 ${esc(past.join(', '))}에 신호가 높았습니다.` : '';
  return `<p class="rp-t rp-when">${esc(label)} 신호는 <strong>${esc(spans[0])}</strong>에 ${rest}.${pastLine}</p>`;
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

/** 십성 무리가 그 해에 건드리는 것 — 고정표 */
const GOD_FIELD = {
  관성: '자리와 역할', 재성: '돈과 조건', 식상: '드러냄과 표현',
  인성: '배움과 문서', 비겁: '경쟁과 동료',
};

/* ── 1. 일과 돈 ─────────────────────────────────────────── */

/** 커리어 무기와 자산 스타일 */
const AREA = {
  명궁: '나 자신', 형제궁: '형제·동료', 부처궁: '배우자·관계', 자녀궁: '자녀', 재백궁: '돈',
  질액궁: '건강', 천이궁: '바깥 활동과 이동', 노복궁: '주변 사람', 관록궁: '일과 명예',
  전택궁: '집과 재산', 복덕궁: '마음의 여유', 부모궁: '부모·윗사람',
};
/**
 * 사전 한 항목(h 어떤 시기·자리인지, g 잘 되는 것, c 조심할 것)을 한 문단으로 잇는다.
 * 모든 칸이 "잘 되는 것 — … 조심할 것 — …" 같은 틀로 읽히지 않게 이음말을 문장마다 바꾼다
 * (문장 내용으로 고르므로 같은 사람에게는 늘 같은 글이 나온다).
 */
const HGC_FORMS = [
  (h, g, c) => `${h} ${g} 다만 ${c}`,
  (h, g, c) => `${h} ${g} 그래도 ${c}`,
  (h, g, c) => `${h} ${g} 한편 ${c}`,
];
function hgc(e, withCaution = true) {
  if (!e) return '';
  let n = 0;
  for (const ch of String(e.h)) n = (n * 31 + ch.charCodeAt(0)) % 9973;
  return withCaution ? HGC_FORMS[n % HGC_FORMS.length](e.h, e.g, e.c) : `${e.h} ${e.g}`;
}

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

  // 자미 관록궁·재백궁 사전(별 조합 39가지)이 있으면 그것으로, 없으면 예전 풀이로
  const work = ziweiPalaceEntry(r, 'career'), money = ziweiPalaceEntry(r, 'money');
  // 자미 관록궁 문장이 위 "잘 맞는 일"과 다른 갈래면 싣지 않는다 — 한 리포트 안에서 직업 말이 엇갈렸다(피드백)
  const fits = careerFocus(r).workFits;
  return (fits ? labeled('일을 키우려면', `${work.h} ${work.g}`) : '')
    + labeled('돈을 키우려면', money ? `${money.h} ${money.g}` : readingText(r, '자미두수', '재백궁'))
    + labeled('일과 돈에서 조심할 것', [fits ? work.c : (nat?.risk?.length ? `${nat.risk.join(', ')}.` : ''), money?.c].filter(Boolean).join(' '))
    + para(nextLine);
}


// '사회에서 보이는 나'(점성술 태양·중천·상승 풀이)는 뺐다 — 같은 내용이 사전으로 위 카드에 들어가 있다
// '가능성이 높은 직업 분야'는 맨 위 "앞으로 가야 할 방향"으로 옮겼다
const careerLife = (v, r) => sub('', '일과 돈을 키워 가는 법', s13(r));

/* ── 2. 사랑과 가족 ─────────────────────────────────────── */

/**
 * 판정 줄(직업·나이·수·성별)에 주어를 붙이고 결론 문장만 남긴다.
 * 원문은 "직업은 …", "나이는 연하 쪽입니다. 자미두수·사주 2갈래가…"처럼 주어가 빠져 있고
 * 뒤에 계산 방식 설명이 붙어, 걸러내고 나면 누구 이야기인지 알 수 없었다.
 */
function verdictLines(lines, who) {
  return (lines ?? []).map((line) => {
    let t = String(line).replace(/\*\*/g, '').split(/(?<=[.!?])\s/)[0];
    if (/\s—\s.*(표|>)/.test(t)) t = t.replace(/\s—\s.*$/, '');
    t = t.replace(/\s*\([^)]*\)/g, '').replace(/[.]?$/, '.');
    return t
      .replace(/^직업은 /, `${who}의 직업은 `)
      .replace(/^나이는 (\S+) 쪽/, `${who} 나이는 나보다 $1 쪽`)
      .replace(/^수는 /, `${who} 수는 `)
      .replace(/^성별은 /, `${who} 성별은 `);
  });
}

/** 별 풀이에서 그 사람의 성격 목록과 아쉬운 점만 뽑는다 (앞 문장은 별 이름 설명이라 걸러진다) */
function personOf(reads, who) {
  const raw = (reads ?? []).map((x) => String(x?.text ?? '')).join('\n');
  const traits = raw.match(/구체적으로는\s*\*\*([^*]+)\*\*/)?.[1];
  const weak = raw.match(/걸림돌이 되는 자리는\s*\*\*([^*]+)\*\*/)?.[1];
  return readItems([
    [`${who}는 이런 사람`, traits ? `${traits.split(/\s+·\s+/).join(', ')}.` : ''],
    [`${who}의 아쉬운 점`, weak ? `${weak.replace(/\s*\/\s*/g, ', ').replace(/다$/, '다.')}` : ''],
  ]);
}

/**
 * 자미 궁 하나에 든 별로 그 대상이 어떤 사람인지 — 별 조합이라 사람마다 갈린다.
 * 출생 시각이 없으면 궁을 세우지 못해 빈 문자열을 낸다(호출부가 대신할 글을 고른다).
 */
function palaceLine(r, palace, who) {
  let nat = null;
  try { nat = natureOf(palaceStars(r.input, palace), who); } catch { /* */ }
  if (!nat?.traits?.length) return '';
  return para(`${j(who, '과')}의 관계에서는 ${nat.traits.slice(0, 4).join(', ')} 같은 모습이 두드러집니다.`)
    + (nat.risk?.[0] ? para(`부딪치는 지점은 ${nat.risk[0].replace(/다$/, '다는 것')}입니다.`) : '');
}

/** 자미 부처궁·자녀궁 사전 — 어떤 인연인지 · 잘 되는 것 · 조심할 것 */
function palaceDict(r, which) {
  const e = ziweiPalaceEntry(r, which);
  return e ? para(e.h) + bullets(bullet('🟢', '잘 되는 것', e.g), bullet('⚠️', '조심할 것', e.c)) : '';
}

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

  // 자미 궁 사전이 있으면 일반 요약 문단(v.life)은 쓰지 않는다 — 그 문단은 또래끼리 거의 같았다
  const spouseDict = palaceDict(r, 'spouse'), childDict = palaceDict(r, 'children');
  return sub('', '앞으로 함께할 사람',
      (spouseDict || para(withSrc(v.life?.spouse))) + verdictLines(spv.lines, '배우자').map(para).join('') + personOf(sp, '배우자') + timingOf(r, '결혼'))
    + sub('', '자녀와의 관계',
      (childDict || para(withSrc(v.life?.child))) + verdictLines(chv.lines, '자녀').map(para).join('') + personOf(ch, '자녀') + timingOf(r, '자녀'))
    + sub('', '형제·동료', palaceLine(r, '형제궁', '형제·동료'))
    + sub('', '주변 사람', palaceLine(r, '노복궁', '주변 사람'));
}

/* ── 실행 원칙 — 사람마다 다르게 ───────────────────────────
   예전에는 모든 사람에게 같은 여섯 줄을 보였다(피드백: "다 똑같이 나온다").
   타고난 십신 구성에서 가장 강한 쪽·가장 빈 쪽, 지금 대운의 십신으로 고른다. */
const STRONG_RULE = {
  비겁: '내 방식이 강한 만큼, 큰 결정 전에는 반대 의견을 한 사람에게 꼭 들어 봅니다.',
  식상: '아이디어를 늘리기보다 하나를 끝까지 완성해 밖에 내놓습니다.',
  재성: '일을 벌이는 속도보다 정리하는 속도를 먼저 맞춥니다. 새 일을 하나 받으면 기존 일 하나를 닫습니다.',
  관성: '책임을 다 떠안지 말고, 맡을 일과 거절할 일의 기준을 미리 정해 둡니다.',
  인성: '배우고 준비하는 기간에 기한을 두고, 정한 날이 오면 부족해도 실행합니다.',
};
const EMPTY_RULE = {
  비겁: '혼자 버티지 말고 같은 편이 되어 줄 사람을 일부러 곁에 둡니다.',
  식상: '생각을 결과물로 꺼내는 연습을 합니다. 작게라도 정기적으로 밖에 보여 줍니다.',
  재성: '돈 흐름을 감으로 두지 말고 숫자로 적어 둡니다. 한 달에 한 번은 들어오고 나간 돈을 확인합니다.',
  관성: '스스로 마감과 규칙을 정해 두어야 흐트러지지 않습니다.',
  인성: '실전으로 배우는 만큼, 배운 것을 기록으로 남겨 쌓습니다.',
};
const SEASON_RULE = {
  비겁: '지금 시기에는 동업·공동 투자처럼 몫을 나누는 약속을 반드시 문서로 남깁니다.',
  식상: '지금 시기에는 말과 결과물이 곧 실력입니다. 만든 것을 꾸준히 공개합니다.',
  재성: '지금 시기에는 들어오는 만큼 나가기 쉽습니다. 수입의 일정 몫을 먼저 떼어 둡니다.',
  관성: '지금 시기에는 책임과 평가가 커집니다. 맡은 일의 기준과 기한부터 확인합니다.',
  인성: '지금 시기에는 자격·공부·문서가 힘이 됩니다. 증빙이 남는 방식으로 쌓습니다.',
};
function personalPrinciples(r) {
  const out = [];
  try {
    const g = tenGodDistribution(r.chart.pillars, r.chart.dayStem).groups;
    const order = Object.keys(g).sort((a, b) => g[b] - g[a]);
    out.push(STRONG_RULE[order[0]]);
    const empty = order.at(-1);
    if (empty !== order[0]) out.push(EMPTY_RULE[empty]);
  } catch { /* */ }
  try {
    const dae = currentDaeun(computeDaeun(r.chart, r.input.isMale, r.input.jdUT), r.input.elapsedYears ?? r.input.age);
    const rule = dae ? SEASON_RULE[TEN_GOD_GROUP[dae.god]] : null;
    if (rule) out.push(rule);
  } catch { /* */ }
  try {
    const nat = natureOf(palaceStars(r.input, '명궁'), '나');
    if (nat?.risk?.[0]) out.unshift(`${nat.risk[0].replace(/다$/, '다')} — 이 버릇이 나오는 순간을 알아차리는 것이 첫 번째 원칙입니다.`);
  } catch { /* */ }
  return [...new Set(out.filter(Boolean))];
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

/**
 * 그 해에 겹치는 일(합·충 등)을 생활 언어로 — **어느 영역에서** 무엇이 일어나기 쉬운가 + 어떻게 하면 좋은가.
 * 영역을 빼고 종류만 말하면 같은 종류가 든 해마다 똑같은 문장이 되풀이된다(피드백).
 * 영역은 세운이 부딪친 원국 기둥으로 정한다: 년주=집안·윗사람, 월주=직장·일, 일주=나와 배우자, 시주=자녀·결과물.
 */
const HIT_AREA = { year: '집안·윗사람', month: '직장·일', day: '나 자신과 배우자·가까운 사이', hour: '자녀·아랫사람·내 결과물' };
const HIT_TIP = {
  육합: (a) => `${a} 쪽에서 협업·계약·새 만남을 시작하기 좋습니다. 함께할 사람을 정하기 좋은 해입니다.`,
  반합: (a) => `${a} 쪽에서 도움이나 제안이 들어오기 쉽습니다. 조건을 한 번 더 확인하고 잡으세요.`,
  충: (a) => `${a} 쪽에 자리 변동(이직·이사·역할 변경)이 생기기 쉽습니다. 떠밀려 바뀌기 전에 계획을 세워 두세요.`,
  삼형: (a) => `${a} 쪽에서 같은 문제로 말이 반복해서 오가기 쉽습니다. 중요한 합의는 문서로 남기세요.`,
  상형: (a) => `${a} 쪽에서 같은 문제로 말이 반복해서 오가기 쉽습니다. 중요한 합의는 문서로 남기세요.`,
  자형: (a) => `${a} 일을 혼자 떠안고 지치기 쉽습니다. 나눠 맡기고 도움을 요청하세요.`,
  해: (a) => `${a} 쪽에서 겉은 조용해도 속으로 서운함이 쌓이기 쉽습니다. 불만은 작을 때 말로 풀어 두세요.`,
  파: (a) => `${a} 쪽 계획이나 약속이 틀어지기 쉽습니다. 조건을 한 번 더 확인하세요.`,
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
  // 대운 경계는 소수 나이로 떨어진다 — 정수 만 나이로 고르면 지난 시즌이 '지금'으로 잡힌다
  try { ds = computeDaeun(r.chart, r.input.isMale, r.input.jdUT); dae = currentDaeun(ds, r.input.elapsedYears ?? r.input.age); } catch { /* */ }
  let years = [];
  try { years = yearTimeline(r.input, r.chart, r.input.currentYear, r.input.currentYear + 9); } catch { /* */ }
  const ageOf = (year) => year - r.input.year;
  const group = dae ? TEN_GOD_GROUP[dae.god] : null;
  const info = group ? SEASON[group] : null;
  // 시즌의 연도는 실제 경계(출생 순간 + 소수 나이)로 센다. '만 나이 + 9'로 세면 끝 해가 한 해 앞당겨졌다
  const yearAt = (exact) => new Date((r.input.jdUT - 2440587.5 + exact * 365.2425) * 864e5).getUTCFullYear();
  const fromYear = dae ? yearAt(dae.fromExact) : null;
  const toYear = dae ? yearAt(dae.toExact) : null;
  const next = dae && ds?.list ? ds.list.find((x) => x.fromAge > dae.fromAge) : null;
  const nextInfo = next ? SEASON[TEN_GOD_GROUP[next.god]] : null;

  // 한 해씩 — 그 해의 흐름 한두 문장 + 겹치는 일과 대처법
  const yearLine = (y) => {
    // 그 해의 십성 풀이는 두 문장까지 — 첫 문장만 쓰면 '책임이 들어오는 해'처럼 제목만 남는다
    const head = firstOf(y.text, 2);
    const tip = y.hit?.kind && HIT_TIP[y.hit.kind] ? HIT_TIP[y.hit.kind](HIT_AREA[y.hit.at] ?? '주변') : '';
    // 인연(결혼)이 움직이는 해는 말하지 않는다 — 결혼 연도는 사례 검증에서 떨어졌다
    return [head, tip].filter(Boolean).join(' ');
  };
  const good = years.filter((y) => y.hit?.good).slice(0, 3);
  const check = years.filter((y) => y.hit && !y.hit.good).slice(0, 3);
  return {
    season: info
      ? `${dae.fromAge}~${dae.toAge}세(${fromYear}~${toYear}년)는 '${GOD_FIELD[group]}'의 라이프 시즌입니다. ${info.what}`
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
  const natOf = (palace, who) => { try { return natureOf(palaceStars(r.input, palace), who); } catch { return null; } };

  // DO — 일할 때의 나(관록궁 별)가 자라는 방향. 별 조합이라 사람마다 갈린다. 시각이 없으면 지금 시즌
  const work = natOf('관록궁', '일할 때의 나');
  const grow = String(work?.text ?? '').replace(/\*\*/g, '').match(/자라는 방향은 ([^.]+?)입니다/)?.[1];
  const doHead = grow ? `${grow.replace(/\s*쪽$/, '')} 쪽으로 움직이세요.` : (s.act ? `${s.act}.` : '');
  const doWhy = grow && work?.traits?.length
    ? `일할 때의 나는 ${work.traits.slice(0, 3).join(', ')} 쪽이라, 이 힘이 그대로 쓰이는 자리에서 성과가 납니다.`
    : [take(pickOf(withSrc(v.work?.job), /편이 낫|잘 됩니다|좋습니다/)), s.seasonTips?.[0]?.[2] ? take(s.seasonTips[0][2]) : ''].filter(Boolean).join(' ');

  // DON'T — 타고난 나(명궁 별)의 걸림돌. 없으면 돈 습관
  const me2 = natOf('명궁', '나');
  const dontHead = me2?.risk?.[0]
    ? '타고난 버릇 하나를 경계하세요.'
    : strip(take(pickOf(withSrc(v.work?.money), /마세요|말고/), pickOf(withSrc(v.work?.money), CAUTION)));
  const dontWhy = me2?.risk?.[0]
    ? `${me2.risk.slice(0, 2).map((x) => `${x.replace(/[.]?$/, '')}.`).join(' ')}`
    : (dontHead ? '돈이 들어오면 쓰기 전에 일정 몫을 먼저 따로 떼어 두세요.' : '');

  // KEY — 가장 넘치는 기운과 가장 옅은 기운의 짝 (스무 가지로 갈린다)
  let weak = null, strong = null;
  try {
    const c = elementDistribution(r.chart.pillars).count;
    weak = ELEM_KEYS[[0, 1, 2, 3, 4].reduce((x, i) => (c[i] < c[x] ? i : x), 0)];
    strong = ELEM_KEYS[[0, 1, 2, 3, 4].reduce((x, i) => (c[i] > c[x] ? i : x), 0)];
  } catch { /* */ }
  const fill = weak ? ELEM_FILL[weak] : null;
  const over = strong && strong !== weak ? ELEM_FILL[strong] : null;
  return [
    ['DO', doHead, doWhy],
    ["DON'T", dontHead, dontWhy],
    ['KEY', fill ? `넘치는 '${over?.name ?? ''}' 대신 옅은 '${fill.name}' 기운을 채우세요.`.replace(/넘치는 '' 대신 /, '') : '',
      fill ? `${over ? `${over.means}은 이미 넘쳐 한쪽으로 쏠리기 쉽고, ` : ''}${fill.means}이 가장 옅습니다. ${fill.how}` : ''],
  ].filter(([, head, why]) => head || why);
}

/**
 * 나만의 특징 — 열일곱 체계의 풀이 가운데 **사람들 사이에서 드물게 나오는 것**부터.
 * 같은 유형표에서 문장을 꺼내 쓰면 결과지가 서로 비슷해진다(scripts/report-sameness.mjs).
 * 드문 정도는 무작위 2천 명으로 미리 잰 표를 쓴다(semantic/distinct.js).
 */
const DISTINCT_LABEL = {
  사주: '타고난 기질', 자미두수: '타고난 별자리판', 점성술: '태어난 날의 하늘', 베딕: '인도식 별자리',
  주역: '타고난 괘', 육임: '태어난 순간의 판', 홍국기문: '타고난 자리', 태을신수: '큰 주기 속 자리',
  구성학: '타고난 별', 숙요: '달이 머문 자리', 토정비결: '타고난 수', 카발라: '생명의 숫자',
  마하보테: '태어난 요일의 자리', '태국 점성술': '태어난 요일', 타로: '생일 카드',
};
function distinctCard(r) {
  let rows = [];
  try { rows = distinctReadings(r, { max: 6 }); } catch { /* */ }
  const items = rows.map((x) => {
    // 체계의 정의처럼 누구에게나 붙는 문장은 빼고 그 사람 몫의 문장만
    const text = firstOf(plain(ownSentences(x.text).join(' ')), 3);
    if (!text) return '';
    const head = DISTINCT_LABEL[x.system] ?? '타고난 자리';
    // 드문 정도는 계산 사실이다 — 백 명 중 몇 명꼴인지로만 적는다
    const per = Math.max(1, Math.round(x.share * 100));
    return `<article class="rp-signature"><h4 class="rp-h4">${esc(head)} <small>· 100명 중 ${per}명꼴</small></h4><p>${esc(text)}</p></article>`;
  }).filter(Boolean);
  return items.join('');
}

/**
 * 인생의 큰 흐름 — 십 년 단위로 무엇이 앞으로 나오고 어디가 흔들리는가.
 *
 * 해마다 같은 틀 문장을 붙이던 연표(고유 3%)를 걷고, 그 사람의 대운이 **원국의 어느 기둥과
 * 부딪치거나 맞물리는지**, 같은 십 년에 자미 대한이 **원국의 어느 궁**에 서는지로 쓴다.
 * 둘 다 생년월일시로 정해지는 계산이라 사람마다 갈린다. 여러 체계의 큰 주기가 한 해에 함께
 * 바뀌는 해는 "흐름이 꺾이는 해"로 따로 짚는다(사건을 단정하지 않는다).
 */
/** 인도 점성 행성 주기의 주제 — 다샤 주인의 전통적 소관 */
const PLANET_TERM = {
  태양: '지위·명예·윗사람과의 관계', 달: '감정·가족·생활의 안정', 화성: '추진력·경쟁·몸을 쓰는 일',
  수성: '배움·거래·말과 글', 목성: '확장·배움·도와주는 사람', 금성: '관계·즐거움·재물',
  토성: '책임·인내·오래 걸리는 일의 정리', 라후: '욕망과 낯선 변화', 케투: '내려놓음과 정리',
};
const PILLAR_AREA = { year: '집안·윗사람', month: '일과 직장', day: '나 자신과 배우자', hour: '자녀·아랫사람·내 결과물' };
function lifeFlow(r) {
  let ds = null;
  try { ds = computeDaeun(r.chart, r.input.isMale, r.input.jdUT); } catch { return ''; }
  const now = Number(r.input.currentYear);
  const yearAt = (exact) => new Date((r.input.jdUT - 2440587.5 + exact * 365.2425) * 864e5).getUTCFullYear();
  let limits = [];
  try { if (r.input.timeKnown) limits = decadeLimits(r.input, buildBoard(r.input)); } catch { /* */ }
  const seenGroup = new Set();
  const rows = [];
  let elem = null;
  try {
    const c = elementDistribution(r.chart.pillars).count;
    const idx = [0, 1, 2, 3, 4];
    elem = { weak: idx.reduce((a, i) => (c[i] < c[a] ? i : a), 0), strong: idx.reduce((a, i) => (c[i] > c[a] ? i : a), 0) };
  } catch { /* */ }
  for (const d of ds?.list ?? []) {
    const from = yearAt(d.fromExact), to = yearAt(d.toExact) - 1;
    if (to < now || from > now + 30) continue;
    const group = TEN_GOD_GROUP[d.god];
    const info = SEASON[group];
    const parts = [];
    if (info) parts.push(`'${GOD_FIELD[group]}'의 시기입니다. ${firstOf(info.what)}`);
    // 그 십 년의 지지가 타고난 네 기둥과 맺는 관계 — 어느 영역이 움직이는가
    const moves = [];
    // 월주는 뺀다 — 대운은 월주에서 한 칸씩 나아가므로 월주와의 관계가 누구에게나 같은 순서로 온다
    for (const key of ['day', 'year', 'hour']) {
      const p = r.chart.pillars[key];
      if (!p) continue;
      // 한 기둥에는 가장 센 관계 하나만 — 합과 형이 함께 걸리면 서로 반대 말이 나란히 나온다
      const rels = branchRelations(p.branch, d.branch).filter((x) => !x.minor);
      const rel = rels.find((x) => x.kind === '충') ?? rels.find((x) => /형/.test(x.kind)) ?? rels.find((x) => /합/.test(x.kind));
      if (!rel) continue;
      if (rel.kind === '충') moves.push(`${PILLAR_AREA[key]} 쪽이 크게 바뀌거나 자리를 옮기기 쉽습니다`);
      else if (/형/.test(rel.kind)) moves.push(`${PILLAR_AREA[key]} 쪽에서 같은 문제가 되풀이되기 쉽습니다`);
      else moves.push(`${PILLAR_AREA[key]} 쪽에 새 인연·협력이 붙기 쉽습니다`);
    }
    if (moves.length) parts.push(`${[...new Set(moves)].slice(0, 2).join('. ')}.`);
    // 그 십 년의 기운이 타고난 오행의 빈 곳을 채우는가, 넘치는 곳을 더 키우는가 — 원국마다 다르다
    if (elem) {
      const de = [d.element, d.branchElement].filter((x) => x != null);
      if (de.includes(elem.weak)) parts.push(`타고난 구성에서 가장 옅은 ${ELEM_FILL[ELEM_KEYS[elem.weak]].name} 기운(${ELEM_FILL[ELEM_KEYS[elem.weak]].means})이 채워지는 시기라, 평소 어렵던 일이 한결 수월해집니다.`);
      else if (de.includes(elem.strong)) parts.push(`이미 넘치는 ${ELEM_FILL[ELEM_KEYS[elem.strong]].name} 기운이 더해지는 시기라, 내 방식이 지나치게 굳어지지 않게 살펴야 합니다.`);
    }
    const lim = limits.find((x) => x.fromYear <= Math.max(from, now) && x.toYear >= Math.max(from, now));
    if (lim && AREA[lim.palaceOfNatal]) parts.push(`같은 무렵 '${AREA[lim.palaceOfNatal]}' 쪽이 삶의 앞자리에 나옵니다.`);
    // 그 십 년의 궁에 든 별 — 이 시기에 두드러지는 내 모습과 걸림돌 (별 조합이라 사람마다 갈린다)
    let nat = null;
    try { nat = lim?.stars?.length ? natureOf(lim.stars, '이 시기의 나') : null; } catch { /* */ }
    if (nat?.traits?.length) {
      parts.push(`이 시기의 나는 ${nat.traits.slice(0, 3).join(', ')} 쪽이 두드러집니다.`
        + (nat.risk?.[0] ? ` 걸림돌은 ${nat.risk[0].replace(/다$/, '다는 것')}입니다.` : ''));
    }
    const nowMark = (x, y) => (x <= now && now <= y ? ' · 지금' : '');
    // 사전이 있으면 전통대로 앞 다섯 해(천간)·뒤 다섯 해(지지)를 따로 쓴다 — 일간과 대운의 짝이라 사람마다 갈린다
    const de = daeunEntry(r.chart.dayStem, d.stem, d.branch);
    if (de.front && de.back) {
      const mid = from + 5;
      const half = (e) => hgc(e);
      const extra = parts.filter((p) => !p.startsWith('\x27') || !p.includes('의 시기입니다'));
      rows.push([`${d.fromAge}~${d.fromAge + 4}세 (${from}~${mid - 1}년)${nowMark(from, mid - 1)}`, [half(de.front), ...extra.slice(0, 2)].join(' ')]);
      rows.push([`${d.fromAge + 5}~${d.toAge}세 (${mid}~${to}년)${nowMark(mid, to)}`, [half(de.back), ...extra.slice(2)].join(' ')]);
      continue;
    }
    if (info && !seenGroup.has(group)) {
      seenGroup.add(group);
      parts.push(`잘 쓰려면 — ${info.good} 조심할 점 — ${info.watch}`);
    }
    rows.push([`${d.fromAge}~${d.toAge}세 (${from}~${to}년)${nowMark(from, to)}`, parts.join(' ')]);
  }

  let turns = [];
  try {
    turns = chapterTurns(lifeChapters(r.input, r.chart, r.input.isMale),
      { from: now, to: now + 30, minSystems: 2, birthYear: r.input.year }).slice(0, 4);
  } catch { /* */ }
  // 그 해에 **무엇이** 바뀌는지 — 주기마다 쉬운 이름과, 새로 시작되는 구간의 뜻
  // 그 해에 삶의 무엇이 바뀌는지만 말한다 — 어느 체계의 어떤 주기인지는 손님이 알 필요가 없다
  const startLine = (st) => {
    if (st.system === '사주') {
      // 새로 시작되는 10년의 앞 다섯 해 해석(일간 × 대운 천간 사전) — 사람마다 갈린다
      const d = (ds?.list ?? []).find((x) => yearAt(x.fromExact) === st.fromYear);
      const de = d ? daeunEntry(r.chart.dayStem, d.stem, d.branch) : null;
      if (de?.front) return `${de.front.h.replace(/[.]$/, '')}`;
      const g = TEN_GOD_GROUP[String(st.detail ?? '').replace(/^천간\s*/, '')];
      return g ? `'${GOD_FIELD[g]}'이 삶의 중심 주제로 올라옵니다` : '';
    }
    if (st.system === '자미두수') {
      const pal = String(st.label ?? '').match(/원국의\s*(\S+궁)/)?.[1];
      // 그 10년 궁의 별로 이때 두드러지는 내 모습까지
      const lim = limits.find((x) => x.fromYear === st.fromYear);
      let nat = null;
      try { nat = lim?.stars?.length ? natureOf(lim.stars, '이 시기의 나') : null; } catch { /* */ }
      const area = pal && AREA[pal] ? `'${AREA[pal]}' 쪽이 삶의 앞자리로 나옵니다` : '';
      return [area, nat?.traits?.length ? `이때의 나는 ${nat.traits.slice(0, 2).join(', ')} 쪽이 두드러집니다` : ''].filter(Boolean).join('. ');
    }
    if (st.system === '베딕') {
      const p = String(st.label ?? '').split(' ')[0];
      return PLANET_TERM[p] ? `${j(PLANET_TERM[p], '이')} 오래 이어질 주제가 됩니다` : '';
    }
    // 구성학·카발라의 주기는 같은 해에 난 사람에게 같은 해에 돌아온다 — 그 사람 몫의 말이 없어 적지 않는다
    if (st.system === '고전 서양') return '삶의 큰 무대가 바뀝니다';
    if (st.system === '태을신수') return '오래 이어진 흐름이 한 바퀴를 돌아 새로 시작됩니다';
    return '';
  };
  const turnRows = turns.map((t) => {
    const what = [...new Set(t.starts.map(startLine).filter(Boolean))];
    return [`${t.year}년 (${t.age}세)`,
      what.length ? `${what.join('. ')}.` : '하던 일의 방향이나 생활의 틀을 다시 짜게 되기 쉬운 때입니다.'];
  });

  return (rows.length ? timeline(rows) : '')
    + (turnRows.length ? `<h4 class="rp-h4">🔀 흐름이 크게 꺾이는 해</h4>${timeline(turnRows)}` : '');
}

/**
 * 지켜야 할 원칙 — 조심할 점 칸의 다음 문장(드문 순서 5~8번째). 없으면 예전 원칙표로.
 * 고르는 방식은 그대로 둔다 — "의외로 맞는다"는 반응이 있었다. 위 칸에 이미 나온 문장만 뺀다.
 */
function dictPrinciples(r, shownTexts = []) {
  let es = [];
  try { es = dictEntries(r); } catch { /* */ }
  const shown = new Set(shownTexts);
  const more = dictField(es, 'c', 8, 4).map((x) => x.text).filter((t) => !shown.has(t)).slice(0, 4);
  return more.length ? more : personalPrinciples(r);
}

/* ── 문서 맨 위 — "어떤 사람인가"보다 "앞으로 어디로 가고 무엇을 알고 무엇을 조심할까" ──
   사전 문장을 갈래로 나눠 쓴다. 일할 때 칸에는 "어떤 분야에 맞는가"와 "일할 때 어떤가"가 섞여 있고,
   돈 칸에는 "버는 방향"과 "쓰는 습관"과 "하지 말라는 말"이 섞여 있다(피드백: 수익 스타일에 지출 습관이 나옴). */
const FIELD_FIT = /맞습니다|맞는 일|분야|어울립니다|일에서/;
const EARN = /벌|수입|수익|들어오|들어옵|모으|모읍|재산|자산|투자|돈이 됩|돈이 따|부자|불어|늘어/;
const IMPERATIVE = /세요\.?$|마세요|말고|두세요/;
const DRAWN_TO = /끌리|끌립|원합|원하고|만나|맞는 사람|곁에/;
const lineList = (xs) => (xs.length ? `<ul class="rp-ul">${xs.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : '');
const h4 = (icon, t) => `<h4 class="rp-h4">${icon} ${esc(t)}</h4>`;

/** 지금 내가 서 있는 10년의 반쪽(앞 다섯 해·뒤 다섯 해)과 바로 다음 반쪽 — 일간 × 10년 운 사전 */
/**
 * 오늘·이달의 흐름 (화면·AI 공용) — 분야마다 점수 구간으로 정해진 한 줄("특별히 좋지도 나쁘지도 않은
 * 날입니다")만 내던 것을 걷고(피드백: 의미가 없다), 그날·그달의 기운이 **이 사람에게 무엇인가**(일간 기준
 * 십신, dict/flow.json)와 그날·그달의 지지가 **내 일지와 맺는 관계**로 쓴다. 같은 날이라도 사람마다 갈린다.
 * @param {'day'|'month'} kind
 * @returns {{god, theme, seat, areas: Array<[area, text]>}|null}
 */
const SEAT_FLOW = {
  충: (u) => `${u} 내 생활의 중심과 정면으로 부딪칩니다. 가까운 사람과 다투거나 계획이 틀어지기 쉬우니 큰 결정은 미루세요.`,
  합: (u) => `${u} 내 자리와 잘 맞물립니다. 만남·협력·부탁이 잘 풀리니 미뤄 둔 연락을 해 보세요.`,
  형: (u) => `${u} 지난 문제가 다시 불거지기 쉽습니다. 끝난 이야기를 다시 꺼내지 마세요.`,
  원진: (u) => `${u} 까닭 없이 거슬리는 일이 생기기 쉽습니다. 말투를 한 번 더 부드럽게 하세요.`,
};
export function periodFlow(r, block, kind) {
  const flow = dictLoaded()?.flow;
  if (!block) return null;
  const god = String(block.results?.find((x) => x.id === 'saju')?.headline ?? '').split('·').at(-1).trim();
  const e = flow?.[god];
  const unit = kind === 'day' ? '오늘은' : '이번 달은';
  let seat = '';
  try {
    const b = kind === 'day' ? block.period.gz.day.branch : block.period.gz.month.branch;
    const rels = branchRelations(r.chart.pillars.day.branch, b);
    const k = rels.find((x) => x.kind === '충') ? '충' : rels.find((x) => /형/.test(x.kind)) ? '형'
      : rels.find((x) => /합/.test(x.kind)) ? '합' : rels.find((x) => x.kind === '원진') ? '원진' : null;
    if (k) seat = SEAT_FLOW[k](unit);
  } catch { /* */ }
  const areas = ['총운', '애정운', '금전운', '직장운', '건강운'].map((a) => {
    const s = block.areas?.[a]?.score;
    if (s == null) return null;
    if (!e?.[a]) return [a, areaText(a, s, kind)];
    // 점수는 같은 결 안에서의 세기로만 덧붙인다
    const tail = s >= 62 ? ' 이 분야는 흐름도 좋은 편입니다.' : s < 42 ? ' 이 분야는 흐름이 약한 편이라 한 번 더 확인하세요.' : '';
    return [a, `${e[a]}${tail}`];
  }).filter(Boolean);
  // 십신 이름은 화면에 쓰지 않는다(용어) — 뜻만
  return { god, theme: e?.h ? `${unit} ${e.h}` : '', seat, areas };
}

/** 두 사람의 다음 시기가 두 해 안쪽으로 함께 바뀌면, 생활의 틀을 같이 다시 짤 때다 (궁합 리포트·AI 공용) */
export function togetherTurn(snA, snB) {
  // 두 해까지 넓히면 40쌍 중 33쌍, 한 해까지도 24쌍에 붙어 누구에게나 하는 말이 됐다 — 같은 해에 바뀔 때만
  if (!snA?.next || !snB?.next || snA.next.from !== snB.next.from) return '';
  const a = Math.min(snA.next.from, snB.next.from), b = Math.max(snA.next.from, snB.next.from);
  return `${a === b ? a : `${a}~${b}`}년 무렵 두 사람의 흐름이 함께 바뀝니다. 사는 곳·일·돈 계획처럼 생활의 큰 틀을 같이 다시 짜기 좋은 때입니다.`;
}

export function seasonNow(r) {
  try {
    const ds = computeDaeun(r.chart, r.input.isMale, r.input.jdUT);
    const now = Number(r.input.currentYear);
    const yearAt = (exact) => new Date((r.input.jdUT - 2440587.5 + exact * 365.2425) * 864e5).getUTCFullYear();
    const list = (ds?.list ?? []).map((d) => ({ d, from: yearAt(d.fromExact), to: yearAt(d.toExact) - 1 }));
    const i = list.findIndex((x) => x.from <= now && now <= x.to);
    if (i < 0) return null;
    const halves = [];
    for (const x of list.slice(i, i + 2)) {
      const de = daeunEntry(r.chart.dayStem, x.d.stem, x.d.branch);
      halves.push({ from: x.from, to: x.from + 4, age: x.d.fromAge, e: de.front },
        { from: x.from + 5, to: x.to, age: x.d.fromAge + 5, e: de.back });
    }
    const k = halves.findIndex((h) => h.from <= now && now <= h.to);
    if (k < 0 || !halves[k].e) return null;
    return { cur: halves[k], next: halves[k + 1]?.e ? halves[k + 1] : null };
  } catch { return null; }
}

/**
 * 잘 맞는 일 — 여러 체계가 **가장 많이 함께 가리키는 분야 하나**로 모은다.
 * 체계마다 "맞는 분야" 문장을 하나씩 가져오면 실무·디자인·강의처럼 서로 다른 말이 한 칸에
 * 나란히 놓였다(피드백). 각 문장·자미 관록궁·검증된 직업 범주가 분야 갈래에 표를 던지고,
 * 가장 많은 표를 받은 갈래의 문장만 쓴다. 검증된 직업 범주는 두 표.
 */
const CAREER_CATS = [
  ['돈과 숫자를 다루는 일', /금융|재무|회계|숫자|돈과 실무|투자|보험|은행|자산/],
  ['깊이 파는 전문 분야', /연구|전문|분석|조사|법률|정확|기술직|엔지니어/],
  ['말과 가르침으로 하는 일', /강의|교육|가르치|상담|컨설팅|말과|글|출판|언론/],
  ['감각과 표현을 쓰는 일', /디자인|예술|창작|감각|미디어|콘텐츠|무대|방송|홍보/],
  ['사람을 돕고 돌보는 일', /서비스|복지|돌봄|사람을 돕|의료|치유|간호|건강|요식/],
  ['조직을 이끌고 관리하는 일', /관리|운영|조직|행정|공공|총괄|리더|대표|직책|공무/],
  ['새 길을 여는 일', /IT|기획|새로운 방식|개척|창업|사업|무역|해외/],
  ['몸과 현장을 쓰는 일', /체육|운동|제조|건설|현장|생산|농업|운송|군|경찰|몸을 쓰/],
];
const catsOf = (t) => CAREER_CATS.map(([, re], i) => (re.test(t) ? i : -1)).filter((i) => i >= 0);
export function careerFocus(r) {
  let es = [];
  try { es = dictEntries(r); } catch { /* */ }
  const lines = coreField(es, 'w', 30, 0, (t) => FIELD_FIT.test(t)).map((x) => x.text);
  const work = ziweiPalaceEntry(r, 'career');
  let vc = null;
  try { vc = verifiedCareer(r.input); } catch { /* */ }
  const votes = CAREER_CATS.map(() => 0);
  for (const t of lines) for (const i of catsOf(t)) votes[i] += 1;
  if (work) for (const i of catsOf(`${work.h} ${work.g}`)) votes[i] += 1;
  // 사례로 확인한 직업 범주가 가장 무겁다(세 표) — 이것과 다른 갈래를 내세우면 같은 카드 안에서 말이 엇갈린다
  if (vc?.available) for (const x of vc.top) for (const i of catsOf(x.label)) votes[i] += 3;
  const best = votes.reduce((b, v, i) => (v > votes[b] ? i : b), 0);
  // 여러 분야를 늘어놓으면 "잘 맞는 일이 너무 여러 개"가 된다(피드백) — 고른 갈래에 드는 것만 남긴다
  const verifiedAll = vc?.available ? vc.top.map((x) => x.label) : [];
  if (!votes[best]) return { name: '', verified: verifiedAll.slice(0, 1), lines: lines.slice(0, 1), workFits: !!work };
  const verified = verifiedAll.filter((l) => catsOf(l).includes(best));
  // 문장도 하나만 — 그 갈래에만 드는(다른 갈래와 덜 섞인) 문장을 고른다
  const own = lines.filter((t) => catsOf(t).includes(best)).sort((a, b) => catsOf(a).length - catsOf(b).length);
  return {
    name: CAREER_CATS[best][0],
    verified,
    lines: own.slice(0, 1),
    // 자미 관록궁 문장이 같은 갈래일 때만 "일을 키우려면"에 싣는다 — 다르면 리포트 안에서 직업 말이 엇갈린다
    workFits: !!work && catsOf(`${work.h} ${work.g}`).includes(best),
  };
}

/**
 * 앞으로 마주할 중요한 일 — 시기표 대신 **무슨 일이, 어떤 모양으로, 어떻게 대비할지**를 사건 단위로.
 *   · 앞으로의 10년 운이 타고난 기둥(집안·나와 배우자·자녀와 결과물)과 부딪치거나 맞물리는 것
 *   · 실제 사례로 고른 체계가 짚는 일의 변화·목돈·이사·건강 (나이 무렵으로만 적는다)
 * 결혼·출산 시기는 사례 검증에서 떨어져 쓰지 않는다.
 */
const SEAT_EVENT = {
  day: {
    충: ['생활의 중심이 크게 바뀌는 일', '배우자·연인과의 관계나 매일의 생활 방식이 크게 흔들리기 쉽습니다. 이사·동거·따로 살기·이직처럼 하루의 틀 자체가 바뀌는 모양으로 나타납니다.', '바뀌는 것을 한꺼번에 몰아 결정하지 말고 하나씩 차례로 정리하세요. 가장 가까운 사람과 먼저 계획을 맞춰 두면 흔들림이 작아집니다.'],
    형: ['가까운 사이에서 같은 갈등이 되풀이되는 일', '배우자나 가장 가까운 사람과 같은 문제로 거듭 부딪치기 쉽습니다. 크게 터지기보다 오래 끄는 모양입니다.', '반복되는 다툼 주제를 적어 두고 둘만의 규칙으로 정하세요. 참았다가 한 번에 터뜨리지 마세요.'],
    합: ['새 동반자·협력자가 생기는 일', '삶을 함께할 사람이나 오래 갈 파트너가 생기기 쉽습니다. 연애·결혼뿐 아니라 동업·협업의 형태로도 나타납니다.', '좋은 인연일수록 역할과 약속을 분명히 해 두세요. 들뜬 마음에 큰 결정을 서두르지 마세요.'],
  },
  year: {
    충: ['집안·윗사람 쪽의 큰 변화', '부모님의 건강이나 거처, 집안의 형편, 또는 직장 윗선이 바뀌는 일이 생기기 쉽습니다. 내가 책임을 나눠 져야 하는 자리에 서게 됩니다.', '부모님과 집안 일을 미리 의논해 두고, 혼자 떠안지 말고 형제·가족과 몫을 나누세요.'],
    형: ['집안 문제가 오래 끄는 일', '집안이나 윗사람과 얽힌 일이 크게 터지지 않은 채 오래 신경을 씁니다.', '선을 정해 두고, 감정이 아니라 사실과 문서로 정리하세요.'],
    합: ['윗사람·집안의 도움이 들어오는 일', '부모님이나 윗사람, 오래 알던 사람에게서 도움이나 기회가 들어오기 쉽습니다.', '도움을 받을 때 조건과 기대를 분명히 해 두면 나중에 서운함이 남지 않습니다.'],
  },
  hour: {
    충: ['자녀·아랫사람이나 내 결과물 쪽의 큰 변화', '자녀의 진학·독립, 함께 일하던 사람의 교체, 오래 붙든 일이나 작품의 정리처럼 내가 키워 온 것이 크게 바뀌기 쉽습니다.', '떠나보낼 것은 정리하고 새로 시작할 것을 고르는 계기로 삼으세요. 붙잡을수록 소모가 큽니다.'],
    형: ['아랫사람·결과물 쪽에서 같은 문제가 되풀이되는 일', '자녀나 후배, 내가 맡은 일에서 같은 문제가 거듭 생기기 쉽습니다.', '그때그때 넘기지 말고 원인을 한 번 제대로 짚어 고치세요.'],
    합: ['내가 키운 것이 결실을 맺는 일', '자녀·후배가 자리를 잡거나, 오래 공들인 일이 결과로 돌아오기 쉽습니다.', '결실을 다음 단계로 잇는 계획을 미리 세워 두세요.'],
  },
};
const DOMAIN_EVENT = {
  직업: ['일의 큰 변화', '하던 일의 방향이 바뀌거나 자리를 옮기는 일이 생기기 쉽습니다. 스스로 옮길 수도, 밖에서 제안이 올 수도, 맡은 일이 바뀔 수도 있습니다.', '1~2년 전부터 해 온 일을 정리하고 다음에 갈 쪽을 알아 두세요.'],
  재물: ['목돈이 움직이는 일', '큰돈이 들어오거나, 집·투자·사업처럼 큰돈을 쓰는 결정이 생기기 쉽습니다.', '들어온 돈의 일부는 먼저 떼어 두고, 큰 지출은 한 번에 몰지 말고 나눠 결정하세요.'],
  이사: ['사는 곳을 옮기는 일', '이사·이주처럼 생활의 근거지가 바뀌기 쉽습니다.', '옮길 곳의 일·가족 사정을 함께 따져 미리 후보를 좁혀 두세요.'],
  건강: ['몸을 챙겨야 하는 일', '몸에 신호가 오거나 치료·관리가 필요한 일이 생기기 쉽습니다.', '그 무렵에는 검진을 미루지 말고 일정과 잠을 먼저 챙기세요.'],
};
function lifeEvents(r) {
  return lifeEventItems(r).map((it) =>
    `<article class="rp-event"><h4 class="rp-h4">${esc(it.title)} <small>· ${esc(it.when)}</small></h4>`
    + `<p>${esc(it.what)}</p><p class="rp-prep"><b>대비</b> — ${esc(it.prep)}</p></article>`).join('');
}

/** 앞으로 마주할 중요한 일의 목록 (리포트·AI 공용) — {y, when, title, what, prep} */
export function lifeEventItems(r) {
  const items = [];
  const now = Number(r.input.currentYear);
  const ageOf = (y) => y - r.input.year;
  // 사건 사전(dict/event-*.json)이 있으면 그 사람의 10년 운 갈래(십신 무리)·가장 옅은 기운에 맞춘 글을, 없으면 기본 글을
  const pickEvent = (key, fallback) => { const e = eventEntry(key); return e ? [e.t, e.w, e.p] : fallback; };
  let decades = [];
  const yearAt = (exact) => new Date((r.input.jdUT - 2440587.5 + exact * 365.2425) * 864e5).getUTCFullYear();
  try {
    decades = (computeDaeun(r.chart, r.input.isMale, r.input.jdUT)?.list ?? [])
      .map((d) => ({ d, from: yearAt(d.fromExact), to: yearAt(d.toExact) - 1, group: TEN_GOD_GROUP[d.god] }));
  } catch { /* */ }
  const groupAt = (y) => decades.find((x) => x.from <= y && y <= x.to)?.group;
  try {
    const seen = new Set();
    for (const { d, from, to, group } of decades) {
      if (to < now || from > now + 30) continue;
      for (const key of ['day', 'year', 'hour']) {
        const p = r.chart.pillars[key];
        if (!p) continue;
        const rels = branchRelations(p.branch, d.branch).filter((x) => !x.minor);
        const rel = rels.find((x) => x.kind === '충') ?? rels.find((x) => /형/.test(x.kind)) ?? rels.find((x) => /합/.test(x.kind));
        if (!rel) continue;
        const kind = rel.kind === '충' ? '충' : /형/.test(rel.kind) ? '형' : '합';
        if (seen.has(key + kind)) continue;
        seen.add(key + kind);
        const [title, what, prep] = pickEvent(`seat|${key}|${kind}|${group}`, SEAT_EVENT[key][kind]);
        const y = Math.max(from, now);
        items.push({ y, when: `${ageOf(y)}~${d.toAge}세 무렵`, title, what, prep });
      }
    }
  } catch { /* */ }
  let weakKey = null;
  try {
    const c = elementDistribution(r.chart.pillars).count;
    weakKey = ELEM_KEYS[[0, 1, 2, 3, 4].reduce((x, i) => (c[i] < c[x] ? i : x), 0)];
  } catch { /* */ }
  for (const domain of ['직업', '재물', '이사', '건강']) {
    const w = selectedWindows(r, domain, 20, 1)[0];
    if (!w) continue;
    const y = Number(String(w.peakAt ?? w.from).slice(0, 4));
    if (y < now) continue;
    const key = domain === '건강' ? `health|${weakKey}` : `domain|${domain}|${groupAt(y)}`;
    const [title, what, prep] = pickEvent(key, DOMAIN_EVENT[domain]);
    items.push({ y, domain, group: groupAt(y), when: `${ageOf(y)}세 무렵`, title, what, prep });
  }
  // 사건마다 그 사람 몫의 말을 붙인다 — 일은 맞는 갈래, 돈은 돈을 키우는 방향, 건강은 가장 옅은 기운을 채우는 법
  const focus = careerFocus(r);
  let es = [];
  try { es = dictEntries(r); } catch { /* */ }
  const earn = coreField(es, 'm', 1, 0, (t) => EARN.test(t) && !IMPERATIVE.test(t))[0]?.text;
  const weak = weakKey ? ELEM_FILL[weakKey] : null;
  for (const it of items) {
    if (it.domain === '직업' && focus.name) it.prep += ` 옮긴다면 ${focus.name} 쪽이 이 명반에 맞습니다.`;
    if (it.domain === '재물' && earn) it.what += ` 이 명반은 ${earn}`;
    if (it.domain === '건강' && weak) it.prep += ` 이 명반에서 가장 옅은 것은 ${weak.name} 기운(${weak.means})이라, ${weak.how}`;
  }
  items.sort((a, b) => a.y - b.y);
  return items.slice(0, 8);
}

/**
 * 두 사람이 앞으로 마주할 중요한 일 (궁합 리포트·AI 공용) — {y, when, title, what, prep}
 *   · 한 사람의 앞으로의 10년 운이 **상대의 배우자 자리(일지)**와 부딪치거나·되풀이되거나·맞물리는 일
 *     (그 10년의 갈래별 사전 pair|충·형·합|십신 무리)
 *   · 한 사람의 일 변화·목돈·이사가 두 사람 생활에 미치는 일 (pairlife|분야|십신 무리)
 *   · 두 사람의 흐름이 함께 바뀌는 때
 * 사전 문장의 {X}는 그 일을 겪는 사람, {Y}는 상대다. 결혼·출산 시기는 쓰지 않는다.
 */
export function pairEventItems(rA, rB, A, B) {
  const now = Number(rA.input.currentYear);
  const items = [];
  const fill = (e, X, Y) => [e.t, e.w, e.p].map((s) => s.replaceAll('{X}', X).replaceAll('{Y}', Y));
  for (const [rX, rY, X, Y] of [[rA, rB, A, B], [rB, rA, B, A]]) {
    try {
      const yearAt = (exact) => new Date((rX.input.jdUT - 2440587.5 + exact * 365.2425) * 864e5).getUTCFullYear();
      const seat = rY.chart.pillars.day.branch;
      const seen = new Set();
      for (const d of computeDaeun(rX.chart, rX.input.isMale, rX.input.jdUT)?.list ?? []) {
        const from = yearAt(d.fromExact), to = yearAt(d.toExact) - 1;
        if (to < now || from > now + 30) continue;
        const rels = branchRelations(d.branch, seat).filter((x) => !x.minor);
        const rel = rels.find((x) => x.kind === '충') ?? rels.find((x) => /형/.test(x.kind)) ?? rels.find((x) => /합/.test(x.kind));
        if (!rel) continue;
        const kind = rel.kind === '충' ? '충' : /형/.test(rel.kind) ? '형' : '합';
        if (seen.has(kind)) continue;
        seen.add(kind);
        const e = eventEntry(`pair|${kind}|${TEN_GOD_GROUP[d.god]}`);
        if (!e) continue;
        const [title, what, prep] = fill(e, X, Y);
        const y = Math.max(from, now);
        items.push({ y, when: `${y}~${to}년 무렵`, title, what, prep });
      }
    } catch { /* */ }
    for (const it of lifeEventItems(rX)) {
      if (!['직업', '재물', '이사'].includes(it.domain)) continue;
      const e = eventEntry(`pairlife|${it.domain}|${it.group}`);
      if (!e) continue;
      const [title, what, prep] = fill(e, X, Y);
      items.push({ y: it.y, when: `${it.y}년 무렵`, title, what, prep });
    }
  }
  const snA = seasonNow(rA), snB = seasonNow(rB);
  const together = togetherTurn(snA, snB);
  if (together) {
    const y = Number(together.match(/^(\d{4})/)?.[1]);
    // 두 사람이 각각 어느 쪽으로 넘어가는지 — 이것이 쌍마다 갈린다
    const headOf = (sn) => String(sn.next.e.h).split(/(?<=[.])\s/)[0].replace(/[.]$/, '');
    items.push({ y, when: together.match(/^[\d~]+년/)?.[0] ?? '', title: '두 사람의 흐름이 함께 바뀌는 때',
      what: `${A}님은 '${headOf(snA)}'로, ${B}님은 '${headOf(snB)}'로 비슷한 무렵에 넘어갑니다. 둘 다 생활의 틀이 바뀌는 때라 같이 움직이기 좋은 만큼 서로의 변화에 흔들리기도 쉽습니다.`,
      prep: '사는 곳·일·돈 계획처럼 큰 틀을 이때 함께 다시 짜고, 각자 바라는 다음 10년을 미리 이야기해 두세요.' });
  }
  items.sort((a, b) => a.y - b.y);
  return items.slice(0, 8);
}

/**
 * 리포트 맨 위 네 카드의 내용 — 지금 시기 · 앞으로 가야 할 방향 · 알아 두면 좋은 나 · 조심해야 할 것.
 * AI 상담 문맥(aiContext.js)도 이 함수를 그대로 써서, 리포트와 AI가 같은 말을 같은 순서로 한다.
 */
export function futureDigest(r) {
  let es = [];
  try { es = dictEntries(r); } catch { /* */ }
  const pick = (f, n, keep, skip = 0) => coreField(es, f, n, skip, keep).map((x) => x.text);
  const careful = pick('c', 3);
  const focus = careerFocus(r);
  return {
    hasDict: es.length > 0,
    season: seasonNow(r),
    direction: {
      // 직업 분야와 맞는 일을 한 칸으로 — 두 칸으로 나눠 두니 서로 다른 말을 했다
      career: '',
      fields: [
        focus.name ? `여러 점술이 함께 가리키는 쪽은 ${focus.name}입니다.` : '',
        focus.verified.length
          ? (focus.name ? `그중에서도 ${focus.verified.join(', ')} 분야가 가능성이 높습니다.` : `가능성이 높은 분야는 ${focus.verified.join(', ')}입니다.`)
          : '',
        ...focus.lines,
      ].filter(Boolean),
      earn: pick('m', 2, (t) => EARN.test(t) && !IMPERATIVE.test(t)),
      // 한 문장만 — 두 문장이면 "안정된 관계를 원합니다"처럼 같은 말이 되풀이되었다
      drawn: pick('r', 1, (t) => DRAWN_TO.test(t)),
    },
    know: {
      p: pick('p', 3),
      work: pick('w', 3, (t) => !FIELD_FIT.test(t)),
      spend: pick('m', 2, (t) => !EARN.test(t) && !IMPERATIVE.test(t)),
      rel: pick('r', 2, (t) => !DRAWN_TO.test(t)),
    },
    caution: {
      careful: [...careful, ...pick('m', 1, (t) => IMPERATIVE.test(t))],
      principles: dictPrinciples(r, careful),
    },
  };
}

function lifeReport(form, r, f, v) {
  const me = readingBy(r, '사주', /^일간/);
  const s = lifeSeasons(r);
  // '명반을 가르는 핵심 구조' 카드는 뺐다 — 구조마다 정해진 문단 하나를 통째로 붙여, 같은 구조를 가진
  // 사람은 글자 하나 다르지 않은 글을 받았다(예: '어린 시절 집안 환경의 변화')
  const d = futureDigest(r);
  const sn = d.season;

  // 1. 지금 나는 어떤 시기에 있나
  const now = sn
    ? bullets(
      bullet('📍', `지금 (${sn.cur.from}~${sn.cur.to}년)`, sn.cur.e.h),
      bullet('👍', '지금 힘을 쓸 곳', sn.cur.e.g),
      sn.next ? bullet('⏭️', `${sn.next.from}년(${sn.next.age}세)부터`, sn.next.e.h) : '',
    )
    : bullets(bullet('📍', '지금', s.season), bullet('⏭️', '다음 시기', s.next));

  // 2. 앞으로 가야 할 방향
  const direction = bullets(
    bullet('💼', '가능성이 높은 직업 분야', d.direction.career),
    bullet('🛠️', '잘 맞는 일', d.direction.fields.join(' ')),
    bullet('💰', '돈을 키우는 방향', d.direction.earn.join(' ')),
    bullet('💞', '곁에 두면 좋은 사람', d.direction.drawn.join(' ')),
  );

  // 3. 알아 두면 좋은 나 — 결정할 때 기억할 내 모습
  const know = [
    ['🙂', '나의 성격', d.know.p],
    ['💼', '일할 때의 나', d.know.work],
    ['💳', '돈을 쓰는 습관', d.know.spend],
    ['💬', '관계 속의 나', d.know.rel],
  ].map(([icon, t, xs]) => (xs.length ? h4(icon, t) + lineList(xs) : '')).join('');

  // 4. 조심해야 할 것 — 지금 시기 · 늘 조심할 것 · 지켜야 할 원칙
  const caution = (sn?.cur?.e?.c ? h4('⏳', '지금 시기에') + lineList([sn.cur.e.c]) : '')
    + (d.caution.careful.length ? h4('🚧', '늘 조심할 것') + lineList(d.caution.careful) : '')
    + (d.caution.principles.length ? h4('📏', '지켜야 할 원칙') + lineList(d.caution.principles) : '');

  return card('🧭', '지금 나는 어떤 시기에 있나', now)
    + card('🚀', '앞으로 가야 할 방향', direction)
    + card('💡', '알아 두면 좋은 나', know || distinctCard(r))
    + card('⚠️', '조심해야 할 것', caution)
    + card('🌊', '인생의 큰 흐름 — 앞으로 십 년마다 무엇이 오는가', lifeFlow(r))
    + card('🎯', '당장 실행해볼 수 있는 Action Item 3가지',
      `<ol class="rp-act">`
      + actionItems(r, v, me, s)
        .map(([k, head, why]) => `<li><span class="rp-tag rp-tag-${k === 'DO' ? 'do' : k === 'KEY' ? 'key' : 'dont'}">${esc(k)}</span><div>${head ? `<b>${esc(head)}</b>` : ''}${why ? `<p>${esc(why)}</p>` : ''}</div></li>`).join('')
      + `</ol>`);
}

export function renderReport(form, r, f, v) {
  const today = `${f.today.y}.${String(f.today.m).padStart(2, '0')}.${String(f.today.d).padStart(2, '0')}`;
  const name = v.who?.name ?? form.name ?? '';
  // 예전 문서에서 뺀 것: '프로젝트·사업·수익화'(모든 사람에게 같은 면책 문구), '전반 신수'(올해 장과 같은 표),
  // '질문별 답변 색인'(요약과 같은 내용). 계산이나 문장을 바꾼 것이 아니라 겹친 자리를 걷어낸 것이다.
  const chapters = [
    // '방향과 이동'은 뺐다 — 태어난 해 하나로 정해져 같은 해에 난 사람은 모두 같은 방향을 받았다
    sec(1, '일과 돈', careerLife(v, r), '앞으로 키워 갈 일과 돈'),
    sec(2, '사랑과 가족', relations(v, r), '배우자·자녀·형제'),
    // '올해'와 '일이 풀리고 막히는 흐름' 장은 뺐다(사용자 요청) — 앞으로의 방향은 위 카드와 시기 장이 맡는다
    // '시기 한눈에 보기'는 뺐다(사용자 요청) — 언제보다 무슨 일이 어떤 모양으로 오는지를 쓴다
    sec(3, '앞으로 마주할 중요한 일', lifeEvents(r), '무슨 일이, 어떤 모양으로 오고, 어떻게 대비할지'),
  ].filter(Boolean).join('');

  return `
    <section class="rp" aria-labelledby="rp-title">
      <header class="rp-cover">
        <p class="rp-kicker">인생 데이터 분석 · ${esc(today)}</p>
        <h2 class="rp-title" id="rp-title"><span aria-hidden="true">🔮</span> ${esc(name ? `${name}님의` : '나의')} 인생 데이터 분석 리포트</h2>
        <p class="rp-lead">열일곱 가지 동양·서양 점술이 함께 가리키는 것을 나만을 위한 결과지로 정리했습니다.</p>
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

/**
 * 궁합 리포트 — 개인 리포트와 같은 원칙이다.
 * 여덟 관계 축마다 점수 구간(상·중·하)별로 정해진 문단을 붙이던 방식은 뺐다. 같은 구간의 쌍은
 * 글자 하나 다르지 않은 글을 받았다. 대신
 *   · 두 사람의 명반을 맞대야만 정해지는 것(일간의 기운 짝, 배우자 자리끼리의 관계, 서로 채우는 기운)
 *   · 두 사람 각자의 해석 사전(성격의 뼈대 체계 순 — 개인 리포트의 "나는 어떤 사람인가"와 같다)
 *   · 두 사람의 문장을 맞대어 찾은 닮은 점·부딪치는 점
 * 으로 쓴다. 띠처럼 태어난 해로만 정해지는 것은 쓰지 않는다.
 */
export function renderPairReport(formA, formB, c, v, elementDist, people = {}) {
  const A = c.A?.input?.name ?? formA.name;
  const B = c.B?.input?.name ?? formB.name;
  const today = new Date();
  const stamp = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;
  const rA = people.a ?? c.A, rB = people.b ?? c.B;

  // 서로 채워 주는 기운 — 한쪽이 옅은 기운을 다른 쪽이 넉넉히 가졌는가
  const ea = elementDist?.a, eb = elementDist?.b;
  const fills = [];
  const elemRows = (ea && eb) ? ELEM_KEYS.map((e, i) => {
    const x = Math.round(ea[i] * 10) / 10, y = Math.round(eb[i] * 10) / 10;
    if (x < 1 && y >= 2) fills.push(`${B}님이 ${A}님에게 옅은 ${ELEM_FILL[e].name} 기운(${ELEM_FILL[e].means})을 채워 줍니다.`);
    if (y < 1 && x >= 2) fills.push(`${A}님이 ${B}님에게 옅은 ${ELEM_FILL[e].name} 기운(${ELEM_FILL[e].means})을 채워 줍니다.`);
    const note = (x < 1 && y < 1) ? '두 사람 모두 약합니다. 서로 채워주지 못하는 기운입니다.'
      : x - y >= 0.8 ? `${A}님 쪽이 강합니다.` : y - x >= 0.8 ? `${B}님 쪽이 강합니다.` : '두 사람이 비슷합니다.';
    return [`${ELEM[e]} 기운`, note];
  }) : [];

  let pr = null, esA = [], esB = [];
  try { pr = pairReading(rA, rB, A, B); } catch { /* */ }
  try { esA = dictEntries(rA); esB = dictEntries(rB); } catch { /* */ }
  const lines = (es, f, n, skip = 0) => coreField(es, f, n, skip).map((x) => x.text);

  // 개인 리포트와 같은 순서 — 지금 → 앞으로 갈 방향 → 알아 둘 것 → 조심할 것
  const seat = pr?.seatKind !== '없음'; // 배우자 자리끼리 아무 관계가 없으면 누구에게나 같은 말이라 싣지 않는다
  const snA = seasonNow(rA), snB = seasonNow(rB);
  let events = [];
  try { events = pairEventItems(rA, rB, A, B); } catch { /* */ }

  // 1. 지금 두 사람은 — 어떤 관계이고, 각자 어떤 시기에 있나
  const together = togetherTurn(snA, snB);
  const nowCard = bullets(
    bullet('💞', '두 사람의 관계', pr?.stem?.h),
    bullet('🔗', '끌어당기는 힘', pr?.hap?.h),
    bullet('🏠', '함께 살 때', seat ? pr?.seat?.h : ''),
    bullet('📍', `${A}님의 지금 (${snA?.cur?.from ?? ''}~${snA?.cur?.to ?? ''}년)`, snA?.cur?.e?.h),
    bullet('📍', `${B}님의 지금 (${snB?.cur?.from ?? ''}~${snB?.cur?.to ?? ''}년)`, snB?.cur?.e?.h),
    // 함께 바뀌는 때는 아래 "앞으로 두 사람이 마주할 중요한 일"이 자세히 쓴다
    together && !events.length ? bullet('⏭️', '함께 바뀌는 때', together) : '',
  );

  // 2. 앞으로 함께 가야 할 방향
  const mA = lines(esA, 'm', 4), mB = lines(esB, 'm', 4);
  const money = themeContrast(mA, mB);
  const direction = bullets(
    bullet('🧭', '두 사람이 잘 되려면', [pr?.stem?.g, pr?.hap?.g, seat ? pr?.seat?.g : ''].filter(Boolean).join(' ')),
    bullet('🌱', '서로 채워 주는 것', fills.slice(0, 2).join(' ')),
    bullet('💰', '돈은 이렇게', money.clash.length
      ? '돈 앞에서 두 사람의 결이 엇갈립니다. 공동으로 쓰는 몫과 각자 쓰는 몫을 처음부터 나눠 두세요.'
      : ''),
    bullet('👍', `${A}님이 지금 힘을 쓸 곳`, snA?.cur?.e?.g),
    bullet('👍', `${B}님이 지금 힘을 쓸 곳`, snB?.cur?.e?.g),
  );

  // 3. 알아 두면 좋은 서로 — 상대를 이해할 때 기억할 모습, 닮은 점
  const tA = [...lines(esA, 'p', 6), ...lines(esA, 'r', 4)];
  const tB = [...lines(esB, 'p', 6), ...lines(esB, 'r', 4)];
  const { same, clash } = themeContrast(tA, tB);
  const pairRow = ([a, b]) => `<li><b>${esc(A)}님</b> — ${esc(a)}<br><b>${esc(B)}님</b> — ${esc(b)}</li>`;
  const pairList = (rows) => (rows.length ? `<ul class="rp-ul">${rows.slice(0, 3).map(pairRow).join('')}</ul>` : '');
  const person = (name, es, r) => {
    const want = ziweiPalaceEntry(r, 'spouse');
    return h4('🙂', `${name}님`) + bullets(
      bullet('', '성격', lines(es, 'p', 2).join(' ')),
      bullet('', '사랑할 때', lines(es, 'r', 2).join(' ')),
      bullet('', '끌리는 사람', want?.h),
    );
  };
  const know = person(A, esA, rA) + person(B, esB, rB)
    + (same.length ? h4('🤝', '닮은 점') + pairList(same) : '');

  // 4. 조심해야 할 것 — 부딪치기 쉬운 점, 두 사람 짝에서 조심할 것, 각자 지금 시기에 조심할 것
  const caution = (clash.length ? h4('⚡', '부딪치기 쉬운 점') + pairList(clash) : '')
    + (money.clash.length ? h4('💳', '돈 앞에서 엇갈리는 점') + pairList(money.clash) : '')
    + h4('🚧', '두 사람이 조심할 것') + lineList([pr?.stem?.c, pr?.hap?.c, seat ? pr?.seat?.c : ''].filter(Boolean))
    + h4('⏳', '각자 지금 시기에') + bullets(
      bullet('', `${A}님`, [snA?.cur?.e?.c, lines(esA, 'c', 1)[0]].filter(Boolean).join(' ')),
      bullet('', `${B}님`, [snB?.cur?.e?.c, lines(esB, 'c', 1)[0]].filter(Boolean).join(' ')),
    );

  // 앞으로 두 사람이 마주할 중요한 일 — 개인 리포트처럼 시기표가 아니라 사건·모양·대비로
  const eventHtml = events.map((it) =>
    `<article class="rp-event"><h4 class="rp-h4">${esc(it.title)} <small>· ${esc(it.when)}</small></h4>`
    + `<p>${esc(it.what)}</p><p class="rp-prep"><b>대비</b> — ${esc(it.prep)}</p></article>`).join('');
  const chapters = sec(1, '앞으로 두 사람이 마주할 중요한 일', eventHtml, '무슨 일이, 어떤 모양으로 오고, 어떻게 대비할지')
    + sec(2, '서로 채워주는 기운', table2(['기운', '두 사람'], elemRows), '두 사람의 기운 비교');

  return `
    <section class="rp" aria-labelledby="rp-title">
      <header class="rp-cover">
        <p class="rp-kicker">관계 데이터 분석 · ${esc(stamp)}</p>
        <h2 class="rp-title" id="rp-title"><span aria-hidden="true">💞</span> ${esc(A)} · ${esc(B)} 관계 분석 리포트</h2>
        <p class="rp-lead">두 사람의 출생 정보를 맞대어 본 결과를 한 장으로 정리했습니다.</p>
      </header>
      ${card('🧭', '지금 두 사람은', nowCard)}
      ${card('🚀', '앞으로 함께 가야 할 방향', direction)}
      ${card('💡', '알아 두면 좋은 서로', know)}
      ${card('⚠️', '조심해야 할 것', caution)}
      <h3 class="rp-more">더 자세히 보기</h3>
      <div class="rp-chs">${chapters}</div>
      <p class="rp-note">점술은 상징적 해석 도구이며 실제 미래를 확정하지 않습니다. 결혼·이별·임신·투자·건강과 관련된 결정은
        두 사람의 대화와 전문가의 객관적 조언을 우선해 주세요.</p>
    </section>`;
}

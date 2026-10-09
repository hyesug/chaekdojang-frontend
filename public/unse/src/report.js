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
import { buildBoard, decadeLimits, palaceMap, sihwaOn } from './hires/ziwei.js';
import { yearTimeline } from './reading.js';
import { j } from './core/josa.js';
import { yearDirections } from './systems/gujeong.js';
import { timingFor } from './semantic/compose/timing.js';
import { reportTimingPolicy } from './semantic/timing/policy.js';
import { selectedWindows, selectedSpan, pastWindows, isMarried, PAST_DOMAINS } from './semantic/timing/selected.js';
import { palaceStars, natureOf } from './semantic/structure/stars.js';
import { readSpouse, spousePalaceStars, spouseVerdict } from './semantic/structure/spouse.js';
import { readChildren, childPalaceStars, childrenVerdict } from './semantic/structure/children.js';
import { childrenPack, marriagePack } from './hires/vedicExt.js';
import { verifiedCareer } from './semantic/index.js';
import { distinctReadings, ownSentences } from './semantic/distinct.js';
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

/** 가능성이 높은 직업 범주 — 자미두수·육임·숙요 (docs/unse/rebuild-result.md) */
function verifiedCareerLine(r) {
  let vc = null;
  try { vc = verifiedCareer(r.input); } catch { /* */ }
  if (!vc?.available) return '';
  return para(`가능성이 높은 직업 분야는 ${vc.top.map((x) => x.label).join(', ')} 쪽입니다.`);
}

const careerLife = (v, r) =>
  sub('', '가능성이 높은 직업 분야', verifiedCareerLine(r))
  + sub('', '내 커리어 무기와 자산 스타일', s13(r))
  + sub('', '사회에서 보이는 나', s12(r))
  + sub('', '타고난 성향', readings(r, '사주', 3));

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
  return para(`${who}과의 관계에서는 ${nat.traits.slice(0, 4).join(', ')} 같은 모습이 두드러집니다.`)
    + (nat.risk?.[0] ? para(`부딪치는 지점은 ${nat.risk[0].replace(/다$/, '다는 것')}입니다.`) : '');
}

/**
 * 일이 풀리고 막히는 흐름 — 자미 관록궁(일할 때의 나)의 별과 사주에서 가장 센 힘·비어 있는 힘으로.
 * 예전에는 모든 사람에게 같은 세 줄을 냈다(고유 0%).
 */
function workFlow(r) {
  const rows = [];
  let nat = null;
  try { nat = natureOf(palaceStars(r.input, '관록궁'), '일할 때의 나'); } catch { /* */ }
  if (nat?.traits?.length) rows.push(['잘 풀릴 때', `${nat.traits.slice(0, 3).join(', ')} — 이 힘이 그대로 쓰이는 자리에서 일이 풀립니다.`]);
  if (nat?.risk?.[0]) rows.push(['막힐 때', `${nat.risk[0].replace(/다$/, '다')}.`.replace(/\.\.$/, '.')]);
  try {
    const g = tenGodDistribution(r.chart.pillars, r.chart.dayStem).groups;
    const order = Object.keys(g).sort((a, b) => g[b] - g[a]);
    if (STRONG_RULE[order[0]]) rows.push(['넘칠 때 잡을 것', STRONG_RULE[order[0]]]);
    if (order.at(-1) !== order[0] && EMPTY_RULE[order.at(-1)]) rows.push(['비어 있어 채울 것', EMPTY_RULE[order.at(-1)]]);
  } catch { /* */ }
  return rows.length ? timeline(rows) : '';
}

/**
 * 올해 — 그 해 천간의 사화가 **타고난 판의 어느 궁**에 떨어지는가, 그 해 지지가 원국 기둥과 무엇을 맺는가.
 * 둘 다 생년월일시로 정해진 판 위에서 계산하므로 같은 해라도 사람마다 다른 자리를 짚는다.
 */
const SIHWA_SAY = {
  화록: (a) => `'${a}' 쪽에 돈과 기회가 붙습니다.`,
  화권: (a) => `'${a}' 쪽에서 주도권을 쥐게 됩니다.`,
  화과: (a) => `'${a}' 쪽에서 이름이 나거나 인정을 받습니다.`,
  화기: (a) => `'${a}' 쪽이 막히거나 마음이 붙들리기 쉽습니다. 여기서는 서두르지 마세요.`,
};
function yearPalaces(r, yr) {
  const rows = [];
  try {
    if (r.input.timeKnown) {
      const b = buildBoard(r.input);
      const map = palaceMap(b.myeong);
      const stem = ((Number(yr) - 4) % 10 + 10) % 10;
      const center = map[((Number(yr) - 4) % 12 + 12) % 12];
      if (AREA[center]) rows.push(['올해의 중심', `'${AREA[center]}' 쪽이 한 해의 중심에 섭니다.`]);
      for (const s of sihwaOn(b.board, stem)) {
        const pal = s.branch != null ? map[s.branch] : null;
        if (pal && AREA[pal] && SIHWA_SAY[s.kind]) rows.push([s.kind === '화기' ? '조심할 자리' : s.kind === '화록' ? '돈과 기회' : s.kind === '화권' ? '주도권' : '인정받는 자리', SIHWA_SAY[s.kind](AREA[pal])]);
      }
    }
    const yb = ((Number(yr) - 4) % 12 + 12) % 12;
    for (const key of ['day', 'year', 'month', 'hour']) {
      const p = r.chart.pillars[key];
      if (!p) continue;
      const rel = branchRelations(p.branch, yb).find((x) => !x.minor);
      if (!rel) continue;
      if (rel.kind === '충') rows.push(['크게 움직이는 곳', `${PILLAR_AREA[key]} 쪽이 크게 바뀌거나 자리를 옮기기 쉽습니다.`]);
      else if (/합/.test(rel.kind)) rows.push(['붙는 인연', `${PILLAR_AREA[key]} 쪽에 새 인연·협력이 붙기 쉽습니다.`]);
      else if (/형/.test(rel.kind)) rows.push(['되풀이되는 일', `${PILLAR_AREA[key]} 쪽에서 같은 문제가 되풀이되기 쉽습니다.`]);
    }
  } catch { /* */ }
  return rows;
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

  return sub('', '배우자 — 어떤 사람인가',
      para(withSrc(v.life?.spouse)) + verdictLines(spv.lines, '배우자').map(para).join('') + personOf(sp, '배우자') + timingOf(r, '결혼'))
    + sub('', '자녀',
      para(withSrc(v.life?.child)) + verdictLines(chv.lines, '자녀').map(para).join('') + personOf(ch, '자녀') + timingOf(r, '자녀'))
    + sub('', '형제·동료', palaceLine(r, '형제궁', '형제·동료') || para(withSrc(v.life?.sibling)))
    + sub('', '주변 사람', palaceLine(r, '노복궁', '주변 사람'));
}

/* ── 3. 올해 흐름 ───────────────────────────────────────── */

function thisYear(v, f, r) {
  const yr = f.year?.period?.sajuYear ?? r.input.currentYear;
  // 달마다의 흐름은 뺐다 — 사람마다 같은 틀 문장이 되풀이되었다(scripts/report-sameness.mjs, 고유 7%)
  // 건강은 실제 사례로 고른 시기 체계가 올해 신호를 짚으면 그 달을 먼저 말한다.
  // 일반 점수의 "큰 기복이 없는 해"와 시기 신호가 서로 다른 말을 하지 않게 한다.
  const healthMonths = selectedWindows(r, '건강', 15, 3)
    .map((w) => w.peakAt ?? w.from)
    .filter((key) => Number(key.slice(0, 4)) === Number(yr))
    .map((key) => Number(key.slice(5)))
    .sort((a, b) => a - b);
  const healthText = healthMonths.length
    ? `${[...new Set(healthMonths)].map((m) => `${m}월`).join('·')} 무렵 몸에 일이 생기기 쉬운 신호가 있습니다. 미뤄 둔 검진·치료를 챙기고 일정을 무리하게 잡지 마세요.`
    : null;
  const areas = ['총운', '금전운', '직장운', '애정운', '학업운', '건강운']
    .map((a) => {
      const s = f.year?.areas?.[a]?.score;
      if (a === '건강운' && healthText) return ['건강', healthText];
      return s == null ? null : [a === '총운' ? '전체' : a.replace('운', ''), areaText(a, s, 'year')];
    }).filter(Boolean);

  // 판 위에서 계산한 올해의 자리(사람마다 갈린다)를 먼저 쓰고, 그것이 없을 때만 영역 점수표로 물러선다
  const placed = yearPalaces(r, yr);
  if (healthText) placed.push(['건강', healthText]);
  return sub('', `${yr}년, 어디가 움직이는가`, placed.length >= 2 ? timeline(placed) : table2(['영역', '풀이'], areas))
    + sub('', '올해의 메인 테마', readings(r, '토정비결', 2) + readings(r, '태을신수', 1))
    + sub('', '타고난 요일의 성향', readings(r, '태국 점성술', 1));
}

/* ── 4. 방향과 이동 ─────────────────────────────────────── */

function direction(r, f) {
  let d = null;
  try { d = yearDirections(r.input.sajuYear, f.year?.period?.sajuYear ?? r.input.currentYear); }
  catch { /* */ }
  const uniq = (xs) => [...new Set(xs)];
  const rows = [];
  // 한 방위가 길방이면서 흉방(예: 본명적살)이기도 하면 피할 쪽으로만 적는다 — aiContext.js 와 같은 규칙
  const badDirs = uniq((d?.bad ?? []).map((b) => b.dir));
  const goodDirs = uniq((d?.good ?? []).map((g) => g.dir)).filter((x) => !badDirs.includes(x));
  if (goodDirs.length) rows.push(['좋은 방향', goodDirs.join(', ')]);
  if (badDirs.length) rows.push(['피할 방향', badDirs.join(', ')]);
  const thai = sysOf(r, '태국 점성술')?.facts ?? [];
  const lucky = thai.filter((x) => /색|요일/.test(x.label)).map((x) => `${x.label} ${x.value}`).join(' · ');

  return table2(['구분', '방향'], rows)
    + (lucky ? labeled('나의 행운 상징', lucky) : '')
    + sub('', '타고난 기질', readings(r, '구성학', 1))
    + sub('', '옮기기 좋은 시기', timingOf(r, '이사', 8));
}

/* ── 5. 내면의 패턴 ─────────────────────────────────────── */

function inner(r) {
  return sub('', '일이 풀리고 막히는 흐름', workFlow(r))
    + sub('', '생일 숫자로 본 나', readings(r, '카발라', 1))
    + sub('', '타고난 과제', readings(r, '주역', 2))
    + sub('', '타로 카드', readings(r, '타로', 2));
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

/* ── 6. 시기 한눈에 보기 ────────────────────────────────── */

function finale(r) {
  const items = [];
  for (const [domain, icon, what] of [
    ['직업', '💼', '일에서 가장 큰 기회와 변화가 오는 때'],
    ['재물', '💰', '돈이 가장 크게 들어오는 때'],
    ['이사', '🏠', '이사·이동하기 가장 좋은 때'],
    ['건강', '🩺', '몸에 일이 생기기 쉬워 특히 챙겨야 하는 때'],
  ]) {
    const windows = selectedWindows(r, domain, 15, 2);
    if (!windows.length) continue;
    const spans = windows.map((w) => selectedSpan(r, w));
    const text = (spans.length === 1
      ? `${esc(what)}는 <strong>${esc(spans[0])}</strong>에 신호가 가장 높습니다.`
      : `${esc(what)}는 <strong>${esc(spans.join(', '))}</strong> 순으로 신호가 높습니다.`);
    items.push(`<li><span class="rp-ic" aria-hidden="true">${icon}</span><div><p>${text}</p></div></li>`);
  }
  const principles = personalPrinciples(r);
  const timingNotice = items.length
    ? `<ul class="rp-bul">${items.join('')}</ul>`
    : '<p class="rp-t rp-when">이 명반에서는 선택된 체계가 기간 안에서 서로 다른 달을 가르지 못했습니다.</p>';
  return sub('', '앞으로 15년, 분야마다 신호가 모이는 때', timingNotice)
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
    ? `${me2.risk.slice(0, 2).map((x) => `${x.replace(/[.]?$/, '')}.`).join(' ')} 이런 순간을 알아차리는 것만으로 손해가 크게 줄어듭니다.`
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
      for (const rel of branchRelations(p.branch, d.branch)) {
        if (rel.minor) continue;
        if (rel.kind === '충') moves.push(`${PILLAR_AREA[key]} 쪽이 크게 바뀌거나 자리를 옮기기 쉽습니다`);
        else if (/합/.test(rel.kind)) moves.push(`${PILLAR_AREA[key]} 쪽에 새 인연·협력이 붙기 쉽습니다`);
        else if (/형/.test(rel.kind)) moves.push(`${PILLAR_AREA[key]} 쪽에서 같은 문제가 되풀이되기 쉽습니다`);
      }
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
    if (info && !seenGroup.has(group)) {
      seenGroup.add(group);
      parts.push(`잘 쓰려면 — ${info.good} 조심할 점 — ${info.watch}`);
    }
    const nowMark = from <= now && now <= to ? ' · 지금' : '';
    rows.push([`${d.fromAge}~${d.toAge}세 (${from}~${to}년)${nowMark}`, parts.join(' ')]);
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
      const g = TEN_GOD_GROUP[String(st.detail ?? '').replace(/^천간\s*/, '')];
      return g ? `'${GOD_FIELD[g]}'이 삶의 중심 주제로 올라옵니다` : '';
    }
    if (st.system === '자미두수') {
      const pal = String(st.label ?? '').match(/원국의\s*(\S+궁)/)?.[1];
      return pal && AREA[pal] ? `'${AREA[pal]}' 쪽이 삶의 앞자리로 나옵니다` : '';
    }
    if (st.system === '베딕') {
      const p = String(st.label ?? '').split(' ')[0];
      return PLANET_TERM[p] ? `${j(PLANET_TERM[p], '이')} 오래 이어질 주제가 됩니다` : '';
    }
    if (st.system === '구성학' || st.system === '카발라') return '하나를 매듭짓고 새로 씨를 뿌리는 시기가 시작됩니다';
    if (st.system === '고전 서양') return '삶의 큰 무대가 바뀝니다';
    if (st.system === '태을신수') return '오래 이어진 흐름이 한 바퀴를 돌아 새로 시작됩니다';
    return '';
  };
  const turnRows = turns.map((t) => {
    const what = [...new Set(t.starts.map(startLine).filter(Boolean))];
    return [`${t.year}년 (${t.age}세)`,
      `${what.length ? `${what.join('. ')}. ` : ''}하던 일의 방향이나 생활의 틀을 다시 짜게 되기 쉬운 때입니다.`];
  });

  return (rows.length ? timeline(rows) : '')
    + (turnRows.length ? `<h4 class="rp-h4">🔀 흐름이 크게 꺾이는 해</h4>${timeline(turnRows)}` : '');
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
  const signature = (v.signature ?? []).map((item) =>
    `<article class="rp-signature">` +
      `<h4 class="rp-h4">${esc(item.title)}</h4>` +
      `<p>${esc(item.conclusion)}</p>` +
      `<p class="rp-fine"><b>이 힘이 흔들리는 조건</b> — ${esc(item.condition)}</p>` +
    `</article>`
  ).join('');

  return card('🔍', '나만의 특징 — 사람들 사이에서 드문 것부터', distinctCard(r))
    + card('🧭', '명반을 가르는 핵심 구조', signature)
    + card('⚡', '한눈에 보는 내 인생의 핵심 키워드',
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
    + card('🌊', '인생의 큰 흐름 — 십 년마다 무엇이 오는가',
      (yearText ? bullets(bullet('📍', `올해(${r.input.currentYear}년)는`, firstOf(yearText, 3))) : '')
      + lifeFlow(r))
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

/** 궁합 결과에서 체계 하나 */
const pSys = (c, name) => (c.results ?? []).find((x) => x?.name === name) ?? null;


/** 그 체계의 풀이 */
function pRead(c, name, max = 2) {
  const s = pSys(c, name);
  if (!s?.readings?.length) return '';
  return readItems(s.readings.slice(0, max).map((x) => [x.title, x.text]));
}

/** 관계 축 하나 — 실제로 어떤 모습인지 · 잘 되려면 · 조심할 점 */
const pairAxis = (v, key) => v?.eightAxes?.find((item) => item.key === key) ?? null;
function axisBlock(v, key) {
  const x = pairAxis(v, key);
  if (!x) return '';
  return sub('', x.label, para([x.conclusion, x.reality].filter(Boolean).join(' '))
    + bullets(bullet('🟢', '잘 되려면', x.good), bullet('⚠️', '조심할 점', x.bad)));
}

export function renderPairReport(formA, formB, c, v, elementDist) {
  const A = c.A?.input?.name ?? formA.name;
  const B = c.B?.input?.name ?? formB.name;
  const today = new Date();
  const stamp = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;

  // 오행 보완성 — 두 사람 수치를 나란히 놓고 적은 쪽을 짚는다(수치는 싣지 않고 결론만)
  const ea = elementDist?.a, eb = elementDist?.b;
  const elemRows = (ea && eb) ? ['목', '화', '토', '금', '수'].map((e, i) => {
    const x = Math.round(ea[i] * 10) / 10, y = Math.round(eb[i] * 10) / 10;
    // 0.8 이상 벌어지면 한쪽으로 기운 것으로 본다
    const note = (x < 1 && y < 1) ? '두 사람 모두 약합니다. 서로 채워주지 못하는 기운입니다.'
      : x - y >= 0.8 ? `${A}님 쪽이 강합니다.` : y - x >= 0.8 ? `${B}님 쪽이 강합니다.` : '두 사람이 비슷합니다.';
    return [`${ELEM[e]} 기운`, note];
  }) : [];

  // 한눈에 — 잘 맞는 축 · 부딪치기 쉬운 축 · 오래 가려면. 체계 표 수는 싣지 않는다
  const axes = v?.eightAxes ?? [];
  const hi = axes.filter((x) => x.band === 'hi');
  const lo = axes.filter((x) => x.band === 'lo');
  const keep = pairAxis(v, '장기유지');
  const glance = bullets(
    bullet('🟢', `잘 맞는 점${hi.length ? ` — ${hi.map((x) => x.label).join('·')}` : ''}`,
      hi[0] ? [hi[0].conclusion, hi[0].reality].join(' ') : ''),
    bullet('⚠️', `부딪치기 쉬운 점${lo.length ? ` — ${lo.map((x) => x.label).join('·')}` : ''}`,
      lo[0] ? [lo[0].conclusion, lo[0].bad].join(' ') : ''),
    bullet('🔑', '오래 가려면', keep ? [keep.conclusion, keep.good].join(' ') : ''),
  );

  const chapters = [
    sec(1, '두 사람의 기본 성향',
      sub('', '성격이 맞물리는 방식', pRead(c, '사주'))
      + sub('', '서로 채워주는 기운', table2(['기운', '두 사람'], elemRows)),
      '성격과 기운'),
    sec(2, '감정과 끌림', axisBlock(v, '끌림') + axisBlock(v, '감정') + axisBlock(v, '대화'), '끌림·감정·대화'),
    sec(3, '생활의 궁합', axisBlock(v, '생활') + axisBlock(v, '돈') + axisBlock(v, '역할분담'), '생활·돈·역할'),
    sec(4, '다툼과 오래 가기', axisBlock(v, '갈등') + axisBlock(v, '장기유지'), '부딪칠 때와 오래 갈 때'),
  ].filter(Boolean).join('');

  return `
    <section class="rp" aria-labelledby="rp-title">
      <header class="rp-cover">
        <p class="rp-kicker">관계 데이터 분석 · ${esc(stamp)}</p>
        <h2 class="rp-title" id="rp-title"><span aria-hidden="true">💞</span> ${esc(A)} · ${esc(B)} 관계 분석 리포트</h2>
        <p class="rp-lead">두 사람의 출생 정보를 맞대어 본 결과를 한 장으로 정리했습니다.</p>
      </header>
      ${card('⚡', '한눈에 보는 두 사람', glance)}
      <h3 class="rp-more">더 자세히 보기</h3>
      <div class="rp-chs">${chapters}</div>
      <p class="rp-note">점술은 상징적 해석 도구이며 실제 미래를 확정하지 않습니다. 결혼·이별·임신·투자·건강과 관련된 결정은
        두 사람의 대화와 전문가의 객관적 조언을 우선해 주세요.</p>
    </section>`;
}

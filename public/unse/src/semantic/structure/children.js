/**
 * children.js — **자녀를 체계마다 따로 말한다 (수·성별 포함)**
 *
 * 이 저장소는 오랫동안 "자녀 수와 성별은 계산에서 나오지 않는다. 묻더라도
 * 만들지 않는다"로 막아 두었다. 그 결정은 **열다섯을 하나로 합쳐 단정하던
 * 때**에 나온 것이다. 합치면 어느 체계가 한 말인지 사라지고, 사라진 채로
 * 숫자가 나가면 그건 계산을 자처하는 창작이 된다.
 *
 * 지금은 구조가 다르다. **체계마다 따로 말하고, 갈리면 갈린다고 적는다.**
 * 그러면 막을 이유가 없어진다 — "자미두수 전서의 자녀궁 수 표로는 둘"은
 * 예언이 아니라 **그 전통의 규칙이 무엇인지**를 그대로 옮긴 것이다.
 *
 * ── 그래서 지키는 선 ───────────────────────────────────────
 * 1. **출전이 있는 표만 쓴다.** 새 규칙을 만들지 않는다.
 * 2. **어느 체계가 한 말인지 반드시 붙인다.** 떼면 창작이 된다.
 * 3. **유파가 갈리는 자리는 갈린다고 적는다.** 성별이 특히 그렇다 —
 *    같은 식상을 두고 딸이라 적은 책과 아들이라 적은 책이 다 있다.
 * 4. **맞는다고 말하지 않는다.** 이 저장소는 자녀 수·성별을 검증한 적이 없다.
 *    규칙이 무엇인지 옮기는 것과 그 규칙이 맞는다는 것은 다른 이야기다.
 */
import { MAIN_HIDDEN, tenGod, TEN_GOD_GROUP } from '../../core/ganzhi.js';
import { j } from '../../core/josa.js';
import { buildBoard } from '../../hires/ziwei.js';
import { PALACES } from '../../systems/jamidusu.js';
import { consensusOf, consensusRange, phrase } from '../compose/consensus.js';

/**
 * 자녀궁에 든 주성을 판에서 직접 꺼낸다.
 *
 * `facts` 의 글자를 파싱하면 표기가 조금만 바뀌어도 조용히 빈 배열이 된다 —
 * 실제로 그렇게 비어서 공궁으로 잘못 읽었다. 판에서 가져온다.
 */
export function childPalaceStars(input) {
  try {
    const b = buildBoard(input);
    const idx = PALACES.findIndex(([kr]) => kr === '자녀궁');
    if (idx < 0) return [];
    const pos = ((b.myeong - idx) % 12 + 12) % 12;
    // 보조 네 별은 수 표에 없으므로 주성만 남긴다
    return (b.board[pos] ?? []).filter((s) => !['좌보', '우필', '문창', '문곡'].includes(s));
  } catch { return []; }
}

/**
 * 자미두수 자녀궁 주성별 자녀 수.
 *
 * 『자미두수전서』 계열의 자녀궁 장에 실린 표다. 별이 밝은 자리(묘·왕)에
 * 있으면 많고 어두운 자리(함)면 줄어든다고 적혀 있어서 범위로 옮긴다.
 *
 * **유파 고지**: 판본마다 한두 명씩 다르게 적는다. 여기서는 한 계열만 쓰고
 * 섞지 않는다. 그리고 이 사이트는 **밝기(묘왕함)를 계산하지 않으므로**
 * 범위를 그대로 내보낸다 — 좁혀 말하면 없는 계산을 지어내는 것이다.
 */
const ZIWEI_CHILD_COUNT = {
  자미: { n: [2, 3], note: '귀한 자식을 두나 늦는 편으로 본다' },
  천기: { n: [1, 2], note: '적게 보고, 딸 쪽으로 적은 판본이 많다' },
  태양: { n: [2, 3], note: '아들 쪽으로 적힌 판본이 많다' },
  무곡: { n: [1, 1], note: '적게 보고 늦게 본다' },
  천동: { n: [3, 5], note: '많은 쪽. 판본 중 가장 후하게 적힌 별이다' },
  염정: { n: [1, 1], note: '적게 보고 굴곡이 있다고 적는다' },
  천부: { n: [3, 5], note: '많은 쪽으로 본다' },
  태음: { n: [2, 3], note: '딸 쪽으로 적힌 판본이 많다' },
  탐랑: { n: [2, 3], note: '늦게 두는 쪽으로 본다' },
  거문: { n: [1, 2], note: '적게 보고, 사이에 말이 오간다고 적는다' },
  천상: { n: [2, 2], note: '무난하게 본다' },
  천량: { n: [2, 2], note: '늦게 두는 쪽으로 본다' },
  칠살: { n: [1, 1], note: '적게 보고 늦게 본다' },
  파군: { n: [1, 3], note: '판본 차이가 가장 큰 별이다' },
};

/**
 * 사주로 보는 성별 — **유파가 정면으로 갈린다.**
 *
 * 여자 명식에서 식신을 딸, 상관을 아들로 적은 책이 있고 그 반대로 적은 책이
 * 있다. 남자 명식은 관성으로 보는데 정관·편관의 짝도 마찬가지로 갈린다.
 *
 * **한쪽을 골라 단정하면 그 순간 근거가 사라진다.** 그래서 양쪽을 다 적고
 * 갈린다는 사실을 함께 낸다. 가릴 수 없는 것을 가릴 수 있는 척하지 않는 것이
 * 이 자리에서 할 수 있는 최선이다.
 */
function sajuGender(chart) {
  const { pillars, dayStem, gender } = chart;
  const seen = [];
  for (const [pos, key] of [['년', 'year'], ['월', 'month'], ['일', 'day'], ['시', 'hour']]) {
    const p = pillars[key];
    if (!p) continue;
    if (pos !== '일') {
      const g = tenGod(dayStem, p.stem);
      seen.push({ pos: `${pos}간`, god: g });
    }
    seen.push({ pos: `${pos}지`, god: tenGod(dayStem, MAIN_HIDDEN[p.branch]) });
  }

  const group = gender === 'female' ? '식상' : '관성';
  const mine = seen.filter((x) => TEN_GOD_GROUP[x.god] === group);
  if (!mine.length) {
    return {
      count: 0,
      text: `${gender === 'female' ? '여자 명식은 식상' : '남자 명식은 관성'}으로 자녀를 보는데`
        + ` 그 별이 원국에 없습니다. 자녀가 없다는 뜻이 아니라 **원국만으로는 이 자리를 말할 수 없다**는 뜻이고,`
        + ` 대운으로 들어올 때 열리는 것으로 봅니다.`,
    };
  }

  const kinds = [...new Set(mine.map((x) => x.god))];
  const pair = gender === 'female' ? ['식신', '상관'] : ['정관', '편관'];
  const both = pair.every((k) => kinds.includes(k));

  return {
    count: mine.length,
    kinds,
    text: `${gender === 'female' ? '여자 명식은 식상' : '남자 명식은 관성'}으로 자녀를 봅니다.`
      + ` ${mine.map((x) => `${x.pos} ${x.god}`).join(' · ')} — 모두 ${mine.length}개입니다.`
      + (both
        ? ` ${pair[0]}과 ${pair[1]}이 섞여 있어 아들·딸이 함께 있는 쪽으로 봅니다.`
        : ` ${kinds[0]} 한 종류입니다.`)
      + ` **성별은 여기서 갈립니다** — 같은 ${j(kinds[0], '을')} 두고 딸이라 적은 책과`
      + ` 아들이라 적은 책이 둘 다 있습니다. 한쪽을 골라 말하면 그 순간 근거가 사라지므로`
      + ` 갈린다는 것까지만 말합니다.`,
  };
}

/**
 * 자녀를 체계마다 따로 읽는다.
 *
 * @param {object} chart   `readFortune(...).chart` + `gender`
 * @param {string[]} [ziweiChildStars] 자미 자녀궁 주성
 * @param {object} [vedic] `childrenPack(input)` 결과
 */
export function readChildren(chart, ziweiChildStars = [], vedic = null) {
  const out = [];

  // ── 자미두수 — 수를 세는 표가 실제로 있다 ──
  if (ziweiChildStars.length) {
    const rows = ziweiChildStars.map((s) => ({ star: s, ...(ZIWEI_CHILD_COUNT[s] ?? {}) }))
      .filter((r) => r.n);
    if (rows.length) {
      const lo = Math.min(...rows.map((r) => r.n[0]));
      const hi = Math.max(...rows.map((r) => r.n[1]));
      out.push({
        system: '자미두수', what: `자녀궁 ${ziweiChildStars.join('·')}`,
        topic: '수',
        text: `자녀궁에 ${j(ziweiChildStars.join('·'), '이')} 들었습니다. 전서 계열의 자녀궁 수 표로는`
          + ` **${lo === hi ? `${lo}명` : `${lo}~${hi}명`}**입니다.`
          + ` ${rows.map((r) => `${r.star} — ${r.note}`).join(' / ')}.`
          + ` 판본마다 한둘씩 다르게 적고, 이 사이트는 별의 밝기(묘왕함)를 계산하지 않아`
          + ` 범위를 그대로 냅니다.`,
        source: '자미두수전서 자녀궁 — 주성별 자녀 수',
        topicKey: '수',
        range: [lo, hi],
      });
    } else {
      out.push({
        system: '자미두수', what: `자녀궁 ${ziweiChildStars.join('·')}`, topic: '수',
        text: `자녀궁에 ${j(ziweiChildStars.join('·'), '이')} 들었는데, 수를 적은 표에 없는 별입니다.`,
        source: '자미두수전서 자녀궁',
      });
    }
  } else {
    out.push({
      system: '자미두수', what: '자녀궁 공궁', topic: '수',
      text: '자녀궁에 주성이 없습니다(공궁). 자미두수에서 공궁은 흠이 아니라 **정해진 색이 옅다**는'
        + ' 뜻이라, 수를 표에서 뽑지 않고 마주 보는 궁을 빌려 읽습니다.',
      source: '자미두수 — 공궁은 대궁을 빌려 본다',
    });
  }

  // ── 사주 — 성별은 유파가 갈린다 ──
  const g = sajuGender(chart);
  out.push({
    system: '사주', what: g.count ? `${g.kinds.join('·')}` : '자녀별 없음',
    topic: '성별·수', text: g.text,
    source: '연해자평 — 女命은 食傷, 男命은 官星으로 자녀를 본다',
    // **수가 아니라 자리가 열렸는지**를 말한다. 십성 개수는 자녀 수가 아니다 —
    // 자미의 수 표와 같은 축에 놓으면 있지도 않은 상충이 만들어진다.
    topicKey: '열림',
    stance: g.count >= 1 ? '많음' : '적음',
  });

  // ── 베딕 — D7(삽탐샤)이 자녀 전용 분할도다 ──
  if (vedic) {
    const bits = [];
    if (vedic.d1_5?.sign) bits.push(`D1 5하우스 ${vedic.d1_5.sign}`);
    if (vedic.d1_5?.lord) bits.push(`5궁주 ${j(vedic.d1_5.lord, '이')} ${vedic.d1_5.lordIn}하우스`);
    if (vedic.d7Lagna != null) bits.push(`D7 라그나 ${vedic.d7Lagna}`);
    if (vedic.d7_5?.occupants?.length) bits.push(`D7 5하우스에 ${vedic.d7_5.occupants.join('·')}`);
    if (vedic.maleficsOn5?.length) bits.push(`5하우스에 흉성 ${vedic.maleficsOn5.join('·')}`);

    // 5하우스가 받쳐지는가 눌리는가 — 수를 세지는 못해도 방향은 낸다.
    // 목성이 보거나 들면 받쳐지고(BPHS 의 자녀 카라카), 흉성이 들면 눌린다.
    const lift = ((vedic.d1_5?.aspects ?? []).includes('목성') ? 1 : 0)
      + ((vedic.d1_5?.occupants ?? []).includes('목성') ? 1 : 0)
      - (vedic.maleficsOn5?.length ?? 0);

    out.push({
      system: '베딕', what: 'D7 삽탐샤', topic: '수·시기',
      text: `베딕에서 자녀를 보는 자리는 D7(삽탐샤)입니다. ${bits.join(' · ')}.`
        + ` 삽탐샤는 **수를 직접 세는 분할도가 아니라** 자녀와의 인연이 어떤 결인지를 보는 자리라,`
        + ` 몇 명인지는 여기서 나오지 않습니다.`
        + (lift > 0 ? ' 다만 5하우스가 목성에 받쳐져 **열리는 쪽**으로 봅니다.'
          : lift < 0 ? ' 다만 5하우스에 흉성이 들어 **눌리는 쪽**으로 봅니다.' : ''),
      source: 'BPHS — 자녀는 5하우스와 D7(삽탐샤)로 본다',
      topicKey: '열림',
      stance: lift > 0 ? '많음' : lift < 0 ? '적음' : null,
    });
  }

  return out;
}

/**
 * 셋을 종합한다 — **겹치면 단정, 갈리면 빼고, 하나뿐이면 보수적으로.**
 *
 * 평균을 내지 않는다. 자미가 2~5 라 하고 사주가 하나라 하면 그 사이 어딘가를
 * 만드는 것이 아니라 **갈렸다고 적고 수를 말하지 않는다.** 2명과 5명의 평균
 * 3.5명은 어느 전통의 말도 아니다.
 */
export function childrenVerdict(reads) {
  const c = consensusOf(reads.filter((x) => x.topicKey === '열림'));
  const r = consensusRange(reads.filter((x) => x.range).map((x) => ({ system: x.system, n: x.range })));

  const lines = [];
  if (c.verdict === '갈림') {
    lines.push(c.say);
  } else if (c.verdict === '겹침') {
    lines.push(`자녀 자리는 **${c.stance === '많음' ? '열리는 쪽' : '눌리는 쪽'}**입니다. ${c.say}`);
  } else if (c.verdict === '하나') {
    // `c.say` 가 이미 "한 곳에서만" 을 말하므로 phrase 의 꼬리를 또 붙이지 않는다
    lines.push(`자녀 자리는 ${c.stance === '많음' ? '열리는 쪽' : '눌리는 쪽'}으로 나옵니다.`
      + ` ${c.agree[0].system} 한 곳에서만 나온 말이라 세게 말하지 않겠습니다.`);
  }

  if (r.verdict === '겹침') {
    lines.push(`수는 **${r.n[0] === r.n[1] ? `${r.n[0]}명` : `${r.n[0]}~${r.n[1]}명`}** — ${r.say}`);
  } else if (r.verdict === '하나') {
    lines.push(`수는 **${r.n[0] === r.n[1] ? `${r.n[0]}명` : `${r.n[0]}~${r.n[1]}명`}**`
      + ` — ${r.from[0]}의 표에서만 나온 값입니다.`);
  } else if (r.verdict === '갈림') {
    lines.push(r.say);
  }

  // 성별은 한 체계 안에서 유파가 갈린다 — 규칙대로 뺀다
  lines.push('성별은 말하지 않습니다. 같은 십성을 딸로 적은 책과 아들로 적은 책이 둘 다 있어,'
    + ' 한쪽을 고르면 근거가 사라집니다.');

  return { consensus: c, range: r, lines: lines.filter(Boolean) };
}

/** 체계끼리 어긋나는가 — 수를 말한 것들만 견준다 */
export function childrenDisagreement(reads) {
  const nums = reads
    .map((r) => r.text.match(/\*\*(\d+)(?:~(\d+))?명\*\*/))
    .filter(Boolean)
    .map((m) => [Number(m[1]), Number(m[2] ?? m[1])]);
  if (nums.length < 2) return null;
  const lo = Math.min(...nums.map((x) => x[0]));
  const hi = Math.max(...nums.map((x) => x[1]));
  return lo === hi ? null
    : `체계마다 ${lo}명에서 ${hi}명까지 다르게 말합니다. 하나로 좁히지 않습니다.`;
}

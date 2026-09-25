/**
 * spouse.js — **배우자를 체계마다 따로 말한다 (직업·나이차·시기)**
 *
 * `children.js` 와 같은 자리다. 표는 이미 `hires/profile.js` 의 `MAIN_STAR` 에
 * 있었고(직업·나이차·안정성까지), 계산도 되고 있었는데 **출력이 막혀** 있었다.
 *
 * 종합은 `compose/consensus.js` 의 규칙을 그대로 쓴다 —
 * **겹치면 단정, 갈리면 빼고, 하나뿐이면 보수적으로.**
 *
 * ── 지키는 선 ──────────────────────────────────────────────
 * 출전이 있는 표만 쓰고, 체계 이름을 반드시 붙이고, 유파가 갈리면 갈린다고
 * 적고, **맞는다고 말하지 않는다.** 이 저장소는 배우자 속성을 검증한 적이 없다.
 * 특히 **혼인 안정**은 재 봤더니 찍는 것보다 나빴다(5명 중 3, 영점 75%) —
 * 그 사실을 함께 적는다.
 */
import { MAIN_HIDDEN, tenGod, TEN_GOD_GROUP, BRANCHES_KR } from '../../core/ganzhi.js';
import { j } from '../../core/josa.js';
import { buildBoard } from '../../hires/ziwei.js';
import { PALACES } from '../../systems/jamidusu.js';
import { consensusOf } from '../compose/consensus.js';

/**
 * 자미 부처궁 주성이 그리는 배우자.
 *
 * `hires/profile.js` 의 `MAIN_STAR` 와 같은 표다. 그쪽은 해석 층이고 이쪽은
 * 구조 층이라 서로 가져다 쓰지 않는다 — **고칠 때는 양쪽 다** 고쳐야 한다.
 * `older` 는 나이차(+ 연상 / − 연하), `stable` 은 관계의 안정성이다.
 */
const SPOUSE_STAR = {
  자미: { trade: '조직에서 자리를 맡는 사람', older: 1, stable: 2 },
  천부: { trade: '모으고 지키는 실무·재무 쪽', older: 1, stable: 2 },
  무곡: { trade: '돈과 기술을 직접 다루는 실무형', older: 0, stable: 1 },
  천상: { trade: '조율하고 보좌하는 자리', older: 0, stable: 2 },
  천량: { trade: '원칙을 세우고 돌보는 일, 연장자 같은 사람', older: 2, stable: 2 },
  태양: { trade: '드러나는 자리 — 공공·교육·영업', older: 1, stable: 1 },
  태음: { trade: '섬세하게 쌓는 일 — 재무·기획·연구', older: -1, stable: 1 },
  천동: { trade: '모나지 않은 서비스·관리', older: -1, stable: 1 },
  천기: { trade: '기획·분석처럼 머리 쓰는 일', older: -1, stable: 0 },
  거문: { trade: '말과 전문성으로 먹고사는 일', older: 0, stable: 0 },
  탐랑: { trade: '재주가 여럿인 사람 — 영업·예술·사교', older: -1, stable: -1 },
  염정: { trade: '원칙과 욕망의 낙차가 큰 사람', older: 0, stable: -1 },
  칠살: { trade: '개척하는 일 — 혼자 판을 여는 쪽', older: 0, stable: -1 },
  파군: { trade: '틀을 갈아엎는 일 — 변동이 큰 쪽', older: -1, stable: -2 },
};

/** 부처궁에 든 주성 */
export function spousePalaceStars(input) {
  try {
    const b = buildBoard(input);
    const idx = PALACES.findIndex(([kr]) => kr === '부처궁');
    if (idx < 0) return [];
    const pos = ((b.myeong - idx) % 12 + 12) % 12;
    return (b.board[pos] ?? []).filter((s) => SPOUSE_STAR[s]);
  } catch { return []; }
}

/** 일지(배우자궁)에 무엇이 앉았나 — 사주 */
function spouseSeat(chart) {
  const d = chart.pillars?.day;
  if (!d) return null;
  const god = tenGod(chart.dayStem, MAIN_HIDDEN[d.branch]);
  const grp = TEN_GOD_GROUP[god];
  const KO = {
    비겁: { text: '나와 같은 힘이 앉았습니다. 친구처럼 나란히 서는 관계가 편하고, 기대거나 기대게 하는 쪽은 잘 안 맞습니다.', older: 0 },
    식상: { text: '관을 눌러 내는 힘이 앉았습니다. 규격에 맞는 상대보다 내가 이끌고 돌보는 쪽으로 기울고, 전통적으로 연하를 봅니다.', older: -1 },
    재성: { text: '재성이 앉았습니다. 현실을 같이 굴리는 관계, 생활이 맞물리는 쪽입니다.', older: 0 },
    관성: { text: '관성이 앉았습니다. 배우자 자리에 배우자를 뜻하는 것이 바로 앉은 모양이라, 관계가 한 줄기로 이어지기 쉽습니다.', older: 1 },
    인성: { text: '인성이 앉았습니다. 기댈 언덕으로 삼거나 나이 차가 나는 쪽, 보살핌을 주고받는 관계입니다.', older: 1 },
  };
  return { god, branch: BRANCHES_KR[d.branch], ...KO[grp] };
}

/**
 * 배우자를 체계마다 읽는다.
 *
 * @param {object} chart  `readFortune(...).chart` + `gender`
 * @param {string[]} stars 부처궁 주성
 * @param {object} [vedic] `marriagePack(input)` 결과
 */
export function readSpouse(chart, stars = [], vedic = null) {
  const out = [];

  // ── 자미 부처궁 — 직업·나이차 표가 실제로 있다 ──
  if (stars.length) {
    const rows = stars.map((s) => ({ star: s, ...SPOUSE_STAR[s] }));
    const older = rows.reduce((a, r) => a + r.older, 0);
    const stable = rows.reduce((a, r) => a + r.stable, 0);
    out.push({
      system: '자미두수', topicKey: '직업', what: `부처궁 ${stars.join('·')}`,
      text: `부처궁에 ${j(stars.join('·'), '이')} 들었습니다. 이 별들이 그리는 상대는`
        + ` **${rows.map((r) => r.trade).join(' / ')}** 쪽입니다.`,
      source: '자미두수 — 부처궁 주성이 배우자의 결을 그린다',
      stance: null,
      trade: rows.map((r) => r.trade),
    });
    out.push({
      system: '자미두수', topicKey: '나이차', what: `부처궁 ${stars.join('·')}`,
      text: older > 0 ? `나이는 **연상 쪽**으로 봅니다(${stars.join('·')}).`
        : older < 0 ? `나이는 **연하 쪽**으로 봅니다(${stars.join('·')}).`
        : `나이차는 한쪽으로 기울지 않습니다(${stars.join('·')}).`,
      source: '자미두수 — 부처궁 주성의 연상·연하 배당',
      stance: older > 0 ? '연상' : older < 0 ? '연하' : null,
    });
    // **재 봤더니 진 축.** 그래도 내되 결과를 함께 적는다
    out.push({
      system: '자미두수', topicKey: '안정', what: `부처궁 ${stars.join('·')}`,
      text: `관계의 안정성은 ${stable >= 2 ? '받쳐지는 쪽' : stable <= -1 ? '흔들리는 쪽' : '중간'}으로 적혀 있습니다.`
        + ` **다만 이 축은 저희가 열한 명에게 대 봤을 때 다섯 중 셋으로, 그냥 찍는 것(75%)보다`
        + ` 나빴습니다.** 전통이 뭐라 하는지만 옮기고 믿지는 마세요.`,
      source: '자미두수 부처궁 — 측정: 5명 중 3 (영점 75%)',
      stance: null,
      measured: '영점보다 나쁨',
    });
  } else {
    out.push({
      system: '자미두수', topicKey: '직업', what: '부처궁 공궁',
      text: '부처궁에 주성이 없습니다(공궁). 마주 보는 궁을 빌려 읽는 자리라 직업을 표에서 뽑지 않습니다.',
      source: '자미두수 — 공궁은 대궁을 빌려 본다',
    });
  }

  // ── 사주 일지 — 배우자궁 ──
  const seat = spouseSeat(chart);
  if (seat) {
    out.push({
      system: '사주', topicKey: '결', what: `일지 ${seat.branch} ${seat.god}`,
      text: `배우자 자리(일지)에 ${j(seat.god, '이')} 앉았습니다. ${seat.text}`,
      source: '연해자평 — 日支는 配偶宮이다',
      stance: null,
    });
    if (seat.older) {
      out.push({
        system: '사주', topicKey: '나이차', what: `일지 ${seat.god}`,
        text: `일지 ${seat.god}은 ${seat.older > 0 ? '연상' : '연하'} 쪽으로 봅니다.`,
        source: '연해자평 — 日支 十星의 연상·연하 배당',
        stance: seat.older > 0 ? '연상' : '연하',
      });
    }
  }

  // ── 베딕 — 7하우스와 D9 ──
  if (vedic) {
    const bits = [];
    if (vedic.d1_7?.sign) bits.push(`7하우스 ${vedic.d1_7.sign}`);
    if (vedic.d1_7?.lord) bits.push(`7궁주 ${j(vedic.d1_7.lord, '이')} ${vedic.d1_7.lordIn}하우스`);
    if (vedic.d9Lagna != null) bits.push(`D9 라그나 ${vedic.d9Lagna}`);
    // 다라카라카는 객체다 — 그대로 끼우면 [object Object] 가 나간다
    const dk = vedic.darakaraka;
    if (dk?.planet) {
      bits.push(`다라카라카 ${dk.planet}`
        + (dk.d1?.house ? ` (D1 ${dk.d1.sign} ${dk.d1.house}하우스)` : '')
        // 도수 차가 작으면 카라카 순서가 뒤집힐 수 있다 — 엔진이 신고하면 적는다
        + (dk.uncertain ? ' ※ 도수가 가까워 순서가 뒤집힐 수 있는 자리' : ''));
    }
    if (bits.length) {
      out.push({
        system: '베딕', topicKey: '결', what: '7하우스 · D9',
        text: `베딕은 배우자를 7하우스와 D9(나밤샤)로 봅니다. ${bits.join(' · ')}.`,
        source: 'BPHS — 배우자는 7하우스와 D9, 다라카라카로 본다',
        stance: null,
      });
    }
  }

  return out;
}

/** 종합 — children 과 같은 규칙 */
export function spouseVerdict(reads) {
  const lines = [];

  const trades = reads.filter((r) => r.trade).flatMap((r) => r.trade);
  if (trades.length) {
    lines.push(`직업은 **${trades.join(' / ')}** 쪽으로 나옵니다.`
      + ` 자미두수 부처궁 한 곳에서만 나온 값입니다.`);
  }

  const age = consensusOf(reads.filter((r) => r.topicKey === '나이차'));
  if (age.verdict === '겹침') {
    lines.push(`나이는 **${age.stance}** 쪽입니다. ${age.say}`);
  } else if (age.verdict === '하나') {
    lines.push(`나이는 ${age.stance} 쪽으로 나옵니다.`
      + ` ${age.agree[0].system} 한 곳에서만 나온 말이라 세게 말하지 않겠습니다.`);
  } else if (age.verdict === '갈림') {
    lines.push(age.say);
  }

  return { age, lines };
}

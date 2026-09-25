/**
 * stars.js — **자미 14주성의 성정. 어느 궁에서 읽느냐가 누구인지를 정한다.**
 *
 * 이 저장소는 별의 `trade`(무슨 일을 하는가)만 쓰고 **성정을 통째로 버리고**
 * 있었다. 그래서 "자녀운 어때"에 수와 시기만 나오고 **아이가 어떤 아이인지**는
 * 한 줄도 나오지 않았다. 없어서가 아니라 안 꺼낸 것이다.
 *
 * 표는 『자미두수전서』 성계 각론에 있는 것을 옮긴 것이고, 여기서 새로 만든
 * 성질은 없다. 다만 **낱말은 이 사이트에서 새로 썼다** — 원문의 번역이 아니다.
 *
 * ── 같은 표, 다른 사람 ─────────────────────────────────────
 * 자미두수는 궁이 대상을 정한다. 같은 자미·천부라도
 *
 *   자녀궁에서 읽으면 → **아이**가 그런 사람
 *   부처궁에서 읽으면 → **배우자**가 그런 사람
 *   명궁에서 읽으면   → **본인**이 그런 사람
 *
 * 이건 이 사이트가 만든 규칙이 아니라 자미두수가 원래 그렇게 읽는 것이다.
 * `hires/profile.js` 의 `MAIN_STAR`(직업)와 짝이 되는 표이고, 그쪽을 고치면
 * 여기도 봐야 한다.
 *
 * ── 유파 고지 ──────────────────────────────────────────────
 * 전서 계열 기본 성계론 하나만 쓴다. 이 사이트는 **별의 밝기(묘왕리함)를
 * 계산하지 않으므로** 밝을 때만 나오는 성질과 어두울 때만 나오는 성질을
 * 가르지 않는다. 그래서 성정은 내되 "좋다/나쁘다"로는 옮기지 않는다.
 */
import { buildBoard } from '../../hires/ziwei.js';
import { PALACES } from '../../systems/jamidusu.js';

/**
 * 14주성의 성정.
 *
 * `nature` 는 한 줄 요약, `traits` 는 구체적인 결, `toward` 는 그 결이
 * 자라면 어느 쪽으로 가는가다. traits 를 별마다 넷씩으로 맞춘 것은
 * 별이 둘·셋 든 궁에서 한 별이 낱말 수로 이기지 않게 하려는 것이다 —
 * `hires/body.js` 에서 낱말 개수가 답을 가른 적이 있다.
 */
export const STAR_NATURE = {
  자미: {
    nature: '자기 기준이 뚜렷하고 아랫자리를 견디기 어려워하는 결',
    traits: ['자존심이 강함', '지시받기보다 맡기를 원함', '체면과 격식을 의식함', '큰 자리에서 안정됨'],
    toward: '조직 안에서 책임을 맡는 쪽',
  },
  천기: {
    nature: '머리가 빨리 돌고 생각이 많아 자주 방향을 고쳐 잡는 결',
    traits: ['궁리가 많음', '변화를 먼저 알아챔', '한자리에 오래 머물기 어려워함', '손재주·기획력'],
    toward: '기획·분석·연구처럼 머리를 쓰는 쪽',
  },
  태양: {
    nature: '드러나는 자리에서 살아나고 남을 챙기느라 자기를 쓰는 결',
    traits: ['베푸는 편', '앞에 나서는 것을 꺼리지 않음', '인정받고 싶어 함', '숨기지 못함'],
    toward: '공공·교육·영업처럼 드러나는 쪽',
  },
  무곡: {
    nature: '말보다 실행이 앞서고 맺고 끊는 것이 분명한 결',
    traits: ['결단이 빠름', '무뚝뚝한 편', '돈과 숫자에 밝음', '한번 정하면 밀어붙임'],
    toward: '돈·기술을 직접 다루는 실무 쪽',
  },
  천동: {
    nature: '모나지 않고 편한 것을 찾아 부딪힘을 피하는 결',
    traits: ['순한 편', '다투기를 싫어함', '누리는 것을 좋아함', '늦게 자리 잡는 편'],
    toward: '서비스·관리처럼 사람을 상대하는 쪽',
  },
  염정: {
    nature: '원칙과 욕망의 낙차가 커서 극단을 오가는 결',
    traits: ['호오가 분명함', '한번 빠지면 깊음', '규율과 일탈이 함께 있음', '속을 잘 안 보임'],
    toward: '규율이 선 조직, 또는 정반대로 자기 판',
  },
  천부: {
    nature: '모으고 지키는 쪽으로 기울어 함부로 흔들리지 않는 결',
    traits: ['안정을 우선함', '살림·관리에 밝음', '모험을 꺼림', '주변에 기대게 만듦'],
    toward: '재무·관리·실무처럼 쌓는 쪽',
  },
  태음: {
    nature: '속으로 쌓고 섬세하게 살피며 겉으로 덜 드러내는 결',
    traits: ['감정이 섬세함', '속내를 잘 안 말함', '꼼꼼하고 뒤끝을 챙김', '밤에 집중이 잘 됨'],
    toward: '재무·기획·연구처럼 섬세하게 쌓는 쪽',
  },
  탐랑: {
    nature: '재주가 여럿이고 사람·재미를 끌어당기는 결',
    traits: ['호기심이 많음', '사람을 잘 사귐', '한 가지만 하기 어려워함', '눈치가 빠름'],
    toward: '영업·예술·사교처럼 사람과 재주를 쓰는 쪽',
  },
  거문: {
    nature: '말과 따짐으로 먹고사는 대신 말 때문에 걸리기도 하는 결',
    traits: ['의심이 많고 확인해야 함', '따지고 파고듦', '말재주가 있음', '오해를 사기 쉬움'],
    toward: '말과 전문성으로 먹고사는 쪽 — 법·교육·상담·기술',
  },
  천상: {
    nature: '조율하고 보좌하며 모난 데를 메우는 결',
    traits: ['남을 돕는 자리가 편함', '체면과 의리를 챙김', '먼저 나서지는 않음', '부탁을 잘 못 거절함'],
    toward: '조율·보좌·중재하는 쪽',
  },
  천량: {
    nature: '원칙을 세우고 돌보며 나이보다 어른스러운 결',
    traits: ['가르치려는 편', '원칙을 굽히지 않음', '또래보다 성숙함', '외로움을 타는 편'],
    toward: '원칙을 세우고 돌보는 쪽 — 교육·의료·감사',
  },
  칠살: {
    nature: '혼자 판을 열고 부딪쳐 가며 길을 내는 결',
    traits: ['독립심이 강함', '승부욕이 있음', '통제받기를 싫어함', '한번 꽂히면 끝까지'],
    toward: '개척하는 쪽 — 혼자 판을 여는 일',
  },
  파군: {
    nature: '기존 틀을 갈아엎고 새로 짜는 쪽으로 움직이는 결',
    traits: ['변화를 스스로 만듦', '틀에 갇히면 답답해함', '기복이 큼', '남과 다른 길을 고름'],
    toward: '틀을 바꾸는 쪽 — 변동이 큰 일',
  },
};

/** 보조 네 별 — 주성은 아니지만 결을 크게 바꾼다 */
export const HELPER_NATURE = {
  문창: { traits: ['글·문장이 빠름', '시험에 강한 편'], toward: '글과 시험' },
  문곡: { traits: ['말·표현이 빠름', '예체능 감각'], toward: '말과 표현' },
  좌보: { traits: ['돕는 사람이 붙음'], toward: '조력' },
  우필: { traits: ['돕는 사람이 붙음'], toward: '조력' },
};

/** 한 궁에 든 별을 판에서 그대로 꺼낸다 (주성·보조 구분 없이) */
export function palaceStars(input, palaceName) {
  try {
    const b = buildBoard(input);
    const idx = PALACES.findIndex(([kr]) => kr === palaceName);
    if (idx < 0) return [];
    const pos = ((b.myeong - idx) % 12 + 12) % 12;
    return b.board[pos] ?? [];
  } catch { return []; }
}

/**
 * 궁에 든 별들을 **그 궁이 가리키는 사람의 성격**으로 읽는다.
 *
 * @param {string[]} stars 그 궁의 별
 * @param {string} who     '아이' · '배우자' · '본인' 처럼 누구인지
 * @returns {{stars:string[], nature:string[], traits:string[], toward:string[], text:string}|null}
 */
export function natureOf(stars, who) {
  const main = (stars ?? []).filter((s) => STAR_NATURE[s]);
  const help = (stars ?? []).filter((s) => HELPER_NATURE[s]);
  if (!main.length && !help.length) return null;

  const nature = main.map((s) => `${s} — ${STAR_NATURE[s].nature}`);
  // 별이 둘 이상이면 결이 섞인다. 겹치는 낱말은 한 번만 적는다
  const traits = [...new Set([
    ...main.flatMap((s) => STAR_NATURE[s].traits),
    ...help.flatMap((s) => HELPER_NATURE[s].traits),
  ])];
  const toward = [...new Set(main.map((s) => STAR_NATURE[s].toward))];

  const L = [];
  L.push(`${who}의 결은 ${main.length ? main.join('·') : help.join('·')}가 그립니다.`);
  if (nature.length) L.push(nature.join(' / ') + '.');
  L.push(`구체적으로는 **${traits.join(' · ')}**.`);
  if (toward.length) L.push(`자라는 방향은 ${toward.join(' / ')}입니다.`);
  if (main.length >= 2) {
    L.push(`별이 ${main.length} 들어 결이 한 갈래가 아닙니다 — 상황에 따라 다른 면이 나옵니다.`);
  }
  return { stars: [...main, ...help], nature, traits, toward, text: L.join(' ') };
}

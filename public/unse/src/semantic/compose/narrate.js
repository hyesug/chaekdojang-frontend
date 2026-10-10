/**
 * narrate.js — **칸에 담긴 것을 한 단락으로**
 *
 * `slots.js` 가 칸을 채우면 여기서 말로 잇는다. 하는 일은 셋뿐이다.
 *
 *   ① 칸마다 **주장 문장만** 고른다 (계산을 되읊은 줄은 버린다)
 *   ② 칸 순서대로 잇는다 — 어디서 → 무엇을 → 어떻게 들어왔나 → 머무나 → 드러나는가
 *   ③ 한 칸 안에서 말이 엇갈리면 **엇갈린다고 적는다**
 *
 * ── 하지 않는 것 ───────────────────────────────────────────
 * 엇갈릴 때 하나를 고르지 않는다. 고르는 학습을 재 봤고 LOO 0.015 로
 * 실패했다(`learn-select.mjs`) — 어느 쪽이 맞는지 가릴 근거가 이 저장소에
 * 없다. 근거 없이 고르면 **더 자신 있게 틀린다.**
 *
 * 점수·확률을 붙이지 않는다. 이 층이 아는 것은 "누가 무엇을 말했나"뿐이다.
 */

/** 명반을 되읊은 줄을 가린다 — `scripts/ledger.mjs` 와 같은 기준 */
const CHART_WORD = new RegExp([
  '비견', '겁재', '식신', '상관', '편재', '정재', '편관', '정관', '편인', '정인',
  '비겁', '식상', '재성', '관성', '인성', '칠살', '십신', '오행', '지장간',
  '일간', '일지', '년지', '월지', '시지', '년간', '월간', '대운', '세운', '원국',
  '명궁', '신궁', '부처궁', '관록궁', '재백궁', '질액궁', '전택궁', '오행국',
  '자미', '천기', '무곡', '천동', '염정', '천부', '태음', '탐랑', '거문', '천상',
  '천량', '파군', '문창', '문곡', '화록', '화권', '화과', '화기', '사화',
  '상승점', '중천', '하우스', '라그나', '찬드라', '다샤', '나크샤트라',
  '본괘', '지괘', '동효', '삼전', '사과', '주산', '객산', '본명성', '본명숙',
  '세피라', '라이프 ?패스', '생일수',
].join('|'));
const CALC_TAIL = new RegExp(`(${[
  '있습니다', '없습니다', '입니다', '것입니다', '셈입니다', '뜻입니다',
  '해당합니다', '충합니다', '형합니다', '강합니다', '약합니다', '우세합니다',
  '들었습니다', '듭니다', '앉았습니다', '떨어졌습니다', '놓였습니다',
  '낳습니다', '지킵니다', '나옵니다', '봅니다',
].join('|')})[.!?]?$`);

const isClaim = (s) => {
  // 괄호를 떼면 "있습니다 ." 처럼 공백이 남아 서술어 검사가 빗나간다
  const bare = s.replace(/\s*[(（][^)）]*[)）]\s*/g, ' ').replace(/\*\*/g, '')
    .replace(/\s+([.!?])/g, '$1').trim();
  const chart = CHART_WORD.test(s) || /[一-鿿]/.test(s);
  return !(chart && CALC_TAIL.test(bare));
};

const claimsOf = (text) => String(text ?? '')
  .split(/(?<=[.。!?])\s+|\n+/)
  .map((s) => s.replace(/\*\*/g, '').trim())
  .filter((s) => s.length >= 6 && isClaim(s));

/**
 * 한 체계가 한 칸에서 하는 말의 **알맹이**.
 *
 * 이 저장소의 읽기는 *이름 → 뜻 → 주의사항* 순서로 적혀 있다.
 *
 *   "말의 별입니다. 따지고 파고드는 힘이 강해 전문 분야에서 빛납니다.
 *    그 입이 시비를 부르기도 하니 말의 온도를 조절해야 합니다."
 *
 * 첫 문장만 쓰면 이름표만 남고("말의 별입니다"), 가장 긴 것을 고르면
 * **주의사항이 뽑힌다**("그 입이 시비를 부르기도 하니…"). 둘 다 알맹이를
 * 놓친다. 그래서 순서대로 앞의 둘을 쓴다.
 */
const gist = (lines) => lines.slice(0, 2).join(' ');

/**
 * 한 칸 안에서 말이 엇갈리는가.
 *
 * 반대말 짝으로만 가린다. **없는 대립을 만들어 내지 않으려고** 짝을
 * 명시적으로 적어 둔다 — 낱말이 다르다고 엇갈리는 것이 아니다.
 */
const OPPOSITES = [
  [/자기 판|자기 사업|조직 밖|스스로 세워|자유로운/, /조직·|조직 안|틀과 책임|맡은 자리|소속/],
  [/지키(며|고|는)|한자리|머무는|오래/, /움직|옮기|이동|전환|바꾸|판을 여는|나가는/],
  [/드러나|이름이 오르|밝게 보이/, /드러나는 성과는 적|안으로 쌓|조용/],
  [/쌓입니다|남는 쪽|모으기/, /새어|흩어|남지 않|머물지 않/],
];

/** 낱말 뜻풀이는 엇갈림의 근거가 못 된다 — "창고는 닫혀 있을 때만 쌓입니다"는 설명이다 */
const DEFINITION = /^[가-힣]{2,6}(은|는) .+(입니다|것입니다)[.!?]?$|때만|때는/;

function tension(voices) {
  // **같은 체계 안의 두 말은 엇갈림이 아니다.** 한 체계가 여러 면을 말한 것뿐이다.
  const all = voices.flatMap((v) => v.lines
    .filter((t) => !DEFINITION.test(t))
    .map((t) => ({ t, who: v.system })));
  for (const [a, b] of OPPOSITES) {
    const x = all.find((s) => a.test(s.t));
    const y = all.find((s) => b.test(s.t) && s.who !== x?.who);
    if (x && y) return { a: x, b: y };
  }
  return null;
}

/** 받침이 있으면 `은`, 없으면 `는` — 체계 이름이 들어가는 자리라 필요하다 */
const eunNeun = (word) => {
  const last = String(word ?? '').replace(/[)\]]+$/, '').slice(-1);
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return `${word}는`;
  return `${word}${(code - 0xac00) % 28 ? '은' : '는'}`;
};

/** 칸마다 말을 어떻게 시작할지 */
const LEAD = {
  setting: '일하는 자리는',
  content: '직무는',
  style: '일하는 결은',
  entry: '이 길에 들어선 모양은',
  tenure: '한 자리에 머무는 방식은',
  visibility: '일이 드러나는 정도는',
  earning: '버는 쪽은',
  keeping: '쌓이는 쪽은',
  partner: '인연이 닿는 상대는',
  shape: '관계의 모양은',
  stance: '관계에서 서는 자리는',
};

/**
 * 채운 칸들을 단락으로.
 *
 * @param {object[]} slots `fillSlots(...)` 의 결과
 * @returns {{sections: object[], text: string}}
 */
export function narrateSlots(slots) {
  const sections = [];

  for (const slot of slots) {
    if (slot.empty) {
      sections.push({
        key: slot.key, label: slot.label, empty: true,
        text: `${slot.label} — 이 자리를 말하는 체계가 없어 비워 둡니다.`,
        voices: [],
      });
      continue;
    }

    const voices = slot.filled
      .map((f) => ({ system: f.system, what: f.what, lines: claimsOf(f.text) }))
      .filter((v) => v.lines.length);

    if (!voices.length) {
      // 채워지긴 했는데 전부 계산을 되읊은 줄이었다 — 할 말이 없는 것과 같다
      sections.push({
        key: slot.key, label: slot.label, empty: true,
        text: `${slot.label} — 명반 값만 있고 그것이 무슨 뜻인지 말하는 줄이 없습니다.`,
        voices: [],
      });
      continue;
    }

    const t = tension(voices);
    // 체계마다 알맹이 하나씩. 다 쓰면 단락이 아니라 목록이 된다.
    const head = voices.map((v) => `${gist(v.lines)} (${v.system})`).join(' ');

    sections.push({
      key: slot.key,
      label: slot.label,
      ask: slot.ask,
      empty: false,
      source: slot.source,
      text: `${LEAD[slot.key] ?? slot.label} — ${head}`,
      tension: t
        ? `다만 이 자리는 말이 엇갈립니다. ${eunNeun(t.a.who)} 한쪽을, ${eunNeun(t.b.who)} 반대쪽을 가리킵니다.`
          + ' 어느 쪽이 맞는지 가릴 근거가 없어 둘 다 적습니다.'
        : null,
      voices,
    });
  }

  const text = sections
    .map((s) => s.text + (s.tension ? ` ${s.tension}` : ''))
    .join('\n\n');

  return { sections, text };
}

/**
 * yukchin.js — **육친(六親)으로 모든 분야를 읽는다**
 *
 * 육임·주역이 자녀와 배우자에만 입을 다물고 있었던 것이 아니다. **아무
 * 분야에도 말하지 않고 있었다.** 삼전과 괘는 계산되는데 그것이 무엇에
 * 대한 말인지 잇는 층이 없었기 때문이다.
 *
 * 그 이음새가 **육친**이다. 육친은 그 자체가 분야 지도다.
 *
 *   부모(父母) — 문서·집·배움·윗사람
 *   형제(兄弟) — 동료·경쟁·나눠 갖는 돈
 *   자손(子孫) — 자녀·아랫사람·즐거움. 관을 눌러 근심을 푼다
 *   처재(妻財) — 재물, 남자에게는 아내
 *   관귀(官鬼) — 직장·명예·관재, 여자에게는 남편
 *
 * ── 셈은 이미 있다 ─────────────────────────────────────────
 * 육친은 **일간과의 오행 생극**으로 정해진다. 십성과 같은 관계라
 * `tenGod()` 가 내는 값을 이름만 바꾸면 된다 — 새 계산을 만들지 않는다.
 *
 * ── 고지 ───────────────────────────────────────────────────
 * 육임의 삼전은 **점을 치는 순간**으로 세운다. 이 사이트는 태어난 시각으로
 * 세우므로 "타고난 판"에 가깝고, 물을 때마다 새로 세우는 전통 용법과 다르다.
 * 그 사실을 답에 적는다.
 */
import { MAIN_HIDDEN, tenGod, TEN_GOD_GROUP, BRANCHES_KR, BRANCHES } from '../../core/ganzhi.js';
import { j } from '../../core/josa.js';

/** 십성 묶음 → 육친. 같은 오행 관계에 붙은 다른 이름이다 */
const GROUP_TO_YUKCHIN = {
  인성: '부모', 비겁: '형제', 식상: '자손', 재성: '처재', 관성: '관귀',
};

/** 육친이 무엇을 보는 자리인가 */
export const YUKCHIN = {
  부모: { domains: ['문서', '주거', '학업'], text: '문서·집·배움과 윗사람의 자리입니다. 계약과 자격이 여기서 움직입니다.' },
  형제: { domains: ['관계', '재물'], text: '동료·경쟁의 자리입니다. 재물을 나눠 갖는 쪽이라 돈이 새는 자리로도 봅니다.' },
  자손: { domains: ['자녀', '건강'], text: '자녀와 아랫사람의 자리입니다. 관귀를 눌러 근심과 관재를 푸는 자리이기도 합니다.' },
  처재: { domains: ['재물', '관계'], text: '재물의 자리입니다. 남자 명식에서는 아내를 함께 봅니다.' },
  관귀: { domains: ['직업', '관계', '건강'], text: '직장·명예의 자리입니다. 여자 명식에서는 남편을, 흉하게 볼 때는 관재와 질병을 함께 봅니다.' },
};

/** 지지 하나를 일간 기준 육친으로 */
export function yukchinOf(dayStem, branch) {
  const god = tenGod(dayStem, MAIN_HIDDEN[branch]);
  return GROUP_TO_YUKCHIN[TEN_GOD_GROUP[god]] ?? null;
}

/** 이름이나 한자로 적힌 지지를 번호로 */
const branchIndex = (s) => {
  const t = String(s ?? '').replace(/[()]/g, '');
  for (let i = 0; i < 12; i++) {
    if (t.includes(BRANCHES[i]) || t.includes(BRANCHES_KR[i])) return i;
  }
  return -1;
};

/**
 * 육임 삼전을 육친으로 읽는다 — **모든 분야에 걸린다.**
 *
 * 초전이 일의 시작, 중전이 거쳐 가는 자리, 말전이 끝나는 자리다. 셋의
 * 육친이 그 판이 무엇에 대한 것인지를 말한다.
 *
 * @param {object} fortune `readFortune(...)`
 * @param {number} dayStem 일간
 * @param {string} [domain] 한 분야만 볼 때
 */
export function readYukim(fortune, dayStem, domain = null) {
  const y = Object.values(fortune?.results ?? {}).find((v) => v.name === '육임');
  if (!y) return [];

  const rows = [];
  for (const [label, key] of [['초전', '초전'], ['중전', '중전'], ['말전', '말전']]) {
    const f = (y.facts ?? []).find((x) => x.label === key);
    if (!f) continue;
    const bi = branchIndex(f.value);
    if (bi < 0) continue;
    const yc = yukchinOf(dayStem, bi);
    if (!yc) continue;
    rows.push({ label, branch: BRANCHES_KR[bi], yukchin: yc, note: f.note ?? '' });
  }
  if (!rows.length) return [];

  const keep = domain ? rows.filter((r) => YUKCHIN[r.yukchin].domains.includes(domain)) : rows;
  if (!keep.length) {
    return [{
      system: '육임', topicKey: domain, what: '삼전',
      text: `삼전이 ${rows.map((r) => `${r.label} ${r.yukchin}`).join(' · ')}입니다.`
        + ` **${j(domain, '을')} 보는 육친(${Object.entries(YUKCHIN).filter(([, v]) => v.domains.includes(domain)).map(([k]) => k).join('·')})이 삼전에 없어**`
        + ` 이 질문에는 말할 것이 없습니다.`,
      source: '대육임 — 삼전의 육친',
      stance: null,
    }];
  }

  return [{
    system: '육임', topicKey: domain, what: `삼전 ${rows.map((r) => `${r.label} ${r.branch}(${r.yukchin})`).join(' → ')}`,
    text: `삼전은 일이 시작해서(초전) 거쳐 가고(중전) 끝나는(말전) 자리입니다.`
      + ` ${keep.map((r) => `**${r.label}에 ${r.yukchin}** — ${YUKCHIN[r.yukchin].text}`).join(' ')}`
      + ` 다만 육임의 삼전은 본래 **묻는 순간**으로 세웁니다. 여기서는 태어난 시각으로 세웠으므로`
      + ` 타고난 판에 가깝고, 물을 때마다 새로 세우는 전통 용법과는 다릅니다.`,
    source: '대육임 — 삼전의 육친 (일간 기준 오행 생극)',
    stance: null,
  }];
}

/** 팔문이 무엇을 보는 자리인가 — 홍국기문 */
const GATE_DOMAIN = {
  개문: { domains: ['직업', '문서'], stance: '많음' },
  휴문: { domains: ['관계', '건강'], stance: null },
  생문: { domains: ['재물', '건강', '자녀'], stance: '많음' },
  상문: { domains: ['관계', '건강'], stance: '적음' },
  두문: { domains: ['문서', '주거'], stance: null },
  경문: { domains: ['직업', '문서'], stance: null },
  사문: { domains: ['건강', '재물'], stance: '적음' },
  경문2: { domains: ['관계'], stance: '적음' },
};

/**
 * 홍국기문 — 내가 선 궁의 문이 어느 자리를 보는가.
 *
 * 팔문은 저마다 맡은 영역이 있다. 그 영역과 물은 분야가 맞을 때만 말한다 —
 * 안 맞는데 끌어다 붙이면 아무 문이나 아무 질문에 답하는 꼴이 된다.
 */
export function readHongguk(fortune, domain = null) {
  const h = Object.values(fortune?.results ?? {}).find((v) => v.name === '홍국기문');
  if (!h) return [];
  const gateR = (h.readings ?? []).find((r) => /문 \(|문\(/.test(r.title));
  if (!gateR) return [];
  const gate = (gateR.title.match(/(개문|휴문|생문|상문|두문|경문|사문)/) ?? [])[1];
  if (!gate) return [];

  const info = GATE_DOMAIN[gate];
  if (domain && info && !info.domains.includes(domain)) {
    return [{
      system: '홍국기문', topicKey: domain, what: gate,
      text: `내 자리에 ${j(gate, '이')} 붙었는데, 이 문이 맡은 자리는`
        + ` ${info.domains.join('·')}입니다. **${j(domain, '을')} 보는 문이 아니라** 이 질문에는 말하지 않습니다.`,
      source: '홍국기문 — 팔문의 소관',
      stance: null,
    }];
  }

  return [{
    system: '홍국기문', topicKey: domain, what: gate,
    text: `내 자리에 ${j(gate, '이')} 붙었습니다. ${gateR.text}`
      + (info ? ` 이 문이 맡은 자리는 ${info.domains.join('·')}입니다.` : ''),
    source: '홍국기문 — 내 궁의 팔문',
    stance: info?.stance ?? null,
  }];
}

/**
 * 주역 — 괘가 무엇에 대한 말인가.
 *
 * 육효에 지지를 붙이는 납갑(納甲)은 이 사이트가 계산하지 않으므로 **효별
 * 육친은 내지 않는다.** 없는 계산을 지어내지 않는다. 대신 본괘와 지괘가
 * 그리는 흐름만 전하고, 그것이 분야를 가리지 않는다는 사실을 밝힌다.
 */
export function readJuyeok(fortune, domain = null) {
  const y = Object.values(fortune?.results ?? {}).find((v) => v.name === '주역');
  if (!y) return [];
  const base = (y.readings ?? []).find((r) => r.title.startsWith('본괘'));
  const to = (y.readings ?? []).find((r) => r.title.startsWith('지괘'));
  if (!base) return [];

  return [{
    system: '주역', topicKey: domain, what: base.title.replace('본괘 — ', ''),
    text: `${base.text}${to ? ` ${to.text}` : ''}`
      + ` 다만 주역은 **효마다 육친을 붙여야 분야를 가릅니다**(납갑). 이 사이트는 납갑을`
      + ` 계산하지 않으므로, 이 괘가 ${domain ?? '그 질문'}에 대한 말인지 다른 일에 대한 말인지`
      + ` 가리지 못합니다. 흐름의 모양으로만 읽어 주세요.`,
    source: '주역 — 본괘·동효·지괘 (납갑 미구현)',
    stance: null,
  }];
}

/** 세 체계를 한 분야에 대해 한꺼번에 */
export function readClassical(fortune, dayStem, domain) {
  return [
    ...readYukim(fortune, dayStem, domain),
    ...readHongguk(fortune, domain),
    ...readJuyeok(fortune, domain),
  ];
}

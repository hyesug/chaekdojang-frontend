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
import { hexagramLines, seLine } from '../../core/nabgap.js';

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
 * 주역 — **납갑으로 효마다 육친을 붙여 분야를 가린다.**
 *
 * 괘사만으로는 "앞이 막혔다"까지는 말해도 그것이 돈 이야기인지 관계
 * 이야기인지 가릴 수 없었다. 이제 `core/nabgap.js` 가 효마다 지지와 육친을
 * 붙이므로, **물은 분야의 육친이 어느 효에 있는지**를 보고 답한다.
 *
 * 동효(動爻)에 그 육친이 있으면 그 자리가 실제로 움직이는 것이고,
 * 세효(世爻)에 있으면 나 자신에게 붙은 일이다.
 */
export function readJuyeok(fortune, domain = null) {
  const y = Object.values(fortune?.results ?? {}).find((v) => v.name === '주역');
  if (!y) return [];
  const base = (y.readings ?? []).find((r) => r.title.startsWith('본괘'));
  if (!base) return [];

  const upper = (y.facts ?? []).find((f) => f.label === '상괘')?.value;
  const lower = (y.facts ?? []).find((f) => f.label === '하괘')?.value;
  const moving = Number(((y.facts ?? []).find((f) => f.label === '동효')?.value ?? '')
    .replace(/[^0-9]/g, '')) || null;
  // facts 의 value 는 한자('坎'), note 에 한글('감 · 물')이 들어 있다.
  // 한쪽만 맞추면 조용히 못 찾고 육친이 통째로 빠진다 — 실제로 그랬다.
  const TRI = ['건', '태', '리', '진', '손', '감', '간', '곤'];
  const TRI_H = ['乾', '兌', '離', '震', '巽', '坎', '艮', '坤'];
  const triOf = (label) => {
    const f = (y.facts ?? []).find((x) => x.label === label);
    const v = `${f?.value ?? ''} ${f?.note ?? ''}`;
    const i = TRI_H.findIndex((t) => v.includes(t));
    return i >= 0 ? i : TRI.findIndex((t) => v.includes(t));
  };
  const ui = triOf('상괘');
  const li = triOf('하괘');

  const hex = (ui >= 0 && li >= 0) ? hexagramLines(ui, li) : null;
  if (!hex) {
    return [{
      system: '주역', topicKey: domain, what: base.title.replace('본괘 — ', ''),
      text: `${base.text} 다만 이 괘의 팔궁 배속을 찾지 못해 효별 육친을 붙이지 못했습니다.`,
      source: '주역 — 본괘',
      stance: null,
    }];
  }

  const se = seLine(hex.rank);
  const want = domain
    ? Object.entries(YUKCHIN).filter(([, v]) => v.domains.includes(domain)).map(([k]) => k)
    : Object.keys(YUKCHIN);
  const hits = hex.lines.filter((l) => want.includes(l.yukchin));

  if (!hits.length) {
    return [{
      system: '주역', topicKey: domain, what: base.title.replace('본괘 — ', ''),
      text: `${base.text} 다만 이 괘 여섯 효에 **${j(domain, '을')} 보는 육친(${want.join('·')})이 없어**`
        + ` 이 질문에는 말할 것이 없습니다. (효별 육친: `
        + `${hex.lines.map((l) => `${l.n}효 ${l.yukchin}`).join(' · ')})`,
      source: '주역 — 납갑으로 붙인 효별 육친',
      stance: null,
    }];
  }

  const onMoving = moving && hits.some((l) => l.n === moving);
  const onSe = hits.some((l) => l.n === se);
  return [{
    system: '주역', topicKey: domain, what: base.title.replace('본괘 — ', ''),
    text: `${base.text} 이 괘에서 ${j(domain, '을')} 보는 자리는`
      + ` ${hits.map((l) => `${l.n}효(${l.yukchin})`).join(' · ')}입니다.`
      + (onMoving ? ` **동효(${moving}효)에 그 육친이 있어 이 자리가 실제로 움직입니다.**`
        : moving ? ` 동효는 ${moving}효라 이 자리는 직접 움직이지 않습니다.` : '')
      + (onSe ? ` 세효(${se}효)에도 있어 남의 일이 아니라 나에게 붙은 일로 봅니다.` : ''),
    source: `주역 — 납갑 효별 육친 (경방 팔궁, ${['건', '태', '리', '진', '손', '감', '간', '곤'][hex.palace]}궁)`,
    stance: null,
  }];
}


/**
 * 그 해를 보는 체계들 — **시기를 묶어 물을 때만 말한다.**
 *
 * 태을·구성·토정은 사람의 타고난 결이 아니라 **그 해가 어떤 해인가**를 보는
 * 자리다. "자녀운 어때"에는 할 말이 없지만 "올해 자녀운 어때"에는 있다.
 * 분야를 가리지는 못하므로 **그 해의 결**로만 붙이고, 분야를 맞혔다고
 * 말하지 않는다.
 */
export function readYearly(fortune, domain = null) {
  const out = [];
  const pick = (name, re) => {
    const v = Object.values(fortune?.results ?? {}).find((x) => x.name === name);
    return { v, r: (v?.readings ?? []).find((x) => !x.mono && re.test(x.title)) };
  };

  for (const [name, re, note] of [
    ['토정비결', /^\d{4}년 —/, '그 해 한 괘로 본다'],
    ['구성학', /9년 주기/, '아홉 해 주기 안에서 올해가 몇 번째인가'],
    ['태을신수', /주산|객산/, '스물네 해 주기에서 지금이 지킬 때인가 움직일 때인가'],
  ]) {
    const { r } = pick(name, re);
    if (!r) continue;
    out.push({
      system: name, topicKey: '시기', what: r.title,
      text: `${r.text} 이건 **그 해가 어떤 해인가**를 보는 자리라`
        + `${domain ? ` ${j(domain, '을')} 따로 가리지는 못합니다.` : ' 분야를 따로 가리지는 못합니다.'}`
        + ` ${note}.`,
      source: `${name} — 그 해의 결`,
      stance: null,
    });
  }
  return out;
}

/** 세 체계를 한 분야에 대해 한꺼번에 */
export function readClassical(fortune, dayStem, domain, { yearly = false } = {}) {
  return [
    ...readYukim(fortune, dayStem, domain),
    ...readHongguk(fortune, domain),
    ...readJuyeok(fortune, domain),
    // 시기를 묶어 물을 때만 그 해를 보는 체계를 붙인다
    ...(yearly ? readYearly(fortune, domain) : []),
  ];
}

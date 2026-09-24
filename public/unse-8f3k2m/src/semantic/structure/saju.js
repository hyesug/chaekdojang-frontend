/**
 * saju.js — **이름 붙은 구조를 읽는다 (점수가 아니라)**
 *
 * 이 저장소는 사람의 결을 스무 개 축의 숫자로 옮겨 왔다. 그런데 그 변환에서
 * 명리가 실제로 말하는 것이 사라진다.
 *
 *   "관살혼잡"  → 관성 0.4      (섞였다는 사실이 사라짐)
 *   "군겁쟁재"  → 재성 0.3      (빼앗긴다는 사실이 사라짐)
 *   "상관견관"  → 식상 0.5      (부딪힌다는 사실이 사라짐)
 *
 * `reading.js` 의 오래된 주석이 이미 그렇게 적어 두었다 — *"실제 삶과
 * 맞춰보니 이 두 가지(자리·조합)가 맞히고 오행 퍼센트는 못 맞혔다."*
 * 그래 놓고 점수판을 또 만들었다. 이 파일은 그 되돌림이다.
 *
 * ── 규칙을 어디서 가져왔는가 ────────────────────────────────
 * **전부 고전에 이름이 있는 것만 넣는다.** 틀린 사례를 보고 그 사례에 맞는
 * 구조를 새로 만들면 고치는 것이 아니라 답을 베끼는 것이다
 * (`hires/events.js` 의 `EVENT_CANDIDATES` 위 주석과 같은 규칙).
 * 그래서 `source` 칸에 어느 책의 무슨 논인지 적는다. 적을 수 없으면 넣지 않는다.
 *
 * ── 이 층이 하는 일과 안 하는 일 ────────────────────────────
 * 한다   — 명식에 어느 구조가 서 있는지 가리고, 그 구조의 전통적 뜻을 옮긴다
 * 안 한다 — 맞는지 틀리는지 말하지 않는다. 확률도 내지 않는다.
 *
 * **이 층은 아직 검증되지 않았다.** 구조가 실제로 그 사람의 일과 맞는지는
 * 사람에게 물어야 알 수 있고, 그것이 이 층을 만든 이유다 — 코사인 0.248 은
 * 사용자가 확인해 줄 수 없지만 "관살혼잡이 맞나요"는 바로 답이 나온다.
 */
import {
  STEMS_KR, BRANCHES_KR, ELEMENTS, STEM_ELEMENT, BRANCH_ELEMENT,
  HIDDEN_STEMS, MAIN_HIDDEN, tenGod, TEN_GOD_GROUP,
  isClash, punishment, SIX_HARMONY,
} from '../../core/ganzhi.js';

/** 네 기둥이 각각 누구의 자리인가 — 명리의 기본 배치 */
export const SEAT = {
  년: { of: '조상·부모', age: '초년', hanja: '年' },
  월: { of: '부모·형제', age: '청년', hanja: '月' },
  일: { of: '나·배우자', age: '중년', hanja: '日' },
  시: { of: '자식·아랫사람', age: '말년', hanja: '時' },
};

const POS = ['년', '월', '일', '시'];

/**
 * 여덟 자리에 십성을 붙인다.
 *
 * 일간은 나 자신이라 십성이 없다. 지지는 본기(지장간의 마지막)로 읽는다 —
 * 지장간을 전부 세면 자리 하나가 셋으로 불어나 구조가 흐려진다.
 */
export function positions(chart) {
  const { pillars, dayStem } = chart;
  const out = [];
  for (const pos of POS) {
    const p = pillars[{ 년: 'year', 월: 'month', 일: 'day', 시: 'hour' }[pos]];
    if (!p) continue;
    out.push({
      pos,
      pillar: `${STEMS_KR[p.stem]}${BRANCHES_KR[p.branch]}`,
      stem: p.stem,
      branch: p.branch,
      stemGod: pos === '일' ? null : tenGod(dayStem, p.stem),
      branchGod: tenGod(dayStem, MAIN_HIDDEN[p.branch]),
      seat: SEAT[pos],
    });
  }
  return out;
}

/**
 * 신강·신약 — 일간이 버틸 힘이 있는가.
 *
 * 군겁쟁재·재다신약·살중신약이 전부 이 판단 위에 선다. 그런데 이 저장소에
 * 아예 없어서 여기서 처음 넣는다.
 *
 * 억부(抑扶)의 표준 셈법을 쓴다 — 나를 돕는 것(비겁·인성)과 나를 쓰는
 * 것(식상·재성·관성)을 자리 무게로 견준다. **월지가 가장 무겁다**(득령).
 * 계절이 일간을 살리느냐가 첫째 기준이라는 것은 유파가 갈리지 않는다.
 *
 * 유파 고지: 문턱은 0.45~0.55 사이로 유파마다 다르다. 여기서는 **0.50** 하나만
 * 쓰고, 0.45~0.55 사이는 `중화`로 따로 부른다 — 애매한 자리를 강·약 둘 중
 * 하나로 밀어 넣으면 그 위에 선 구조가 전부 흔들린다.
 */
export function bodyStrength(chart) {
  const { pillars, dayStem } = chart;
  const W = { 월지: 3, 일지: 2, 년지: 1.5, 시지: 1.5, 년간: 1, 월간: 1, 시간: 1 };
  let help = 0; let drain = 0; const parts = [];

  for (const pos of POS) {
    const p = pillars[{ 년: 'year', 월: 'month', 일: 'day', 시: 'hour' }[pos]];
    if (!p) continue;
    const slots = pos === '일'
      ? [[`${pos}지`, tenGod(dayStem, MAIN_HIDDEN[p.branch])]]
      : [[`${pos}간`, tenGod(dayStem, p.stem)], [`${pos}지`, tenGod(dayStem, MAIN_HIDDEN[p.branch])]];
    for (const [slot, god] of slots) {
      const w = W[slot] ?? 1;
      const g = TEN_GOD_GROUP[god];
      if (g === '비겁' || g === '인성') { help += w; parts.push({ slot, god, side: '돕는다', w }); }
      else { drain += w; parts.push({ slot, god, side: '쓴다', w }); }
    }
  }

  const ratio = help + drain ? help / (help + drain) : 0.5;
  const level = ratio >= 0.55 ? '신강' : ratio <= 0.45 ? '신약' : '중화';
  return { level, ratio: Math.round(ratio * 100) / 100, help, drain, parts };
}

/** 지지 넷 사이의 충·형·합 — 어느 자리가 흔들리는가 */
export function branchTies(chart) {
  const ps = positions(chart);
  const out = [];
  for (let i = 0; i < ps.length; i++) {
    for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i]; const b = ps[j];
      const kinds = [];
      if (isClash(a.branch, b.branch)) kinds.push('충');
      if (punishment(a.branch, b.branch)) kinds.push('형');
      if (SIX_HARMONY[a.branch] === b.branch) kinds.push('합');
      for (const kind of kinds) {
        out.push({
          kind,
          between: [a.pos, b.pos],
          pair: `${BRANCHES_KR[a.branch]}${BRANCHES_KR[b.branch]}`,
          gods: [a.branchGod, b.branchGod],
          seats: [a.seat.of, b.seat.of],
        });
      }
    }
  }
  return out;
}

/** 구조를 가리는 데 쓰는 사실들 — 표가 이것만 보고 판단한다 */
function factsOf(chart) {
  const ps = positions(chart);
  const gods = [];
  for (const p of ps) {
    if (p.stemGod) gods.push({ god: p.stemGod, pos: p.pos, where: '천간' });
    gods.push({ god: p.branchGod, pos: p.pos, where: '지지' });
  }
  const has = (g) => gods.filter((x) => x.god === g);
  const group = (g) => gods.filter((x) => TEN_GOD_GROUP[x.god] === g);
  const ties = branchTies(chart);
  const day = ps.find((p) => p.pos === '일');

  // 오행이 하나도 없는 자리 — 천간·지지 본기로만 센다
  const elems = new Set();
  for (const p of ps) { elems.add(STEM_ELEMENT[p.stem]); elems.add(BRANCH_ELEMENT[p.branch]); }
  const missing = ELEMENTS.map((n, i) => (elems.has(i) ? null : n)).filter(Boolean);

  return {
    ps, gods, has, group, ties, day, missing,
    strength: bodyStrength(chart),
    dayElement: ELEMENTS[STEM_ELEMENT[chart.dayStem]],
    /** 재성이 앉은 지지끼리 충하는가 — 재고가 열리는 자리 */
    wealthClash: ties.filter((t) => t.kind === '충'
      && t.gods.every((g) => TEN_GOD_GROUP[g] === '재성')),
    /** 辰戌丑未 = 창고. 재성이면서 창고면 재고 */
    storage: ps.filter((p) => [1, 4, 7, 10].includes(p.branch)
      && TEN_GOD_GROUP[p.branchGod] === '재성'),
  };
}

/**
 * 구조표.
 *
 * **여기 있는 것은 전부 고전에 이름이 있는 격·조합이다.** `source` 를 적을 수
 * 없으면 넣지 않는다. 새 구조를 더할 때도 같다 — 사례를 보고 만들지 말 것.
 *
 * `says` 는 전통적 뜻을 초보자 말로 옮긴 것이고, **맞는다는 주장이 아니다.**
 */
const STRUCTURES = [
  // ── 관(官) — 제도·조직·시험, 여자에게는 남자 ──
  {
    id: 'gwansal_honjap', name: '관살혼잡', hanja: '官殺混雜', domain: 'career',
    source: '자평진전 「논관살」 — 正官偏官이 함께 드러나면 혼잡이라 한다',
    test: (f) => f.has('정관').length && f.has('편관').length,
    says: (f) => `정관과 편관이 함께 있습니다(${[...f.has('정관'), ...f.has('편관')]
      .map((x) => `${x.pos}${x.where === '천간' ? '간' : '지'} ${x.god}`).join(' · ')}). `
      + '관이 하나로 정해지지 않는 자리라, 몸담을 곳이 한 줄기로 이어지지 않고 '
      + '갈래가 여럿 생깁니다. 조직과의 인연이 깔끔하게 정리되지 않는 쪽입니다.',
  },
  {
    id: 'gwan_in_sangsaeng', name: '관인상생', hanja: '官印相生', domain: 'career',
    source: '자평진전 — 官이 印을 生하고 印이 日干을 生하면 상생이라 한다',
    test: (f) => f.group('관성').length && f.group('인성').length,
    says: () => '관(제도)이 인(자격·학위)을 거쳐 나에게 옵니다. '
      + '시험·자격증·졸업장처럼 **제도가 인정하는 종이**를 통해 자리를 얻는 길이 열려 있습니다.',
  },
  {
    id: 'gwan_without_in', name: '관유인무', hanja: '官有印無', domain: 'career',
    source: '자평진전 「논관」 — 官星이 있으나 印이 없으면 官을 받을 그릇이 없다',
    test: (f) => f.group('관성').length >= 2 && f.group('인성').length === 0,
    says: (f) => `관성이 ${f.group('관성').length}개인데 **인성이 하나도 없습니다.** `
      + '관은 제도와 조직을 향하는 힘이고, 인은 그것을 받아 줄 자격·학위·졸업장입니다. '
      + '가려는 힘은 센데 받쳐 줄 종이가 없는 자리라, 제도권 안으로 들어가려다 '
      + '문턱에서 되돌아 나오기 쉽습니다.',
  },
  {
    id: 'sal_jung_sin_yak', name: '살중신약', hanja: '殺重身弱', domain: 'health',
    source: '적천수 — 殺이 무겁고 身이 약하면 制化를 구한다',
    test: (f) => f.has('편관').length >= 2 && f.strength.level === '신약',
    says: (f) => `편관(칠살)이 ${f.has('편관').length}개인데 일간이 약합니다`
      + `(돕는 힘 ${f.strength.help} 대 쓰는 힘 ${f.strength.drain}). `
      + '살은 나를 밀어붙이는 압력입니다. 버틸 힘보다 압력이 커서 '
      + '긴장과 소진이 몸으로 먼저 옵니다. 쉬는 법을 따로 배워야 하는 쪽입니다.',
  },
  {
    id: 'sanggwan_gyeon_gwan', name: '상관견관', hanja: '傷官見官', domain: 'career',
    source: '자평진전 — 傷官見官 爲禍百端 (상관이 정관을 보면 탈이 난다)',
    test: (f) => f.has('상관').length && f.has('정관').length,
    says: (f) => `상관(${f.has('상관').map((x) => x.pos).join('·')})과 `
      + `정관(${f.has('정관').map((x) => x.pos).join('·')})이 함께 있습니다. `
      + '상관은 제 재주로 밀고 나가는 힘이고 정관은 규율입니다. 둘이 부딪히는 자리라 '
      + '**규칙이 정해 주는 길에서 벗어나 자기 기술로 가는** 쪽으로 기웁니다. '
      + '조직 안에서도 규정보다 실력으로 말하려 합니다.',
  },
  {
    id: 'siksin_jesal', name: '식신제살', hanja: '食神制殺', domain: 'career',
    source: '자평진전 「논식신」 — 食神이 七殺을 制하면 貴格이라 한다',
    test: (f) => f.has('식신').length && f.has('편관').length,
    says: () => '식신이 칠살을 다스립니다. 밀려오는 압력을 '
      + '**만들어 내는 것으로 받아내는** 자리입니다. 압박이 심한 판에서 '
      + '결과물로 답하는 방식이 몸에 맞습니다.',
  },
  {
    id: 'no_gwan', name: '무관', hanja: '無官', domain: 'career',
    source: '연해자평 — 官星이 없으면 制가 없다',
    test: (f) => f.group('관성').length === 0,
    says: () => '관성이 없습니다. 위에서 내려오는 기준이 없어 자유로운 대신, '
      + '기준을 스스로 세워야 해서 늘 흔들립니다. 조직보다 자기 판이 편한 쪽입니다.',
  },

  // ── 인(印) — 자격·배움·기댈 곳 ──
  {
    id: 'no_in', name: '무인', hanja: '無印', domain: 'career',
    source: '연해자평 — 印星이 없으면 生助가 없다',
    test: (f) => f.group('인성').length === 0,
    says: () => '인성이 없습니다. 인은 배움·자격·기댈 언덕입니다. '
      + '학위나 자격으로 증명하는 길보다 **해낸 것으로 증명하는 길**이 열려 있고, '
      + '뒤를 받쳐 주는 사람 없이 혼자 버티는 것이 습관이 되기 쉽습니다.',
  },

  // ── 재(財) — 돈, 남자에게는 여자 ──
  {
    id: 'gunggeop_jaengjae', name: '군겁쟁재', hanja: '群劫爭財', domain: 'wealth',
    source: '적천수 — 比劫이 무리 지어 財를 다투면 재물이 흩어진다',
    test: (f) => f.group('비겁').length >= 2 && f.group('재성').length
      && f.group('비겁').length >= f.group('재성').length,
    says: (f) => `비겁이 ${f.group('비겁').length}개로 재성 ${f.group('재성').length}개를 나눠 갖습니다. `
      + '비겁은 나와 같은 힘, 곧 나눠 갈 사람입니다. '
      + '**버는 것과 남는 것이 다른 자리**라, 수입이 있어도 손에 남지 않습니다.',
  },
  {
    id: 'geopjae_talja', name: '겁재탈재', hanja: '劫財奪財', domain: 'wealth',
    source: '적천수 — 劫財는 財를 빼앗는 신이다',
    test: (f) => f.has('겁재').length && f.group('재성').length,
    says: (f) => `겁재가 ${f.has('겁재').map((x) => `${x.pos}${x.where === '천간' ? '간' : '지'}`).join('·')}에 있습니다. `
      + '겁재는 나보다 센 형제 같은 것이라, 재물이 들어와도 새어 나갈 구멍이 함께 섭니다. '
      + '큰 지출·빌려주는 돈·같이 하는 일에서 특히 그렇습니다.',
  },
  {
    id: 'jae_clash', name: '재성충', hanja: '財星沖', domain: 'wealth',
    source: '자평진전 — 財星이 沖을 만나면 흩어진다',
    test: (f) => f.wealthClash.length > 0,
    says: (f) => `재성끼리 충합니다(${f.wealthClash.map((t) => `${t.between.join('')}지 ${t.pair}충`).join(' · ')}). `
      + '재물 자리가 서로 부딪혀 한자리에 머물지 않습니다. '
      + '모아 두려 해도 흔들려 나가는 모양입니다.',
  },
  {
    id: 'jaego_gaego', name: '재고개고', hanja: '財庫開庫', domain: 'wealth',
    source: '적천수 — 辰戌丑未는 庫이니 沖하면 열린다',
    test: (f) => f.storage.length >= 2 && f.wealthClash.length > 0,
    says: () => '재물 창고(辰戌丑未)가 둘인데 그 둘이 서로 충합니다. '
      + '창고는 열려 있을 때는 드나들고 닫혀 있을 때만 쌓입니다. '
      + '**열린 창고**라 목돈이 지나가기는 해도 머물지 않습니다.',
  },
  {
    id: 'only_pyeonjae', name: '편재독존', hanja: '偏財獨存', domain: 'wealth',
    source: '자평진전 「논재」 — 正財는 常이요 偏財는 浮財라',
    test: (f) => f.has('편재').length && f.has('정재').length === 0,
    says: () => '편재만 있고 정재가 없습니다. 정재는 달마다 같은 날 들어오는 고정 수입과 '
      + '쌓여서 남는 것(저축·집)이고, 편재는 드나드는 돈입니다. '
      + '**버는 힘은 있는데 고정으로 남기는 자리가 비어** 있습니다.',
  },
  {
    id: 'jae_da_sin_yak', name: '재다신약', hanja: '財多身弱', domain: 'wealth',
    source: '적천수 — 財가 많고 身이 약하면 富屋貧人이라',
    test: (f) => f.group('재성').length >= 3 && f.strength.level === '신약',
    says: () => '재물은 많은데 그것을 감당할 힘이 약합니다. 고전이 '
      + '"부잣집의 가난한 사람"이라 부르는 자리로, 돈이 오가는 자리에 있으면서도 '
      + '내 것이 되지 않는 쪽입니다.',
  },
  // ── 재(財) — 쌓이는 쪽 ──
  // **한쪽 방향만 있으면 그 칸은 한 가지 답밖에 못 낸다.** 위의 군겁쟁재·
  // 재성충·겁재탈재는 전부 "샌다"는 말이라, 새지 않는 사람에게는 아무 말도
  // 못 하고 칸이 빈다(열한 명 중 다섯). 고전에 있는 반대쪽을 함께 둔다.
  // `hires/events.js` 가 '안 된 쪽' 후보 없이 판정했다가 틀린 것과 같은 함정이다.
  {
    id: 'jeongjae_present', name: '정재유기', hanja: '正財有氣', domain: 'wealth',
    source: '자평진전 「논재」 — 正財는 常이라 꾸준히 들어오고 쌓이는 재물이다',
    test: (f) => f.has('정재').length && !f.wealthClash.length,
    says: (f) => `정재가 ${f.has('정재').map((x) => `${x.pos}${x.where === '천간' ? '간' : '지'}`).join('·')}에 있고 충을 맞지 않습니다. `
      + '정재는 달마다 같은 날 들어오는 고정 수입이자 쌓여서 남는 것입니다. '
      + '크게 벌어들이는 자리는 아니어도 **손에 남는 자리**입니다.',
  },
  {
    id: 'jaego_closed', name: '재고폐장', hanja: '財庫閉藏', domain: 'wealth',
    source: '적천수 — 庫는 沖하지 않으면 닫혀 있다',
    test: (f) => f.storage.length > 0 && f.wealthClash.length === 0,
    says: (f) => `재물 창고(辰戌丑未)가 ${f.storage.length}개인데 충을 맞지 않아 닫혀 있습니다. `
      + '닫힌 창고는 드나들지 않는 대신 쌓입니다. 큰돈이 오가는 모양은 아니지만 '
      + '모으기 시작하면 남는 쪽입니다.',
  },
  {
    id: 'sinwang_jaewang', name: '신왕재왕', hanja: '身旺財旺', domain: 'wealth',
    source: '적천수 — 身旺하고 財旺하면 富格이라',
    test: (f) => f.strength.level === '신강' && f.group('재성').length >= 2,
    says: () => '일간이 튼튼하고 재성도 있습니다. 벌이는 일의 크기를 감당할 힘이 '
      + '함께 있는 자리라, 규모를 키워도 몸이 먼저 무너지지 않는 쪽입니다.',
  },

  {
    id: 'siksang_saengjae', name: '식상생재', hanja: '食傷生財', domain: 'wealth',
    source: '자평진전 — 食傷이 財를 生하면 재물의 길이 열린다',
    test: (f) => f.group('식상').length && f.group('재성').length,
    says: () => '식상이 재성을 낳습니다. **만들어 낸 것이 돈이 되는** 길이 있습니다. '
      + '남의 판에서 받는 것보다 내가 만든 것으로 버는 쪽이 맞습니다.',
  },

  // ── 배우자궁 — 일지 ──
  {
    id: 'spouse_seat', name: '배우자궁', hanja: '日支', domain: 'relationship',
    source: '연해자평 — 日支는 配偶宮이다',
    test: (f) => !!f.day,
    says: (f) => {
      const g = f.day.branchGod;
      const grp = TEN_GOD_GROUP[g];
      const KO = {
        비겁: '나와 같은 힘이 앉았습니다. 친구처럼 나란히 서는 관계가 편하고, '
          + '기대거나 기대게 하는 쪽은 잘 안 맞습니다.',
        식상: '관을 눌러 내는 힘이 앉았습니다. 규격에 맞는 상대보다 **내가 이끌고 '
          + '돌보는 쪽**으로 기울고, 전통적으로 연하 쪽을 봅니다.',
        재성: '재성이 앉았습니다. 현실을 같이 굴리는 관계, 생활이 맞물리는 쪽입니다.',
        관성: '관성이 앉았습니다. 배우자 자리에 배우자를 뜻하는 것이 바로 앉은 '
          + '모양이라, 관계가 한 줄기로 이어지기 쉬운 자리입니다.',
        인성: '인성이 앉았습니다. 배우자를 기댈 언덕으로 삼거나, 나이 차가 나거나 '
          + '보살핌을 주고받는 관계 쪽입니다.',
      };
      return `일지 ${BRANCHES_KR[f.day.branch]}에 **${g}**이 앉았습니다. ${KO[grp]}`;
    },
  },
  {
    id: 'spouse_seat_shaken', name: '배우자궁 흔들림', hanja: '日支沖刑', domain: 'relationship',
    source: '연해자평 — 日支가 沖刑을 만나면 配偶가 편치 않다',
    test: (f) => f.ties.some((t) => t.between.includes('일') && t.kind !== '합'),
    says: (f) => {
      const t = f.ties.filter((x) => x.between.includes('일') && x.kind !== '합');
      return `배우자 자리가 ${t.map((x) => `${x.between.join('')}지 ${x.pair}${x.kind}`).join(' · ')}으로 흔들립니다. `
        + '붙었다 부딪혔다 하는 자리라, 관계가 길어져도 한결같기보다 굴곡이 있습니다.'
        + (t.some((x) => x.kind === '형') ? ' 특히 형(刑)은 끊어지기보다 **엉키는** 쪽입니다.' : '');
    },
  },
  {
    // 여자 명식만 있으면 남자에게는 이 칸이 통째로 빈다(열한 명 중 넷).
    // 전통은 남명을 財星으로 본다 — 같은 규칙의 짝이다.
    id: 'jae_scattered', name: '재성분산', hanja: '財星分散', domain: 'relationship',
    source: '연해자평 — 男命은 財星으로 妻를 본다',
    // 하나(전일) / 둘 이상(분산) / 없음(무재) 로 빈틈없이 나눈다.
    // 처음에 1개와 3개 이상만 다뤄서 2개인 사람에게 칸이 통째로 비었다.
    test: (f, chart) => chart.gender === 'male' && f.group('재성').length >= 2,
    says: (f) => {
      const gs = f.group('재성');
      const open = gs.filter((x) => x.where === '천간');
      const hid = gs.filter((x) => x.where === '지지');
      return `남자 명식에서 재성은 여자 자리인데 ${gs.length}개로 흩어져 있습니다`
        + `(드러난 것 ${open.length} · 숨은 것 ${hid.length}). `
        + '드러난 것은 겉으로 보이는 관계, 숨은 것은 나중에 오거나 잘 드러나지 않는 관계로 봅니다.';
    },
  },
  {
    id: 'jae_single', name: '재성전일', hanja: '財星專一', domain: 'relationship',
    source: '자평진전 「논재」 — 財가 하나로 맑으면 淸이라 한다',
    test: (f, chart) => chart.gender === 'male' && f.group('재성').length === 1,
    says: () => '남자 명식에서 재성이 하나뿐입니다. 관계가 여럿으로 갈라지기보다 '
      + '한 줄기로 이어지는 쪽이고, 그만큼 그 하나에 무게가 실립니다.',
  },
  {
    id: 'no_spouse_star', name: '짝별 없음', hanja: '無配偶星', domain: 'relationship',
    source: '연해자평 — 女命은 官星, 男命은 財星으로 짝을 본다. 그 별이 없으면 자리가 비었다',
    test: (f, chart) => (chart.gender === 'female'
      ? f.group('관성').length === 0 : f.group('재성').length === 0),
    says: (f, chart) => `${chart.gender === 'female' ? '여자 명식의 관성' : '남자 명식의 재성'}이 `
      + '하나도 없습니다. 짝을 가리키는 별이 원국에 없는 자리입니다. '
      + '인연이 없다는 뜻이 아니라 **명식이 그 자리를 말해 주지 않는다**는 뜻이라, '
      + '관계의 모양은 대운으로 들어오는 때에 따라 달라집니다.',
  },
  {
    id: 'no_wealth', name: '무재', hanja: '無財', domain: 'wealth',
    source: '연해자평 — 財星이 없으면 財의 자리가 비었다',
    test: (f) => f.group('재성').length === 0,
    says: () => '재성이 없습니다. 돈을 가리키는 별이 원국에 없어, '
      + '버는 힘·쌓이는 힘을 명식만으로는 말할 수 없는 자리입니다. '
      + '가난하다는 뜻이 아니라 **이 자리는 대운이 들어와야 켜진다**는 뜻입니다.',
  },
  {
    id: 'gwan_single', name: '관성전일', hanja: '官星專一', domain: 'relationship',
    source: '자평진전 「논관」 — 官이 하나면 貴하다',
    test: (f, chart) => chart.gender === 'female' && f.group('관성').length === 1,
    says: () => '여자 명식에서 관성이 하나뿐입니다. 관계가 여럿으로 갈라지기보다 '
      + '한 줄기로 이어지는 쪽이고, 그만큼 그 하나에 무게가 실립니다.',
  },
  {
    id: 'gwan_scattered', name: '관성분산', hanja: '官星分散', domain: 'relationship',
    source: '연해자평 — 女命은 官星으로 夫를 본다',
    test: (f, chart) => chart.gender === 'female' && f.group('관성').length >= 2,
    says: (f) => {
      const gs = f.group('관성');
      const open = gs.filter((x) => x.where === '천간');
      const hid = gs.filter((x) => x.where === '지지');
      return `여자 명식에서 관성은 남자 자리인데 ${gs.length}개로 흩어져 있습니다. `
        + (open.length ? `${open.map((x) => x.pos).join('·')}간에 드러난 것이 ${open.length}개` : '')
        + (open.length && hid.length ? ', ' : '')
        + (hid.length ? `${hid.map((x) => x.pos).join('·')}지에 숨은 것이 ${hid.length}개` : '')
        + '입니다. 드러난 것은 오래 보이는 관계, 숨은 것은 나중에 오거나 '
        + '겉으로 잘 드러나지 않는 관계로 봅니다.';
    },
  },

  // ── 몸·집안 ──
  {
    id: 'element_missing', name: '오행결', hanja: '五行缺', domain: 'health',
    source: '황제내경 오행-장부 배당 (목=간담 화=심소장 토=비위 금=폐대장 수=신방광)',
    test: (f) => f.missing.length > 0,
    says: (f) => {
      const ORGAN = { 목: '간·담', 화: '심장·소장', 토: '비위(소화)', 금: '폐·대장', 수: '신장·방광' };
      return `${f.missing.join('·')}가 명식에 없습니다(${f.missing.map((e) => ORGAN[e]).join(' / ')}). `
        + '없는 오행은 그 계통이 약하다기보다 **스스로 채워야 하는 자리**로 봅니다. '
        + '진단이 아니라 어디를 살펴 두면 좋은지의 이야기입니다.';
    },
  },
  {
    id: 'early_seat_clash', name: '년월충', hanja: '年月沖', domain: 'family',
    source: '연해자평 — 年月은 祖上·父母의 자리다',
    test: (f) => f.ties.some((t) => t.kind === '충'
      && t.between.includes('년') && t.between.includes('월')),
    says: () => '년지와 월지가 충합니다. 년·월은 조상과 부모, 그리고 초년의 자리입니다. '
      + '자라난 자리가 한곳에 고이지 않고 옮겨지거나 갈라지는 모양으로 봅니다.',
  },
];

/**
 * 명식에 서 있는 구조를 전부 가린다.
 *
 * @param {object} chart `natalFortune(...).fortune.chart`
 * @param {object} [opts]
 * @param {string} [opts.domain] 한 갈래만 볼 때
 */
export function readStructures(chart, { domain = null } = {}) {
  const f = factsOf(chart);
  const found = [];
  for (const s of STRUCTURES) {
    if (domain && s.domain !== domain) continue;
    let hit = false;
    try { hit = !!s.test(f, chart); } catch { hit = false; }
    if (!hit) continue;
    found.push({
      id: s.id, name: s.name, hanja: s.hanja, domain: s.domain,
      source: s.source, text: s.says(f, chart),
    });
  }
  return { structures: found, facts: f };
}

/**
 * 대운이 바뀌며 구조가 어떻게 달라지는가 — **흐름**.
 *
 * 구조는 원국에 붙박여 있지만, 대운이 없던 글자를 데려오면 잠시 다른 구조가
 * 선다. 인성이 없는 사람에게 인성 대운이 오면 그 십 년은 관인상생이 서고,
 * 지나가면 다시 사라진다. 사람의 삶에서 "그때는 그랬는데" 하는 자리가 이것이다.
 *
 * **어느 대운이 무엇을 바꾸는지는 십성 관계로만 정한다** — 좋다·나쁘다를
 * 매기지 않는다. 그 판단은 유파마다 다르고, 여기서 고를 근거가 없다.
 */
export function daeunFlow(chart, daeun) {
  const f = factsOf(chart);
  const lacking = ['비겁', '식상', '재성', '관성', '인성']
    .filter((g) => f.group(g).length === 0);

  return (daeun?.list ?? []).map((d) => {
    const grp = TEN_GOD_GROUP[d.god];
    const notes = [];
    if (lacking.includes(grp)) {
      notes.push(`원국에 없던 ${grp}이 들어옵니다 — 이 십 년만 그 자리가 섭니다`);
    }
    if (grp === '비겁' && f.group('재성').length) {
      notes.push('비겁 운이라 재물을 나눠 갈 사람이 늘어납니다');
    }
    if (grp === '인성' && f.group('관성').length && !f.group('인성').length) {
      notes.push('없던 인이 들어와 관인상생이 잠시 성립합니다 — 자격·배움으로 자리를 얻는 길');
    }
    if (grp === '재성' && f.strength.level === '신약') {
      notes.push('약한 몸에 재가 더해집니다 — 벌이는 일이 몸보다 커지기 쉬운 때');
    }
    return {
      age: `${d.fromAge}~${d.toAge}세`,
      pillar: d.kr ?? `${d.hanja ?? ''}`,
      god: d.god, group: grp, notes,
    };
  });
}

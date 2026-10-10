/**
 * western.js — **점성술을 고전과 현대 둘 다 쓴다**
 *
 * 이 사이트는 점성술을 두 벌 계산한다.
 *
 *   현대 — `systems/astrology.js`  사인·하우스·각·스텔리움, 천왕성 밖까지
 *   고전 — `hires/classical.js`    섹트·에센셜 디그니티·아라빅 로트, 전통 7행성만
 *
 * 그런데 고전은 재물과 ZR 에서만 쓰이고 **자녀·배우자 자리에는 닿지 않았다.**
 * 둘은 같은 하늘을 다르게 읽으므로, 한쪽만 쓰면 그 전통이 통째로 빠진다.
 *
 * ── 둘의 차이를 뭉개지 않는다 ──────────────────────────────
 * 고전은 **룰러와 디그니티**로 읽는다 — 그 자리의 주인이 어디에서 어떤
 * 상태로 있는가. 현대는 **행성이 어느 하우스에 들었나**로 읽는다.
 * 답이 갈릴 수 있고, 갈리면 갈린다고 적는다. 섞어서 가운데를 만들지 않는다.
 */
import { classicalChart, readHouse } from '../../hires/classical.js';
import { j } from '../../core/josa.js';

/** 디그니티 점수를 말로 — 고전은 '어느 상태인가'가 읽기의 절반이다 */
function dignityWord(d) {
  if (!d) return null;
  if (d.domicile) return '자기 자리(도미사일)';
  if (d.exaltation) return '고양';
  if (d.detriment) return '반대 자리(디트리먼트)';
  if (d.fall) return '함몰';
  if (d.triplicity) return `트리플리시티(${d.triplicity})`;
  if (d.term) return '텀';
  if (d.face) return '페이스';
  return '특별한 자리 없음(페레그린)';
}

/**
 * 한 하우스를 고전으로 읽는다.
 *
 * @param {object} input `readFortune(...).input`
 * @param {number} n     하우스 번호 (5=자녀, 7=배우자, 10=직업)
 * @param {string} label 무엇을 보는 자리인지
 */
export function classicalHouse(input, n, label) {
  let cc = null;
  try { cc = classicalChart(input); } catch { return null; }
  if (!cc) return null;

  let h = null;
  try { h = readHouse(n, cc.pos, { cusps: cc.cusps, asc: cc.asc, mc: cc.mc }, cc.sect); }
  catch { return null; }
  if (!h) return null;

  const dig = dignityWord(h.rulerDignity);
  const strong = (h.rulerDignity?.score ?? 0) >= 5;

  return {
    system: '고전 서양', topicKey: label, what: `${n}하우스 (${h.cuspSign})`,
    text: `고전은 ${n}하우스를 **그 자리의 주인이 어디에서 어떤 상태로 있는가**로 읽습니다.`
      + ` ${n}하우스는 ${h.cuspSign}이고 주인은 ${h.ruler}입니다.`
      + ` 그 ${j(h.ruler, '은')} ${h.rulerSign} ${h.rulerHouse}하우스에 있고, 상태는 ${dig}입니다.`
      + (strong ? ` 주인이 힘을 받는 자리라 **이 영역은 받쳐집니다.**`
        : h.rulerDignity?.fall || h.rulerDignity?.detriment
          ? ` 주인이 약한 자리라 **이 영역은 애를 먹는 쪽입니다.**`
          : ` 주인이 특별히 강하지도 약하지도 않습니다.`)
      + ` (차트는 ${cc.sect.label}, 이 차트를 받쳐 주는 길성은 ${cc.sect.benefic},`
      + ` 조심할 흉성은 ${cc.sect.malefic}입니다.)`,
    source: `고전 서양 — ${n}하우스 룰러와 에센셜 디그니티 · 섹트`,
    stance: strong ? '많음' : (h.rulerDignity?.fall || h.rulerDignity?.detriment) ? '적음' : null,
    ruler: h.ruler,
    dignity: dig,
  };
}

/**
 * 같은 하우스를 현대로 읽는다 — **행성이 들었는가**를 본다.
 *
 * 고전이 '주인이 어디 있나'를 보는 것과 다른 물음이다. 그래서 둘을 나란히
 * 두면 서로 다른 면이 나오고, 상충하면 상충한다고 적을 수 있다.
 */
export function modernHouse(fortune, n, label) {
  const astro = Object.values(fortune?.results ?? {}).find((v) => v.name === '점성술');
  if (!astro) return null;

  // facts 에 "태양 물병자리 9.7° / note: 7하우스" 로 들어 있다
  const inHouse = (astro.facts ?? [])
    .filter((f) => new RegExp(`(^|\\D)${n}하우스`).test(f.note ?? ''))
    .map((f) => `${f.label} ${f.value}`);

  if (!inHouse.length) {
    return {
      system: '점성술(현대)', topicKey: label, what: `${n}하우스`,
      // **빈 하우스를 약한 하우스로 읽지 않는다.** 열두 하우스에 행성 열 개를
      // 나누면 어느 차트에서든 절반은 빈다 — 비었다는 것은 그 영역이 약하다는
      // 뜻이 아니라 **거주 행성으로 읽을 수 없다**는 뜻이고, 그러면 전통대로
      // 그 하우스의 주인(룰러)에게 읽기를 넘긴다. 위 '고전 서양' 줄이 그 답이다.
      text: `현대 점성술은 ${n}하우스에 **어느 행성이 들었는가**를 봅니다.`
        + ` 이 차트는 ${n}하우스가 비어 있습니다. **빈 하우스는 약한 하우스가 아닙니다** —`
        + ` 행성 열 개를 열두 자리에 나누면 어느 차트에서든 절반은 비고, 비었다는 것은`
        + ` 거주 행성으로는 읽을 수 없다는 뜻일 뿐입니다.`
        + ` 이럴 때는 **그 하우스의 주인이 어디서 무엇을 하는지**로 읽습니다`
        + ` (바로 위 '고전 서양' 줄이 그 읽기입니다).`,
      source: `현대 점성술 — ${n}하우스 거주 행성`,
      stance: null,
    };
  }

  const heavy = inHouse.length >= 3;
  return {
    system: '점성술(현대)', topicKey: label, what: `${n}하우스`,
    text: `현대 점성술은 ${n}하우스에 든 행성으로 읽습니다.`
      + ` ${inHouse.join(' · ')}${heavy ? ' — 셋 이상이 몰려(스텔리움) 이 영역이 삶의 중심으로 나옵니다.' : '이 들었습니다.'}`,
    source: `현대 점성술 — ${n}하우스 거주 행성`,
    stance: heavy ? '많음' : null,
  };
}

/** 자녀(5) · 배우자(7) · 직업(10) 을 두 벌로 읽는다 */
export function westernPair(input, fortune, n, label) {
  return [classicalHouse(input, n, label), modernHouse(fortune, n, label)].filter(Boolean);
}

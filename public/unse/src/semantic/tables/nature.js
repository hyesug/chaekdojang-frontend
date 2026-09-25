/**
 * tables/nature.js — 기호의 **물상(物象)**, 그리고 물상을 분야로 옮기는 표
 *
 * ── 왜 이 층이 필요한가 ────────────────────────────────────
 * 직업만 풍부하고 결혼·재물·학업은 빈약한 상태로 끝낼 수 없다. 그런데
 * 팔괘 여덟 개에 대해 분야별 벡터를 손으로 열두 벌 쓰면 96개를 사람이
 * 지어내는 꼴이 되고, 그건 전통이 아니라 내가 만든 표가 된다.
 *
 * 전통은 그렇게 하지 않는다. **기호에 물상 하나를 붙여 두고, 묻는 분야에
 * 따라 그 물상을 읽는다.** 坎(물)은 직업에서는 '물에 딸린 일', 관계에서는
 * '깊고 감추는 인연', 재물에서는 '들고 나는 돈'이다 — 같은 물상의 다른
 * 얼굴이지 다른 표가 아니다.
 *
 * 그래서 두 층으로 나눈다.
 *
 *   NATURE      기호 → 전통 물상 (설괘전·기문·육임 등 원전의 배당)
 *   PROJECTION  물상 → 분야별 축
 *
 * 근거 사슬이 `기호 → 물상 → 축` 으로 남으므로, 결과를 보고 "왜 이렇게
 * 나왔나"를 되짚을 수 있다.
 *
 * ── 물상 어휘 스물넷 ───────────────────────────────────────
 * 늘리지 않는다. 늘리면 물상이 아니라 축의 다른 이름이 된다.
 */

export const TRAIT_LABEL = {
  剛: '굳셈', 柔: '부드러움', 動: '움직임', 靜: '고요',
  明: '드러남', 暗: '감춤', 進: '나아감', 止: '멈춤',
  合: '모음', 分: '나눔', 爭: '다툼', 和: '화합',
  文: '글·학문', 武: '무·현장', 財: '재물', 官: '제도·직책',
  藝: '재주·꾸밈', 醫: '치유·돌봄', 商: '거래', 言: '말',
  蓄: '쌓음', 耗: '흩음', 遷: '옮김', 守: '지킴',
};

// ─────────────────────────────────────────────────────────────
// NATURE — 기호가 전통에서 무엇을 뜻하는가
// ─────────────────────────────────────────────────────────────

/** 팔괘 — 『주역』 설괘전의 물상 */
export const TRIGRAM_NATURE = {
  乾: ['剛', '官', '進', '明', '守'],   // 하늘·임금·아버지·금옥
  兌: ['言', '和', '藝', '商', '明'],   // 못·입·기쁨·소녀
  離: ['明', '文', '藝', '分', '動'],   // 불·밝음·문서·눈
  震: ['動', '進', '爭', '言', '遷'],   // 우레·움직임·장남
  巽: ['柔', '遷', '商', '和', '進'],   // 바람·드나듦·이익
  坎: ['暗', '動', '醫', '耗', '遷'],   // 물·험난·숨음·지혜
  艮: ['止', '守', '蓄', '靜', '剛'],   // 산·멈춤·쌓음
  坤: ['柔', '蓄', '守', '和', '醫'],   // 땅·어머니·무리·포용
};

/** 구성 아홉 — 기학의 구성 물상 */
export const NINE_STAR_NATURE = {
  일백: ['暗', '動', '醫', '和', '遷'],
  이흑: ['柔', '守', '蓄', '醫', '止'],
  삼벽: ['動', '進', '言', '爭', '明'],
  사록: ['柔', '遷', '商', '和', '言'],
  오황: ['剛', '分', '耗', '爭', '動'],
  육백: ['剛', '官', '進', '守', '財'],
  칠적: ['言', '和', '藝', '商', '明'],
  팔백: ['止', '蓄', '守', '財', '靜'],
  구자: ['明', '文', '藝', '分', '爭'],
};

/** 십이천장 — 대육임의 천장 물상 */
export const GENERAL_NATURE = {
  귀인: ['官', '和', '守', '文'],
  등사: ['動', '暗', '爭', '遷'],
  주작: ['言', '文', '明', '爭'],
  육합: ['合', '和', '商', '藝'],
  구진: ['止', '爭', '守', '武'],
  청룡: ['財', '進', '明', '商'],
  천공: ['暗', '耗', '分', '商'],
  백호: ['武', '爭', '剛', '醫'],
  태상: ['和', '蓄', '守', '醫'],
  현무: ['暗', '遷', '耗', '動'],
  태음: ['柔', '暗', '藝', '守'],
  천후: ['柔', '和', '藝', '醫'],
};

/** 팔문 — 기문둔갑의 문 물상 */
export const GATE_NATURE = {
  개문: ['官', '明', '進', '商'],
  휴문: ['靜', '和', '醫', '守'],
  생문: ['財', '蓄', '進', '商'],
  상문: ['武', '爭', '動', '分'],
  두문: ['暗', '止', '文', '守'],
  경문: ['言', '明', '爭', '動'],     // 驚門
  사문: ['止', '耗', '醫', '靜'],
  경문2: ['武', '明', '動', '爭'],    // 景門
};

/** 수 — 수비학의 수 의미 */
export const NUMBER_NATURE = {
  1: ['剛', '進', '官', '爭'],
  2: ['柔', '和', '合', '醫'],
  3: ['明', '藝', '言', '動'],
  4: ['止', '守', '蓄', '官'],
  5: ['動', '遷', '商', '分'],
  6: ['和', '醫', '守', '藝'],
  7: ['暗', '文', '止', '靜'],
  8: ['財', '官', '進', '蓄'],
  9: ['明', '醫', '和', '文'],
  11: ['文', '言', '明', '醫'],
  22: ['官', '蓄', '進', '武'],
};

/** 칠요 — 요일 수호 행성. 숙요·태국·마하보테가 함께 쓴다 */
export const WEEKDAY_NATURE = {
  일: ['明', '官', '進', '爭'], 월: ['柔', '和', '醫', '遷'],
  화: ['武', '爭', '動', '剛'], 수: ['言', '文', '商', '動'],
  목: ['文', '和', '官', '蓄'], 금: ['藝', '和', '明', '商'],
  토: ['止', '守', '蓄', '武'],
  일요일: ['明', '官', '進', '爭'], 월요일: ['柔', '和', '醫', '遷'],
  화요일: ['武', '爭', '動', '剛'], 수요일: ['言', '文', '商', '動'],
  목요일: ['文', '和', '官', '蓄'], 금요일: ['藝', '和', '明', '商'],
  토요일: ['止', '守', '蓄', '武'],
  태양: ['明', '官', '進', '爭'], 달: ['柔', '和', '醫', '遷'],
  화성: ['武', '爭', '動', '剛'], 수성: ['言', '文', '商', '動'],
  목성: ['文', '和', '官', '蓄'], 금성: ['藝', '和', '明', '商'],
  토성: ['止', '守', '蓄', '武'],
};

/** 마하보테 여덟 자리 */
export const MAHABOTE_NATURE = {
  빈가: ['剛', '進', '爭', '官'], 아하: ['和', '合', '商', '藝'],
  야자: ['文', '醫', '守', '和'], 아디: ['動', '進', '遷', '分'],
  마라나: ['分', '耗', '醫', '止'], 푸티: ['財', '蓄', '和', '守'],
  타트: ['遷', '動', '商', '進'],
};

/** 타로 메이저 아르카나 — 전통 상징 */
export const TAROT_NATURE = {
  마법사: ['藝', '言', '進', '動'], 여사제: ['暗', '文', '靜', '守'],
  여황제: ['柔', '蓄', '藝', '醫'], 황제: ['剛', '官', '守', '止'],
  교황: ['文', '官', '和', '守'], 연인: ['合', '和', '藝', '明'],
  전차: ['進', '爭', '武', '動'], 힘: ['剛', '柔', '守', '醫'],
  은둔자: ['暗', '文', '止', '靜'], 운명의수레바퀴: ['動', '遷', '財', '分'],
  정의: ['官', '分', '守', '文'], 매달린사람: ['止', '靜', '耗', '醫'],
  죽음: ['分', '遷', '耗', '動'], 절제: ['和', '醫', '合', '守'],
  악마: ['財', '爭', '暗', '耗'], 탑: ['分', '耗', '動', '爭'],
  별: ['明', '藝', '和', '醫'], 달: ['暗', '柔', '藝', '動'],
  태양: ['明', '進', '和', '藝'], 심판: ['明', '分', '官', '醫'],
  세계: ['合', '和', '官', '遷'], 바보: ['動', '遷', '進', '分'],
};

// ─────────────────────────────────────────────────────────────
// PROJECTION — 물상을 분야로 옮긴다
//
// 한 물상이 분야마다 어떤 얼굴을 갖는지 적는다. 坎(暗·動·醫·耗·遷)이
// 관계에서는 '감추는 인연', 재물에서는 '들고 나는 돈', 이동에서는
// '자주 옮김'이 되는 식이다.
//
// 비어 있는 칸은 **그 물상이 그 분야에 대해 말하지 않는다**는 뜻이다.
// 억지로 채우지 않는다.
// ─────────────────────────────────────────────────────────────

export const PROJECTION = {
  personality: {
    剛: { lead: 0.7, disciplined: 0.5, competitive: 0.4 },
    柔: { sensitive: 0.6, caring: 0.5, adaptive: 0.5 },
    動: { outward: 0.6, adaptive: 0.5, competitive: 0.3 },
    靜: { steady: 0.6, analytic: 0.4, disciplined: 0.4 },
    明: { outward: 0.7, expressive: 0.6 },
    暗: { intuitive: 0.6, analytic: 0.5, independentMind: 0.4 },
    進: { lead: 0.6, competitive: 0.5, outward: 0.4 },
    止: { steady: 0.7, disciplined: 0.5 },
    合: { caring: 0.5, adaptive: 0.5, outward: 0.4 },
    分: { analytic: 0.5, independentMind: 0.5, competitive: 0.4 },
    爭: { competitive: 0.8, lead: 0.4 },
    和: { caring: 0.6, adaptive: 0.6, sensitive: 0.4 },
    文: { analytic: 0.7, disciplined: 0.4 },
    武: { competitive: 0.6, lead: 0.5, steady: 0.3 },
    財: { steady: 0.4, competitive: 0.4 },
    官: { disciplined: 0.7, steady: 0.5, lead: 0.4 },
    藝: { expressive: 0.8, sensitive: 0.5, intuitive: 0.4 },
    醫: { caring: 0.8, sensitive: 0.5 },
    商: { outward: 0.6, adaptive: 0.5 },
    言: { expressive: 0.8, outward: 0.5 },
    蓄: { steady: 0.7, disciplined: 0.5 },
    耗: { adaptive: 0.4, independentMind: 0.4 },
    遷: { adaptive: 0.7, outward: 0.4, independentMind: 0.4 },
    守: { steady: 0.7, disciplined: 0.6 },
  },

  relationship: {
    剛: { autonomy: 0.6, volatility: 0.3 },
    柔: { bonding: 0.6, commitment: 0.4 },
    動: { volatility: 0.5, passion: 0.4 },
    靜: { stability: 0.6, commitment: 0.4 },
    明: { bonding: 0.6, passion: 0.5 },
    暗: { autonomy: 0.5, volatility: 0.4 },
    進: { passion: 0.6, bonding: 0.4 },
    止: { stability: 0.6, autonomy: 0.3 },
    合: { bonding: 0.8, commitment: 0.6 },
    分: { volatility: 0.6, autonomy: 0.5 },
    爭: { volatility: 0.7, passion: 0.4 },
    和: { bonding: 0.7, stability: 0.6 },
    文: { commitment: 0.4, stability: 0.3 },
    武: { volatility: 0.5, autonomy: 0.4 },
    藝: { passion: 0.6, bonding: 0.5 },
    醫: { bonding: 0.6, commitment: 0.5 },
    商: { bonding: 0.4, volatility: 0.3 },
    言: { bonding: 0.5, volatility: 0.3 },
    蓄: { commitment: 0.6, stability: 0.5 },
    耗: { volatility: 0.6 },
    遷: { volatility: 0.6, autonomy: 0.5 },
    守: { stability: 0.7, commitment: 0.6 },
  },

  marriage: {
    剛: { lateUnion: 0.4, spouseVolatile: 0.3 },
    柔: { earlyUnion: 0.4, spouseStable: 0.4 },
    動: { spouseVolatile: 0.5, earlyUnion: 0.3 },
    靜: { lateUnion: 0.5, spouseStable: 0.5 },
    明: { marriageOrientation: 0.5, earlyUnion: 0.4 },
    暗: { lateUnion: 0.6, spouseVolatile: 0.3 },
    進: { earlyUnion: 0.5 },
    止: { lateUnion: 0.6, spouseStable: 0.4 },
    合: { marriageOrientation: 0.8, earlyUnion: 0.5 },
    分: { spouseVolatile: 0.6, lateUnion: 0.4 },
    爭: { spouseVolatile: 0.6 },
    和: { marriageOrientation: 0.7, spouseStable: 0.6 },
    文: { lateUnion: 0.4, spouseStable: 0.3 },
    武: { spouseVolatile: 0.4 },
    官: { marriageOrientation: 0.6, spouseStable: 0.5 },
    藝: { earlyUnion: 0.4, spouseVolatile: 0.3 },
    醫: { spouseStable: 0.5, marriageOrientation: 0.4 },
    蓄: { spouseStable: 0.6, marriageOrientation: 0.5 },
    耗: { spouseVolatile: 0.6 },
    遷: { spouseVolatile: 0.5, lateUnion: 0.3 },
    守: { spouseStable: 0.7, marriageOrientation: 0.5 },
  },

  children: {
    柔: { childThick: 0.5, caregiving: 0.5 },
    靜: { childLate: 0.4 },
    暗: { childThin: 0.4, childLate: 0.4 },
    止: { childThin: 0.5, childLate: 0.4 },
    合: { childThick: 0.6, caregiving: 0.5 },
    分: { childThin: 0.5 },
    爭: { childThin: 0.4 },
    和: { childThick: 0.6, caregiving: 0.6 },
    文: { caregiving: 0.4, childLate: 0.3 },
    武: { childThin: 0.4 },
    醫: { caregiving: 0.8, childThick: 0.5 },
    蓄: { childThick: 0.6, caregiving: 0.4 },
    耗: { childThin: 0.5 },
    遷: { childLate: 0.4 },
    守: { caregiving: 0.5, childThick: 0.4 },
  },

  education: {
    剛: { repeatChallenge: 0.4 },
    靜: { formalContinuity: 0.5 },
    明: { credential: 0.4 },
    暗: { selfTaught: 0.5, detour: 0.4 },
    進: { credential: 0.5, repeatChallenge: 0.4 },
    止: { formalContinuity: 0.5, detour: 0.3 },
    分: { detour: 0.6 },
    爭: { repeatChallenge: 0.5 },
    文: { formalContinuity: 0.8, credential: 0.7 },
    武: { detour: 0.5, selfTaught: 0.4 },
    官: { formalContinuity: 0.7, credential: 0.6 },
    藝: { selfTaught: 0.5, detour: 0.3 },
    醫: { credential: 0.5, formalContinuity: 0.4 },
    商: { detour: 0.4, selfTaught: 0.4 },
    言: { credential: 0.4, formalContinuity: 0.3 },
    蓄: { formalContinuity: 0.5 },
    耗: { detour: 0.6 },
    遷: { detour: 0.5, selfTaught: 0.4 },
    守: { formalContinuity: 0.6 },
  },

  wealth: {
    剛: { enterprise: 0.4 },
    柔: { incomeStability: 0.4 },
    動: { wealthVolatility: 0.6 },
    靜: { incomeStability: 0.6 },
    明: { enterprise: 0.4, speculation: 0.3 },
    暗: { wealthVolatility: 0.5, speculation: 0.4 },
    進: { enterprise: 0.6 },
    止: { accumulation: 0.6, incomeStability: 0.5 },
    分: { wealthVolatility: 0.6 },
    爭: { speculation: 0.5, wealthVolatility: 0.4 },
    和: { incomeStability: 0.5 },
    文: { incomeStability: 0.5 },
    武: { wealthVolatility: 0.4, enterprise: 0.3 },
    財: { accumulation: 0.8, enterprise: 0.5 },
    官: { incomeStability: 0.8 },
    商: { enterprise: 0.7, accumulation: 0.4 },
    蓄: { accumulation: 0.8, inheritance: 0.5, incomeStability: 0.5 },
    耗: { wealthVolatility: 0.8, speculation: 0.4 },
    遷: { wealthVolatility: 0.5 },
    守: { accumulation: 0.6, incomeStability: 0.6, inheritance: 0.4 },
  },

  residence: {
    剛: { ownership: 0.4 },
    柔: { settled: 0.3 },
    靜: { settled: 0.7 },
    止: { settled: 0.8, ownership: 0.5 },
    動: { homeExpand: 0.3 },
    分: { homeShrink: 0.5 },
    和: { settled: 0.5 },
    財: { ownership: 0.7, homeExpand: 0.5 },
    官: { ownership: 0.5, settled: 0.5 },
    醫: { settled: 0.4 },
    蓄: { ownership: 0.8, homeExpand: 0.6, settled: 0.6 },
    耗: { homeShrink: 0.7 },
    遷: { settled: 0.1 },
    守: { settled: 0.8, ownership: 0.6 },
  },

  movement: {
    動: { mobile: 0.7 },
    靜: { localBound: 0.6 },
    進: { mobile: 0.5, longDistance: 0.4 },
    止: { localBound: 0.8 },
    分: { mobile: 0.5 },
    遷: { mobile: 0.9, longDistance: 0.7, abroad: 0.5 },
    守: { localBound: 0.7 },
    蓄: { localBound: 0.5 },
    商: { mobile: 0.6, longDistance: 0.4, abroad: 0.4 },
    武: { mobile: 0.4 },
    耗: { mobile: 0.5 },
    暗: { mobile: 0.3 },
  },

  // 질환명·수술 여부는 만들지 않는다. '몸에 실리는 부담'까지다
  health: {
    剛: { physicalLoad: 0.5, recovery: 0.5 },
    柔: { vulnerability: 0.5, recovery: 0.3 },
    動: { physicalLoad: 0.5 },
    靜: { recovery: 0.5, chronicTendency: 0.3 },
    暗: { chronicTendency: 0.5, vulnerability: 0.4 },
    止: { chronicTendency: 0.5 },
    分: { physicalLoad: 0.5, vulnerability: 0.4 },
    爭: { physicalLoad: 0.6 },
    和: { recovery: 0.6 },
    武: { physicalLoad: 0.7 },
    醫: { recovery: 0.6, vulnerability: 0.3 },
    耗: { vulnerability: 0.7, chronicTendency: 0.5 },
    遷: { physicalLoad: 0.4 },
    守: { recovery: 0.5 },
  },

  majorChange: {
    動: { turningPoint: 0.6, selfDriven: 0.4 },
    靜: { continuity: 0.7 },
    進: { turningPoint: 0.5, selfDriven: 0.6 },
    止: { continuity: 0.8 },
    分: { turningPoint: 0.8, externallyDriven: 0.5 },
    爭: { turningPoint: 0.5, selfDriven: 0.4 },
    剛: { selfDriven: 0.6 },
    柔: { externallyDriven: 0.5 },
    耗: { turningPoint: 0.7, externallyDriven: 0.6 },
    遷: { turningPoint: 0.6, selfDriven: 0.4 },
    守: { continuity: 0.8 },
    蓄: { continuity: 0.6 },
    官: { continuity: 0.5 },
  },

  /**
   * 시기 — **연도를 말하는 자리가 아니다.**
   * 그 전통이 "언제 켜지는가"를 보는 장치가 있는지와, 기운이 앞쪽에
   * 실리는지 뒤쪽에 실리는지까지만 적는다.
   */
  timing: {
    進: { earlyPeak: 0.5 },
    動: { earlyPeak: 0.4 },
    止: { latePeak: 0.5 },
    靜: { latePeak: 0.4 },
    蓄: { latePeak: 0.6 },
    耗: { midPeak: 0.4 },
    遷: { midPeak: 0.5 },
    明: { earlyPeak: 0.4 },
    暗: { latePeak: 0.4 },
    文: { midPeak: 0.4 },
    官: { midPeak: 0.5 },
    財: { midPeak: 0.4 },
  },
};

/** 물상 목록을 분야 축 벡터로 */
export function projectNature(traits, domain) {
  const table = PROJECTION[domain];
  if (!table) return null;
  const out = {};
  for (const t of traits ?? []) {
    for (const [axis, v] of Object.entries(table[t] ?? {})) {
      out[axis] = Math.max(out[axis] ?? 0, v);   // 같은 축은 최댓값
    }
  }
  return Object.keys(out).length ? out : null;
}

/** 체계 → 그 체계가 쓰는 물상표 */
export const NATURE_OF = {
  juyeok: TRIGRAM_NATURE, taeeul: TRIGRAM_NATURE, tojeong: TRIGRAM_NATURE,
  gujeong: NINE_STAR_NATURE,
  yukim: GENERAL_NATURE,
  hongguk: GATE_NATURE,
  kabbalah: NUMBER_NATURE,
  sukyo: WEEKDAY_NATURE, thai: WEEKDAY_NATURE,
  mahabote: MAHABOTE_NATURE,
  tarot: TAROT_NATURE,
};

// ─────────────────────────────────────────────────────────────
// 핵심 넷의 물상
//
// 이 넷은 분야마다 전용 자리가 있어 **명시적인 분야별 표**를 따로 둔다
// (ziwei.js · saju.js · western.js · vedic.js). 다만 그 표가 없는 분야
// (기질·결혼 시기·이동·큰 전환·시기)는 여기 물상으로 채운다.
//
// 명시적인 표가 있으면 그쪽이 이긴다 — 물상은 **빈칸을 메우는 자리**다.
// ─────────────────────────────────────────────────────────────

/** 십성 열 — 자평 명리 */
export const TEN_GOD_NATURE = {
  비견: ['剛', '守', '爭', '止'],
  겁재: ['剛', '爭', '分', '動'],
  식신: ['柔', '和', '藝', '蓄'],
  상관: ['明', '藝', '言', '分'],
  정재: ['財', '蓄', '守', '和'],
  편재: ['財', '商', '動', '遷'],
  정관: ['官', '守', '止', '和'],
  편관: ['武', '爭', '剛', '進'],
  정인: ['文', '醫', '守', '靜'],
  편인: ['文', '暗', '藝', '止'],
};

/** 십사주성 — 자미두수 */
export const ZIWEI_STAR_NATURE = {
  자미: ['官', '明', '守', '剛'], 천기: ['動', '文', '遷', '分'],
  태양: ['明', '官', '進', '和'], 무곡: ['財', '武', '剛', '蓄'],
  천동: ['柔', '和', '醫', '靜'], 염정: ['爭', '暗', '藝', '分'],
  천부: ['蓄', '守', '財', '和'], 태음: ['柔', '暗', '蓄', '藝'],
  탐랑: ['藝', '商', '和', '動'], 거문: ['言', '暗', '文', '爭'],
  천상: ['官', '和', '守', '合'], 천량: ['醫', '文', '守', '官'],
  칠살: ['武', '爭', '進', '分'], 파군: ['分', '耗', '動', '遷'],
};

/** 12사인 — 원소 × 양태의 물상. 회귀·항성 모두 '사인이 뜻하는 것'은 같다 */
export const SIGN_NATURE = [
  ['進', '爭', '武', '動'],   // 양자리
  ['蓄', '守', '財', '止'],   // 황소
  ['言', '動', '商', '遷'],   // 쌍둥이
  ['柔', '醫', '守', '和'],   // 게
  ['明', '官', '藝', '進'],   // 사자
  ['文', '醫', '分', '守'],   // 처녀
  ['和', '合', '藝', '商'],   // 천칭
  ['暗', '分', '醫', '剛'],   // 전갈
  ['文', '遷', '明', '進'],   // 사수
  ['官', '止', '蓄', '守'],   // 염소
  ['分', '文', '動', '明'],   // 물병
  ['柔', '暗', '藝', '醫'],   // 물고기
];

/** 행성 — 서양·베딕이 함께 쓴다 */
export const PLANET_NATURE = {
  태양: ['明', '官', '進', '剛'], 달: ['柔', '和', '醫', '遷'],
  수성: ['言', '文', '商', '動'], 금성: ['藝', '和', '合', '明'],
  화성: ['武', '爭', '動', '剛'], 목성: ['文', '和', '蓄', '官'],
  토성: ['止', '守', '蓄', '剛'], 천왕성: ['分', '動', '遷', '明'],
  해왕성: ['柔', '暗', '藝', '醫'], 명왕성: ['暗', '分', '耗', '剛'],
  라후: ['遷', '動', '商', '暗'], 케투: ['暗', '止', '文', '分'],
};

/**
 * meta.js - 무엇을 어떤 기준으로 계산했는가
 *
 * 계산 파일을 건드리지 않고 바깥에서 붙이는 이름표다. 산식은 systems/ 안에
 * 그대로 두고, 여기서는 "그 산식이 어느 유파의 무슨 방식이며 전통에서 온
 * 것인지 이 사이트가 정한 것인지"만 적는다.
 *
 * 왜 따로 두는가 - 지금까지 검증을 받을 때마다 같은 질문이 돌아왔다.
 * "이 값은 어느 유파인가", "이건 전통인가 사이트 산식인가". 코드 주석에는
 * 적혀 있었지만 화면에는 없었다. 값과 근거가 같이 다녀야 한다.
 *
 * sourceType
 *   traditional - 전통 산식을 그대로 옮긴 것
 *   school      - 전통이되 유파마다 값이 갈리는 것 (어느 쪽을 골랐는지 적는다)
 *   site        - 이 사이트가 정한 방식 (전통에 같은 규칙이 없거나 단순화한 것)
 */

export const ENGINE_VERSION = 'calc 1.6.0 / read 1.6.0';

export const SYSTEM_META = {
  saju: {
    method: 'BAZI_SOLAR_TERM_V1', tier: 'core', sourceType: 'traditional',
    basis: '절기 기준 · 진태양시(경도+균시차) 보정',
    note: '연주는 입춘, 월주는 절입으로 바뀝니다. 일주는 자정 기준입니다.',
  },
  jamidusu: {
    method: 'ZIWEI_SCHOOL_A_V1', tier: 'core', sourceType: 'school',
    basis: '음력 · 오행국 납음 · 삼합파 안성법',
    note: '사화(四化)는 유파마다 배정이 갈립니다. 여기서는 널리 쓰는 배정을 따랐습니다.',
  },
  astrology: {
    method: 'WESTERN_PLACIDUS_V1', tier: 'core', sourceType: 'traditional',
    basis: 'VSOP87D · 플라시두스 하우스 · 회귀 황도',
    note: '고위도에서 플라시두스가 성립하지 않으면 등분 하우스로 내려갑니다. 라후는 평균 교점입니다.',
  },
  vedic: {
    method: 'VEDIC_LAHIRI_V1', tier: 'core', sourceType: 'school',
    basis: '라히리 아야남샤 · 빔쇼타리 다샤',
    note: '아야남샤는 라히리 외에도 여럿입니다. 아쉬타쿠타 배점표도 유파마다 세부가 다릅니다.',
  },
  juyeok: {
    method: 'IGING_SITE_CAST_V1', tier: 'support', sourceType: 'site',
    basis: '생년월일시에서 괘를 세우는 방식',
    note: '변효 계산은 전통 그대로지만, 출생 자료에서 괘를 뽑는 기괘법은 이 사이트가 정한 것입니다.',
  },
  yukim: {
    method: 'LIUREN_V1', tier: 'support', sourceType: 'traditional',
    basis: '월장가시 · 사과삼전 · 십이천장',
    note: '생극은 일간의 오행으로 가립니다. 기궁은 자리이지 일간 자신이 아닙니다.',
  },
  hongguk: {
    method: 'HONGGUK_SCHOOL_A_V1', tier: 'support', sourceType: 'school',
    basis: '홍국수 · 팔문 · 양둔/음둔',
    note: '수를 구궁에 앉히는 방식은 유파 전용식입니다. 다른 책과 결과가 다를 수 있습니다.',
  },
  taeeul: {
    method: 'TAEEUL_SITE_OFFSET_V1', tier: 'support', sourceType: 'site',
    basis: '갑자년(서기 4년)부터 센 연도 오프셋 · 24년 1주',
    note: '고전 태을의 적년(상원부터 누적한 큰 수)과 같은 값이 아닙니다. 궁과 주객산이 모두 이 오프셋에서 나옵니다.',
  },
  gujeong: {
    method: 'KYUSEI_V1', tier: 'support', sourceType: 'traditional',
    basis: '입춘 기준 본명성 · 월명성',
    note: '별을 정하는 셈은 조견과 같습니다. 9년 주기 국면에 붙이는 이름은 해석 쪽입니다.',
  },
  sukyo: {
    method: 'SUKYO_MOON_V1', tier: 'support', sourceType: 'school',
    basis: '달의 항성 황경(라히리)으로 27수를 가림',
    note: '일본계 숙요도가 쓰는 월숙방통력(음력 대조표)은 다른 숙이 나옵니다. 둘 다 표시합니다.',
  },
  tojeong: {
    method: 'TOJEONG_SITE_TABLE_V1', tier: 'fun', sourceType: 'site',
    basis: '선천수 · 태세수/월건수/일진수로 상중하괘',
    note: '산법은 전통이지만 괘사 문구는 원전을 옮긴 것이 아니라 이 사이트에서 새로 썼습니다.',
  },
  kabbalah: {
    method: 'NUMEROLOGY_SEPHIRA_V1', tier: 'fun', sourceType: 'site',
    basis: '날짜 기반 수비학 · 세피라 대응',
    note: '라이프 패스 수를 세피라에 잇는 것은 현대 수비학 쪽 대응이지 전통 카발라의 고정 산법이 아닙니다.',
  },
  mahabote: {
    method: 'MAHABOTE_SITE_LAYOUT_V1', tier: 'fun', sourceType: 'school',
    basis: '버마력(새해 4월 중순 기준) · 요일 행성 · 여덟 자리',
    note: '버마력과 나머지까지는 규칙이 분명하지만, 나머지를 여덟 자리에 얹는 배치는 자료마다 다릅니다.',
  },
  thai: {
    method: 'THAI_WEEKDAY_V1', tier: 'fun', sourceType: 'traditional',
    basis: '요일 · 요일 행성 · 색과 방위',
    note: '요일 친소는 태국 전통 규칙과 별개로 인도식 행성 친소를 빌려 쓴 보조 기준입니다.',
  },
  tarot: {
    method: 'TAROT_SITE_SEED_V1', tier: 'fun', sourceType: 'site',
    basis: '생일 카드는 생년월일 합 · 석 장은 생년월일시+연도 씨앗',
    note: '석 장은 해마다 바뀝니다. 생일 카드와 달리 출생 고정값이 아닙니다.',
  },
};

export const TIER_LABEL = {
  core: '핵심 - 명반을 통째로 세우는 체계',
  support: '보조 - 한 국면이나 한 축을 보는 체계',
  fun: '재미 - 상징이나 사이트 산식 비중이 큰 체계',
};

export const SOURCE_LABEL = {
  traditional: '전통 산식',
  school: '전통 · 유파 선택 있음',
  site: '사이트 산식',
};

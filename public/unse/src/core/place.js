/**
 * place.js — 출생지 / 거주지 좌표
 *
 * 경도는 진태양시 보정(사주·자미두수·홍국기문)에,
 * 위도는 하우스 분할(점성술·베딕)에 쓰인다. 둘 다 없으면 계산이 못 간다.
 * tz는 그 지역의 표준시 오프셋(시간). 한국은 역사적으로 바뀌어서 time.js가 따로 처리한다.
 */

export const CITIES = [
  // ── 한국 ──
  { name: '서울', lat: 37.5665, lon: 126.9780, tz: 9, kr: true },
  { name: '인천', lat: 37.4563, lon: 126.7052, tz: 9, kr: true },
  { name: '수원', lat: 37.2636, lon: 127.0286, tz: 9, kr: true },
  { name: '성남', lat: 37.4200, lon: 127.1265, tz: 9, kr: true },
  { name: '용인', lat: 37.2411, lon: 127.1776, tz: 9, kr: true },
  { name: '고양', lat: 37.6584, lon: 126.8320, tz: 9, kr: true },
  { name: '부천', lat: 37.5035, lon: 126.7660, tz: 9, kr: true },
  { name: '안산', lat: 37.3219, lon: 126.8309, tz: 9, kr: true },
  { name: '의정부', lat: 37.7381, lon: 127.0338, tz: 9, kr: true },
  { name: '춘천', lat: 37.8813, lon: 127.7300, tz: 9, kr: true },
  { name: '원주', lat: 37.3422, lon: 127.9202, tz: 9, kr: true },
  { name: '강릉', lat: 37.7519, lon: 128.8761, tz: 9, kr: true },
  { name: '대전', lat: 36.3504, lon: 127.3845, tz: 9, kr: true },
  { name: '세종', lat: 36.4800, lon: 127.2890, tz: 9, kr: true },
  { name: '청주', lat: 36.6424, lon: 127.4890, tz: 9, kr: true },
  { name: '천안', lat: 36.8151, lon: 127.1139, tz: 9, kr: true },
  { name: '공주', lat: 36.4465, lon: 127.1190, tz: 9, kr: true },
  { name: '광주광역시', lat: 35.1595, lon: 126.8526, tz: 9, kr: true },
  { name: '광주(경기)', lat: 37.4292, lon: 127.2550, tz: 9, kr: true },
  { name: '전주', lat: 35.8242, lon: 127.1480, tz: 9, kr: true },
  { name: '군산', lat: 35.9676, lon: 126.7370, tz: 9, kr: true },
  { name: '목포', lat: 34.8118, lon: 126.3922, tz: 9, kr: true },
  { name: '여수', lat: 34.7604, lon: 127.6622, tz: 9, kr: true },
  { name: '순천', lat: 34.9506, lon: 127.4872, tz: 9, kr: true },
  { name: '대구', lat: 35.8714, lon: 128.6014, tz: 9, kr: true },
  { name: '포항', lat: 36.0190, lon: 129.3435, tz: 9, kr: true },
  { name: '경주', lat: 35.8562, lon: 129.2247, tz: 9, kr: true },
  { name: '안동', lat: 36.5684, lon: 128.7294, tz: 9, kr: true },
  { name: '구미', lat: 36.1196, lon: 128.3446, tz: 9, kr: true },
  { name: '부산', lat: 35.1796, lon: 129.0756, tz: 9, kr: true },
  { name: '울산', lat: 35.5384, lon: 129.3114, tz: 9, kr: true },
  { name: '창원', lat: 35.2280, lon: 128.6811, tz: 9, kr: true },
  { name: '진주', lat: 35.1800, lon: 128.1076, tz: 9, kr: true },
  { name: '제주', lat: 33.4996, lon: 126.5312, tz: 9, kr: true },
  { name: '서귀포', lat: 33.2541, lon: 126.5600, tz: 9, kr: true },
  { name: '여주', lat: 37.2982, lon: 127.6372, tz: 9, kr: true },
  { name: '이천', lat: 37.2723, lon: 127.4350, tz: 9, kr: true },
  { name: '평택', lat: 36.9921, lon: 127.1129, tz: 9, kr: true },
  { name: '안양', lat: 37.3943, lon: 126.9568, tz: 9, kr: true },
  { name: '광명', lat: 37.4781, lon: 126.8646, tz: 9, kr: true },
  { name: '시흥', lat: 37.3800, lon: 126.8029, tz: 9, kr: true },
  { name: '파주', lat: 37.7599, lon: 126.7800, tz: 9, kr: true },
  { name: '김포', lat: 37.6152, lon: 126.7156, tz: 9, kr: true },
  { name: '남양주', lat: 37.6360, lon: 127.2165, tz: 9, kr: true },
  { name: '구리', lat: 37.5943, lon: 127.1296, tz: 9, kr: true },
  { name: '하남', lat: 37.5393, lon: 127.2148, tz: 9, kr: true },
  { name: '오산', lat: 37.1499, lon: 127.0774, tz: 9, kr: true },
  { name: '화성', lat: 37.1995, lon: 126.8314, tz: 9, kr: true },
  { name: '양주', lat: 37.7853, lon: 127.0458, tz: 9, kr: true },
  { name: '포천', lat: 37.8949, lon: 127.2003, tz: 9, kr: true },
  { name: '동두천', lat: 37.9036, lon: 127.0606, tz: 9, kr: true },
  { name: '안성', lat: 37.0080, lon: 127.2797, tz: 9, kr: true },
  { name: '의왕', lat: 37.3449, lon: 126.9682, tz: 9, kr: true },
  { name: '군포', lat: 37.3617, lon: 126.9352, tz: 9, kr: true },
  { name: '과천', lat: 37.4292, lon: 126.9877, tz: 9, kr: true },
  { name: '속초', lat: 38.2070, lon: 128.5918, tz: 9, kr: true },
  { name: '동해', lat: 37.5247, lon: 129.1143, tz: 9, kr: true },
  { name: '삼척', lat: 37.4500, lon: 129.1653, tz: 9, kr: true },
  { name: '태백', lat: 37.1641, lon: 128.9856, tz: 9, kr: true },
  { name: '충주', lat: 36.9910, lon: 127.9259, tz: 9, kr: true },
  { name: '제천', lat: 37.1326, lon: 128.1910, tz: 9, kr: true },
  { name: '아산', lat: 36.7898, lon: 127.0018, tz: 9, kr: true },
  { name: '서산', lat: 36.7848, lon: 126.4503, tz: 9, kr: true },
  { name: '논산', lat: 36.1872, lon: 127.0987, tz: 9, kr: true },
  { name: '당진', lat: 36.8895, lon: 126.6457, tz: 9, kr: true },
  { name: '보령', lat: 36.3333, lon: 126.6128, tz: 9, kr: true },
  { name: '익산', lat: 35.9483, lon: 126.9576, tz: 9, kr: true },
  { name: '정읍', lat: 35.5699, lon: 126.8558, tz: 9, kr: true },
  { name: '남원', lat: 35.4164, lon: 127.3905, tz: 9, kr: true },
  { name: '나주', lat: 35.0160, lon: 126.7108, tz: 9, kr: true },
  { name: '광양', lat: 34.9407, lon: 127.6959, tz: 9, kr: true },
  { name: '김천', lat: 36.1398, lon: 128.1136, tz: 9, kr: true },
  { name: '영주', lat: 36.8056, lon: 128.6240, tz: 9, kr: true },
  { name: '상주', lat: 36.4110, lon: 128.1590, tz: 9, kr: true },
  { name: '경산', lat: 35.8251, lon: 128.7411, tz: 9, kr: true },
  { name: '김해', lat: 35.2285, lon: 128.8894, tz: 9, kr: true },
  { name: '양산', lat: 35.3350, lon: 129.0372, tz: 9, kr: true },
  { name: '통영', lat: 34.8544, lon: 128.4331, tz: 9, kr: true },
  { name: '거제', lat: 34.8804, lon: 128.6211, tz: 9, kr: true },
  { name: '밀양', lat: 35.5038, lon: 128.7465, tz: 9, kr: true },
  { name: '사천', lat: 35.0034, lon: 128.0642, tz: 9, kr: true },
  // ── 나머지 시·군 ──
  { name: '계룡', lat: 36.2744, lon: 127.2487, tz: 9, kr: true },
  { name: '김제', lat: 35.8038, lon: 126.8807, tz: 9, kr: true },
  { name: '문경', lat: 36.5868, lon: 128.1867, tz: 9, kr: true },
  { name: '영천', lat: 35.9733, lon: 128.9387, tz: 9, kr: true },
  { name: '양평', lat: 37.4917, lon: 127.4876, tz: 9, kr: true },
  { name: '가평', lat: 37.8315, lon: 127.5097, tz: 9, kr: true },
  { name: '연천', lat: 38.0965, lon: 127.0748, tz: 9, kr: true },
  { name: '강화', lat: 37.7466, lon: 126.4878, tz: 9, kr: true },
  { name: '홍천', lat: 37.6971, lon: 127.8889, tz: 9, kr: true },
  { name: '횡성', lat: 37.4917, lon: 127.9850, tz: 9, kr: true },
  { name: '영월', lat: 37.1836, lon: 128.4618, tz: 9, kr: true },
  { name: '평창', lat: 37.3705, lon: 128.3902, tz: 9, kr: true },
  { name: '정선', lat: 37.3805, lon: 128.6608, tz: 9, kr: true },
  { name: '철원', lat: 38.1466, lon: 127.3131, tz: 9, kr: true },
  { name: '화천', lat: 38.1060, lon: 127.7081, tz: 9, kr: true },
  { name: '양구', lat: 38.1100, lon: 127.9899, tz: 9, kr: true },
  { name: '인제', lat: 38.0696, lon: 128.1707, tz: 9, kr: true },
  { name: '고성(강원)', lat: 38.3806, lon: 128.4678, tz: 9, kr: true },
  { name: '양양', lat: 38.0754, lon: 128.6190, tz: 9, kr: true },
  { name: '보은', lat: 36.4894, lon: 127.7294, tz: 9, kr: true },
  { name: '옥천', lat: 36.3065, lon: 127.5714, tz: 9, kr: true },
  { name: '영동', lat: 36.1750, lon: 127.7764, tz: 9, kr: true },
  { name: '진천', lat: 36.8554, lon: 127.4355, tz: 9, kr: true },
  { name: '괴산', lat: 36.8153, lon: 127.7867, tz: 9, kr: true },
  { name: '음성', lat: 36.9403, lon: 127.6903, tz: 9, kr: true },
  { name: '단양', lat: 36.9846, lon: 128.3654, tz: 9, kr: true },
  { name: '증평', lat: 36.7855, lon: 127.5814, tz: 9, kr: true },
  { name: '금산', lat: 36.1089, lon: 127.4880, tz: 9, kr: true },
  { name: '부여', lat: 36.2757, lon: 126.9099, tz: 9, kr: true },
  { name: '서천', lat: 36.0801, lon: 126.6917, tz: 9, kr: true },
  { name: '청양', lat: 36.4592, lon: 126.8022, tz: 9, kr: true },
  { name: '홍성', lat: 36.6014, lon: 126.6608, tz: 9, kr: true },
  { name: '예산', lat: 36.6827, lon: 126.8450, tz: 9, kr: true },
  { name: '태안', lat: 36.7456, lon: 126.2978, tz: 9, kr: true },
  { name: '완주', lat: 35.9049, lon: 127.1620, tz: 9, kr: true },
  { name: '진안', lat: 35.7917, lon: 127.4248, tz: 9, kr: true },
  { name: '무주', lat: 36.0069, lon: 127.6606, tz: 9, kr: true },
  { name: '장수', lat: 35.6474, lon: 127.5212, tz: 9, kr: true },
  { name: '임실', lat: 35.6178, lon: 127.2892, tz: 9, kr: true },
  { name: '순창', lat: 35.3744, lon: 127.1375, tz: 9, kr: true },
  { name: '고창', lat: 35.4358, lon: 126.7020, tz: 9, kr: true },
  { name: '부안', lat: 35.7318, lon: 126.7330, tz: 9, kr: true },
  { name: '담양', lat: 35.3211, lon: 126.9882, tz: 9, kr: true },
  { name: '곡성', lat: 35.2820, lon: 127.2921, tz: 9, kr: true },
  { name: '구례', lat: 35.2026, lon: 127.4629, tz: 9, kr: true },
  { name: '고흥', lat: 34.6111, lon: 127.2850, tz: 9, kr: true },
  { name: '보성', lat: 34.7714, lon: 127.0800, tz: 9, kr: true },
  { name: '화순', lat: 35.0645, lon: 126.9865, tz: 9, kr: true },
  { name: '장흥', lat: 34.6816, lon: 126.9070, tz: 9, kr: true },
  { name: '강진', lat: 34.6420, lon: 126.7673, tz: 9, kr: true },
  { name: '해남', lat: 34.5735, lon: 126.5990, tz: 9, kr: true },
  { name: '영암', lat: 34.8001, lon: 126.6967, tz: 9, kr: true },
  { name: '무안', lat: 34.9900, lon: 126.4817, tz: 9, kr: true },
  { name: '함평', lat: 35.0658, lon: 126.5166, tz: 9, kr: true },
  { name: '영광', lat: 35.2772, lon: 126.5120, tz: 9, kr: true },
  { name: '장성', lat: 35.3018, lon: 126.7847, tz: 9, kr: true },
  { name: '완도', lat: 34.3110, lon: 126.7551, tz: 9, kr: true },
  { name: '진도', lat: 34.4868, lon: 126.2634, tz: 9, kr: true },
  { name: '신안', lat: 34.8332, lon: 126.3510, tz: 9, kr: true },
  { name: '군위', lat: 36.2393, lon: 128.5727, tz: 9, kr: true },
  { name: '의성', lat: 36.3527, lon: 128.6971, tz: 9, kr: true },
  { name: '청송', lat: 36.4363, lon: 129.0571, tz: 9, kr: true },
  { name: '영양', lat: 36.6667, lon: 129.1124, tz: 9, kr: true },
  { name: '영덕', lat: 36.4150, lon: 129.3656, tz: 9, kr: true },
  { name: '청도', lat: 35.6474, lon: 128.7341, tz: 9, kr: true },
  { name: '고령', lat: 35.7262, lon: 128.2628, tz: 9, kr: true },
  { name: '성주', lat: 35.9190, lon: 128.2831, tz: 9, kr: true },
  { name: '칠곡', lat: 35.9955, lon: 128.4017, tz: 9, kr: true },
  { name: '예천', lat: 36.6578, lon: 128.4527, tz: 9, kr: true },
  { name: '봉화', lat: 36.8932, lon: 128.7325, tz: 9, kr: true },
  { name: '울진', lat: 36.9930, lon: 129.4003, tz: 9, kr: true },
  { name: '울릉', lat: 37.4843, lon: 130.9057, tz: 9, kr: true },
  { name: '의령', lat: 35.3222, lon: 128.2617, tz: 9, kr: true },
  { name: '함안', lat: 35.2724, lon: 128.4066, tz: 9, kr: true },
  { name: '창녕', lat: 35.5444, lon: 128.4922, tz: 9, kr: true },
  { name: '고성(경남)', lat: 34.9730, lon: 128.3222, tz: 9, kr: true },
  { name: '남해', lat: 34.8376, lon: 127.8925, tz: 9, kr: true },
  { name: '하동', lat: 35.0672, lon: 127.7514, tz: 9, kr: true },
  { name: '산청', lat: 35.4156, lon: 127.8736, tz: 9, kr: true },
  { name: '함양', lat: 35.5205, lon: 127.7252, tz: 9, kr: true },
  { name: '거창', lat: 35.6868, lon: 127.9095, tz: 9, kr: true },
  { name: '합천', lat: 35.5666, lon: 128.1658, tz: 9, kr: true },
  // 북한 (출생지로 입력되는 경우가 있다)
  { name: '평양', lat: 39.0392, lon: 125.7625, tz: 9, kr: true },
  { name: '개성', lat: 37.9700, lon: 126.5544, tz: 9, kr: true },
  { name: '함흥', lat: 39.9183, lon: 127.5364, tz: 9, kr: true },
  { name: '신의주', lat: 40.1006, lon: 124.3981, tz: 9, kr: true },

  // ── 해외 ──
  { name: '도쿄', lat: 35.6762, lon: 139.6503, tz: 9 },
  { name: '오사카', lat: 34.6937, lon: 135.5023, tz: 9 },
  { name: '베이징', lat: 39.9042, lon: 116.4074, tz: 8 },
  { name: '상하이', lat: 31.2304, lon: 121.4737, tz: 8 },
  { name: '홍콩', lat: 22.3193, lon: 114.1694, tz: 8 },
  { name: '타이베이', lat: 25.0330, lon: 121.5654, tz: 8 },
  { name: '싱가포르', lat: 1.3521, lon: 103.8198, tz: 8 },
  { name: '하노이', lat: 21.0278, lon: 105.8342, tz: 7 },
  { name: '방콕', lat: 13.7563, lon: 100.5018, tz: 7 },
  { name: '자카르타', lat: -6.2088, lon: 106.8456, tz: 7 },
  { name: '마닐라', lat: 14.5995, lon: 120.9842, tz: 8 },
  { name: '델리', lat: 28.6139, lon: 77.2090, tz: 5.5 },
  { name: '두바이', lat: 25.2048, lon: 55.2708, tz: 4 },
  { name: '모스크바', lat: 55.7558, lon: 37.6173, tz: 3 },
  { name: '베를린', lat: 52.5200, lon: 13.4050, tz: 1 },
  { name: '파리', lat: 48.8566, lon: 2.3522, tz: 1 },
  { name: '로마', lat: 41.9028, lon: 12.4964, tz: 1 },
  { name: '런던', lat: 51.5074, lon: -0.1278, tz: 0 },
  { name: '뉴욕', lat: 40.7128, lon: -74.0060, tz: -5 },
  { name: '토론토', lat: 43.6532, lon: -79.3832, tz: -5 },
  { name: '시카고', lat: 41.8781, lon: -87.6298, tz: -6 },
  { name: '덴버', lat: 39.7392, lon: -104.9903, tz: -7 },
  { name: '로스앤젤레스', lat: 34.0522, lon: -118.2437, tz: -8 },
  { name: '샌프란시스코', lat: 37.7749, lon: -122.4194, tz: -8 },
  { name: '시애틀', lat: 47.6062, lon: -122.3321, tz: -8 },
  { name: '밴쿠버', lat: 49.2827, lon: -123.1207, tz: -8 },
  { name: '상파울루', lat: -23.5505, lon: -46.6333, tz: -3 },
  { name: '시드니', lat: -33.8688, lon: 151.2093, tz: 10 },
  { name: '멜버른', lat: -37.8136, lon: 144.9631, tz: 10 },
  { name: '오클랜드', lat: -36.8485, lon: 174.7633, tz: 12 },
];

const BY_NAME = new Map(CITIES.map((c) => [c.name, c]));

export function findCity(name) {
  return BY_NAME.get(name) ?? null;
}

/**
 * 목록에 없는 지역을 넣었을 때 비슷한 이름을 알려준다.
 *
 * 여기서 정작 중요한 건, 정확히 일치하지 않아도 된다는 점이다.
 * 경도가 0.2도 이내로 붙어 있으면 진태양시 차이가 1분도 안 되므로
 * 이웃한 시·군을 골라도 결과가 사실상 같다.
 * 구미와 김천은 0.9분, 대전과 세종은 0.4분 차이일 뿐이다.
 */
export function suggestCity(name) {
  const q = String(name).trim().replace(/(특별시|광역시|자치시|[시군구])$/, '');
  if (!q) return [];
  const kr = CITIES.filter((c) => c.kr);
  const hit = kr.filter((c) => c.name.includes(q) || q.includes(c.name));
  const sameFirst = kr.filter((c) => c.name[0] === q[0] && !hit.includes(c));
  return [...hit, ...sameFirst].map((c) => c.name).slice(0, 6);
}

/** 두 지점 사이의 방위 (8방위 한글). 거주지 해석에 쓴다. */
export function bearing8(from, to) {
  const dLon = to.lon - from.lon;
  const dLat = to.lat - from.lat;
  if (Math.abs(dLon) < 0.15 && Math.abs(dLat) < 0.15) return '제자리';
  // 경도차는 위도에 따라 실제 거리가 줄어든다
  const x = dLon * Math.cos(((from.lat + to.lat) / 2) * Math.PI / 180);
  const y = dLat;
  const deg = ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
  const names = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'];
  return names[Math.round(deg / 45) % 8];
}

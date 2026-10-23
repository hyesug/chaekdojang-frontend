// 평가 세트 — PROTOCOL.md 에 고정. 바꾸면 이전 결과와 비교할 수 없다.

/** 가상 인물 둘 (테스트·측정 스크립트와 같은 명반) */
export const FORMS = [
  { id: 'F1', name: '가', gender: 'female', year: 1993, month: 3, day: 17, hour: 15, minute: 42, birthPlace: '여주', homePlace: '서울' },
  { id: 'F2', name: '나', gender: 'male', year: 1985, month: 11, day: 2, hour: 7, minute: 10, birthPlace: '부산', homePlace: '서울' },
];

/** [id, 분야, 유형, 질문] — 유형: when 시기 · choice 양자택일 · whether 될까 · trait 성향 · detail 내용 */
export const QUESTIONS = [
  ['q01', '직업', 'choice', '2027년에 회사를 지키는게 낫냐'],
  ['q02', '직업', 'when', '언제 이직해?'],
  ['q03', '직업', 'whether', '내년에 승진할까'],
  ['q04', '직업', 'trait', '나한테 맞는 직업은?'],
  ['q05', '직업', 'choice', '창업할까 회사 다닐까'],
  ['q06', '재물', 'when', '올해 재물운'],
  ['q07', '재물', 'whether', '지금 주식 투자해도 될까'],
  ['q08', '주거', 'choice', '집을 살까 전세로 계속 살까'],
  ['q09', '재물', 'detail', '돈 모으는 법'],
  ['q10', '결혼', 'when', '언제 결혼해'],
  ['q11', '결혼', 'choice', '지금 남자친구랑 결혼하는 게 맞을까'],
  ['q12', '관계', 'choice', '헤어질까 말까'],
  ['q13', '관계', 'when', '2027년 연애운'],
  ['q14', '결혼', 'detail', '내 배우자는 어떤 사람이야'],
  ['q15', '이사', 'choice', '이사 갈까 말까'],
  ['q16', '건강', 'detail', '건강 조심할 곳'],
  ['q17', '건강', 'whether', '내일 수술인데 잘될까'],
  ['q18', '학업', 'choice', '대학원 갈까 취업할까'],
  ['q19', '학업', 'whether', '이번 시험 합격할까'],
  ['q20', '자녀', 'when', '아이는 언제 생겨'],
  ['q21', '가족', 'detail', '엄마랑 사이가 왜 안 좋을까'],
  ['q22', '성향', 'trait', '내 성격 장단점'],
  ['q23', '종합', 'when', '이번 달 운세'],
  ['q24', '종합', 'detail', '내 인생 전체 흐름'],
];

/** 기준 시각 — 2026-10-19 12:00 KST */
export const NOW = new Date('2026-10-19T03:00:00Z');

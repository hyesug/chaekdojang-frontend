/**
 * labels.js — 실제 사례의 **정답표 규격**
 *
 * ── 왜 '모름'을 따로 두는가 ─────────────────────────────────
 * 열한 명 모두에게 모든 칸이 있는 것이 아니다. 자녀를 아는 사람은
 * 여섯이고 학업을 아는 사람은 일곱이다. 빈칸을 0 이나 '아니오'로
 * 채우면 **모르는 것이 오답으로 세어진다.** 그래서 넷으로 가른다.
 *
 *   known           값을 안다
 *   unknown         물어보지 않았거나 답을 못 들었다  → 채점에서 뺀다
 *   not_applicable  그 사람에게 성립하지 않는다        → 채점에서 뺀다
 *   censored        아직 안 일어났을 뿐이다           → 절단으로 채점한다
 *
 * ── 예정된 일은 정답이 아니다 ───────────────────────────────
 * "2027-10 결혼 예정"은 아직 일어나지 않았다. `plannedFutureEvent` 에
 * 따로 두고 채점에 넣지 않는다. 실제로 일어난 뒤 `known` 으로 올린다.
 *
 * ── 저장소에 올리지 않는다 ──────────────────────────────────
 * 실제 사람 자료는 `validation/people.json` 에 두고 `.gitignore` 에 건다.
 * 저장소에는 이 규격과 `validation/people.example.json`(지어낸 자료)만 남는다.
 */

export const STATUS = ['known', 'unknown', 'not_applicable', 'censored'];

/** 채점에 넣어도 되는 칸인가 */
export const isScorable = (label) => label?.status === 'known';

/** 절단 채점을 해야 하는 칸인가 */
export const isCensored = (label) => label?.status === 'censored';

/** 값이 없는 칸을 만들 때 쓰는 기본값 */
export const unknown = (why = null) => ({ status: 'unknown', why });

/**
 * 사람 한 명의 정답표 규격.
 *
 * ```json
 * {
 *   "id": "P01",
 *   "birth": { "gender": "female", "year": 1992, ... },
 *   "labels": {
 *     "occupation": {
 *       "status": "known",
 *       "category": "it_software",
 *       "attributes": ["technical", "analytical", "organization"],
 *       "employmentForm": "organization"
 *     },
 *     "marriage": { "status": "censored", "observedUntilAge": 34 },
 *     "children": { "status": "known", "count": 0 },
 *     "education": { "status": "known", "path": "formal_continuous" },
 *     "residence": { "status": "unknown" }
 *   },
 *   "plannedFutureEvents": [
 *     { "domain": "marriage", "date": "2027-10", "note": "아직 일어나지 않음" }
 *   ]
 * }
 * ```
 */
export const SCHEMA_DOC = 'validation/SCHEMA.md';

/** 자녀 수 → 범주. 정확한 숫자를 맞히려 들지 않는다 */
export function childrenBand(count) {
  if (count == null) return null;
  return count === 0 ? 'few' : count <= 2 ? 'average' : 'many';
}

/** 정답표를 읽어 채점 가능한 칸만 추린다 */
export function scorableLabels(person, domain) {
  const l = person?.labels?.[domain];
  if (!l) return { status: 'unknown', why: '칸 자체가 없다' };
  if (!STATUS.includes(l.status)) return { status: 'unknown', why: `알 수 없는 status: ${l.status}` };
  return l;
}

/**
 * 정답표에 사람 자료가 아닌 것이 섞였는지 본다.
 * 이름·전화·주소 같은 것이 들어오면 커밋 사고로 이어진다.
 */
export function assertNoPersonalFields(person) {
  const banned = ['name', 'phone', 'address', 'email', 'realName', '이름'];
  const found = banned.filter((k) => k in (person ?? {}) || k in (person?.birth ?? {}));
  if (found.length) {
    throw new Error(`정답표에 개인 식별 정보가 들어 있다: ${found.join(', ')}`);
  }
  return true;
}

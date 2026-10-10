/**
 * sourceTrace.js — 화면에 보였던 문장이 어느 사전의 어느 칸에서 왔는지 거꾸로 찾는다.
 *
 * 관리자 '운세 피드백' 화면이 쓴다. 피드백에는 생년월일이 없으니 명반을 다시 계산할 수 없다 —
 * 대신 저장된 문장(snippet)을 사전 문장과 맞대어 출처(예: 사주 辛 일간 × 辰월 · 성격)를 붙인다.
 * 여기에는 import 를 두지 않는다(관리자 번들이 운세 계산 모듈을 끌어오지 않게).
 */

const STEM = { 갑: '甲', 을: '乙', 병: '丙', 정: '丁', 무: '戊', 기: '己', 경: '庚', 신: '辛', 임: '壬', 계: '癸' };
const BRANCH = { 자: '子', 축: '丑', 인: '寅', 묘: '卯', 진: '辰', 사: '巳', 오: '午', 미: '未', 신: '申', 유: '酉', 술: '戌', 해: '亥' };

/** 사전 묶음 이름 */
const GROUP_LABEL = {
  'saju-stem-month': '사주 일간×월', 'saju-ilju': '사주 일주',
  'ziwei-ming': '자미 명궁', 'ziwei-career': '자미 관록궁', 'ziwei-money': '자미 재백궁',
  'ziwei-spouse': '자미 부처궁', 'ziwei-children': '자미 자녀궁',
  western: '서양 점성', 'western-planets': '서양 점성(행성)', vedic: '베딕', mansion: '28수',
  gujeong: '구성학', juyeok: '주역', kabbalah: '카발라', tarot: '타로', weekday: '요일',
  boards: '육임·기문', 'daeun-stem': '대운(천간)', 'daeun-branch': '대운(지지)',
  'pair-stem': '궁합(일간)', 'pair-bond': '궁합(자리)', event: '사건', flow: '오늘·이달 흐름',
};
/** 칸 이름 — 사건 사전은 t/w/p 의 뜻이 다르다 */
const FIELD_LABEL = { p: '성격', w: '일', m: '돈', r: '관계', c: '조심', h: '모습', g: '잘되는 것' };
const EVENT_FIELD = { t: '제목', w: '내용', p: '대비' };

const group = (file) => file.replace(/-\d+$/, '');
const norm = (t) => String(t ?? '').replace(/\s+/g, ' ').trim();
/** 문장 끝 마침표·따옴표를 떼고 비교한다 — 화면은 사전 문장을 '…' 안에 넣으며 마침표를 뗀다 */
const core = (t) => norm(t).replace(/[.!?。]+$/, '');

/** 사전 열쇠를 사람이 읽는 말로 — 사주 일간×월은 한자로 */
export function keyLabel(file, key) {
  const g = group(file);
  if (g === 'saju-stem-month') {
    const [s, b] = String(key).split('-');
    if (STEM[s] && BRANCH[b]) return `${STEM[s]}(${s}) 일간 × ${BRANCH[b]}(${b})월`;
  }
  if (g === 'saju-ilju' && key.length === 2 && STEM[key[0]] && BRANCH[key[1]]) return `${STEM[key[0]]}${BRANCH[key[1]]}(${key}) 일주`;
  return String(key);
}

export const fieldLabel = (file, field) => (group(file) === 'event' ? EVENT_FIELD[field] : FIELD_LABEL[field]) ?? field;
export const groupLabel = (file) => GROUP_LABEL[group(file)] ?? group(file);

/**
 * 사전 문장 색인 — 칸 값 하나를 문장으로 쪼갠다(칸 값이 통째로, 또는 한 문장만 화면에 나올 수 있어서).
 * @param {Record<string, object>} dicts 파일 이름 → 그 파일의 JSON
 */
export function buildSentenceIndex(dicts) {
  const out = [];
  for (const [file, obj] of Object.entries(dicts)) {
    for (const [key, entry] of Object.entries(obj ?? {})) {
      if (!entry || typeof entry !== 'object') continue;
      for (const [field, value] of Object.entries(entry)) {
        if (typeof value !== 'string') continue;
        const parts = [value, ...value.split(/(?<=[.!?])\s+/)].map(core).filter((t) => t.length >= 12);
        for (const text of new Set(parts)) out.push({ text, file, key, field });
      }
    }
  }
  // 긴 문장부터 — 긴 것이 맞으면 그 안의 짧은 조각은 따로 세지 않는다
  return out.sort((a, b) => b.text.length - a.text.length);
}

/**
 * 저장된 문장에서 출처를 찾는다.
 * @returns {Array<{file, key, field, text, label}>}
 */
export function traceSources(snippet, index) {
  const s = norm(snippet);
  if (!s) return [];
  const found = [];
  const seen = new Set();
  for (const x of index) {
    if (!s.includes(x.text)) continue;
    const id = `${x.file}|${x.key}|${x.field}`;
    if (seen.has(id)) continue;
    // 이미 찾은 긴 문장 안에 든 조각이면 건너뛴다
    if (found.some((f) => f.text.includes(x.text))) continue;
    seen.add(id);
    found.push({ ...x, label: `${groupLabel(x.file)} · ${keyLabel(x.file, x.key)} · ${fieldLabel(x.file, x.field)}` });
  }
  return found;
}

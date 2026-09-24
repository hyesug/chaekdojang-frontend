/**
 * scenario/provider.js — **바깥 자료를 후보 모양으로 옮긴다**
 *
 *   provider  실제 자료를 들고 오는 곳 (채용 공고·회사·지역)
 *   normalize 그 자료를 `reality.js` 가 읽는 후보 모양으로
 *   matcher   시나리오와 맞대 본다
 *
 * `reality.js` 는 자유문장을 분류하지 않는다고 못 박아 두었다. **그 정규화가
 * 여기서 할 일이다.** 다만 여기서도 "그럴듯하게 찍는 일"은 하지 않는다.
 *
 * ── 애매하면 비운다 ────────────────────────────────────────
 * 낱말이 표에 또렷이 걸릴 때만 값을 넣고, 두 갈래에 걸치거나 아무 데도 안
 * 걸리면 `null` 이다. `null` 은 "아니다"가 아니라 **"모른다"** 이고,
 * matcher 는 모르는 칸을 어긋남으로 세지 않는다.
 *
 * ── 바깥으로 나가지 않는다 ─────────────────────────────────
 * 여기 들어 있는 provider 는 **이미 손에 있는 자료**를 읽는 것뿐이다
 * (고정 자료·파일). 네트워크를 부르는 provider 는 넣지 않았다 — 그것은
 * 키·요금·약관이 걸리는 일이라 쓰는 쪽에서 정할 몫이다. 그런 provider 를
 * 붙이려면 아래 `ProviderShape` 만 지키면 된다.
 */

import { MAJOR_ZONES } from '../../hires/location.js';

/**
 * provider 가 지켜야 할 모양.
 *
 *   id        provider 이름 (근거에 적힌다)
 *   kind      'opportunity' | 'entity' | 'fact'
 *   domain    이 provider 가 대는 분야
 *   list()    원자료 배열을 돌려준다 (동기 또는 Promise)
 */
export const ProviderShape = {
  id: 'string', kind: 'string', domain: 'string', list: '() => rows | Promise<rows>',
};

// ═════════════════════════════════════════════════════════════
// 표 — 낱말을 넓은 갈래로 옮긴다. **직업 예언표가 아니다**
// ═════════════════════════════════════════════════════════════

/** `detail.js` 의 역할 갈래와 같은 이름을 쓴다 (둘이 어긋나면 비교가 무의미하다) */
export const ROLE_LEXICON = {
  technical_analytical: ['백엔드', '프론트엔드', '서버', '개발자', '엔지니어', '데이터', '인프라',
    'SW', '소프트웨어', 'QA', '보안', '알고리즘', 'DBA'],
  research_specialist: ['연구원', '연구개발', 'R&D', '분석가', '애널리스트', '박사급'],
  management_org: ['팀장', '관리자', '매니저', 'PM', 'PO', '운영관리', '총괄'],
  sales_client: ['영업', '세일즈', '고객', 'CS', '상담', 'AE', '제휴'],
  creative_design: ['디자이너', '디자인', '브랜딩', 'UX', 'UI', '콘텐츠', '편집'],
  public_institution: ['공무원', '공공기관', '공단', '재단', '행정'],
  field_care: ['간호', '요양', '보육', '조리', '정비', '시공', '현장', '기사'],
  independent_business: ['창업', '가맹', '점주', '프랜차이즈'],
};

export const WORKSTYLE_LEXICON = {
  specialist_technical: ['시니어', '전문', '스페셜리스트', '수석'],
  management_role: ['팀장', '관리', '총괄', '리드'],
};

/** 구조화된 고용형태 값만 받는다 — 문장에서 추측하지 않는다 */
export const EMPLOYMENT_MAP = {
  'full-time': 'organization', 정규직: 'organization', 계약직: 'organization',
  contract: 'organization', intern: 'organization', 인턴: 'organization',
  freelance: 'independent', 프리랜서: 'independent',
  business: 'independent', 사업: 'independent', 자영: 'independent',
};

/** 공고의 종류 → 그것이 받쳐 줄 수 있는 사건 */
export const POSTING_EVENTS = {
  external_posting: ['first_job', 'job_change', 'return_to_work'],
  internal_posting: ['role_change', 'promotion'],
  freelance_contract: ['freelance'],
  business_listing: ['business_start'],
};

const DISTRICT = /(구|군|시)$/;

// ═════════════════════════════════════════════════════════════

/** 표에 **또렷이 하나만** 걸릴 때만 값을 준다 */
export function lexiconPick(text, lexicon) {
  const t = String(text ?? '');
  if (!t) return { value: null, reason: 'no_text' };
  const hits = [];
  for (const [key, words] of Object.entries(lexicon)) {
    const w = words.filter((x) => t.includes(x));
    if (w.length) hits.push({ key, words: w });
  }
  if (!hits.length) return { value: null, reason: 'no_match' };
  if (hits.length > 1) {
    return { value: null, reason: 'ambiguous', among: hits.map((h) => h.key) };
  }
  return { value: hits[0].key, reason: null, matched: hits[0].words };
}

/** "대전 유성구" → {metro:'대전', district:'유성구'} — 아는 도시일 때만 */
export function parseLocation(raw) {
  if (!raw) return { metro: null, district: null, reason: 'no_location' };
  if (typeof raw === 'object') {
    return {
      metro: raw.metro ?? null, district: raw.district ?? null,
      reason: raw.metro ? null : 'no_metro',
    };
  }
  const parts = String(raw).split(/[\s,]+/).filter(Boolean);
  const metro = parts.find((p) => MAJOR_ZONES.includes(p))
    ?? parts.find((p) => MAJOR_ZONES.some((z) => p.startsWith(z))) ?? null;
  const district = parts.find((p) => p !== metro && DISTRICT.test(p)) ?? null;
  return { metro, district, reason: metro ? null : 'unknown_metro' };
}

const isoDay = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d ?? '').slice(0, 10));
const daysBetween = (a, b) => Math.round((new Date(a) - new Date(b)) / 86400000);

/**
 * 채용 공고 하나를 후보로 옮긴다.
 *
 * @param {object} raw provider 가 준 원자료
 * @param {object} o   provider · retrievedAt · asOf · maxAgeDays
 * @returns {{candidate}|{rejected:true, reason, id}}
 */
export function normalizeJobPosting(raw, o = {}) {
  const provider = o.provider ?? 'unknown';
  const retrievedAt = isoDay(o.retrievedAt ?? raw?.retrievedAt ?? o.asOf ?? new Date());
  const id = raw?.id ?? null;

  if (!id) return { rejected: true, reason: 'missing_id', id: null };
  const postingType = raw.postingType ?? 'external_posting';
  const supportsEvents = POSTING_EVENTS[postingType] ?? null;
  if (!supportsEvents) return { rejected: true, reason: 'unknown_posting_type', id };

  // 너무 오래 들고 있던 자료를 "지금 열려 있는 후보"로 내지 않는다
  const maxAge = o.maxAgeDays ?? 45;
  const age = o.asOf ? daysBetween(isoDay(o.asOf), retrievedAt) : 0;
  if (age > maxAge) return { rejected: true, reason: 'stale_source', id, age };

  const text = [raw.title, raw.role, raw.description].filter(Boolean).join(' ');
  const role = lexiconPick(text, ROLE_LEXICON);
  const style = lexiconPick(text, WORKSTYLE_LEXICON);
  const employmentSetting = EMPLOYMENT_MAP[raw.employmentType] ?? null;
  const loc = parseLocation(raw.location);

  return {
    candidate: {
      id,
      domain: 'career',
      kind: 'opportunity',
      supportsEvents,
      detail: {
        roleFamily: role.value,
        workStyle: style.value,
        employmentSetting,
        // 산업군은 표가 없다. 없는 표로 값을 만들지 않는다
        industryFamily: null,
      },
      ...(raw.company?.name || raw.companyName
        ? { company: { name: raw.company?.name ?? raw.companyName } } : {}),
      ...(loc.metro || loc.district
        ? { location: { metro: loc.metro, district: loc.district } } : {}),
      ...(raw.opensAt || raw.closesAt
        ? { validity: { from: isoDay(raw.opensAt ?? raw.closesAt), to: isoDay(raw.closesAt ?? raw.opensAt) } }
        : {}),
      source: { id: raw.sourceId ?? `${provider}:${id}`, sourceType: 'reality', provider, retrievedAt },
      /** 무엇을 무엇으로 옮겼는지 — 되짚을 수 있어야 한다 */
      normalizedFrom: {
        roleFamily: role.value ? { matched: role.matched } : { skipped: role.reason, among: role.among ?? null },
        workStyle: style.value ? { matched: style.matched } : { skipped: style.reason },
        employmentSetting: employmentSetting
          ? { from: raw.employmentType } : { skipped: 'no_structured_employment_type' },
        location: loc.reason ? { skipped: loc.reason } : { from: raw.location },
        postingType,
      },
    },
  };
}

/** 회사 자체 — **미래의 채용이 아니다.** 성격을 견주는 데만 쓴다 */
export function normalizeCompany(raw, o = {}) {
  const provider = o.provider ?? 'unknown';
  const id = raw?.id ?? null;
  if (!id) return { rejected: true, reason: 'missing_id', id: null };
  const text = [raw.name, raw.industry, raw.description].filter(Boolean).join(' ');
  const role = lexiconPick(text, ROLE_LEXICON);
  const loc = parseLocation(raw.location);
  return {
    candidate: {
      id, domain: 'career', kind: 'entity',
      supportsEvents: raw.supportsEvents ?? ['job_change', 'first_job'],
      detail: { roleFamily: role.value, workStyle: null, employmentSetting: 'organization', industryFamily: null },
      ...(raw.name ? { company: { name: raw.name } } : {}),
      ...(loc.metro || loc.district ? { location: { metro: loc.metro, district: loc.district } } : {}),
      source: { id: raw.sourceId ?? `${provider}:${id}`, sourceType: 'reality', provider,
        retrievedAt: isoDay(o.retrievedAt ?? new Date()) },
      normalizedFrom: { roleFamily: role.value ? { matched: role.matched } : { skipped: role.reason },
        location: loc.reason ? { skipped: loc.reason } : { from: raw.location } },
    },
  };
}

const NORMALIZERS = { opportunity: normalizeJobPosting, entity: normalizeCompany };

/** 손에 있는 자료로 만드는 provider (네트워크를 쓰지 않는다) */
export function fixtureProvider({ id, kind = 'opportunity', domain = 'career', rows = [] }) {
  return { id, kind, domain, list: () => rows };
}

/**
 * provider 들에게서 자료를 받아 후보로 옮긴다.
 *
 * **여기서 거른 것도 남긴다.** 조용히 사라지면 "후보가 없다"와 "자료가
 * 잘못됐다"를 가릴 수 없다.
 *
 * @param {object} o providers · asOf · maxAgeDays · limit
 */
export async function fetchCandidates(o = {}) {
  const { providers = [], asOf = null, maxAgeDays = 45, limit = 50 } = o;
  const candidates = [];
  const rejected = [];
  const byProvider = {};

  for (const p of providers) {
    let rows = [];
    try {
      rows = await p.list();
    } catch (err) {
      rejected.push({ provider: p.id, reason: 'provider_failed', detail: String(err?.message ?? err) });
      continue;
    }
    const norm = NORMALIZERS[p.kind];
    if (!norm) { rejected.push({ provider: p.id, reason: 'unknown_provider_kind' }); continue; }

    let ok = 0;
    for (const raw of rows ?? []) {
      const r = norm(raw, { provider: p.id, asOf, maxAgeDays, retrievedAt: raw?.retrievedAt });
      if (r.rejected) { rejected.push({ provider: p.id, id: r.id, reason: r.reason }); continue; }
      candidates.push(r.candidate); ok++;
    }
    byProvider[p.id] = { rows: rows?.length ?? 0, accepted: ok };
  }

  // 후보 id 순 — 들어온 순서가 아래 층의 근거 번호를 흔들지 않게
  candidates.sort((a, b) => String(a.id).localeCompare(String(b.id)));

  return {
    candidates: candidates.slice(0, limit),
    rejected,
    meta: {
      providers: providers.map((p) => p.id),
      byProvider,
      asOf: asOf ? isoDay(asOf) : null,
      deterministic: true,
      note: '정규화되지 않은 칸은 null 이고, 그것은 "모른다"이지 "아니다"가 아니다',
    },
  };
}

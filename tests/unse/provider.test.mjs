/**
 * Reality provider / normalizer — **바깥 자료를 옮기되 지어내지 않는가**
 *
 * 여기서 재는 것은 얼마나 많이 채우는가가 아니라, **못 읽은 칸을 비워 두는가**
 * 다. 애매한 공고를 그럴듯한 갈래로 찍어 넣으면 아래 층 전체가 그 추측 위에
 * 서게 된다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  fetchCandidates, fixtureProvider, normalizeJobPosting, normalizeCompany,
  lexiconPick, parseLocation, answerWithReality, composeScenario, matchReality,
} from '../../public/unse/src/semantic/scenario/index.js';
import {
  ROLE_LEXICON, POSTING_EVENTS, EMPLOYMENT_MAP,
} from '../../public/unse/src/semantic/scenario/provider.js';

const BIRTH = {
  name: 'x', gender: 'female', year: 1992, month: 1, day: 30,
  hour: 16, minute: 28, birthPlace: '여주', homePlace: '대전',
};
const NOW = new Date('2026-09-24T00:00:00Z');
const ASOF = '2026-09-24';

const post = (o) => ({ postingType: 'external_posting', employmentType: '정규직', ...o });

// ── 1~3. 낱말을 갈래로 옮기되 애매하면 비운다 ────────────────

test('1. 또렷이 하나만 걸릴 때만 갈래를 준다', () => {
  assert.equal(lexiconPick('백엔드 개발자', ROLE_LEXICON).value, 'technical_analytical');
  assert.equal(lexiconPick('간호조무사', ROLE_LEXICON).value, 'field_care');
  // 두 갈래에 걸치면 고르지 않는다
  const amb = lexiconPick('영업 관리자', ROLE_LEXICON);
  assert.equal(amb.value, null);
  assert.equal(amb.reason, 'ambiguous');
  assert.ok(amb.among.length >= 2);
  // 아무 데도 안 걸리면 모른다
  assert.equal(lexiconPick('무언가 하는 사람', ROLE_LEXICON).reason, 'no_match');
  assert.equal(lexiconPick('', ROLE_LEXICON).reason, 'no_text');
  // 갈래 이름은 detail.js 와 같은 것을 쓴다 (다르면 비교가 무의미하다)
  for (const k of Object.keys(ROLE_LEXICON)) assert.match(k, /^[a-z_]+$/);
});

test('2. 아는 도시일 때만 지역을 읽는다', () => {
  assert.deepEqual(parseLocation('대전 유성구'), { metro: '대전', district: '유성구', reason: null });
  assert.equal(parseLocation('해운대').metro, null, '모르는 지명을 도시로 만들었다');
  assert.equal(parseLocation('해운대').reason, 'unknown_metro');
  assert.equal(parseLocation(null).reason, 'no_location');
  // 이미 정규화된 값은 그대로 받는다
  assert.deepEqual(parseLocation({ metro: '부산', district: '해운대구' }),
    { metro: '부산', district: '해운대구', reason: null });
});

test('3. 공고 하나를 후보로 옮기고 무엇을 못 옮겼는지 남긴다', () => {
  const ok = normalizeJobPosting(post({
    id: 'P1', title: '백엔드 개발자 (시니어)', location: '대전 유성구',
    companyName: '대덕넷웍스', opensAt: '2028-02-01', closesAt: '2028-05-31',
  }), { provider: 'fx', asOf: ASOF, retrievedAt: ASOF }).candidate;

  assert.equal(ok.kind, 'opportunity');
  assert.equal(ok.domain, 'career');
  assert.deepEqual(ok.supportsEvents, POSTING_EVENTS.external_posting);
  assert.equal(ok.detail.roleFamily, 'technical_analytical');
  assert.equal(ok.detail.workStyle, 'specialist_technical');
  assert.equal(ok.detail.employmentSetting, 'organization');
  assert.equal(ok.detail.industryFamily, null, '표가 없는 칸을 채웠다');
  assert.equal(ok.company.name, '대덕넷웍스');
  assert.deepEqual(ok.location, { metro: '대전', district: '유성구' });
  assert.deepEqual(ok.validity, { from: '2028-02-01', to: '2028-05-31' });
  assert.equal(ok.source.sourceType, 'reality');
  assert.ok(ok.source.id && ok.source.provider === 'fx' && ok.source.retrievedAt);
  assert.ok(ok.normalizedFrom.roleFamily.matched.length, '무엇에 걸렸는지 남긴다');

  // 못 읽은 칸은 비우고 왜 못 읽었는지 적는다
  const vague = normalizeJobPosting(post({ id: 'P3', title: '무언가 하는 사람', location: '해운대' }),
    { provider: 'fx', asOf: ASOF, retrievedAt: ASOF }).candidate;
  assert.equal(vague.detail.roleFamily, null);
  assert.equal(vague.normalizedFrom.roleFamily.skipped, 'no_match');
  assert.equal(vague.location, undefined, '모르는 지명으로 location 을 만들었다');
  assert.equal(vague.normalizedFrom.location.skipped, 'unknown_metro');
  // 고용형태는 구조화된 값에서만 온다
  assert.equal(normalizeJobPosting(post({ id: 'P4', title: 'x', employmentType: '알수없음' }),
    { provider: 'fx', asOf: ASOF, retrievedAt: ASOF }).candidate.detail.employmentSetting, null);
  assert.equal(EMPLOYMENT_MAP['프리랜서'], 'independent');
});

// ── 4~5. 거르는 자리 ─────────────────────────────────────────

test('4. 쓸 수 없는 자료는 조용히 버리지 않고 이유를 남긴다', async () => {
  const rows = [
    post({ id: 'GOOD', title: '백엔드 개발자', retrievedAt: ASOF }),
    post({ title: '아이디 없음' }),
    post({ id: 'OLD', title: '옛 공고', retrievedAt: '2026-01-01' }),
    post({ id: 'WEIRD', title: 'x', postingType: 'made_up' }),
  ];
  const r = await fetchCandidates({ providers: [fixtureProvider({ id: 'fx', rows })], asOf: ASOF });
  assert.deepEqual(r.candidates.map((c) => c.id), ['GOOD']);
  const why = Object.fromEntries(r.rejected.map((x) => [x.id ?? 'null', x.reason]));
  assert.equal(why.null, 'missing_id');
  assert.equal(why.OLD, 'stale_source');
  assert.equal(why.WEIRD, 'unknown_posting_type');
  assert.equal(r.meta.byProvider.fx.rows, 4);
  assert.equal(r.meta.byProvider.fx.accepted, 1);

  // provider 가 터져도 답이 무너지지 않는다
  const bad = { id: 'boom', kind: 'opportunity', domain: 'career', list: () => { throw new Error('네트워크'); } };
  const r2 = await fetchCandidates({ providers: [bad], asOf: ASOF });
  assert.deepEqual(r2.candidates, []);
  assert.equal(r2.rejected[0].reason, 'provider_failed');
});

test('5. 회사 자체는 entity 로 들어오고 미래 채용이 되지 않는다', async () => {
  const co = fixtureProvider({ id: 'co', kind: 'entity',
    rows: [{ id: 'C1', name: '대덕연구소', industry: '연구개발', location: '대전 유성구' }] });
  const r = await fetchCandidates({ providers: [co], asOf: ASOF });
  const c = r.candidates[0];
  assert.equal(c.kind, 'entity');
  assert.equal(c.detail.roleFamily, 'research_specialist');
  assert.equal(c.validity, undefined, '회사 자체에 기간을 만들었다');

  const s = composeScenario({ birth: BIRTH, question: '나 이직하게 될까?', now: NOW,
    from: '2027-01', to: '2029-12', currentState: { employmentType: 'employed' } }).scenario;
  const m = matchReality(s, [{ ...c, supportsEvents: [s.primary.event.type] }]);
  const hit = m.primaryMatches[0];
  assert.equal(hit.timeRelation, 'not_applicable');
  assert.notEqual(hit.matchMode, 'direct', '회사 자체를 미래 채용으로 올렸다');
});

// ── 6~8. 끝까지 이어 붙이기 ──────────────────────────────────

test('6. provider → 정규화 → 맞대기 → 문장이 이어진다', async () => {
  const base = { birth: BIRTH, question: '나 이직하게 될까? 어디쯤일까?', now: NOW,
    from: '2027-01', to: '2029-12',
    currentState: { employmentType: 'employed', occupation: '백엔드 개발자' } };
  const w = composeScenario(base).scenario.primary.timing;
  const ev = composeScenario(base).scenario.primary.event.type;

  // 시나리오의 사건을 실제로 받쳐 주는 종류의 공고를 넣는다
  const kind = Object.entries(POSTING_EVENTS).find(([, v]) => v.includes(ev))?.[0] ?? 'external_posting';
  const rows = [post({ id: 'B1', title: '프랜차이즈 가맹점주 모집', employmentType: '사업',
    location: '대전 유성구', companyName: '한밭프랜차이즈',
    opensAt: `${w.from}-01`, closesAt: `${w.to}-28`, postingType: kind, retrievedAt: ASOF })];

  const r = await answerWithReality({ ...base, providers: [fixtureProvider({ id: 'jobs', rows })],
    asOf: ASOF, narrate: { detail: 'full' } });

  assert.equal(r.fetched.candidates.length, 1);
  assert.equal(r.realityMatch.audit.ok, true);
  assert.equal(r.narration.meta.auditOk, true, JSON.stringify(r.narration.meta.issues));
  assert.match(r.narration.sections.reality, /한밭프랜차이즈/);
  assert.match(r.narration.sections.reality, /운세가 짚은 회사가 아니고/);
  // 시나리오 자체는 여전히 회사·도시를 비워 둔다
  assert.equal(r.scenario.primary.company, null);
  assert.equal(r.scenario.primary.location.metro, null);
});

test('7. 사건을 받쳐 주지 않는 공고는 겹친다고 하지 않는다', async () => {
  const base = { birth: BIRTH, question: '나 이직하게 될까?', now: NOW,
    from: '2027-01', to: '2029-12', currentState: { employmentType: 'employed' } };
  const s = composeScenario(base).scenario;
  const w = s.primary.timing;
  // 이 명반의 대표 사건을 받치지 않는 종류만 넣는다
  const rows = [post({ id: 'P1', title: '백엔드 개발자', location: '대전 유성구',
    companyName: '대덕넷웍스', opensAt: `${w.from}-01`, closesAt: `${w.to}-28`, retrievedAt: ASOF })];
  const r = await answerWithReality({ ...base, providers: [fixtureProvider({ id: 'jobs', rows })],
    asOf: ASOF, narrate: { detail: 'full' } });

  const supported = POSTING_EVENTS.external_posting.includes(s.primary.event.type);
  if (!supported) {
    assert.match(r.narration.sections.reality, /조건이 겹치는 것은 없습니다/);
    assert.ok(!/대덕넷웍스/.test(r.narration.text), '받치지도 않는 공고 이름을 댔다');
  }
  assert.equal(r.narration.meta.auditOk, true);
});

test('8. 자료가 없어도 답은 나오고, 같은 입력이면 같다', async () => {
  const base = { birth: BIRTH, question: '나 이직하게 될까?', now: NOW,
    from: '2027-01', to: '2029-12', currentState: { employmentType: 'employed' } };
  const none = await answerWithReality({ ...base, providers: [], asOf: ASOF });
  assert.ok(none.narration.text.length > 20, '자료가 없다고 답이 사라졌다');
  assert.equal(none.realityMatch, null);
  assert.deepEqual(none.fetched.candidates, []);

  const rows = [post({ id: 'P1', title: '백엔드 개발자', location: '대전 유성구',
    companyName: '대덕넷웍스', retrievedAt: ASOF })];
  const opts = { ...base, providers: [fixtureProvider({ id: 'jobs', rows })], asOf: ASOF };
  const a = await answerWithReality(opts);
  const b = await answerWithReality(opts);
  assert.equal(a.narration.text, b.narration.text);
  assert.deepEqual(a.fetched.candidates, b.fetched.candidates);
  assert.deepEqual(a.realityMatch.evidence, b.realityMatch.evidence);
  // 들어온 순서가 근거 번호를 흔들지 않는다
  const rev = await fetchCandidates({
    providers: [fixtureProvider({ id: 'jobs', rows: [...rows].reverse() })], asOf: ASOF });
  const fwd = await fetchCandidates({ providers: [fixtureProvider({ id: 'jobs', rows })], asOf: ASOF });
  assert.deepEqual(rev.candidates.map((c) => c.id), fwd.candidates.map((c) => c.id));
});

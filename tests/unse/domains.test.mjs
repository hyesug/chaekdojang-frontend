/**
 * 열두 분야 층 — 구조를 고정한다.
 *
 * 직업만 깊고 나머지는 빈약한 상태로 돌아가지 않게 막는 검사들이다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { natalFortune, readPerson } from '../../public/unse-8f3k2m/src/semantic/index.js';
import {
  DOMAINS, DOMAIN_LABEL, coverage, gather, interpretDomain,
  DOMAIN_RULES, domainRuleFor, NATURE_FILLED,
} from '../../public/unse-8f3k2m/src/semantic/domains.js';
import { RULES } from '../../public/unse-8f3k2m/src/semantic/rules.js';
import { SYSTEM_IDS } from '../../public/unse-8f3k2m/src/semantic/extract.js';
import { AXES } from '../../public/unse-8f3k2m/src/semantic/axes.js';
import { PROJECTION, TRAIT_LABEL, projectNature, TRIGRAM_NATURE } from '../../public/unse-8f3k2m/src/semantic/tables/nature.js';

const BIRTH = {
  gender: 'female', year: 1992, month: 1, day: 30,
  hour: 16, minute: 28, birthPlace: '여주', homePlace: '대전',
};

test('열두 분야가 모두 있고 축이 비어 있지 않다', () => {
  assert.equal(DOMAINS.length, 12);
  for (const d of DOMAINS) {
    assert.ok(AXES[d]?.length, `${d} 에 축이 없다`);
    assert.ok(DOMAIN_LABEL[d], `${d} 에 우리말 이름이 없다`);
  }
});

test('열다섯 체계가 열두 분야에 모두 규칙을 갖는다', () => {
  const cov = coverage();
  for (const id of SYSTEM_IDS) {
    for (const d of DOMAINS) {
      if (d === 'career') {
        assert.ok(RULES.some((r) => r.system === id && r.domain === 'career'), `${id} 직업 규칙 없음`);
        continue;
      }
      assert.ok(cov[id][d].total > 0, `${id} × ${DOMAIN_LABEL[d]} 규칙이 하나도 없다`);
    }
  }
});

test('핵심 넷은 모든 분야에 직접 근거를 갖는다', () => {
  const cov = coverage();
  for (const id of ['saju', 'jamidusu', 'astrology', 'vedic']) {
    for (const d of DOMAINS) {
      if (d === 'career') continue;
      assert.ok(cov[id][d].direct > 0, `${id} × ${DOMAIN_LABEL[d]} 에 직접 근거가 없다`);
    }
  }
});

test('전용 자리가 없는 체계는 물상으로만 읽고 그렇다고 표시된다', () => {
  const cov = coverage();
  for (const id of ['juyeok', 'tojeong', 'tarot', 'thai']) {
    for (const d of DOMAINS) {
      if (d === 'career') continue;
      assert.equal(cov[id][d].direct, 0, `${id} 에 없는 전용 자리가 생겼다`);
      assert.equal(cov[id][d].mark, '△');
    }
  }
  assert.ok(NATURE_FILLED.size > 0, '물상으로 채운 칸이 기록된다');
});

test('물상은 축이 아니라 전통 어휘다 — 스물넷을 넘기지 않는다', () => {
  assert.equal(Object.keys(TRAIT_LABEL).length, 24);
  for (const [domain, table] of Object.entries(PROJECTION)) {
    for (const [trait, axes] of Object.entries(table)) {
      assert.ok(TRAIT_LABEL[trait], `${domain} 에 없는 물상 ${trait}`);
      for (const ax of Object.keys(axes)) {
        assert.ok(AXES[domain].includes(ax), `${domain}.${trait} 이 없는 축 ${ax} 을 가리킨다`);
      }
    }
  }
});

test('같은 물상이 분야마다 다른 얼굴을 갖는다', () => {
  // 坎(물) — 관계에서는 감추는 인연, 이동에서는 자주 옮김
  const rel = projectNature(TRIGRAM_NATURE.坎, 'relationship');
  const mov = projectNature(TRIGRAM_NATURE.坎, 'movement');
  assert.ok(rel.autonomy > 0 || rel.volatility > 0);
  assert.ok(mov.mobile > 0);
  assert.notDeepEqual(Object.keys(rel).sort(), Object.keys(mov).sort());
});

test('근거 사슬이 기호 → 물상 → 축 으로 남는다', () => {
  const { fortune, stack } = natalFortune({ ...BIRTH, name: 'x' });
  const raw = gather(fortune, stack);
  const reads = interpretDomain(raw, 'movement');
  const spoke = reads.filter((r) => r.status === 'ok');
  assert.ok(spoke.length >= 10, `이동을 말한 체계 ${spoke.length}`);
  const withNature = spoke.flatMap((r) => r.evidence).filter((e) => e.nature);
  assert.ok(withNature.length, '물상이 근거에 적힌다');
  assert.match(withNature[0].nature, /물상/);
  for (const e of spoke.flatMap((r) => r.evidence)) {
    assert.ok(e.rule && e.source && e.basis, '규칙·자리·근거가 모두 있다');
  }
});

test('열두 분야가 실제로 답을 낸다', () => {
  const r = readPerson({ ...BIRTH, name: 'x' });
  for (const d of DOMAINS) {
    const v = r.domains[d];
    assert.ok(v, `${d} 결과가 없다`);
    assert.ok(v.spokeCount >= 10, `${DOMAIN_LABEL[d]} 를 말한 체계가 ${v.spokeCount} 뿐`);
    assert.ok(v.features, `${DOMAIN_LABEL[d]} 축 벡터가 비었다`);
    assert.ok(v.leading.length, `${DOMAIN_LABEL[d]} 에 두드러진 축이 없다`);
    for (const ax of Object.keys(v.features)) {
      assert.ok(AXES[d].includes(ax), `${d} 에 없는 축 ${ax}`);
    }
  }
});

test('건강과 시기는 넘지 말아야 할 선을 문장으로 달고 나간다', () => {
  const r = readPerson({ ...BIRTH, name: 'x' }, { domains: ['health', 'timing'] });
  assert.equal(r.domains.health.notMedical, true);
  assert.match(r.domains.health.caution, /질환명/);
  assert.match(r.domains.timing.note, /연도를 말하지 않는다/);
});

test('같은 입력이면 열두 분야가 모두 똑같다', () => {
  const a = readPerson({ ...BIRTH, name: 'x' });
  const b = readPerson({ ...BIRTH, name: 'x' });
  for (const d of DOMAINS) assert.deepEqual(a.domains[d].profile, b.domains[d].profile, d);
});

test('시각을 모르면 자미·점성만 빠지고 나머지는 열두 분야를 계속 말한다', () => {
  const r = readPerson({ ...BIRTH, name: 'x', hour: undefined, minute: undefined });
  for (const d of DOMAINS) {
    const v = r.domains[d];
    const byId = Object.fromEntries(v.systems.map((s) => [s.system, s]));
    assert.equal(byId.jamidusu.status, 'unavailable', `${d}: 자미가 시각 없이 판을 세웠다`);
    assert.equal(byId.saju.status, 'ok', `${d}: 사주는 시각 없이도 말한다`);
    assert.ok(v.features, `${d}: 나머지로 답이 나온다`);
  }
});

test('규칙마다 전통강도·좁기·증거등급이 붙어 있다', () => {
  for (const r of DOMAIN_RULES) {
    assert.ok(r.traditionalStrength > 0 && r.traditionalStrength <= 1, r.id);
    assert.ok(r.specificity >= 0 && r.specificity <= 1, r.id);
    assert.ok(['direct', 'indirect', 'weak'].includes(r.evidenceType), r.id);
    assert.ok(Object.keys(r.features).length, `${r.id} 에 축이 없다`);
    for (const k of Object.keys(r.features)) {
      assert.ok(AXES[r.domain].includes(k), `${r.id} 에 없는 축 ${k}`);
    }
  }
  assert.ok(domainRuleFor('jamidusu', 'marriage', 'star:천부'), '자미 부처궁 천부 규칙이 있다');
  assert.ok(domainRuleFor('saju', 'personality', 'god:정관'), '사주 정관 기질 규칙이 있다');
});

/**
 * year.js — **한 해를 칸으로 펼친다**
 *
 * `life.js` 가 평생을 장으로 잘랐다면 여기는 그 안의 한 해다. 칸은 다섯이고,
 * 칸마다 그 자리를 보는 체계의 말을 **나란히** 둔다 — 합치지도 고르지도
 * 않는다(`compose/slots.js` 와 같은 방식이고, 같은 이유다).
 *
 *   어느 장인가       그 해가 일곱 구간 중 어디에 들어 있나
 *   그 해의 색        세운 십성 · 자미 유년사화 · 구성 · 카발라 개인년 · 토정 괘 · 타로
 *   원국과 부딪히나    태세 지지 × 원국 네 기둥의 충·합·형
 *   달력이 정한 것     본명년 · 환갑
 *   장이 바뀌는가      둘 이상의 구간이 그 해에 함께 바뀌나
 *
 * ── 좋다·나쁘다를 말하지 않는다 ────────────────────────────
 * `annualTrack` 이 `harmony` 와 `friction` 을 숫자로 낸다. 그것을 "힘든 해"로
 * 옮기지 않는다. **충이 많으면 나쁜 해라는 것은 유파가 갈리고 이 저장소가
 * 검증한 적이 없다.** 대신 **어디가** 부딪히는지를 적는다 — 재성끼리 부딪히는
 * 것과 배우자궁이 부딪히는 것은 전혀 다른 이야기이고, 그 구별은 확정 계산이다.
 *
 * ── 달까지 내려가지 않는다 ─────────────────────────────────
 * 달 단위 시기는 독립된 두 표본에서 모두 기준선보다 나빴다(p=0.868).
 * 이 층은 해까지만 단정한다.
 */
import { annualTrack } from '../../hires/bazi.js';
import { buildBoard, annualLayer } from '../../hires/ziwei.js';
import { dashaTree, dashaChanges } from '../../hires/vedic.js';
import { natalPack } from '../../hires/western.js';
import { profection } from '../../hires/westernExt.js';
import { chaptersAt, chapterTurns } from './life.js';
import { positions } from '../structure/saju.js';
import { j } from '../../core/josa.js';

import * as gujeong from '../../systems/gujeong.js';
import * as kabbalah from '../../systems/kabbalah.js';
import * as tojeong from '../../systems/tojeong.js';
import * as tarot from '../../systems/tarot.js';

/**
 * 보조 체계를 다른 해로 돌린다.
 *
 * **두 연도 필드를 같이 옮겨야 한다.** 구성·토정은 입춘 기준 `currentYear` 를,
 * 카발라 개인년은 양력 기준 `civilYear` 를 본다(개인년은 1월 1일에 바뀌므로
 * 입춘 기준을 쓰면 1월생이 한 해 밀린다). 하나만 옮기면 그 체계만 제자리에
 * 남는다 — 실제로 그렇게 헤맸다.
 */
const shiftYear = (input, year) => ({ ...input, currentYear: year, civilYear: year });

/** 그 체계가 그 해에 대해 한 말 가운데 첫 읽기 */
function say(mod, input, year, titleRe) {
  try {
    const r = mod.analyze(shiftYear(input, year));
    const hit = (r.readings ?? []).find((x) => !x.mono && titleRe.test(x.title));
    return hit ? { what: hit.title, text: hit.text } : null;
  } catch { return null; }
}

/**
 * 한 해를 펼친다.
 *
 * @param {object} input     `readFortune(...).input`
 * @param {object} chart     `readFortune(...).chart`
 * @param {number} year      볼 해 (서기)
 * @param {object[]} chapters `lifeChapters(...)` 결과
 */
export function yearSlots(input, chart, year, chapters = []) {
  const age = year - input.year;
  const track = annualTrack(input, chart, year, year)[0] ?? null;

  // ── ① 어느 장인가 ──
  const inChapters = chaptersAt(chapters, year).map((c) => ({
    system: c.system, what: c.what,
    text: `${c.fromYear}~${c.toYear}년 (${c.fromAge}~${c.toAge}세) ${c.label}`
      + (c.detail ? ` — ${c.detail}` : ''),
  }));

  // ── ② 그 해의 색 ──
  const tone = [];
  if (track) {
    tone.push({
      system: '사주', what: `세운 ${track.gz.kr}(${track.gz.hanja})`,
      text: `천간이 ${track.god}, 지지가 ${track.branchGod}입니다.`
        + ` 대운은 ${track.daeun.kr}(${track.daeun.god}) 구간 안입니다.`
        + (track.daeunTurn ? ' **이 해에 대운이 바뀝니다.**' : ''),
    });
  }
  try {
    const b = buildBoard(input);
    const al = annualLayer(b, year);
    const gi = (al.sihwa ?? []).find((x) => /화기/.test(x.kind ?? x.label ?? ''));
    const rok = (al.sihwa ?? []).find((x) => /화록/.test(x.kind ?? x.label ?? ''));
    tone.push({
      system: '자미두수', what: `유년 ${al.gz} — 원국의 ${al.palaceOfNatal}`,
      text: `그 해의 명궁이 원국의 ${al.palaceOfNatal} 자리에 옵니다.`
        + (rok ? ` 화록은 ${rok.star}.` : '')
        + (gi ? ` 화기는 ${gi.star} — 그 별이 든 자리가 그 해 가장 애먹는 영역입니다.` : ''),
    });
  } catch { /* 시각을 모르면 판이 안 선다 */ }

  for (const [mod, name, re] of [
    [gujeong, '구성학', /9년 주기/],
    [kabbalah, '카발라', /개인년/],
    [tojeong, '토정비결', /^\d{4}년 —/],
    [tarot, '타로', /상황|과제/],
  ]) {
    const s = say(mod, input, year, re);
    if (s) tone.push({ system: name, what: s.what, text: s.text });
  }

  try {
    const N = natalPack(input);
    const p = profection(input, N, Math.max(0, age));
    if (p) {
      tone.push({
        system: '고전 서양', what: `연간 프로펙션 — ${p.house}하우스`,
        text: `그 해의 무대는 ${p.house}하우스(${p.topic})이고, 주인은 ${p.timeLord}입니다.`
          + ` 그 ${j(p.timeLord, '은')} 원국의 ${p.lordNatalHouse}하우스 ${p.lordNatalSign}에 있습니다`
          + ` — 사건이 터지는 자리는 거기입니다.`,
      });
    }
  } catch { /* 시각 미상 */ }

  // ── ③ 원국과 부딪히나 — **어디가** 부딪히는지 적는다 ──
  //
  // "월주와 충" 으로 끝내면 쓸모가 없다. 월지에 무엇이 앉아 있느냐가
  // 그 충의 뜻을 정한다 — 재성이면 돈 자리가 부딪히는 것이고 일지면
  // 배우자궁이 흔들리는 것이라, 전혀 다른 이야기다. 그 구별은 확정 계산이다.
  const friction = [];
  if (track?.hits?.length) {
    let seats = [];
    try {
      seats = positions({ ...chart, gender: input.gender }).map((p) => ({
        pos: p.pos, god: p.branchGod, of: p.seat.of, age: p.seat.age,
      }));
    } catch { seats = []; }
    const whatIsAt = (posName) => seats.find((s) => s.pos === posName);

    // 같은 기둥에 여럿이 걸리면 한 줄로 묶는다. 안 묶으면 "월주와 충 —
    // 그 자리에 편재가…. 월주와 삼형 — 그 자리에 편재가…" 로 같은 설명이
    // 반복된다.
    const byPillar = new Map();
    const others = [];
    for (const h of track.hits) {
      const m = h.match(/^([년월일시])주와?과? (.+)$/) ?? h.match(/^([년월일시])주[와과] (.+)$/);
      if (m) {
        const list = byPillar.get(m[1]) ?? [];
        list.push(m[2]);
        byPillar.set(m[1], list);
      } else { others.push(h); }
    }

    const lines = [];
    for (const [pos, kinds] of byPillar) {
      const s = whatIsAt(pos);
      lines.push(`${pos}주와 ${kinds.join('·')}`
        + (s ? ` — 그 자리에 ${j(s.god, '이')} 앉아 있습니다 (${s.of}의 자리, ${s.age})` : ''));
    }
    if (others.length) lines.push(others.join(' · '));

    friction.push({
      system: '사주', what: '태세와 원국',
      text: `${lines.join('. ')}.`
        + (track.combos?.length ? ` 그리고 ${track.combos.join(' · ')}.` : ''),
    });
  }
  if (track && !track.hits?.length && !track.combos?.length) {
    friction.push({
      system: '사주', what: '태세와 원국',
      text: '그 해 태세가 원국 네 기둥과 충·합·형을 이루지 않습니다. 조용히 지나가는 해입니다.',
    });
  }

  // ── ④ 달력이 정한 것 ──
  const calendar = [];
  if (track?.zodiacReturn) {
    calendar.push({
      system: '사주', what: '본명년',
      text: `태어난 해와 같은 띠가 돌아오는 해입니다(${age}세). 열두 해마다 옵니다.`,
    });
  }
  if (track?.sexagenaryReturn) {
    calendar.push({
      system: '사주', what: '환갑',
      text: '원국 년주와 그 해 태세의 간지가 같아지는 해입니다. 육십갑자가 한 바퀴 돌았습니다.'
        + ' 한국에서는 이 해에 기념 여행·잔치·가족 모임이 실제로 몰립니다 —'
        + ' 명반이 만든 사건이 아니라 달력이 만든 사건입니다.',
    });
  }

  // ── ⑤ 장이 바뀌는가 ──
  const turn = chapterTurns(chapters, { from: year, to: year, minSystems: 1, birthYear: input.year })
    .flatMap((t) => t.starts)
    .map((c) => ({ system: c.system, what: `${c.what} 시작`, text: `${c.label}${c.detail ? ` — ${c.detail}` : ''}` }));

  // 다샤 하위 구간(AD)이 그 해에 바뀌는지 — MD 만큼은 아니어도 결이 바뀐다
  try {
    const tree = dashaTree(input, 2);
    for (const c of dashaChanges(tree, year, year)) {
      turn.push({
        system: '베딕', what: `${c.level === 'MD' ? '마하다샤' : '안타르다샤'} 전환`,
        text: `${c.from.y}-${String(c.from.m).padStart(2, '0')}-${String(c.from.d).padStart(2, '0')}`
          + ` 부터 ${c.lord} 구간.`,
      });
    }
  } catch { /* 넘어간다 */ }

  // MD 와 AD 가 같은 순간에 바뀌면 같은 문장이 두 번 난다. 겹치는 줄을 지운다.
  const seenTurn = new Set();
  const turnUniq = turn.filter((t) => {
    const k = `${t.system}|${t.text}`;
    if (seenTurn.has(k)) return false;
    seenTurn.add(k);
    return true;
  });

  return [
    { key: 'chapter', label: '어느 장인가', ask: '지금 인생의 어느 대목인가', voices: inChapters },
    { key: 'tone', label: '그 해의 색', ask: '무엇이 들어오는 해인가', voices: tone },
    { key: 'friction', label: '원국과 부딪히나', ask: '어디가 흔들리나', voices: friction },
    { key: 'calendar', label: '달력이 정한 것', ask: '나이가 만드는 사건이 있나', voices: calendar },
    { key: 'turn', label: '장이 바뀌는가', ask: '이 해가 경계인가', voices: turnUniq },
  ].map((s) => ({ ...s, empty: s.voices.length === 0 }));
}

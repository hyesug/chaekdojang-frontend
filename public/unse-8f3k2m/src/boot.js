/**
 * boot.js — 첫 화면에 필요한 것만
 *
 * 브라우저가 처음 받는 파일이다. 여기서 하는 일은 **폼을 쓸 수 있게 만드는
 * 것까지**다. 계산 엔진과 결과 화면은 손대지 않는다.
 *
 * 왜 갈랐는가.
 *   예전에는 ui.js 하나가 엔진·해석문·카드 그리기까지 전부 끌고 들어왔다.
 *   그래서 생년월일을 적는 동안에도 쓰지 않을 코드를 다 받아놓고 기다렸다.
 *   폼 화면에 필요한 것은 도시 목록과 판 번호뿐인데 그 몇 배를 받은 셈이다.
 *
 *   이제 무거운 쪽은 ui.js 로 몰아 두고 '풀이 보기'를 누를 때 받아온다.
 *   실제로는 그때도 기다리지 않는다 — 폼에 처음 손을 대는 순간 미리
 *   받아두기 때문이다. 사람이 생년월일을 적는 몇 초가 곧 내려받는 시간이 된다.
 *
 * 여기에 둘 것과 두지 말 것.
 *   둘 것    — DOM 배선, 입력 도움(도시 목록), 진행 표시, 판 번호
 *   두지 말 것 — 계산, 해석문, 카드 그리기, 공유 링크 해석
 *   import 를 하나 더 붙이기 전에 그것이 폼을 띄우는 데 꼭 필요한지 보라.
 *   share.js 는 reading.js(해석문 113KB)를 끌고 들어오므로 특히 조심한다.
 */

import { CITIES } from './core/place.js';
import { ENGINE_VERSION, CALC_CHANGES } from './meta.js';
import { loadProfile } from './profile.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ─────────────────────────────────────────────────────────────
// 무거운 쪽 불러오기
// ─────────────────────────────────────────────────────────────

/**
 * ui.js 와 그 아래 엔진 전부. 한 번만 받고 그다음부터는 받아둔 것을 쓴다.
 * esbuild 가 이 import() 를 보고 따로 떼어 낸다.
 */
let pending = null;
const loadUI = () => (pending ??= import('./ui.js'));

// 폼에 처음 손을 대면 그때부터 받아둔다. 누를 때는 이미 와 있다.
// 실패해도 조용히 넘긴다 — 진짜로 필요한 순간에 다시 부르고, 그때 알린다.
$('#form').addEventListener('input', () => { loadUI().catch(() => {}); }, { once: true });

// ─────────────────────────────────────────────────────────────
// 폼 배선
// ─────────────────────────────────────────────────────────────

// ── 도시 목록 채우기 ──
$('#cities').innerHTML = CITIES.map((c) => `<option value="${c.name}">`).join('');

// ── 두 번째 사람 칸 만들기 ──
// 첫 번째 사람 칸을 그대로 복제하고 id에만 b- 접두사를 붙인다.
// 칸이 늘어나거나 바뀌어도 한쪽만 고치면 된다.
{
  const src = $('#personA');
  const clone = src.cloneNode(true);
  clone.querySelectorAll('[id]').forEach((el) => { el.id = 'b-' + el.id; });
  clone.querySelectorAll('label[for]').forEach((el) => { el.htmlFor = 'b-' + el.htmlFor; });
  const b = $('#personB');
  b.innerHTML = clone.innerHTML;
  b.querySelector('.person-title').textContent = '두 번째 사람';
}

// ── 모드 전환 ──
let mode = 'solo';
document.querySelectorAll('.mode').forEach((btn) => {
  btn.addEventListener('click', () => {
    mode = btn.dataset.mode;
    document.querySelectorAll('.mode').forEach((x) => x.classList.toggle('on', x === btn));
    $('#personB').hidden = mode !== 'pair';
    document.querySelectorAll('.person-title').forEach((t) => { t.hidden = mode !== 'pair'; });
    $('.go').textContent = mode === 'pair' ? '궁합 보기' : '풀이 보기';
    $('#result').classList.remove('on');
    // 아직 안 받았으면 지울 결과도 없다
    pending?.then((ui) => ui.reset()).catch(() => {});
    history.replaceState(null, '', location.pathname);
  });
});

// ── 시간 미상 토글 ──
function wireNoTime(prefix) {
  const box = $(`#${prefix}noTime`);
  if (!box) return;
  box.addEventListener('change', (e) => {
    const off = e.target.checked;
    for (const f of ['hour', 'minute']) {
      const el = $(`#${prefix}${f}`);
      el.disabled = off;
      el.style.opacity = off ? 0.4 : 1;
    }
  });
}
wireNoTime('');
wireNoTime('b-');

// ─────────────────────────────────────────────────────────────
// 제출
// ─────────────────────────────────────────────────────────────

/**
 * 계산 과정을 보여준다.
 *
 * 전부 합쳐 0.3초면 끝나는 계산이라 예전에는 결과가 툭 튀어나왔다. 그러면
 * 무엇을 했는지가 전혀 보이지 않아서, 어딘가에서 글을 받아온 것처럼 보인다.
 * 실제로 하는 일을 순서대로 보여주는 편이 낫다.
 *
 * 체크 표시는 그 단계가 진짜로 끝났을 때만 켠다. 다만 사람이 읽을 수 있게
 * 단계마다 최소 시간을 준다 — 없는 일을 하는 척하지는 않는다.
 */
const SOLO_STEPS = [
  '태어난 곳의 경도와 균시차로 진태양시를 맞춥니다',
  '열다섯 체계의 명반을 세웁니다',
  '지금의 흐름을 얹습니다',
  '겹치는 것을 추려 풀이를 씁니다',
  '앞으로 120일의 일진을 계산합니다',
];
const PAIR_STEPS = [
  '두 사람의 진태양시를 각각 맞춥니다',
  '열다섯 체계로 두 명반을 견줍니다',
  '풀이를 씁니다',
];

const progressShell = (steps) => `
  <div class="card progress">
    <ol class="steps">
      ${steps.map((t) => `<li><span class="mark"></span>${esc(t)}</li>`).join('')}
    </ol>
  </div>`;

/** 한 단계가 끝날 때마다 부른다. 최소 시간을 채우고 다음으로 넘어간다 */
function stepper(minMs = 260) {
  const items = [...document.querySelectorAll('#result .steps li')];
  let i = 0, due = performance.now();
  if (items[0]) items[0].classList.add('doing');
  return async () => {
    const wait = due - performance.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    items[i]?.classList.remove('doing');
    items[i]?.classList.add('done');
    i += 1;
    items[i]?.classList.add('doing');
    due = performance.now() + minMs;
    // 켜진 표시가 실제로 그려지도록 한 번 양보한다.
    // requestAnimationFrame 은 탭이 뒤로 가면 아예 멈춘다. 그러면 사용자가
    // 잠깐 다른 탭을 봤다 왔을 때 진행 화면에서 영영 끝나지 않는다.
    await new Promise((r) => setTimeout(r, 0));
  };
}

$('#form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const box = $('#result');

  // 진행 표시를 먼저 띄운다. 엔진을 받아오는 동안 화면이 멈춘 것처럼
  // 보이지 않게 하려는 것이다 — 미리 받아둔 경우에는 어차피 곧바로 넘어간다.
  box.innerHTML = progressShell(mode === 'pair' ? PAIR_STEPS : SOLO_STEPS);
  box.classList.add('on');
  box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const next = stepper();
  await new Promise((r) => setTimeout(r, 0));

  try {
    const ui = await loadUI();
    await ui.run(mode, box, next);
  } catch (err) {
    // 받아오지 못한 경우도 여기로 온다. 다음 시도에서 다시 받도록 비워 둔다.
    pending = null;
    box.innerHTML = `<div class="error">${esc(err.message)}</div>`;
    box.classList.add('on');
  }
});

// ── 링크로 들어온 경우 그대로 되살린다 ──
// 주소에 결과가 담겨 있으면 어차피 결과를 그릴 것이므로 지금 받아도 된다.
if (location.hash.length > 1) {
  loadUI().then((ui) => ui.restoreFromHash()).catch(() => {});
} else {
  // 로그인해 두고 프로필을 저장했으면 첫 사람 칸을 채워 둔다.
  // 그 사이 사람이 이미 적기 시작했으면 덮어쓰지 않는다.
  loadProfile().then(({ profile }) => {
    if (!profile || $('#year').value || $('#name').value) return;
    const set = (id, v) => { if (v != null) $('#' + id).value = v; };
    set('name', profile.name);
    set('gender', profile.gender);
    set('calendar', 'solar');
    set('year', profile.year); set('month', profile.month); set('day', profile.day);
    const noTime = profile.hour == null;
    $('#noTime').checked = noTime;
    $('#noTime').dispatchEvent(new Event('change'));
    if (!noTime) { set('hour', profile.hour); set('minute', profile.minute); }
    set('birthPlace', profile.birthPlace);
    set('homePlace', profile.homePlace);
    $('#dst').checked = !!profile.dst;
    $('#profileNote').hidden = false;
    loadUI().catch(() => {});
  });
}

// 화면 아래에 판 번호를 박아 둔다. "예전과 다른데요"라는 말이 나올 때
// 어느 판을 보고 있는지부터 맞춰야 이야기가 된다.
{
  const el = $('#ver');
  if (el) {
    const last = CALC_CHANGES[0];
    el.textContent = `${ENGINE_VERSION} · 계산이 마지막으로 달라진 날 ${last ? last.at : '—'}`;
  }
}

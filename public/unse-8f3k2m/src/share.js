/**
 * share.js — 저장하고 나누기
 *
 * 세 가지를 한다.
 *   1. 공유 링크 — 입력값을 주소에 담는다. 서버가 없으니 링크가 곧 데이터다.
 *   2. 이미지 카드 — 결과를 그림 한 장으로 그린다.
 *   3. 인쇄 — 브라우저 인쇄로 PDF까지.
 *
 * 이미지는 캔버스에 직접 그린다. html2canvas 같은 걸 쓰면 화면을 그대로 찍어주지만
 * 외부 라이브러리에 매이고, 화면용 레이아웃이 그림으로는 어색해진다.
 * 직접 그리면 공유에 맞는 비율과 여백을 따로 잡을 수 있다.
 */

import { lifeReading, structureReading, areaProse, compatReading } from './reading.js';

// ─────────────────────────────────────────────────────────────
// 공유 링크
// ─────────────────────────────────────────────────────────────

/** 한글이 섞인 문자열도 안전하게 담기는 base64 */
function toB64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64(s) {
  const pad = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(pad + '='.repeat((4 - (pad.length % 4)) % 4));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** 입력값에서 꼭 필요한 것만 골라 짧게 만든다 */
const packPerson = (f) => [
  f.name, f.gender === 'male' ? 1 : 0, f.year, f.month, f.day,
  f.hour ?? '', f.minute ?? 0, f.birthPlace, f.homePlace,
  f.dst ? 1 : 0, f.inputCalendar ?? 'solar',
];

const unpackPerson = (a) => ({
  name: a[0], gender: a[1] ? 'male' : 'female',
  year: +a[2], month: +a[3], day: +a[4],
  hour: a[5] === '' ? null : +a[5], minute: +a[6],
  birthPlace: a[7], homePlace: a[8],
  dst: !!a[9], inputCalendar: a[10] || 'solar',
});

export function encodeState(mode, formA, formB) {
  const payload = mode === 'pair'
    ? { m: 'p', a: packPerson(formA), b: packPerson(formB) }
    : { m: 's', a: packPerson(formA) };
  return '#s=' + toB64(JSON.stringify(payload));
}

export function decodeState(hash) {
  const m = /[#&]s=([A-Za-z0-9\-_]+)/.exec(hash || '');
  if (!m) return null;
  try {
    const o = JSON.parse(fromB64(m[1]));
    return {
      mode: o.m === 'p' ? 'pair' : 'solo',
      formA: unpackPerson(o.a),
      formB: o.b ? unpackPerson(o.b) : null,
    };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// 이미지 카드
// ─────────────────────────────────────────────────────────────

const W = 1080;
const PAD = 72;
const INNER = W - PAD * 2;

const C = {
  bg1: '#0f1420', bg2: '#0a0d15',
  ink: '#e8ecf4', ink2: '#a8b2c6', ink3: '#6b768d',
  gold: '#d9b26a', goldSoft: '#8d7443',
  line: '#2a3347', card: '#171d2b',
};

const FONT = '"Pretendard", -apple-system, "Malgun Gothic", "Apple SD Gothic Neo", system-ui, sans-serif';
const font = (size, weight = 400) => `${weight} ${size}px ${FONT}`;

/** 주어진 너비에 맞춰 줄을 나눈다. 한글은 글자 단위로 끊어도 자연스럽다 */
function wrap(ctx, text, maxW) {
  const lines = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const ch of para) {
      if (ctx.measureText(line + ch).width > maxW && line) {
        lines.push(line); line = ch;
      } else line += ch;
    }
    lines.push(line);
  }
  return lines;
}

/** 캔버스를 만들고 배경을 깐다 */
function makeCanvas(height) {
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = height;
  const ctx = cv.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, C.bg1); g.addColorStop(1, C.bg2);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, height);
  // 위쪽에 은은한 빛
  const glow = ctx.createRadialGradient(W / 2, -160, 40, W / 2, -160, 760);
  glow.addColorStop(0, 'rgba(60,80,140,0.5)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, 560);
  return { cv, ctx };
}

/** 다 그린 뒤 실제로 쓴 높이만큼 잘라낸다 */
function crop(cv, height) {
  const out = document.createElement('canvas');
  out.width = W; out.height = Math.ceil(height);
  out.getContext('2d').drawImage(cv, 0, 0);
  return out;
}

function header(ctx, title, sub) {
  let y = 96;
  ctx.textAlign = 'center';
  ctx.fillStyle = C.goldSoft;
  ctx.font = font(22, 500);
  ctx.fillText('종 합 운 세', W / 2, y);
  y += 78;

  ctx.fillStyle = C.ink;
  ctx.font = font(58, 700);
  ctx.fillText(title, W / 2, y);
  y += 46;

  ctx.fillStyle = C.ink3;
  ctx.font = font(24, 400);
  ctx.fillText(sub, W / 2, y);
  y += 44;

  const g = ctx.createLinearGradient(W / 2 - 90, 0, W / 2 + 90, 0);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, C.goldSoft); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(W / 2 - 90, y, 180, 1);
  ctx.textAlign = 'left';
  return y + 62;
}

function sectionLabel(ctx, y, text) {
  ctx.fillStyle = C.goldSoft;
  ctx.font = font(20, 500);
  ctx.fillText(text, PAD, y);
  return y + 34;
}

function footer(ctx, y, note) {
  ctx.fillStyle = C.line;
  ctx.fillRect(PAD, y, INNER, 1);
  y += 40;
  ctx.fillStyle = C.ink3;
  ctx.font = font(20, 400);
  ctx.textAlign = 'center';
  for (const line of wrap(ctx, note, INNER)) {
    ctx.fillText(line, W / 2, y); y += 30;
  }
  ctx.textAlign = 'left';
  return y + 44;
}

/** 본문 한 문단 */
function para(ctx, y, text, { size = 26, color = C.ink, gap = 40 } = {}) {
  ctx.fillStyle = color;
  ctx.font = font(size, 400);
  for (const line of wrap(ctx, text, INNER)) {
    ctx.fillText(line, PAD, y); y += gap;
  }
  return y + 14;
}

// ── 개인 운세 카드 ───────────────────────────────────────────

export function buildSoloCard(form, r, f = null) {
  const { cv, ctx } = makeCanvas(2600);
  const s = r.synthesis;
  const p = (n) => String(n).padStart(2, '0');

  const when = `${form.year}.${p(form.month)}.${p(form.day)}` +
    (form.hour == null ? ' · 시간 미상' : ` ${p(form.hour)}:${p(form.minute)}`) +
    ` · ${form.birthPlace}`;

  let y = header(ctx, form.name, when);

  // 화면에서 점수와 막대를 걷어냈으니 카드도 같아야 한다. 남에게 보내는
  // 그림이 숫자판이면 받은 사람은 무슨 뜻인지 알 길이 없다.
  const life = lifeReading(r.input, r.chart, s);
  const st = structureReading(r.input, r.chart);

  if (f) {
    const today = areaProse(f.day, '총운', 0, r.chart);
    if (today?.text) {
      y = sectionLabel(ctx, y, `오 늘 — ${f.today.m}월 ${f.today.d}일`);
      y = para(ctx, y + 6, today.text);
      y += 12;
    }
  }

  if (st.head || st.lines.length) {
    y = sectionLabel(ctx, y, '타 고 난 결');
    if (st.head) y = para(ctx, y + 6, st.head, { color: C.ink2 });
    for (const t of st.lines.slice(0, 2)) y = para(ctx, y, t);
    y += 12;
  }

  y = sectionLabel(ctx, y, '평 생');
  y = para(ctx, y + 6, life.career);
  if (s.summary.length) y = para(ctx, y, s.summary[0], { color: C.ink2 });

  y = footer(ctx, y + 10,
    `${s.systemCount}개 체계를 돌린 결과입니다. 재미로 보시고, 중요한 결정은 스스로 내리시기 바랍니다.`);
  return crop(cv, y);
}

// ── 궁합 카드 ────────────────────────────────────────────────

export function buildCompatCard(formA, formB, r) {
  const { cv, ctx } = makeCanvas(2200);
  const p = (n) => String(n).padStart(2, '0');
  const when = (f) => `${f.year}.${p(f.month)}.${p(f.day)}`;

  let y = header(ctx, `${formA.name} × ${formB.name}`,
    `${when(formA)}  ·  ${when(formB)}`);

  const cr = compatReading(r);
  const blocks = [
    ['총 평', cr.총평], ['끌 리 는 지 점', cr.끌림],
    ['부 딪 치 는 지 점', cr.부딪침], ['오 래 가 려 면', cr.오래],
  ];
  for (const [label, v] of blocks) {
    if (!v?.text) continue;
    y = sectionLabel(ctx, y, label);
    y = para(ctx, y + 6, v.text);
    y += 10;
  }

  y = footer(ctx, y,
    '체계마다 잣대가 달라 가로로 견주는 것은 뜻이 적습니다. 어디서 갈리는지를 보세요.');
  return crop(cv, y);
}

// ── 내려받기 ─────────────────────────────────────────────────

export function canvasToBlob(cv) {
  return new Promise((res) => cv.toBlob(res, 'image/png'));
}

/**
 * 저장하기.
 *
 * 링크 태그의 download 속성은 데스크톱에서만 믿을 만하다. 카카오톡이나
 * 인스타그램 안에서 열린 브라우저는 내려받기를 통째로 막아두는 경우가
 * 많아서, 눌러도 아무 일도 일어나지 않는다. 실제로 그렇게 신고가 들어왔다.
 *
 * 휴대폰에서 확실한 길은 공유 시트다. 사진 앱에 바로 저장할 수 있고
 * 막아둔 브라우저에서도 열린다. 쓸 수 있으면 그쪽을 먼저 쓴다.
 */
export async function saveCanvas(cv, filename) {
  const blob = await canvasToBlob(cv);
  if (!blob) throw new Error('이미지를 만들지 못했습니다');

  if (typeof File === 'function' && navigator.canShare) {
    const file = new File([blob], filename, { type: 'image/png' });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return 'shared';
      } catch (err) {
        // 사용자가 시트를 닫은 것은 실패가 아니다
        if (err?.name === 'AbortError') return 'cancel';
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'download';
}

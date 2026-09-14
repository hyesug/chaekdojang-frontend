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
  elem: ['#5fbf7f', '#e0706b', '#d7a84a', '#c3ccdb', '#5f9ae0'],
  good: '#5fbf7f', bad: '#e0706b',
};

const FONT = '"Pretendard", -apple-system, "Malgun Gothic", "Apple SD Gothic Neo", system-ui, sans-serif';
const SERIF = '"Noto Serif KR", serif';
const font = (size, weight = 400, family = FONT) => `${weight} ${size}px ${family}`;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

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

/** 오행 막대 */
function elementBar(ctx, y, pct) {
  const h = 46;
  roundRect(ctx, PAD, y, INNER, h, 12);
  ctx.save(); ctx.clip();
  let x = PAD;
  pct.forEach((v, i) => {
    const w = (v / 100) * INNER;
    ctx.fillStyle = C.elem[i];
    ctx.fillRect(x, y, w, h);
    if (v >= 9) {
      ctx.fillStyle = '#0d1017';
      ctx.font = font(20, 700);
      ctx.textAlign = 'center';
      ctx.fillText(['목', '화', '토', '금', '수'][i], x + w / 2, y + h / 2 + 7);
      ctx.textAlign = 'left';
    }
    x += w;
  });
  ctx.restore();
  y += h + 28;

  // 범례
  let lx = PAD;
  ctx.font = font(21, 400);
  ['목', '화', '토', '금', '수'].forEach((n, i) => {
    ctx.fillStyle = C.elem[i];
    roundRect(ctx, lx, y - 13, 13, 13, 3); ctx.fill();
    ctx.fillStyle = C.ink2;
    const label = `${n} ${pct[i]}%`;
    ctx.fillText(label, lx + 21, y);
    lx += 21 + ctx.measureText(label).width + 30;
  });
  return y + 36;
}

/** 알약 모양 태그들 */
function tagRow(ctx, y, tags) {
  let x = PAD;
  ctx.font = font(22, 600);
  for (const t of tags) {
    const label = t.count ? `${t.word} ${t.count}` : t.word;
    const w = ctx.measureText(label).width + 40;
    if (x + w > W - PAD) { x = PAD; y += 56; }
    const hot = t.count >= 3;
    ctx.fillStyle = hot ? 'rgba(217,178,106,0.15)' : 'rgba(255,255,255,0.05)';
    roundRect(ctx, x, y - 26, w, 44, 22); ctx.fill();
    ctx.strokeStyle = hot ? C.goldSoft : C.line;
    ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = hot ? C.gold : C.ink2;
    ctx.fillText(label, x + 20, y + 2);
    x += w + 12;
  }
  return y + 56;
}

/** 가로 막대 한 줄 */
function barRow(ctx, y, label, value, max, color, right) {
  const labelW = 200, valW = 70;
  ctx.fillStyle = C.ink2;
  ctx.font = font(23, 400);
  ctx.fillText(label, PAD, y + 7);

  const trackX = PAD + labelW;
  const trackW = INNER - labelW - valW;
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  roundRect(ctx, trackX, y - 5, trackW, 12, 6); ctx.fill();
  ctx.fillStyle = color;
  roundRect(ctx, trackX, y - 5, Math.max(12, trackW * (value / max)), 12, 6); ctx.fill();

  ctx.fillStyle = C.ink3;
  ctx.font = font(21, 400);
  ctx.textAlign = 'right';
  ctx.fillText(right ?? String(value), W - PAD, y + 7);
  ctx.textAlign = 'left';
  return y + 46;
}

/** 기질 축 (가운데가 0) */
function axisRow(ctx, y, left, right, value) {
  ctx.font = font(20, 400);
  ctx.fillStyle = C.ink3;
  ctx.fillText(left, PAD, y + 6);
  ctx.textAlign = 'right';
  ctx.fillText(right, W - PAD, y + 6);
  ctx.textAlign = 'left';

  const x = PAD + 150, w = INNER - 300;
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  roundRect(ctx, x, y - 2, w, 5, 3); ctx.fill();
  ctx.fillStyle = C.line;
  ctx.fillRect(x + w / 2, y - 8, 1, 17);

  const px = x + w * (0.5 + value / 2);
  ctx.fillStyle = C.gold;
  ctx.beginPath(); ctx.arc(px, y, 9, 0, Math.PI * 2); ctx.fill();
  return y + 42;
}

// ── 개인 운세 카드 ───────────────────────────────────────────

export function buildSoloCard(form, r) {
  const { cv, ctx } = makeCanvas(2600);
  const s = r.synthesis;
  const p = (n) => String(n).padStart(2, '0');

  const when = `${form.year}.${p(form.month)}.${p(form.day)}` +
    (form.hour == null ? ' · 시간 미상' : ` ${p(form.hour)}:${p(form.minute)}`) +
    ` · ${form.birthPlace}`;

  let y = header(ctx, form.name, when);

  // 사주 팔자판
  const P = r.chart.pillars;
  const cells = [['시', P.hour], ['일', P.day], ['월', P.month], ['년', P.year]];
  const bw = (INNER - 24) / 4;
  y = sectionLabel(ctx, y, '사 주');
  cells.forEach(([pos, g], i) => {
    const x = PAD + i * (bw + 8);
    const me = pos === '일';
    ctx.fillStyle = me ? 'rgba(217,178,106,0.08)' : 'rgba(255,255,255,0.035)';
    roundRect(ctx, x, y, bw, 150, 14); ctx.fill();
    ctx.strokeStyle = me ? C.goldSoft : C.line; ctx.lineWidth = 1; ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = C.ink3; ctx.font = font(19, 400);
    ctx.fillText(pos + '주' + (me ? ' · 나' : ''), x + bw / 2, y + 34);
    ctx.fillStyle = C.ink; ctx.font = font(54, 400, SERIF);
    ctx.fillText(g ? g.hanja : '—', x + bw / 2, y + 98);
    ctx.fillStyle = C.ink3; ctx.font = font(19, 400);
    ctx.fillText(g ? g.kr : '시간 미상', x + bw / 2, y + 128);
    ctx.textAlign = 'left';
  });
  y += 150 + 52;

  // 합의도
  y = sectionLabel(ctx, y, '체 계 간 합 의 도');
  ctx.fillStyle = C.gold; ctx.font = font(70, 700);
  ctx.fillText(`${s.consensus.ratio}%`, PAD, y + 20);
  const numW = ctx.measureText(`${s.consensus.ratio}%`).width;
  if (s.consensus.word) {
    ctx.fillStyle = C.ink2; ctx.font = font(30, 500);
    ctx.fillText(`‘${s.consensus.word}’`, PAD + numW + 22, y + 20);
    ctx.fillStyle = C.ink3; ctx.font = font(22, 400);
    ctx.fillText(`${s.consensus.count} / ${s.consensus.total}개 체계`, PAD + numW + 22, y + 52);
  }
  y += 96;

  // 오행
  y = sectionLabel(ctx, y, '합 산 오 행');
  y = elementBar(ctx, y, s.elements.pct);
  y += 16;

  // 겹친 태그
  if (s.sharedTags.length) {
    y = sectionLabel(ctx, y, '여 러 체 계 가 함 께 가 리 킨 것');
    y = tagRow(ctx, y + 22, s.sharedTags.slice(0, 8));
    y += 12;
  }

  // 기질
  y = sectionLabel(ctx, y, '기 질');
  y += 18;
  const poles = {
    주도: ['따라가는', '이끄는'], 외향: ['안으로', '밖으로'],
    감성: ['이성적', '감각적'], 안정: ['움직이는', '머무는'], 실리: ['이상', '실속'],
  };
  for (const [k, [l, rt]] of Object.entries(poles)) {
    y = axisRow(ctx, y, l, rt, s.traits[k].value);
  }
  y += 16;

  // 영역
  y = sectionLabel(ctx, y, '영 역 별 힘');
  y += 20;
  for (const d of s.ranked) {
    y = barRow(ctx, y, d.label, d.score, 100, C.gold);
  }
  y += 34;

  // 요약 문장
  if (s.summary.length) {
    ctx.fillStyle = C.ink2; ctx.font = font(25, 400);
    for (const line of wrap(ctx, s.summary[0], INNER)) {
      ctx.fillText(line, PAD, y); y += 38;
    }
    y += 18;
  }

  y = footer(ctx, y,
    `${s.systemCount}개 체계를 돌린 결과입니다. 재미로 보시고, 중요한 결정은 스스로 내리시기 바랍니다.`);
  return crop(cv, y);
}

// ── 궁합 카드 ────────────────────────────────────────────────

export function buildCompatCard(formA, formB, r) {
  const { cv, ctx } = makeCanvas(2200);
  const s = r.synthesis;
  const p = (n) => String(n).padStart(2, '0');
  const when = (f) => `${f.year}.${p(f.month)}.${p(f.day)}`;

  let y = header(ctx, `${formA.name} × ${formB.name}`,
    `${when(formA)}  ·  ${when(formB)}`);

  // 총점
  ctx.textAlign = 'center';
  ctx.fillStyle = C.gold; ctx.font = font(130, 700);
  ctx.fillText(String(s.score), W / 2, y + 66);
  const w1 = ctx.measureText(String(s.score)).width;
  ctx.fillStyle = C.ink3; ctx.font = font(32, 400);
  ctx.fillText('/ 100', W / 2 + w1 / 2 + 56, y + 66);
  y += 108;
  ctx.fillStyle = C.ink; ctx.font = font(38, 600);
  ctx.fillText(s.verdict, W / 2, y + 30);
  y += 86;
  ctx.textAlign = 'left';

  // 판정 분포
  const groups = [['좋음', C.good], ['무난', C.ink2], ['어려움', C.bad]];
  const gw = (INNER - 24) / 3;
  groups.forEach(([k, col], i) => {
    const x = PAD + i * (gw + 12);
    ctx.fillStyle = 'rgba(255,255,255,0.035)';
    roundRect(ctx, x, y, gw, 168, 14); ctx.fill();
    ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = col; ctx.font = font(48, 700);
    ctx.fillText(String(s.buckets[k].length), x + gw / 2, y + 60);
    ctx.fillStyle = C.ink3; ctx.font = font(21, 400);
    ctx.fillText(k, x + gw / 2, y + 92);

    ctx.font = font(17, 400);
    let ly = y + 120;
    for (const line of wrap(ctx, s.buckets[k].join(', ') || '—', gw - 28).slice(0, 3)) {
      ctx.fillText(line, x + gw / 2, ly); ly += 24;
    }
    ctx.textAlign = 'left';
  });
  y += 168 + 54;

  // 체계별 점수
  y = sectionLabel(ctx, y, '체 계 별 점 수');
  y += 22;
  const sorted = [...r.results].sort((x, z) => z.score - x.score);
  for (const x of sorted) {
    const col = x.tone > 0 ? C.good : x.tone < 0 ? C.bad : C.gold;
    y = barRow(ctx, y, x.name, x.score, 100, col);
  }
  y += 36;

  // 요약 첫 문장
  if (s.summary.length) {
    ctx.fillStyle = C.ink2; ctx.font = font(25, 400);
    for (const line of wrap(ctx, s.summary[0], INNER)) {
      ctx.fillText(line, PAD, y); y += 38;
    }
    y += 18;
  }

  y = footer(ctx, y,
    '체계마다 잣대가 달라 점수를 가로로 견주는 것은 뜻이 적습니다. 총점보다 갈림을 보세요.');
  return crop(cv, y);
}

// ── 내려받기 ─────────────────────────────────────────────────

export function canvasToBlob(cv) {
  return new Promise((res) => cv.toBlob(res, 'image/png'));
}

export async function downloadCanvas(cv, filename) {
  const blob = await canvasToBlob(cv);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

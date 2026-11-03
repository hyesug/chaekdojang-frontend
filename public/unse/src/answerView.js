/**
 * answerView.js — AI 답(마크다운 일부)을 화면 구조로 그린다
 *
 * 긴 문단 대신 읽히는 구조로:
 *   "## 핵심 결론"          → 결론 상자(맨 위, 결론만 읽어도 답이 되게)
 *   "### ① 직업 — 제목"     → 영역 카드. 안의 "명반 근거: / 해석: / 추천: / 주의:" 줄을 구분해 그린다
 *   "| 표 |"                 → 비교표. 좁은 화면에서는 행마다 카드로 바뀐다(style.css)
 *   "## 종합 권고"          → 마지막 권고 상자
 *   ⟦이름표⟧                → 근거 칩(evidence.js 가 번호를 엔진 계산값으로 바꾼 것)
 *
 * 흘러오는 중의 반쪽 글도 그대로 그려야 하므로 실패하지 않게 줄 단위로만 읽는다.
 * 모델 글은 먼저 이스케이프하고 태그는 여기서만 만든다. DOM 없음 — 테스트에서 바로 부른다.
 */

const esc = (s) => String(s).replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const LEAD = /^(핵심 결론|한 줄 결론|한마디로|결론)/;
const FINAL = /^(종합 권고|종합|최종 권고|우선순위|정리)/;
/** 본문 뒤의 곁가지 — 작고 옅게(사건 판정의 근거 요약·판정하지 못한 것) */
const ASIDE = /^(근거 요약|판정하지 못한 것|판정 한계)/;
/** 카드 안 이름 붙은 줄 — 앞의 낱말이 그 줄의 역할이다 */
const LABELS = {
  '명반 근거': 'ev', '근거': 'ev',
  '해석': 'say', '무슨 일이 가능한가': 'say', '왜 이쪽이 우세한가': 'say',
  '추천': 'do', '활용': 'do', '할 일': 'do', '이렇게': 'do', '현실화 조건': 'do',
  '판단 기준': 'rule', '기준': 'rule', '언제 강한가': 'rule',
  '주의': 'warn', '피할 것': 'warn', '한계': 'limit',
  '입력 완성도': 'meta',
};
const LABEL_LINE = new RegExp(`^(?:\\*\\*)?(${Object.keys(LABELS).join('|')})(?:\\*\\*)?\\s*[:：]\\s*(.*)$`);

/** 모델이 줄바꿈 대신 넣는 역슬래시 줄과 불릿 사이 빈 줄을 걷는다 — 빈 불릿이 '* \'로 보였다 */
export function tidy(t) {
  return String(t ?? '')
    .replace(/^[ \t]*(?:[-*•][ \t]*)?\\[ \t]*$/gm, '')
    .replace(/[ \t]*\\[ \t]*$/gm, '')
    .replace(/(^[-*] .+)\n\s*\n(?=[-*] )/gm, '$1\n');
}

/** 한 줄 안 꾸밈 — 굵게, 근거 칩 */
function inline(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/⟦([^⟦⟧]+)⟧/g, '<span class="ai-chip" title="엔진이 계산한 값">$1</span>');
}

/** 표 한 줄 → 칸들. 맨 앞·뒤 세로줄은 버린다 */
const cells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
const isRule = (line) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);

function table(rows) {
  const body = rows.filter((r) => !isRule(r));
  const hasHead = rows.length > 1 && isRule(rows[1]);
  const head = hasHead ? cells(body[0]) : null;
  const data = (hasHead ? body.slice(1) : body).map(cells);
  const th = head ? `<thead><tr>${head.map((h) => `<th>${inline(h)}</th>`).join('')}</tr></thead>` : '';
  const tr = data.map((r) => `<tr>${r.map((c, i) =>
    `<td${head?.[i] ? ` data-label="${esc(head[i].replace(/\*\*/g, ''))}"` : ''}>${inline(c) || '—'}</td>`).join('')}</tr>`).join('');
  return `<div class="ai-table" role="region" aria-label="비교표" tabindex="0"><table>${th}<tbody>${tr}</tbody></table></div>`;
}

/**
 * @param {string} text 근거 번호를 이름표로 바꾼 답(본문만, [이어서 물어보기] 앞까지)
 * @returns {string} HTML
 */
export function renderAnswer(text) {
  const lines = tidy(text).split('\n');
  const out = [];
  let section = null;   // 'lead' | 'final' | 'sec'
  let card = false;
  let list = null;      // 'ul' | 'ol'
  let para = [];

  const flushPara = () => { if (para.length) { out.push(`<p>${para.map(inline).join('<br>')}</p>`); para = []; } };
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  const closeCard = () => { flushPara(); closeList(); if (card) { out.push('</article>'); card = false; } };
  const closeSection = () => { closeCard(); if (section) { out.push('</section>'); section = null; } };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const h = line.match(/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (h && h[1].length <= 2) {
      closeSection();
      const title = h[2].replace(/\*\*/g, '');
      section = LEAD.test(title) ? 'lead' : FINAL.test(title) ? 'final' : ASIDE.test(title) ? 'aside' : 'sec';
      out.push(`<section class="ai-${section}"><h4>${inline(title)}</h4>`);
      continue;
    }
    if (h) {
      closeCard();
      card = true;
      out.push(`<article class="ai-card"><h5>${inline(h[2].replace(/\*\*/g, ''))}</h5>`);
      continue;
    }
    if (/^\s*\|/.test(line)) {
      flushPara(); closeList();
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(lines[i++]);
      i--;
      out.push(table(rows));
      continue;
    }
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) { flushPara(); closeList(); out.push('<hr>'); continue; }
    const lab = line.trim().match(LABEL_LINE);
    if (lab) {
      flushPara(); closeList();
      const kind = LABELS[lab[1]];
      const value = lab[2].trim();
      if (kind === 'ev') {
        // 번호가 모두 지워져 이름표가 없으면 빈 줄을 그리지 않는다
        if (!/⟦/.test(value) && !value.replace(/[\s,·/]/g, '')) continue;
        out.push(`<p class="ai-ev"><span class="ai-k">명반 근거</span> ${inline(value)}</p>`);
      } else {
        out.push(`<p class="ai-lab ai-lab-${kind}"><span class="ai-k">${esc(lab[1])}</span> ${inline(value)}</p>`);
      }
      continue;
    }
    const li = line.match(/^\s*(?:([-*•])|(\d+)[.)])\s+(.*)$/);
    if (li) {
      flushPara();
      const want = li[1] ? 'ul' : 'ol';
      if (list !== want) { closeList(); out.push(`<${want}>`); list = want; }
      out.push(`<li>${inline(li[3])}</li>`);
      continue;
    }
    if (!line.trim()) { flushPara(); closeList(); continue; }
    closeList();
    para.push(line.trim());
  }
  closeSection();
  flushPara(); closeList();
  return out.join('');
}

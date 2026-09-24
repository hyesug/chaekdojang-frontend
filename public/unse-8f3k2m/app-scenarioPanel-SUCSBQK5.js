/* 종합 운세 — public/unse-8f3k2m/src 를 묶은 것입니다. 원본이 진짜이고 이 파일은 만들어진 것입니다. */
import"./app-chunk-IAPKIPF6.js";var i=e=>String(e??"").replace(/[&<>"]/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[t]),m=[["언제 이직해?","career"],["지금 회사 오래 다닐까?","career"],["결혼은 언제 할까?","marriage"],["이사는 언제쯤?","movement"],["돈은 언제 풀릴까?","wealth"],["시험·자격은 어때?","education"],["건강은 어때?","health"]],y=[["why_event","왜 그 사건인가"],["why_timing","왜 그 시기인가"],["why_direction","왜 그 방향인가"],["why_not_narrower","왜 더 못 좁히는가"]],h=[{k:"occupation",label:"지금 하는 일",type:"text",ph:"예: 백엔드 개발자"},{k:"employmentType",label:"고용 형태",type:"select",opts:[["","모름/안 밝힘"],["employed","회사에 소속"],["none","일을 쉬는 중"],["freelance","프리랜서"],["business","자기 사업"]]},{k:"region",label:"사는 곳",type:"text",ph:"예: 대전 유성구"},{k:"relationshipStatus",label:"관계",type:"select",opts:[["","모름/안 밝힘"],["single","혼자"],["dating","사귀는 사람 있음"],["cohabiting","함께 삶"],["married","기혼"],["separated","별거·이혼"]]},{k:"hasChildren",label:"자녀",type:"select",opts:[["","모름/안 밝힘"],["true","있음"],["false","없음"]]}],v=e=>`
  <label class="scen-f">
    <span>${i(e.label)}</span>
    ${e.type==="text"?`<input type="text" data-ctx="${e.k}" placeholder="${i(e.ph??"")}">`:`<select data-ctx="${e.k}">${e.opts.map(([t,n])=>`<option value="${i(t)}">${i(n)}</option>`).join("")}</select>`}
  </label>`;function g(){return`
    <div class="card scenario">
      <details class="scen-ctx">
        <summary>지금 상황을 알려주면 더 좁혀서 답합니다 (선택)</summary>
        <div class="scen-fields">${h.map(v).join("")}</div>
        <p class="scen-ctx-note">
          여기 적은 것은 <b>알려주신 사실</b>로만 씁니다. 운세가 맞힌 것처럼 쓰지 않고,
          답에도 그렇게 적힙니다. 비워 두면 추측하지 않습니다.
        </p>
      </details>
      <div class="scen-quick">
        ${m.map(([e],t)=>`<button type="button" data-sq="${t}">${i(e)}</button>`).join("")}
      </div>
      <div class="ai-input">
        <textarea id="scen-q" rows="2" placeholder="언제 이직해? / 결혼은 언제 할까? (Ctrl+Enter 로 보기)"></textarea>
        <button type="button" id="scen-go">보기</button>
      </div>
      <div id="scen-out" class="scen-out"></div>
      <p class="ai-note">
        여기 답은 <b>모델이 쓴 글이 아니라 계산 결과를 그대로 옮긴 것</b>입니다.
        같은 질문에는 늘 같은 답이 나오고, 근거가 끊기는 자리에서 말을 멈춥니다.
        점수는 확률이 아니라 그 사람의 그 기간 안에서의 자리입니다.
      </p>
    </div>`}function b(e,t,n){if(!t){e.innerHTML='<p class="scen-empty">답을 만들지 못했습니다.</p>';return}let c=String(t.text??"").split(`

`).filter(Boolean).map(a=>`<p>${i(a)}</p>`).join(""),l=n?.primary?.confidence??null,o={high:"두터움",medium_high:"보통 이상",medium:"보통",low:"얇음",insufficient:"근거 없음"},p={event:"사건",timing:"시기",direction:"방향",role:"역할",location:"지역",district:"구·동"},s=l?`<div class="scen-conf">${["event","timing","direction","role","location","district"].map(a=>`<span><b>${p[a]}</b> ${i(o[l[a]]??l[a])}</span>`).join("")}</div>`:"";e.innerHTML=`
    <div class="scen-answer">${c}</div>
    ${s}
    <div class="scen-why">
      ${y.map(([a,r])=>`<button type="button" data-why="${a}">${i(r)}</button>`).join("")}
    </div>
    <div id="scen-why-out" class="scen-why-out"></div>`}function $(e,t){if(!t||!t.items?.length&&!t.blocked?.length){e.innerHTML=`<p class="scen-empty">${i(t?.note??"그 자리에는 댈 근거가 없습니다.")}</p>`;return}let n={fortune:"명반",context:"알려주신 것",reality:"실제 자료",derived:"위에서 끌어낸 것"},c=Object.entries(t.bySource??{}).filter(([,o])=>o.length).map(([o,p])=>`
      <div class="scen-src">
        <div class="scen-src-h">${i(n[o]??o)}</div>
        <ul>${p.map(s=>`<li>${i(s.claim)}${s.systems?.length?`<span class="scen-sys">${i(s.systems.map(a=>a.what).join(" · "))}</span>`:""}</li>`).join("")}</ul>
      </div>`).join(""),l=t.blocked?.length?`<div class="scen-src"><div class="scen-src-h">여기서 멈춘 까닭</div>
       <ul>${t.blocked.map(o=>`<li>${i(o.reason)}</li>`).join("")}</ul></div>`:"";e.innerHTML=c+l+(t.note?`<p class="scen-empty">${i(t.note)}</p>`:"")}function f(e){let t={};for(let c of e.querySelectorAll("[data-ctx]")){let l=String(c.value??"").trim();l&&(t[c.dataset.ctx]=l)}let n={};return t.occupation&&(n.occupation=t.occupation),t.employmentType&&(n.employmentType=t.employmentType),t.relationshipStatus&&(n.relationshipStatus=t.relationshipStatus,t.relationshipStatus==="married"&&(n.maritalStatus="married"),t.relationshipStatus==="separated"&&(n.maritalStatus="separated")),t.hasChildren&&(n.hasChildren=t.hasChildren==="true"),{currentState:Object.keys(n).length?n:null,contextLocation:t.region||null}}async function S(e,t){let n=e.querySelector("#scen-out"),c=e.querySelector("#scen-q");if(!n||!c)return;let l=await import("./app-scenario-7AEQYB5E.js"),o=null,p=async s=>{let a=String(s??"").trim();if(a){n.innerHTML='<p class="scen-empty">계산하는 중입니다…</p>',await new Promise(r=>setTimeout(r,0));try{let r=new Date().getFullYear(),u=f(e),d=l.answerScenario({birth:t,question:a,from:`${r}-01`,to:`${r+3}-12`,supporting:!0,currentState:u.currentState,contextLocation:u.contextLocation,narrate:{detail:"normal"}});o=d,b(n,d.narration,d.scenario)}catch(r){n.innerHTML=`<p class="scen-empty">계산하지 못했습니다. (${i(r?.message??r)})</p>`}}};e.addEventListener("click",s=>{let a=s.target.closest("button[data-sq]");if(a){c.value=m[Number(a.dataset.sq)][0],p(c.value);return}if(s.target.closest("#scen-go")){p(c.value);return}let r=s.target.closest("button[data-why]");if(r&&o){let u=e.querySelector("#scen-why-out");$(u,l.selectEvidence({scenario:o.scenario,questionType:r.dataset.why}))}}),c.addEventListener("keydown",s=>{s.key==="Enter"&&(s.ctrlKey||s.metaKey)&&p(c.value)})}export{m as PRESETS,S as initScenario,g as panelHtml};

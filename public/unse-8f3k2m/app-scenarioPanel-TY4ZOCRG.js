/* 종합 운세 — public/unse-8f3k2m/src 를 묶은 것입니다. 원본이 진짜이고 이 파일은 만들어진 것입니다. */
import"./app-chunk-IAPKIPF6.js";var o=s=>String(s??"").replace(/[&<>"]/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[t]),p=[["언제 이직해?","career"],["지금 회사 오래 다닐까?","career"],["결혼은 언제 할까?","marriage"],["이사는 언제쯤?","movement"],["돈은 언제 풀릴까?","wealth"],["시험·자격은 어때?","education"],["건강은 어때?","health"]],m=[["why_event","왜 그 사건인가"],["why_timing","왜 그 시기인가"],["why_direction","왜 그 방향인가"],["why_not_narrower","왜 더 못 좁히는가"]];function h(){return`
    <div class="card scenario">
      <div class="scen-quick">
        ${p.map(([s],t)=>`<button type="button" data-sq="${t}">${o(s)}</button>`).join("")}
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
    </div>`}function y(s,t,r){if(!t){s.innerHTML='<p class="scen-empty">답을 만들지 못했습니다.</p>';return}let a=String(t.text??"").split(`

`).filter(Boolean).map(n=>`<p>${o(n)}</p>`).join(""),l=r?.primary?.confidence??null,i={high:"두터움",medium_high:"보통 이상",medium:"보통",low:"얇음",insufficient:"근거 없음"},u={event:"사건",timing:"시기",direction:"방향",role:"역할",location:"지역",district:"구·동"},e=l?`<div class="scen-conf">${["event","timing","direction","role","location","district"].map(n=>`<span><b>${u[n]}</b> ${o(i[l[n]]??l[n])}</span>`).join("")}</div>`:"";s.innerHTML=`
    <div class="scen-answer">${a}</div>
    ${e}
    <div class="scen-why">
      ${m.map(([n,c])=>`<button type="button" data-why="${n}">${o(c)}</button>`).join("")}
    </div>
    <div id="scen-why-out" class="scen-why-out"></div>`}function v(s,t){if(!t||!t.items?.length&&!t.blocked?.length){s.innerHTML=`<p class="scen-empty">${o(t?.note??"그 자리에는 댈 근거가 없습니다.")}</p>`;return}let r={fortune:"명반",context:"알려주신 것",reality:"실제 자료",derived:"위에서 끌어낸 것"},a=Object.entries(t.bySource??{}).filter(([,i])=>i.length).map(([i,u])=>`
      <div class="scen-src">
        <div class="scen-src-h">${o(r[i]??i)}</div>
        <ul>${u.map(e=>`<li>${o(e.claim)}${e.systems?.length?`<span class="scen-sys">${o(e.systems.map(n=>n.what).join(" · "))}</span>`:""}</li>`).join("")}</ul>
      </div>`).join(""),l=t.blocked?.length?`<div class="scen-src"><div class="scen-src-h">여기서 멈춘 까닭</div>
       <ul>${t.blocked.map(i=>`<li>${o(i.reason)}</li>`).join("")}</ul></div>`:"";s.innerHTML=a+l+(t.note?`<p class="scen-empty">${o(t.note)}</p>`:"")}async function w(s,t){let r=s.querySelector("#scen-out"),a=s.querySelector("#scen-q");if(!r||!a)return;let l=await import("./app-scenario-7AEQYB5E.js"),i=null,u=async e=>{let n=String(e??"").trim();if(n){r.innerHTML='<p class="scen-empty">계산하는 중입니다…</p>',await new Promise(c=>setTimeout(c,0));try{let c=new Date().getFullYear(),d=l.answerScenario({birth:t,question:n,from:`${c}-01`,to:`${c+3}-12`,supporting:!0,narrate:{detail:"normal"}});i=d,y(r,d.narration,d.scenario)}catch(c){r.innerHTML=`<p class="scen-empty">계산하지 못했습니다. (${o(c?.message??c)})</p>`}}};s.addEventListener("click",e=>{let n=e.target.closest("button[data-sq]");if(n){a.value=p[Number(n.dataset.sq)][0],u(a.value);return}if(e.target.closest("#scen-go")){u(a.value);return}let c=e.target.closest("button[data-why]");if(c&&i){let d=s.querySelector("#scen-why-out");v(d,l.selectEvidence({scenario:i.scenario,questionType:c.dataset.why}))}}),a.addEventListener("keydown",e=>{e.key==="Enter"&&(e.ctrlKey||e.metaKey)&&u(a.value)})}export{p as PRESETS,w as initScenario,h as panelHtml};

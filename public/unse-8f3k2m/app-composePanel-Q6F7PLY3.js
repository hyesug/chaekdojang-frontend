/* 종합 운세 — public/unse-8f3k2m/src 를 묶은 것입니다. 원본이 진짜이고 이 파일은 만들어진 것입니다. */
import"./app-chunk-IAPKIPF6.js";var s=t=>String(t??"").replace(/[&<>"]/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[e]),v=t=>s(t).replace(/\*\*(.+?)\*\*/g,"<b>$1</b>"),i=[["career","일"],["wealth","돈"],["relationship","관계"]];function y(){return`
    <div class="card compose">
      <div class="cmp-tabs">
        ${i.map(([t,e],a)=>`<button type="button" data-cmp="${t}"${a===0?' class="on"':""}>${s(e)}</button>`).join("")}
      </div>
      <div id="cmp-out" class="cmp-out"></div>
      <p class="ai-note">
        칸마다 <b>그 자리를 보는 체계의 말을 나란히</b> 둔 것입니다. 합치거나 고르지 않습니다 —
        한 칸에 여럿이 들어오면 둘 다 맞을 수 있기 때문입니다.
        말이 엇갈리는 자리는 엇갈린다고 적고, 아무도 말하지 않는 칸은 비워 둡니다.
      </p>
    </div>`}function $(t){return t.empty?`
      <div class="cmp-slot cmp-slot-empty">
        <div class="cmp-h">${s(t.label)}<span>${s(t.ask??"")}</span></div>
        <p class="scen-empty">${s(t.text)}</p>
      </div>`:`
    <div class="cmp-slot">
      <div class="cmp-h">${s(t.label)}<span>${s(t.ask??"")}</span></div>
      ${t.voices.map(e=>`
        <div class="cmp-v">
          <div class="cmp-who">${s(e.system)}<em>${s(e.what)}</em></div>
          <p>${v(e.lines.join(" "))}</p>
        </div>`).join("")}
      ${t.tension?`<p class="cmp-tension">${s(t.tension)}</p>`:""}
      ${t.source?`<details class="cmp-src"><summary>어디를 보고 정한 칸인가</summary>
        <p>${s(t.source)}</p></details>`:""}
    </div>`}async function b(t,e){let a=t.querySelector("#cmp-out");if(!a)return;a.innerHTML='<p class="scen-empty">열다섯 체계를 세우는 중입니다…</p>',await new Promise(n=>setTimeout(n,0));let r=null;try{let[n,c,o,u]=await Promise.all([import("./app-semantic-WBUSKDAU.js"),import("./app-saju-2BSLBHE5.js"),import("./app-slots-C7MRHRUJ.js"),import("./app-narrate-ASALOC63.js")]),{fortune:l}=n.natalFortune(e),d=c.readStructures({...l.chart,gender:e.gender}).structures;r={};for(let[m]of i)r[m]=u.narrateSlots(o.fillSlots(l,d,m)).sections}catch(n){a.innerHTML=`<p class="scen-empty">세우지 못했습니다. (${s(n?.message??n)})</p>`;return}let p=n=>{a.innerHTML=r[n].map($).join("")};p(i[0][0]),t.addEventListener("click",n=>{let c=n.target.closest("button[data-cmp]");if(c){for(let o of t.querySelectorAll("button[data-cmp]"))o.classList.toggle("on",o===c);p(c.dataset.cmp)}})}export{b as initCompose,y as panelHtml};

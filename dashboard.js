// dashboard.js — 대시보드 (2026-11-06 개편: 로스팅 · 커피 한 잔 · 디개싱 중심)

function dashEsc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function dashDays(a,b){ // b-a (일), 'YYYY-MM-DD'
  if(!a||!b)return null;
  const p=s=>{const [y,m,d]=s.split('-').map(Number);return Date.UTC(y,m-1,d);};
  const v=Math.round((p(b)-p(a))/86400000);return isNaN(v)?null:v;
}
function dashMD(d){if(!d)return '';const p=d.split('-');return (+p[1])+'/'+(+p[2]);}
function dashShort(n){ // 산지 뺀 이름에서 앞 1~2단어 (한 글자짜리면 두 단어)
  const w=String(n||'').trim().split(/\s+/);
  const origins=new Set((db.beans||[]).map(b=>b.origin).filter(Boolean));
  if(w.length>1&&origins.has(w[0]))w.shift();
  return w.slice(0,(w[0]||'').length<=2||/^(AA|AB|PB|G1|G2)$/i.test(w[1]||'')?2:1).join(' ');
}
/* 가공 이름 (한글, 짧게). 보통 워시드(Washed·Fully Washed)는 빈 글자 → 워시드가 아닌 것만 표시 (2026-11-12) */
const DASH_PROC_WORDS={natural:'내추럴',honey:'허니',washed:'워시드',anaerobic:'무산소',fermentation:'발효',double:'더블',cascada:'카스카다',
  carbonic:'카보닉',maceration:'매서레이션',thermal:'서멀',shock:'쇼크',classic:'클래식',red:'레드',yellow:'옐로',white:'화이트',black:'블랙',
  pulped:'펄프드',semi:'세미',wet:'웻',hulled:'헐드',fully:'풀리'};
function dashProc(b){
  const p=String((b&&b.process)||'').trim();if(!p)return '';
  const k=p.toLowerCase().replace(/\s+/g,' ');
  if(/^(fully )?washed$/.test(k)||/^(풀리 ?)?워시드$/.test(p))return '';
  return k.split(' ').map(w=>DASH_PROC_WORDS[w]||w).join(' ');
}
/* 홈 "지금 마실 원두" 이름: 원산지 + 짧은 이름 + (워시드가 아닌 가공) — 예: 케냐 카구모 AA / 에티오피아 시다모 내추럴 */
function dashFullName(name,b){
  const s=dashShort(name),origin=(b&&b.origin)||'',proc=dashProc(b);
  const parts=[];
  if(origin&&!s.startsWith(origin))parts.push(origin);
  parts.push(s);
  if(proc&&!s.replace(/\s/g,'').includes(proc.replace(/\s/g,'')))parts.push(proc);   // 줄인 이름에 이미 들어 있으면 중복해서 안 붙임
  return parts.join(' ');
}
/* 최근에 마신 평가 한 줄 (dailycup.js 의 dcBrief) — cs: 커피 한 잔 기록들, pre: 앞에 붙일 말 */
function dashLastCup(cs,pre){
  if(typeof dcBrief!=='function'||!cs||!cs.length)return '';
  const r=cs.slice().sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:(b.created_at||0)-(a.created_at||0))[0];
  return `<div class="dash-bean-ev">${pre||'최근 '}${dashMD(r.date)} · ${dashEsc(dcBrief(r))}</div>`;
}
let _dashMore=false;
function dashStage(days){ // 디개싱 단계 (브루잉 탭과 같은 기준)
  if(days==null)return {l:'',c:'var(--muted)',o:9};
  if(days<3)return {l:'이른 편',c:'var(--coral)',o:3};
  if(days<7)return {l:'디개싱 중',c:'var(--amber)',o:1};
  if(days<21)return {l:'최적기',c:'#7ed6a5',o:0};
  if(days<35)return {l:'양호',c:'var(--amber)',o:2};
  if(days<50)return {l:'후반기',c:'var(--muted2)',o:4};
  return {l:'노화',c:'var(--coral)',o:5};
}
function dashGoTab(name){
  const tb=[...document.querySelectorAll('.tb')].find(t=>(t.getAttribute('onclick')||'').includes(`'${name}'`));
  if(tb)showTab(name,tb);window.scrollTo(0,0);
}

function dashMarkDone(ids){
  const list=ids.split(',');
  if(!confirm(`이 ${list.length}배치를 '다 마심'으로 표시할까요?\n(로스팅 탭에서 다시 되돌릴 수 있어요)`))return;
  db.roasts.forEach(r=>{if(list.includes(r.id))r.stock_state='done';});
  saveDB();renderDash();
}
function renderDash(){
  const el=document.getElementById('dashRoot');if(!el)return;
  const t=today();
  const cups=(db.dailycups||[]);
  const roasts=db.roasts||[];

  // ── 숫자 4개 ──
  const inStock=db.beans.filter(b=>b.status!=='소진'&&b.status!=='샘플');
  const unroasted=inStock.filter(b=>!roasts.some(r=>roastOfBean(r,b)));
  const wk=r=>{const d=dashDays(r,t);return d!=null&&d>=0&&d<7;};
  const stats=[
    [inStock.length,'재고 생두'],[unroasted.length,'로스팅 전'],
    [roasts.filter(r=>wk(r.date)).length,'이번 주 로스팅'],[cups.filter(c=>wk(c.date)).length,'이번 주 한 잔'],
  ].map(([n,l])=>`<div class="stat-card"><div class="stat-n">${n}</div><div class="stat-l">${l}</div></div>`).join('');

  // ── 한눈에 보기: 생두 재고·원두·총 로스팅 (무게는 대략) ──
  const SS=typeof stockSummary==='function'?stockSummary():null;
  const sumCard=SS?`<div class="dash-card"><div class="dash-t">📊 한눈에 보기 <span>무게는 대략이에요</span></div>
    <div class="sum-grid">
      <div class="sum-i"><div class="sum-l">🫘 생두 재고</div><div class="sum-v">${fmtWeight(SS.greenG)}</div><div class="sum-s">${SS.greenKinds}종${SS.greenUnknown?` · 구매량 없는 ${SS.greenUnknown}종 제외`:''}</div></div>
      <div class="sum-i"><div class="sum-l">☕ 마시는 원두</div><div class="sum-v">${fmtWeight(SS.ownG+SS.boughtG)}</div><div class="sum-s">${SS.ownKinds+SS.boughtKinds}종${SS.frozenG?` · 🧊 ${fmtWeight(SS.frozenG)}`:''}</div></div>
      <div class="sum-i"><div class="sum-l">🔥 총 로스팅</div><div class="sum-v">${SS.roastCount}회</div><div class="sum-s">생두 ${fmtWeight(SS.inputG)} 투입</div></div>
    </div>
    <div class="dash-line">🔥 내가 로스팅한 원두 <b>${SS.ownKinds}종</b> · ${SS.ownBatches}배치 · ≈ ${fmtWeight(SS.ownG)}</div>
    <div class="dash-line">🛒 산 원두 <b>${SS.boughtKinds}종</b>${SS.boughtItems!==SS.boughtKinds?` · ${SS.boughtItems}봉지`:''} · ≈ ${fmtWeight(SS.boughtG)}</div></div>`:'';

  // ── 오늘의 한 잔 ──
  const todayCups=cups.filter(c=>c.date===t);
  const recent7=cups.filter(c=>wk(c.date));
  const avg7=recent7.length?(recent7.reduce((s,c)=>s+(+c.stars||0),0)/recent7.length).toFixed(1):'';
  const hints=typeof dcHintsHtml==='function'?dcHintsHtml():'';
  const lastCups=cups.slice().sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:(b.created_at||0)-(a.created_at||0)).slice(0,4);
  const cupCard=`<div class="dash-card">
    <div class="dash-t">☕ 커피 한 잔 <span>${todayCups.length?`오늘 ${todayCups.length}잔`:'오늘 아직 기록 없음'}${avg7?` · 최근 7일 평균 ★${avg7}`:''}</span></div>
    ${hints}
    ${lastCups.map(c=>`<div class="dash-line">${dashEsc(typeof dcSummary==='function'?dcSummary(c):c.date)}</div>`).join('')||'<div class="dash-empty">마신 커피를 별점으로 남겨 보세요</div>'}
    <button class="dash-btn" onclick="dashGoTab('dailycup')">☕ 커피 한 잔 기록하기</button></div>`;

  // ── 지금 마실 원두 (디개싱) ──
  const groups={};
  roasts.forEach(r=>{
    if(!roastHeld(r))return;   // 지인 나눔·다 마심 배치는 빼기
    if(r.frozen)return;        // 냉동 중인 건 아래 "냉동 중" 줄에서
    const d=dashDays(r.date,t);if(d==null||d<0||d>45)return;
    const bean=beanOfRoast(r);
    const k=r.date+'|'+r.bean_name;
    (groups[k]=groups[k]||{date:r.date,bean:r.bean_name,beanId:bean?bean.id:'',items:[],ids:[]}).items.push(r);
    groups[k].ids.push(r.id);
  });
  let rows=Object.values(groups).map(g=>{
    const bn=g.beanId?db.beans.find(b=>b.id===g.beanId):null;
    const w=restWindow(bn||{name:g.bean});
    const d=dashDays(g.date,t),st=restStage(d,w);
    const profs=[...new Set(g.items.sort((a,b)=>(+a.batch_no||0)-(+b.batch_no||0)).map(r=>{const dtr=parseFloat(r.dtr_pct);return r.mode?`${r.mode}-${isNaN(dtr)?'?':Math.round(dtr)}`:'';}).filter(Boolean))];
    const cs=cups.filter(c=>c.bean_info&&g.ids.includes(c.bean_info.roast_id));
    const av=cs.length?(cs.reduce((s,c)=>s+(+c.stars||0),0)/cs.length).toFixed(1):'';
    // 이 배치로 마신 평가가 아직 없으면(방금 볶은 것) 같은 생두의 이전 로스팅 평가를 보여 줌
    const ev=dashLastCup(cs)||(bn&&typeof dcCupsOfBean==='function'?dashLastCup(dcCupsOfBean({bean_id:bn.id,bean:g.bean}),'이전 로스팅 '):'');
    return {d,st,html:`<div class="dash-bean" onclick="${g.beanId?`openDailyCupFor('${g.beanId}')`:`dashGoTab('dailycup')`}">
      <div class="dash-bean-top"><b>${dashEsc(dashFullName(g.bean,bn))}</b><span class="dash-badge" style="color:${st.c};border-color:${st.c}">${d}일차 · ${st.l}</span></div>
      <div class="dash-bean-sub">${dashMD(g.date)} 로스팅 · 최적 ${w.min}~${w.max}일 · ${g.items.length}배치${profs.length?' ('+profs.join(', ')+')':''}${cs.length?` · ${cs.length}잔 ★${av}`:''}
        <button class="dash-done" onclick="event.stopPropagation();dashMarkDone('${g.ids.join(',')}')">다 마심</button></div>${ev}</div>`};
  });
  (db.roasted_beans||[]).filter(b=>b.status!=='다 마심'&&!b.frozen).forEach(b=>{
    const w=restWindow(b);
    const d=dashDays(b.roast_date,t),st=restStage(d,w);
    const cs=cups.filter(c=>c.bean_info&&c.bean_info.rb_id===b.id);
    const av=cs.length?(cs.reduce((s,c)=>s+(+c.stars||0),0)/cs.length).toFixed(1):'';
    rows.push({d,st,html:`<div class="dash-bean" onclick="openDailyCupRb('${b.id}')">
      <div class="dash-bean-top"><b>${dashEsc(b.name)}</b><span class="dash-badge" style="color:${st.c};border-color:${st.c}">${d!=null?d+'일차 · ':''}${st.l}</span></div>
      <div class="dash-bean-sub"><span class="dc-rbtag">산 원두</span> ${dashEsc(b.roastery||'')} · ${dashMD(b.roast_date)} 로스팅 · 최적 ${w.min}~${w.max}일${w.own?'(권장)':''}${cs.length?` · ${cs.length}잔 ★${av}`:''}</div>${dashLastCup(cs)}</div>`});
  });
  rows.sort((a,b)=>a.st.o-b.st.o||(a.st.wait??0)-(b.st.wait??0)||(a.d??99)-(b.d??99));  // 최적기 → 곧 최적기 → 지남
  // 🧊 냉동 중인 배치 (잊지 않게 따로 표시, 누르면 바로 기록)
  const frz=[];
  roasts.forEach(r=>{if(r.frozen&&roastHeld(r)){const bean=beanOfRoast(r);frz.push({label:dashFullName(r.bean_name,bean),rd:r.date,click:bean?`openDailyCupFor('${bean.id}')`:"dashGoTab('dailycup')",g:r.frozen_g,q:frozenLeft(r)});}});
  (db.roasted_beans||[]).forEach(b=>{if(b.frozen&&b.status!=='다 마심')frz.push({label:b.name,rd:b.roast_date,click:`openDailyCupRb('${b.id}')`,g:b.frozen_g,q:frozenLeft(b)});});
  // 같은 생두의 냉동 배치는 한 칩으로 묶음: "에티오피아 합타무 · 11/4~11/10분 · 6배치 · 15g×24"
  const frzG={};
  frz.forEach(x=>{const k=x.label;const g=frzG[k]=frzG[k]||{label:x.label,n:0,from:x.rd||'',to:x.rd||'',bags:0,gs:new Set(),click:x.click};
    g.n++;if((x.rd||'')<g.from)g.from=x.rd||'';if((x.rd||'')>g.to)g.to=x.rd||'';if(+x.q)g.bags+=+x.q;if(x.g)g.gs.add(x.g);});
  const frzList=Object.values(frzG).sort((a,b)=>(a.from||'').localeCompare(b.from||''));
  const frzHtml=frzList.length?`<div class="dash-sub">🧊 냉동 중 ${frzList.length}종 <span style="font-weight:400">· 누르면 바로 기록</span></div><div class="dash-chips">${frzList.map(g=>`<span style="cursor:pointer" onclick="${g.click}">${dashEsc(g.label)} · ${g.from===g.to?dashMD(g.from):dashMD(g.from)+'~'+dashMD(g.to)}분${g.n>1?' · '+g.n+'배치':''}${g.bags?' · '+(g.gs.size===1?[...g.gs][0]+'g':'')+'×'+g.bags:''}</span>`).join('')}</div>`:'';
  const LIM=6,shown=_dashMore?rows:rows.slice(0,LIM);
  const beanCard=`<div class="dash-card"><div class="dash-t">🫘 지금 마실 원두 <span>원두별 최적기 먼저 · 누르면 바로 기록</span></div>
    ${shown.map(r=>r.html).join('')||'<div class="dash-empty">최근 45일 안에 볶은 원두가 없어요</div>'}
    ${rows.length>LIM?`<button class="dash-btn ghost" onclick="_dashMore=!_dashMore;renderDash()">${_dashMore?'접기':`더 보기 (${rows.length-LIM}개)`}</button>`:''}${frzHtml}</div>`;

  // ── 로스팅 ──
  const dates=[...new Set(roasts.map(r=>r.date))].sort();
  const lastDate=dates[dates.length-1];
  const lastBatch=lastDate?roasts.filter(r=>r.date===lastDate).sort((a,b)=>(+a.batch_no||0)-(+b.batch_no||0)):[];
  const since=lastDate?dashDays(lastDate,t):null;
  const recent=roasts.filter(r=>r.input_g&&r.output_g&&!r.weight_unreliable).slice(-20);   // 정전기로 무게 부정확한 옛 기록 제외
  const lossAvg=recent.length?(recent.reduce((s,r)=>s+(1-r.output_g/r.input_g),0)/recent.length*100).toFixed(1):'';
  const low=typeof beanUsage==='function'?inStock.map(b=>({b,u:beanUsage(b)})).filter(x=>x.u.remaining!==null&&x.u.remaining<300&&x.u.count>0).sort((a,b)=>a.u.remaining-b.u.remaining):[];
  const roastCard=`<div class="dash-card"><div class="dash-t">🔥 로스팅 <span>${lastDate?`마지막 ${dashMD(lastDate)} (${since===0?'오늘':since+'일 전'}) · ${lastBatch.length}배치`:'기록 없음'}${lossAvg?` · 손실 ${lossAvg}% (무게 정확한 ${recent.length}배치)`:''}</span></div>
    ${lastBatch.length?`<div class="dash-chips">${lastBatch.map(r=>`<span>${r.batch_no?r.batch_no+'. ':''}${dashEsc(dashShort(r.bean_name))} ${r.mode?r.mode+'-'+(r.dtr_pct?Math.round(parseFloat(r.dtr_pct)):'?'):''}</span>`).join('')}</div>`:''}
    ${unroasted.length?`<div class="dash-sub">로스팅 전 생두 ${unroasted.length}종</div><div class="dash-chips">${unroasted.map(b=>`<span>${dashEsc(dashShort(b.name))}</span>`).join('')}</div>`:''}
    ${low.length?`<div class="dash-sub">얼마 안 남은 생두</div><div class="dash-chips">${low.map(x=>`<span class="${x.u.remaining<120?'warn':''}">${dashEsc(dashShort(x.b.name))} ≈${Math.max(0,Math.round(x.u.remaining))}g</span>`).join('')}</div>`:''}
    <div class="dash-btn-row"><button class="dash-btn" onclick="dashGoTab('timer')">🔥 빈본 타이머</button><button class="dash-btn ghost" onclick="dashGoTab('roasts')">로스팅 기록</button></div></div>`;

  el.innerHTML=`<div class="stat-row">${stats}</div>${sumCard}${cupCard}${beanCard}${roastCard}`;
  try{renderAIPanel();}catch(e){}
}

function renderAIPanel(){
  const hasKey=!!localStorage.getItem('cl_api_key');
  const savedResp=localStorage.getItem('cl_ai_resp')||'';
  document.getElementById('aiPanel').innerHTML=`
    <div class="ai-title">✦ AI 생두 추천</div>
    ${!hasKey?`<div class="ai-keyrow">
      <input class="ai-key" type="password" id="aiKeyInput" placeholder="Anthropic API Key (sk-ant-...)">
      <button class="btn btn-sm" onclick="saveApiKey()">저장</button>
    </div>`:`<div style="display:flex;align-items:center;gap:6px;margin-bottom:10px">
      <span style="font-size:11px;color:var(--teal)">● API 키 설정됨</span>
      <button class="btn2" style="font-size:10px;padding:3px 9px" onclick="clearApiKey()">해제</button>
    </div>`}
    <div class="ai-btn-row">
      <button class="btn btn-sm" onclick="loadAIRec()">추천 받기</button>
      <button class="btn2" onclick="clearAIResp()">초기화</button>
    </div>
    <div class="ai-resp ${savedResp?'':'empty'}" id="aiResp">${savedResp||'추천 받기 버튼을 누르면 현재 생두 재고와 브루잉 기록을 바탕으로 AI가 다음에 구매하면 좋을 생두를 추천해 드립니다.'}</div>`;
}

function saveApiKey(){
  const v=(document.getElementById('aiKeyInput')||{}).value||'';
  if(!v.startsWith('sk-')){alert('올바른 API 키를 입력하세요 (sk-ant-... 형식)');return;}
  localStorage.setItem('cl_api_key',v);
  renderAIPanel();
}

function clearApiKey(){
  localStorage.removeItem('cl_api_key');
  renderAIPanel();
}

function clearAIResp(){
  localStorage.removeItem('cl_ai_resp');
  renderAIPanel();
}

async function loadAIRec(){
  const key=localStorage.getItem('cl_api_key');
  if(!key){alert('API 키를 먼저 입력해 주세요');return;}
  const el=document.getElementById('aiResp');
  if(!el)return;
  el.className='ai-resp loading';
  el.textContent='AI가 생두 데이터를 분석하고 있습니다';

  const beans=db.beans.map(b=>`- ${b.name} (${b.origin||'?'}) ${b.process||''} 상태:${b.status||'?'} 스코어:${b.score_momos||b.score_wonderroom||'?'}`).join('\n');
  const logs=db.brewlogs.slice(-10).map(b=>`- ${b.date} ${b.bean_name} 산미${b.score_acid} 향${b.score_aroma} 맛${b.score_taste}`).join('\n');
  const wishlist=db.wishlist.map(w=>`- ${w.name} (${w.source||'?'})`).join('\n');

  const prompt=`당신은 스페셜티 커피 전문가입니다. 아래 정보를 바탕으로 다음에 구매하면 좋을 생두 2~3가지를 추천해 주세요.

현재 보유 생두:
${beans||'없음'}

최근 브루잉 기록:
${logs||'없음'}

구매 검토 목록:
${wishlist||'없음'}

추천 시 고려사항:
- 현재 소진되었거나 재고가 적은 생두 대체재
- 최근 즐겨 마신 컵노트/원산지 성향
- 다양성 (같은 원산지 편중 방지)
- 구매 검토 목록 중 우선순위

각 추천 생두에 대해 추천 이유를 간결하게 한국어로 작성해 주세요. 150자 이내로.`;

  try{
    const res=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'x-api-key':key,
        'anthropic-version':'2023-06-01',
        'anthropic-dangerous-direct-browser-access':'true',
      },
      body:JSON.stringify({
        model:'claude-haiku-4-5-20251001',
        max_tokens:400,
        messages:[{role:'user',content:prompt}],
      }),
    });
    if(!res.ok){const e=await res.json();throw new Error(e.error?.message||res.status);}
    const data=await res.json();
    const text=data.content?.[0]?.text||'응답 없음';
    el.className='ai-resp';
    el.textContent=text;
    localStorage.setItem('cl_ai_resp',text);
  }catch(e){
    el.className='ai-resp';
    el.textContent='오류: '+e.message;
  }
}


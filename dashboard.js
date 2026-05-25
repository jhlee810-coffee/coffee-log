function renderDash(){
  renderStatRow();
  renderAIPanel();
  renderDashRight();
  renderRecentAct();
}

function renderStatRow(){
  const total=db.beans.length;
  const inStock=db.beans.filter(b=>b.status==='재고있음'||b.status==='잔량부족'||b.status==='샘플').length;
  const roastCnt=db.roasts.length;
  const brewCnt=db.brewlogs.length;
  document.getElementById('dashStats').innerHTML=
    statCard(total,'전체 생두','var(--text2)')+
    statCard(inStock,'재고있음','var(--teal)')+
    statCard(roastCnt,'로스팅','var(--amber)')+
    statCard(brewCnt,'브루잉','var(--coral)');
}

function statCard(n,label,color){
  return`<div class="stat-card"><div class="stat-n" style="color:${color}">${n}</div><div class="stat-l">${label}</div></div>`;
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

function renderDashRight(){
  document.getElementById('dashRight').innerHTML=
    renderTasteProfile()+
    renderDonutChart()+
    renderStockRec();
}

function renderTasteProfile(){
  const logs=db.brewlogs.filter(b=>b.score_acid||b.score_aroma||b.score_taste);
  if(!logs.length) return`<div class="panel"><div class="panel-title">테이스트 프로필</div><div style="font-size:12px;color:var(--muted);font-style:italic">브루잉 기록이 없습니다</div></div>`;
  const avg=arr=>arr.length?(arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(1):0;
  const acid=avg(logs.map(b=>+b.score_acid||0));
  const aroma=avg(logs.map(b=>+b.score_aroma||0));
  const taste=avg(logs.map(b=>+b.score_taste||0));
  const bar=(lbl,val)=>`<div class="taste-row">
    <div class="taste-lbl">${lbl}</div>
    <div class="taste-track"><div class="taste-fill" style="width:${val*10}%"></div></div>
    <div class="taste-val">${val}</div>
  </div>`;
  return`<div class="panel">
    <div class="panel-title">테이스트 평균 <span style="font-size:10px;color:var(--muted);font-weight:400">(최근 ${logs.length}회)</span></div>
    ${bar('산미',acid)}${bar('향',aroma)}${bar('맛',taste)}
  </div>`;
}

function renderDonutChart(){
  const roasts=db.roasts.filter(r=>r.roast_level);
  if(!roasts.length) return`<div class="panel"><div class="panel-title">로스팅 분포</div><div style="font-size:12px;color:var(--muted);font-style:italic">로스팅 기록이 없습니다</div></div>`;
  const total=roasts.length;
  const counts={라이트:0,미디엄:0,다크:0};
  roasts.forEach(r=>{if(counts[r.roast_level]!==undefined)counts[r.roast_level]++;});
  const colors={라이트:'var(--amber)',미디엄:'var(--teal)',다크:'var(--coral)'};
  const r=44,cx=50,cy=50,stroke=14;
  const circ=2*Math.PI*r;
  let offset=0;
  const segments=Object.entries(counts).filter(([,v])=>v>0).map(([k,v])=>{
    const pct=v/total;
    const dash=pct*circ;
    const seg={key:k,val:v,pct:Math.round(pct*100),dash,offset,color:colors[k]};
    offset+=dash;
    return seg;
  });
  const svgSegs=segments.map(s=>`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${stroke}" stroke-dasharray="${s.dash} ${circ-s.dash}" stroke-dashoffset="${-s.offset}" transform="rotate(-90 ${cx} ${cy})"/>`).join('');
  const legend=segments.map(s=>`<div class="donut-item"><div class="donut-dot" style="background:${s.color}"></div>${s.key} ${s.pct}%</div>`).join('');
  return`<div class="panel">
    <div class="panel-title">로스팅 분포</div>
    <div class="donut-wrap">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--b2)" stroke-width="${stroke}"/>
        ${svgSegs}
        <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" fill="var(--text2)" font-size="11" font-family="Bebas Neue">${total}</text>
      </svg>
      <div class="donut-legend">${legend}</div>
    </div>
  </div>`;
}

function renderStockRec(){
  const lowBeans=db.beans.filter(b=>b.status==='잔량부족'||b.status==='소진');
  if(!lowBeans.length) return`<div class="panel"><div class="panel-title">재고 알림</div><div style="font-size:12px;color:var(--muted);font-style:italic">재고 부족 생두 없음</div></div>`;
  const items=lowBeans.map(b=>{
    const isSogin=b.status==='소진';
    const color=isSogin?'var(--coral)':'var(--amber)';
    return`<div class="srec-item">
      <div class="srec-dot" style="background:${color}"></div>
      <div class="srec-name">${b.name}</div>
      <div class="srec-status" style="color:${color}">${b.status}</div>
    </div>`;
  }).join('');
  return`<div class="panel"><div class="panel-title">재고 알림</div>${items}</div>`;
}

function renderRecentAct(){
  const rec=[
    ...db.roasts.slice(-5).map(r=>({date:r.date,text:'🔥 '+r.bean_name+(r.mode?' — 모드'+r.mode:'')})),
    ...db.brewlogs.slice(-3).map(b=>({date:b.date,text:'☕ '+b.bean_name+' 브루잉'})),
  ].sort((a,b)=>b.date>a.date?1:-1).slice(0,8);
  document.getElementById('recentAct').innerHTML=rec.length?
    rec.map(r=>`<div class="ri"><div class="rdot"></div><div class="rt2">${r.text}</div><div class="rd2">${r.date}</div></div>`).join(''):
    '<div class="empty"><div class="empty-icon">☕</div><div class="empty-text">아직 기록이 없습니다</div></div>';
}

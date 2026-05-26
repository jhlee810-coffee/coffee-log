function renderBrewing(){
  renderRecipes();
  renderBrewLogs();
}

function renderRecipes(){
  document.getElementById('officialRecipes').innerHTML=OFFICIAL_RECIPES.map(r=>`
    <div class="rc2 ${r.color}" onclick="toggleTimer('${r.id}')">
      <div class="rtype ${r.color}">${r.type}</div>
      <div class="rname2">${r.name}</div>
      <div class="rmeta"><span>${r.coffee}g</span><span>${r.water}ml</span><span>${r.temp}°C</span>${r.grind?`<span>${r.grind}</span>`:''}</div>
      <div class="rdesc">${r.desc}</div>
    </div>`).join('');

  const myHTML=db.recipes.map(r=>`
    <div class="rc2 cu" onclick="toggleTimer('${r.id}')">
      <div class="rtype cu">내 레시피</div>
      <div class="rname2">${r.name}</div>
      <div class="rmeta">${r.coffee?`<span>${r.coffee}g</span>`:''}<span>${r.water||''}ml</span><span>${r.temp||''}°C</span>${r.grind?`<span>${r.grind}</span>`:''}</div>
      <div class="rdesc">${r.desc||''}</div>
    </div>`).join('');
  document.getElementById('myRecipes').innerHTML=myHTML+`
    <div class="rc2 add cu" onclick="openRecipeForm()">
      <div style="text-align:center;color:var(--muted)"><div style="font-size:28px">+</div><div style="font-size:12px;font-weight:500;margin-top:4px">레시피 추가</div></div>
    </div>`;

  renderTimerViews();
}

function renderTimerViews(){
  const allRecs=[...OFFICIAL_RECIPES,...db.recipes.map(r=>({
    ...r,color:'cu',
    steps:(r.steps_raw||'').split('\n').filter(Boolean).map(line=>{
      const m=line.match(/^(\d+:\d+)\s+(.+?)\s+(\d+g|↓|✓)?$/);
      return m?{time:m[1],action:m[2],detail:'',water:m[3]||''}:{time:'',action:line,detail:'',water:''};
    }),
  }))];
  document.getElementById('timerViews').innerHTML=allRecs.map(r=>`
    <div class="tv" id="tv_${r.id}" style="display:none;">
      <div class="tvh">
        <span style="display:inline-block;font-size:10px;padding:2px 9px;border-radius:20px;font-weight:700;background:var(--teal2);color:var(--teal);border:1px solid var(--teal3);">${r.type||'내 레시피'}</span>
        <div class="tvn">${r.name}</div>
        <button class="btn2" onclick="closeTimer('${r.id}')">✕</button>
      </div>
      <div class="tvp">
        ${r.coffee?`<span>원두 <span>${r.coffee}g</span></span>`:''}
        ${r.water?`<span>물 <span>${r.water}ml</span></span>`:''}
        ${r.temp?`<span>수온 <span>${r.temp}°C</span></span>`:''}
        ${r.grind?`<span>분쇄 <span>${r.grind}</span></span>`:''}
      </div>
      ${r.water_ratio?`<div class="wbox"><b>💧 가수 비율</b>${r.water_ratio}</div>`:''}
      <div class="steps2">
        ${(r.steps||[]).map((s,i)=>`
          <div class="step2 ${i===0?'ac':''}" onclick="tglStep(this)">
            <div class="stime2">${s.time}</div>
            <div class="sbar2 ${i===0?'on':''}"></div>
            <div class="sinfo2"><div class="sact2">${s.action}</div>${s.detail?`<div class="sdtl2">${s.detail}</div>`:''}</div>
            <div class="swt2">${s.water}</div>
          </div>`).join('')}
      </div>
    </div>`).join('');
}

function toggleTimer(id){
  const el=document.getElementById('tv_'+id);
  if(!el) return;
  if(openTimerId&&openTimerId!==id){
    const prev=document.getElementById('tv_'+openTimerId);
    if(prev) prev.style.display='none';
  }
  if(el.style.display==='none'||!el.style.display){
    el.style.display='block';
    openTimerId=id;
    setTimeout(()=>el.scrollIntoView({behavior:'smooth',block:'nearest'}),100);
  }else{
    el.style.display='none';
    openTimerId=null;
  }
}

function closeTimer(id){
  const el=document.getElementById('tv_'+id);
  if(el) el.style.display='none';
  openTimerId=null;
}

function tglStep(el){
  el.classList.toggle('dn');
  el.classList.toggle('ac');
  el.querySelector('.sbar2').classList.toggle('on');
  el.querySelector('.stime2').classList.toggle('dn');
  el.querySelector('.sact2').classList.toggle('dn');
  el.querySelector('.swt2').classList.toggle('dn');
}

function openRecipeForm(id){
  document.getElementById('recId').value=id||'';
  const r=id?db.recipes.find(x=>x.id===id):{};
  ['f_recn','f_recc','f_recw','f_rect','f_recg','f_recwater','f_recsteps','f_recdesc'].forEach(i=>document.getElementById(i).value='');
  if(id&&r){
    document.getElementById('f_recn').value=r.name||'';
    document.getElementById('f_recc').value=r.coffee||'';
    document.getElementById('f_recw').value=r.water||'';
    document.getElementById('f_rect').value=r.temp||'';
    document.getElementById('f_recg').value=r.grind||'';
    document.getElementById('f_recwater').value=r.water_ratio||'';
    document.getElementById('f_recsteps').value=r.steps_raw||'';
    document.getElementById('f_recdesc').value=r.desc||'';
  }
  openMo('moRecipeForm');
}

function saveRecipe(){
  const id=document.getElementById('recId').value;
  const name=document.getElementById('f_recn').value.trim();
  if(!name){alert('레시피명을 입력하세요');return;}
  const data={
    id:id||genId(),name,
    coffee:document.getElementById('f_recc').value,
    water:document.getElementById('f_recw').value,
    temp:document.getElementById('f_rect').value,
    grind:document.getElementById('f_recg').value.trim(),
    water_ratio:document.getElementById('f_recwater').value.trim(),
    steps_raw:document.getElementById('f_recsteps').value.trim(),
    desc:document.getElementById('f_recdesc').value.trim(),
  };
  if(id){const i=db.recipes.findIndex(r=>r.id===id);if(i>=0)db.recipes[i]=data;}
  else db.recipes.push(data);
  saveDB();closeMo('moRecipeForm');renderRecipes();
}

function renderBrewLogs(){
  const el=document.getElementById('brewLogList');
  el.innerHTML=[...db.brewlogs].reverse().map(b=>{
    const sc_a=b.score_acid,sc_sw=b.score_sweet,sc_r=b.score_aroma,sc_t=b.score_taste;
    return`<div class="blcard">
      <div class="blhead">
        <div class="bldate">${b.date}</div>
        <div class="blinfo">
          <div class="blbean">${b.bean_name}</div>
          <div class="blchain">${b.roast_ref?`로스팅 <span>${b.roast_ref}</span> · `:''}레시피 <span>${b.recipe_name||'—'}</span></div>
        </div>
      </div>
      <div class="blstats">
        ${b.coffee_g?`<span>원두 <span>${b.coffee_g}g</span></span>`:''}
        ${b.water_g?`<span>물 <span>${b.water_g}ml</span></span>`:''}
        ${b.temp?`<span>수온 <span>${b.temp}°C</span></span>`:''}
        ${b.grind?`<span>분쇄 <span>${b.grind}</span></span>`:''}
        ${b.water_ratio?`<span>가수 <span>${b.water_ratio}</span></span>`:''}
      </div>
      ${(sc_a||sc_sw||sc_r||sc_t)?`<div class="scores">
        ${sc_a?scRing('산미',sc_a):''}${sc_sw?scRing('단맛',sc_sw):''}${sc_r?scRing('향',sc_r):''}${sc_t?scRing('맛',sc_t):''}
      </div>`:''}
      ${b.memo?`<div class="blmemo">${b.memo}</div>`:''}
      ${b.neg_tags&&b.neg_tags.length?`<div class="negtags">${b.neg_tags.map(t=>`<span class="ntag">${t}</span>`).join('')}</div>`:''}
      <div class="ract"><button class="btn2" onclick="editBrewLog('${b.id}')">수정</button><button class="btnd" onclick="deleteBrewLog('${b.id}')">삭제</button></div>
    </div>`;
  }).join('')||'<div class="empty"><div class="empty-icon">☕</div><div class="empty-text">브루잉 기록이 없습니다</div></div>';
}

function scRing(l,v){
  const c=v>=8?'var(--teal)':v>=6?'var(--amber)':'var(--coral)';
  return`<div class="scitem"><div class="scring" style="border-color:${c}">${v}</div><div class="sclbl">${l}</div></div>`;
}

function openBrewLogForm(id){
  fillSel('f_blbean',db.beans.map(b=>b.name));
  const allRecs=[...OFFICIAL_RECIPES.map(r=>r.name),...db.recipes.map(r=>r.name)];
  fillSel('f_blrec',allRecs);
  document.getElementById('blId').value=id||'';
  const b=id?db.brewlogs.find(x=>x.id===id):{};
  document.getElementById('f_bld').value=b.date||today();
  document.getElementById('f_blbean').value=b.bean_name||'';
  document.getElementById('f_blrec').value=b.recipe_name||'';
  document.getElementById('f_blc').value=b.coffee_g||'';
  document.getElementById('f_blw').value=b.water_g||'';
  document.getElementById('f_blt').value=b.temp||'';
  document.getElementById('f_blg').value=b.grind||'';
  document.getElementById('f_blwater').value=b.water_ratio||'';
  document.getElementById('f_bla').value=b.score_acid||5;
  document.getElementById('f_blsw').value=b.score_sweet||5;
  document.getElementById('f_blar').value=b.score_aroma||5;
  document.getElementById('f_blta').value=b.score_taste||5;
  document.getElementById('va').textContent=b.score_acid||5;
  document.getElementById('vs').textContent=b.score_sweet||5;
  document.getElementById('vr').textContent=b.score_aroma||5;
  document.getElementById('vt').textContent=b.score_taste||5;
  document.getElementById('f_blmemo').value=b.memo||'';
  updateRoastSel(b.bean_name||'',b.roast_id||'');
  document.getElementById('negSel').innerHTML=NEG.map(t=>`<div class="nts${b.neg_tags&&b.neg_tags.includes(t)?' on':''}" onclick="this.classList.toggle('on')">${t}</div>`).join('');
  openMo('moBrewLog');
}

function updateRoastSel(beanName,selId){
  const roasts=db.roasts.filter(r=>r.bean_name===beanName).reverse();
  const sel=document.getElementById('f_blroast');
  sel.innerHTML='<option value="">선택...</option>'+roasts.map(r=>`<option value="${r.id}" ${r.id===selId?'selected':''}>${r.date} 모드${r.mode||'?'} DTR${r.dtr_pct||'?'}%</option>`).join('');
}

function editBrewLog(id){openBrewLogForm(id);}

function saveBrewLog(){
  const id=document.getElementById('blId').value;
  const bn=document.getElementById('f_blbean').value;
  if(!bn){alert('생두를 선택하세요');return;}
  const roastId=document.getElementById('f_blroast').value;
  const roast=db.roasts.find(r=>r.id===roastId);
  const roastRef=roast?`${roast.date} 모드${roast.mode||'?'} DTR${roast.dtr_pct||'?'}%`:'';
  const neg=[...document.querySelectorAll('#negSel .nts.on')].map(e=>e.textContent);
  const data={
    id:id||genId(),
    date:document.getElementById('f_bld').value,
    bean_name:bn,
    roast_id:roastId,
    roast_ref:roastRef,
    recipe_name:document.getElementById('f_blrec').value,
    coffee_g:document.getElementById('f_blc').value,
    water_g:document.getElementById('f_blw').value,
    temp:document.getElementById('f_blt').value,
    grind:document.getElementById('f_blg').value.trim(),
    water_ratio:document.getElementById('f_blwater').value.trim(),
    score_acid:+document.getElementById('f_bla').value,
    score_sweet:+document.getElementById('f_blsw').value,
    score_aroma:+document.getElementById('f_blar').value,
    score_taste:+document.getElementById('f_blta').value,
    neg_tags:neg,
    memo:document.getElementById('f_blmemo').value.trim(),
  };
  if(id){const i=db.brewlogs.findIndex(b=>b.id===id);if(i>=0)db.brewlogs[i]=data;}
  else db.brewlogs.push(data);
  saveDB();closeMo('moBrewLog');renderBrewLogs();
}

function deleteBrewLog(id){
  if(!confirm('삭제?'))return;
  db.brewlogs=db.brewlogs.filter(b=>b.id!==id);
  saveDB();renderBrewLogs();
}

function renderRoasts(){
  document.getElementById('roastList').innerHTML=[...db.roasts].reverse().map(r=>`
    <div class="rcard">
      <div class="rhead">
        <div class="rdate">${r.date}</div>
        <div class="rname">${r.bean_name}</div>
        ${r.roast_level?`<span class="rlv">${r.roast_level}</span>`:''}
      </div>
      <div class="rstats">
        ${r.mode?`<span>모드 <span>${r.mode}</span></span>`:''}
        ${r.input_g?`<span>투입 <span>${r.input_g}g</span></span>`:''}
        ${r.output_g?`<span>배출 <span>${r.output_g}g</span></span>`:''}
        ${r.loss_pct?`<span>손실 <span>${r.loss_pct}%</span></span>`:''}
        ${r.pop_time?`<span>1팝 <span>${r.pop_time}</span></span>`:''}
        ${r.eject_time?`<span>배출 <span>${r.eject_time}</span></span>`:''}
        ${r.dtr_pct?`<span class="rdtr">DTR <span>${r.dtr_pct}%</span></span>`:''}
      </div>
      ${r.notes?`<div class="rmemo">${r.notes}</div>`:''}
      <div class="ract"><button class="btn2" onclick="editRoast('${r.id}')">수정</button></div>
    </div>`).join('')||
    '<div class="empty"><div class="empty-icon">🔥</div><div class="empty-text">로스팅 기록이 없습니다</div></div>';
}

function openRoastForm(id){
  fillSel('f_rb',db.beans.map(b=>b.name));
  document.getElementById('rfId').value=id||'';
  const r=id?db.roasts.find(x=>x.id===id):{};
  document.getElementById('f_rd').value=r.date||today();
  document.getElementById('f_rb').value=r.bean_name||'';
  document.getElementById('f_rm').value=r.mode||'';
  document.getElementById('f_ri').value=r.input_g||'';
  document.getElementById('f_ro').value=r.output_g||'';
  document.getElementById('f_rp').value=r.pop_time||'';
  document.getElementById('f_re').value=r.eject_time||'';
  document.getElementById('f_rb2').value=r.time_basis||'';
  document.getElementById('f_rl').value=r.roast_level||'';
  document.getElementById('f_rn').value=r.notes||'';
  openMo('moRoastForm');
}

function editRoast(id){openRoastForm(id);}

function saveRoast(){
  const id=document.getElementById('rfId').value;
  const bn=document.getElementById('f_rb').value;
  if(!bn){alert('생두를 선택하세요');return;}
  const ig=parseFloat(document.getElementById('f_ri').value)||'';
  const og=parseFloat(document.getElementById('f_ro').value)||'';
  const lp=(ig&&og)?((ig-og)/ig*100).toFixed(1):'';
  const pop=document.getElementById('f_rp').value;
  const ej=document.getElementById('f_re').value;
  const bs=document.getElementById('f_rb2').value;
  let dtr='';
  if(pop&&ej&&bs){
    const ps=toSec(pop),es=toSec(ej);
    dtr=bs==='잔여'?((ps-es)/ps*100).toFixed(1):((es-ps)/ps*100).toFixed(1);
  }
  const data={
    id:id||genId(),
    date:document.getElementById('f_rd').value,
    bean_name:bn,
    shop:db.beans.find(b=>b.name===bn)?.shop||'',
    mode:document.getElementById('f_rm').value,
    input_g:ig.toString(),
    output_g:og.toString(),
    loss_pct:lp.toString(),
    pop_time:pop,
    eject_time:ej,
    time_basis:bs,
    dtr_pct:dtr.toString(),
    roast_level:document.getElementById('f_rl').value,
    notes:document.getElementById('f_rn').value.trim(),
  };
  if(id){const i=db.roasts.findIndex(r=>r.id===id);if(i>=0)db.roasts[i]=data;}
  else db.roasts.push(data);
  saveDB();closeMo('moRoastForm');renderRoasts();
}

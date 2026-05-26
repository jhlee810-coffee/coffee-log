const BINBON_MODES={2:445,3:399,4:406,5:470,6:362,7:405};

let rFilterKey='all';
let rSortDir='desc'; // desc=최신순, asc=번호순(오래된것부터)

function dtrToLevel(dtr){
  const d=parseFloat(dtr);
  if(!d||d<8) return '';
  if(d<13) return '라이트';
  if(d<16) return '라이트-미디엄';
  if(d<19) return '미디엄';
  if(d<22) return '미디엄-다크';
  return '다크';
}

function toggleRSort(){
  rSortDir=rSortDir==='desc'?'asc':'desc';
  const btn=document.getElementById('rSortBtn');
  if(btn) btn.textContent=rSortDir==='desc'?'최신순↓':'번호순↑';
  renderRoasts();
}

function renderRoasts(){
  // 원산지·구매처 필터 칩
  const origins=[...new Set(db.beans.map(b=>b.origin).filter(Boolean))];
  const shops=[...new Set(db.beans.map(b=>b.shop).filter(Boolean))];
  document.getElementById('roastFilters').innerHTML=
    `<div class="fc ${rFilterKey==='all'?'on':''}" onclick="setRF('all')">전체</div>`+
    origins.map(o=>`<div class="fc ${rFilterKey===o?'on':''}" onclick="setRF('${o}')">${o}</div>`).join('')+
    shops.map(s=>`<div class="fc ${rFilterKey===s?'on':''}" onclick="setRF('${s}')">${s}</div>`).join('');

  // 일련번호: 날짜 오름차순 → #1=가장 오래된 것
  const sorted=[...db.roasts].sort((a,b)=>a.date>b.date?1:-1);
  const serialMap={};
  sorted.forEach((r,i)=>serialMap[r.id]=i+1);

  // 필터 적용
  let list=[...sorted];
  if(rFilterKey!=='all'){
    list=list.filter(r=>{
      const bean=db.beans.find(b=>b.name===r.bean_name);
      return bean&&(bean.origin===rFilterKey||bean.shop===rFilterKey);
    });
  }

  // 정렬 적용 (desc=최신순, asc=오래된순=번호순)
  if(rSortDir==='desc') list=[...list].reverse();

  document.getElementById('roastList').innerHTML=list.map(r=>{
    const serial=serialMap[r.id];
    const bean=db.beans.find(b=>b.name===r.bean_name)||{};
    const beanYear=bean.stock_date?bean.stock_date.slice(0,4):'';
    const beanMonth=bean.stock_date?bean.stock_date.slice(2,4)+'.'+bean.stock_date.slice(5,7):'';
    const beanPrice=bean.price?Math.round(parseFloat(bean.price)):'';

    const beanInfoParts=[bean.origin,r.bean_name].filter(Boolean).join('  ');
    const beanMetaParts=[beanYear,bean.shop,beanPrice,beanMonth].filter(Boolean).join('  ');

    // 브루잉 연계 점수
    const brews=db.brewlogs.filter(b=>b.roast_id===r.id);
    let brewHTML='';
    if(brews.length){
      const avg=field=>{
        const vals=brews.map(b=>+b[field]).filter(v=>v>0);
        return vals.length?(vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1):null;
      };
      const scores=[['산미',avg('score_acid')],['단맛',avg('score_sweet')],['향',avg('score_aroma')],['맛',avg('score_taste')]].filter(([,v])=>v!==null);
      if(scores.length){
        brewHTML=`<div class="rbrew">
          <span class="rbrew-lbl">브루잉 평균</span>
          ${scores.map(([l,v])=>`<span class="rbrew-score">${l} <span>${v}</span></span>`).join('')}
          <span class="rbrew-cnt">(${brews.length}회)</span>
        </div>`;
      }
    }

    const levelColor={'라이트':'var(--amber)','라이트-미디엄':'#f5c36e','미디엄':'var(--teal)','미디엄-다크':'#5ec4b8','다크':'var(--coral)'}[r.roast_level]||'var(--muted)';

    return`<div class="rcard" onclick="openRoastDetail('${r.id}')" style="cursor:pointer;">
      <div class="rhead">
        <span class="rserial">#${String(serial).padStart(2,'0')}</span>
        <div class="rdate">${r.date}</div>
        ${r.roast_level?`<span class="rlv" style="color:${levelColor};border-color:${levelColor}33;background:${levelColor}18">${r.roast_level}</span>`:''}
        <div style="margin-left:auto"><button class="btn2" onclick="event.stopPropagation();editRoast('${r.id}')">수정</button></div>
      </div>
      <div class="rbeaninfo"><b>${beanInfoParts}</b>${beanMetaParts?`  /  ${beanMetaParts}`:''}</div>
      <div class="rstats">
        ${r.mode?`<span>모드${r.mode}</span>`:''}
        ${r.dtr_pct?`<span class="rdtr">DTR ${r.dtr_pct}%</span>`:''}
        ${r.loss_pct?`<span>손실율 ${r.loss_pct}%</span>`:''}
        ${r.input_g?`<span>투입 ${r.input_g}g</span>`:''}
      </div>
      ${r.notes?`<div class="rmemo">${r.notes}</div>`:''}
      ${brewHTML}
    </div>`;
  }).join('')||'<div class="empty"><div class="empty-icon">🔥</div><div class="empty-text">로스팅 기록이 없습니다</div></div>';
}

function setRF(key){rFilterKey=key;renderRoasts();}

function openRoastDetail(id){
  const r=db.roasts.find(x=>x.id===id);
  if(!r)return;
  const sorted=[...db.roasts].sort((a,b)=>a.date>b.date?1:-1);
  const serial=sorted.findIndex(x=>x.id===id)+1;
  const bean=db.beans.find(b=>b.name===r.bean_name)||{};
  const levelColor={'라이트':'var(--amber)','라이트-미디엄':'#f5c36e','미디엄':'var(--teal)','미디엄-다크':'#5ec4b8','다크':'var(--coral)'}[r.roast_level]||'var(--muted)';
  const brews=db.brewlogs.filter(b=>b.roast_id===id);
  const avgField=field=>{
    const vals=brews.map(b=>+b[field]).filter(v=>v>0);
    return vals.length?(vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1):null;
  };
  const brewScores=[['산미',avgField('score_acid')],['단맛',avgField('score_sweet')],['향',avgField('score_aroma')],['맛',avgField('score_taste')]].filter(([,v])=>v!==null);
  const ring=(l,v)=>{const c=v>=8?'var(--teal)':v>=6?'var(--amber)':'var(--coral)';return`<div class="scitem"><div class="scring" style="border-color:${c}">${v}</div><div class="sclbl">${l}</div></div>`;};
  document.getElementById('rdTitle').innerHTML=`<span style="font-size:12px;color:var(--muted);font-family:'DM Sans',sans-serif;font-weight:500;letter-spacing:.05em">#${String(serial).padStart(2,'0')} · ${r.date}</span><br>${r.bean_name}`;
  document.getElementById('rdContent').innerHTML=`
    <div class="ds">
      <div class="dstitle">생두 정보</div>
      ${dr('원산지',bean.origin||'')}
      ${dr('구매처',bean.shop||'')}
    </div>
    <div class="ds">
      <div class="dstitle">로스팅 수치</div>
      ${r.roast_level?dr('레벨',`<span style="color:${levelColor};font-weight:700">${r.roast_level}</span>`):''}
      ${dr('빈본 모드',r.mode?`모드${r.mode}`:'')}
      ${dr('DTR',r.dtr_pct?r.dtr_pct+'%':'')}
      ${dr('손실율',r.loss_pct?r.loss_pct+'%':'')}
      ${dr('투입',r.input_g?r.input_g+'g':'')}
      ${dr('배출',r.output_g?r.output_g+'g':'')}
      ${dr('1팝 잔여',r.pop_time||'')}
      ${dr('배출 잔여',r.eject_time||'')}
    </div>
    ${r.notes?`<div class="ds"><div class="dstitle">메모</div><div style="font-family:'Playfair Display',serif;font-size:13px;color:var(--text2);line-height:1.7;font-style:italic">${r.notes}</div></div>`:''}
    ${brewScores.length?`<div class="ds"><div class="dstitle">브루잉 평균 (${brews.length}회)</div><div class="scores" style="margin-top:8px">${brewScores.map(([l,v])=>ring(l,v)).join('')}</div></div>`:''}
  `;
  document.getElementById('rdEditBtn').onclick=()=>{closeMo('moRoastDetail');editRoast(id);};
  openMo('moRoastDetail');
}

/* ── 폼 UX 헬퍼 (로스팅 전용) ── */
function setMode(m){
  document.getElementById('f_rm').value=m;
  document.querySelectorAll('#modeBtns .mbtn').forEach(b=>{
    b.classList.toggle('on',b.textContent==m);
  });
  calcRoastLive();
}

function setWt(fieldId,val,chip){
  document.getElementById(fieldId).value=val;
  if(chip){
    chip.closest('.preset-chips').querySelectorAll('.pchip').forEach(c=>c.classList.remove('on'));
    chip.classList.add('on');
  }
  calcRoastLive();
}
function adjWt(fieldId,delta){
  const el=document.getElementById(fieldId);
  el.value=Math.max(0,(+el.value||0)+delta);
  calcRoastLive();
}
function setTm(fieldId,t){
  document.getElementById(fieldId).value=t;
  calcRoastLive();
}
function adjTm(fieldId,deltaSec){
  const el=document.getElementById(fieldId);
  const parts=(el.value||'0:00').split(':');
  let sec=+parts[0]*60+(+parts[1]||0)+deltaSec;
  if(sec<0)sec=0;
  const m=Math.floor(sec/60),s=sec%60;
  el.value=`${m}:${String(s).padStart(2,'0')}`;
  calcRoastLive();
}

/* DTR 자동 계산 (빈본 모드 기준 잔여시간) */
function calcRoastLive(){
  const ig=parseFloat(document.getElementById('f_ri').value)||0;
  const og=parseFloat(document.getElementById('f_ro').value)||0;
  const pop=document.getElementById('f_rp').value;
  const ej=document.getElementById('f_re').value;
  const mode=+document.getElementById('f_rm').value;
  const autoEject=BINBON_MODES[mode];

  let lossStr='—',dtrStr='—',levelStr='—';

  if(ig&&og){
    lossStr=((ig-og)/ig*100).toFixed(1)+'%';
  }

  if(pop&&ej){
    const ps=toSec(pop),es=toSec(ej);
    if(!autoEject){
      dtrStr='모드 선택 필요';
    } else if(ps>es&&(autoEject-es)>0){
      // DTR = 개발시간 / 배출시점까지 총경과시간
      // 개발시간 = pop잔여 - 배출잔여
      // 배출시점경과 = autoEject - 배출잔여
      const dtr=(ps-es)/(autoEject-es)*100;
      dtrStr=dtr.toFixed(1)+'%';
      levelStr=dtrToLevel(dtr)||'—';
    }
  }

  document.getElementById('ac_loss').textContent='손실율 '+lossStr;
  document.getElementById('ac_dtr').textContent='DTR '+dtrStr;
  document.getElementById('ac_level').textContent='레벨 '+levelStr;
  document.getElementById('f_rl').value=levelStr==='—'?'':levelStr;
}

/* ── 폼 열기/저장 ── */
function openRoastForm(id){
  fillSel('f_rb',db.beans.map(b=>b.name));
  document.getElementById('rfId').value=id||'';
  const r=id?db.roasts.find(x=>x.id===id):{};
  document.getElementById('f_rd').value=r.date||today();
  document.getElementById('f_rb').value=r.bean_name||'';
  document.getElementById('f_rp').value=r.pop_time||'';
  document.getElementById('f_re').value=r.eject_time||'';
  document.getElementById('f_rn').value=r.notes||'';
  document.getElementById('f_ri').value=r.input_g||'';
  document.getElementById('f_ro').value=r.output_g||'';
  document.getElementById('f_rl').value=r.roast_level||'';
  document.getElementById('f_rb2').value=r.time_basis||'잔여';

  document.querySelectorAll('#modeBtns .mbtn').forEach(b=>b.classList.remove('on'));
  if(r.mode){
    document.getElementById('f_rm').value=r.mode;
    document.querySelectorAll('#modeBtns .mbtn').forEach(b=>{
      b.classList.toggle('on',b.textContent==r.mode);
    });
  } else {
    document.getElementById('f_rm').value='';
  }

  document.querySelectorAll('#moRoastForm .preset-chips .pchip').forEach(c=>c.classList.remove('on'));
  calcRoastLive();
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
  const mode=+document.getElementById('f_rm').value;
  const autoEject=BINBON_MODES[mode];
  let dtr='';
  if(pop&&ej&&autoEject){
    const ps=toSec(pop),es=toSec(ej);
    if(ps>es&&(autoEject-es)>0){
      dtr=((ps-es)/(autoEject-es)*100).toFixed(1);
    }
  }
  const autoLevel=dtr?dtrToLevel(dtr):'';
  const manualLevel=document.getElementById('f_rl').value;
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
    time_basis:'잔여',
    dtr_pct:dtr.toString(),
    roast_level:autoLevel||manualLevel,
    notes:document.getElementById('f_rn').value.trim(),
  };
  if(id){const i=db.roasts.findIndex(r=>r.id===id);if(i>=0)db.roasts[i]=data;}
  else db.roasts.push(data);
  saveDB();closeMo('moRoastForm');renderRoasts();
}

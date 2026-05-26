let rFilterKey='all'; // origin or shop value

/* DTR → 로스팅 레벨 자동 계산 (빈본 기준) */
function dtrToLevel(dtr){
  const d=parseFloat(dtr);
  if(!d||d<8) return '';
  if(d<13) return '라이트';
  if(d<16) return '라이트-미디엄';
  if(d<19) return '미디엄';
  if(d<22) return '미디엄-다크';
  return '다크';
}

function renderRoasts(){
  // 필터 칩 렌더
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

  // 필터 적용 (날짜 내림차순 표시)
  let list=[...sorted].reverse();
  if(rFilterKey!=='all'){
    list=list.filter(r=>{
      const bean=db.beans.find(b=>b.name===r.bean_name);
      return bean&&(bean.origin===rFilterKey||bean.shop===rFilterKey);
    });
  }

  document.getElementById('roastList').innerHTML=list.map(r=>{
    const serial=serialMap[r.id];
    const bean=db.beans.find(b=>b.name===r.bean_name)||{};
    const beanYear=bean.stock_date?bean.stock_date.slice(0,4):'';
    const beanMonth=bean.stock_date?bean.stock_date.slice(2,4)+'.'+bean.stock_date.slice(5,7):'';
    const beanPrice=bean.price?Math.round(parseFloat(bean.price)):'';

    // 생두 헤더 라인: 케냐 카구모 AA / 2025  모모스  3  25.11
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
      const scores=[
        ['산미',avg('score_acid')],
        ['단맛',avg('score_sweet')],
        ['향',avg('score_aroma')],
        ['맛',avg('score_taste')],
      ].filter(([,v])=>v!==null);
      if(scores.length){
        brewHTML=`<div class="rbrew">
          <span class="rbrew-lbl">브루잉 평균</span>
          ${scores.map(([l,v])=>`<span class="rbrew-score">${l} <span>${v}</span></span>`).join('')}
          <span class="rbrew-cnt">(${brews.length}회)</span>
        </div>`;
      }
    }

    const levelColor={'라이트':'var(--amber)','라이트-미디엄':'#f5c36e','미디엄':'var(--teal)','미디엄-다크':'#5ec4b8','다크':'var(--coral)'}[r.roast_level]||'var(--muted)';

    return`<div class="rcard">
      <div class="rhead">
        <span class="rserial">#${String(serial).padStart(2,'0')}</span>
        <div class="rdate">${r.date}</div>
        ${r.roast_level?`<span class="rlv" style="color:${levelColor};border-color:${levelColor}33;background:${levelColor}18">${r.roast_level}</span>`:''}
        <div style="margin-left:auto"><button class="btn2" onclick="editRoast('${r.id}')">수정</button></div>
      </div>
      <div class="rbeaninfo"><b>${beanInfoParts}</b>${beanMetaParts?`  /  ${beanMetaParts}`:''}</div>
      <div class="rstats">
        ${r.mode?`<span>모드 <span>${r.mode}</span></span>`:''}
        ${r.dtr_pct?`<span class="rdtr">DTR <span>${r.dtr_pct}%</span></span>`:''}
        ${r.loss_pct?`<span>손실율 <span>${r.loss_pct}%</span></span>`:''}
        ${r.input_g?`<span>투입 <span>${r.input_g}g</span></span>`:''}
      </div>
      ${r.notes?`<div class="rmemo">${r.notes}</div>`:''}
      ${brewHTML}
    </div>`;
  }).join('')||'<div class="empty"><div class="empty-icon">🔥</div><div class="empty-text">로스팅 기록이 없습니다</div></div>';
}

function setRF(key){rFilterKey=key;renderRoasts();}

/* ── 폼 UX 헬퍼 ── */
function setMode(m){
  document.getElementById('f_rm').value=m;
  document.querySelectorAll('.mbtn').forEach(b=>{
    b.classList.toggle('on',b.textContent==m);
  });
}

function setWt(fieldId,val,chip){
  document.getElementById(fieldId).value=val;
  // 같은 preset-chips 그룹에서 on 토글
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

function calcRoastLive(){
  const ig=parseFloat(document.getElementById('f_ri').value)||0;
  const og=parseFloat(document.getElementById('f_ro').value)||0;
  const pop=document.getElementById('f_rp').value;
  const ej=document.getElementById('f_re').value;
  const basis=document.getElementById('f_rb2').value||'잔여';

  let lossStr='—', dtrStr='—', levelStr='—';
  if(ig&&og){ const lp=((ig-og)/ig*100); lossStr=lp.toFixed(1)+'%'; }
  if(pop&&ej){
    const ps=toSec(pop),es=toSec(ej);
    if(ps>0){
      let dtr;
      if(basis==='잔여') dtr=(ps-es)/ps*100;
      else dtr=(es-ps)/ps*100;
      if(dtr>=0){ dtrStr=dtr.toFixed(1)+'%'; levelStr=dtrToLevel(dtr)||'—'; }
    }
  }

  document.getElementById('ac_loss').textContent='손실율 '+lossStr;
  document.getElementById('ac_dtr').textContent='DTR '+dtrStr;
  const lvEl=document.getElementById('ac_level');
  lvEl.textContent='레벨 '+levelStr;
  // 레벨 hidden field에 저장
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

  // 모드 버튼 초기화
  document.querySelectorAll('.mbtn').forEach(b=>b.classList.remove('on'));
  if(r.mode) setMode(r.mode);

  // preset-chips on 초기화
  document.querySelectorAll('.preset-chips .pchip').forEach(c=>c.classList.remove('on'));

  // 자동계산 초기값
  if(r.roast_level){
    document.getElementById('ac_level').textContent='레벨 '+r.roast_level;
  }
  if(r.dtr_pct) document.getElementById('ac_dtr').textContent='DTR '+r.dtr_pct+'%';
  if(r.loss_pct) document.getElementById('ac_loss').textContent='손실율 '+r.loss_pct+'%';
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
  const bs=document.getElementById('f_rb2').value||'잔여';
  let dtr='';
  if(pop&&ej&&bs){
    const ps=toSec(pop),es=toSec(ej);
    if(ps>0){
      const d=bs==='잔여'?(ps-es)/ps*100:(es-ps)/ps*100;
      if(d>=0) dtr=d.toFixed(1);
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
    time_basis:bs,
    dtr_pct:dtr.toString(),
    roast_level:autoLevel||manualLevel,
    notes:document.getElementById('f_rn').value.trim(),
  };
  if(id){const i=db.roasts.findIndex(r=>r.id===id);if(i>=0)db.roasts[i]=data;}
  else db.roasts.push(data);
  saveDB();closeMo('moRoastForm');renderRoasts();
}

const BINBON_MODES={1:460,2:445,3:397,4:406,5:470,6:363,7:406,8:459};

let rFilterKey='all';
let rSortDir='desc'; // desc=최신순, asc=번호순(오래된것부터)

/* ✏️ 로스팅 단계 기준 (DTR %, min 이상 ~ 다음 min 미만). 8% 미만은 비워 둠.
   여기를 바꾸면 앱을 열 때 DTR이 있는 기존 기록도 새 기준으로 다시 붙음 (datafix.js reapplyRoastLevels)
   color: 앱 안 배지·글자 색 (빈본 타이머 화면 색은 따로) */
const ROAST_LEVELS=[
  {min:8,  label:'울트라 라이트', color:'#c9e7a0'},  // 연두빛 — 생두 색이 남아 있는 아주 밝은 단계
  {min:11, label:'라이트',        color:'#ffd966'},  // 밝은 노랑
  {min:15, label:'라이트-미디엄', color:'#ffb347'},  // 앰버
  {min:19, label:'미디엄',        color:'#f5893a'},  // 주황
  {min:23, label:'미디엄-다크',   color:'#e0663a'},  // 적갈
  {min:27, label:'다크',          color:'#c8553f'},  // 짙은 적갈
];
function dtrToLevel(dtr){
  const d=parseFloat(dtr);
  if(!d||d<ROAST_LEVELS[0].min) return '';
  let out='';ROAST_LEVELS.forEach(l=>{if(d>=l.min)out=l.label;});
  return out;
}
function levelColor(label){const l=ROAST_LEVELS.find(x=>x.label===label);return l?l.color:'#9aa0a6';}
function roastLevelRule(){return ROAST_LEVELS.map(l=>l.min+':'+l.label).join('|');}
/* 로스팅 폼: 단계 고르기 (DTR이 계산되면 자동 선택, 없을 때만 직접 고름) */
function renderLevelChips(){
  const el=document.getElementById('rlChips');if(!el)return;
  const cur=document.getElementById('f_rl').value,auto=el.dataset.auto==='1';
  el.innerHTML=ROAST_LEVELS.map(l=>`<span class="pchip lvl-chip${cur===l.label?' on':''}${auto?' auto':''}" style="--lc:${l.color}" onclick="pickLevel('${l.label}')">${l.label}</span>`).join('');
  const h=document.getElementById('rlHint');if(h)h.textContent=auto?'DTR로 자동 지정':'DTR이 없으면 직접 고르기';
}
function pickLevel(label){
  const el=document.getElementById('rlChips');if(el&&el.dataset.auto==='1')return;
  const f=document.getElementById('f_rl');f.value=f.value===label?'':label;renderLevelChips();
}

/* ── 배치 순서 · 시작/끝 시간 (2026-11-04) ──
   batch_no: 같은 날짜 안에서 몇 번째 배치인지 (저장 순서 기준, 폼에서 수정 가능)
   start_time / end_time: "HH:MM" (빈본 타이머에서 자동, 폼에서 수정 가능) */
function hmToMin(t){if(!t)return null;const p=String(t).split(':');return p.length>=2?(+p[0])*60+(+p[1]):null;}
function sameDayRoasts(date,exceptId){return db.roasts.filter(r=>r.date===date&&r.id!==exceptId);}
function nextBatchNo(date,exceptId){
  const rs=sameDayRoasts(date,exceptId);
  return rs.reduce((m,r)=>Math.max(m,+r.batch_no||0),0)+1;
}
/* 직전 배치(같은 날, 배치 순서가 바로 앞) 와의 휴식 시간(분). 없으면 null */
function batchGap(r){
  const n=+r.batch_no;if(!n||!r.start_time)return null;
  const prev=sameDayRoasts(r.date,r.id).filter(o=>+o.batch_no<n).sort((a,b)=>b.batch_no-a.batch_no)[0];
  if(!prev||+prev.batch_no!==n-1)return null;
  const s=hmToMin(r.start_time),pe=hmToMin(prev.end_time),ps=hmToMin(prev.start_time);
  if(pe!=null&&s!=null)return {min:s-pe,from:'end',prev};
  if(ps!=null&&s!=null)return {min:s-ps,from:'start',prev};
  return null;
}
function batchLine(r){
  const parts=[];
  if(r.batch_no)parts.push(`그날 ${r.batch_no}번째`);
  if(r.start_time||r.end_time)parts.push(`${r.start_time||'?'}~${r.end_time||'?'}`);
  const g=batchGap(r);
  if(g)parts.push(g.from==='end'?`직전 배치 후 ${g.min}분 휴식`:`직전 시작 후 ${g.min}분`);
  return parts.join(' · ');
}
/* 옛 기록에 배치 순서 채우기: 같은 날짜 안에서 저장된 순서대로 1,2,3… (이미 있는 번호는 그대로) */
function backfillBatchNo(){
  if(!db||!Array.isArray(db.roasts))return;
  const missing=db.roasts.some(r=>!r.batch_no);
  if(!missing)return;
  const byDate={};
  db.roasts.forEach(r=>{(byDate[r.date]=byDate[r.date]||[]).push(r);});
  let changed=0;
  Object.values(byDate).forEach(list=>{
    const used=new Set(list.map(r=>+r.batch_no).filter(Boolean));
    let n=1;
    list.forEach(r=>{
      if(r.batch_no)return;
      while(used.has(n))n++;
      r.batch_no=String(n);used.add(n);changed++;
    });
  });
  if(changed){saveDB();if(typeof renderRoasts==='function'&&document.getElementById('tab-roasts').classList.contains('on'))renderRoasts();}
}
function updateBatchHint(dateChanged){
  const id=document.getElementById('rfId').value;
  const date=document.getElementById('f_rd').value;
  const bnEl=document.getElementById('f_rbn');
  if(dateChanged&&!id)bnEl.value=nextBatchNo(date);
  const tmp={id:id||'__new',date,batch_no:bnEl.value,start_time:document.getElementById('f_rst').value,end_time:document.getElementById('f_ret').value};
  const g=batchGap(tmp);
  let txt='';
  if(g)txt=g.from==='end'?`직전 ${g.prev.batch_no}번째 배치 끝 ${g.prev.end_time} → 이번 시작 ${tmp.start_time} · <b>${g.min}분 휴식</b>`
                         :`직전 ${g.prev.batch_no}번째 배치 시작 ${g.prev.start_time} → 이번 시작 ${tmp.start_time} · <b>${g.min}분</b>`;
  const dup=sameDayRoasts(date,id).filter(o=>+o.batch_no===+bnEl.value&&bnEl.value);
  if(dup.length)txt+=(txt?'<br>':'')+`⚠ 같은 날 ${bnEl.value}번째 배치가 이미 있어요 (${dup[0].bean_name})`;
  document.getElementById('rf_gap').innerHTML=txt;
}

function toggleRSort(){
  rSortDir=rSortDir==='desc'?'asc':'desc';
  const btn=document.getElementById('rSortBtn');
  if(btn) btn.textContent=rSortDir==='desc'?'최신순↓':'번호순↑';
  renderRoasts();
}

function renderRoasts(){
  // 원산지·구매처·품종 필터 칩
  const origins=[...new Set(db.beans.map(b=>b.origin).filter(Boolean))];
  const shops=[...new Set(db.beans.map(b=>b.shop).filter(Boolean))];
  const varieties=[...new Set(db.beans.map(b=>b.variety).filter(Boolean))];
  const fc=(key,lbl)=>`<div class="fc ${rFilterKey===key?'on':''}" onclick="setRF('${key}')">${lbl}</div>`;
  document.getElementById('roastFilters').innerHTML=
    fc('all','전체')+
    (origins.length?`<span class="flabel">원산지</span>`+origins.map(o=>fc(`origin:${o}`,o)).join(''):'')+
    (shops.length?`<span class="flabel">구매처</span>`+shops.map(s=>fc(`shop:${s}`,s)).join(''):'')+
    (varieties.length?`<span class="flabel">품종</span>`+varieties.map(v=>fc(`variety:${v}`,v)).join(''):'');

  // 일련번호: 날짜 오름차순, 같은 날은 id 오름차순(저장순) → #1=가장 오래된 것
  const sorted=[...db.roasts].sort((a,b)=>a.date!==b.date?(a.date>b.date?1:-1):(a.id>b.id?1:-1));
  const serialMap={};
  sorted.forEach((r,i)=>serialMap[r.id]=i+1);

  // 필터 적용
  let list=[...sorted];
  if(rFilterKey!=='all'){
    list=list.filter(r=>{
      const bean=beanOfRoast(r);
      if(!bean) return false;
      if(rFilterKey.startsWith('origin:')) return bean.origin===rFilterKey.slice(7);
      if(rFilterKey.startsWith('shop:')) return bean.shop===rFilterKey.slice(5);
      if(rFilterKey.startsWith('variety:')) return bean.variety===rFilterKey.slice(8);
      return bean.origin===rFilterKey||bean.shop===rFilterKey;
    });
  }

  // 정렬 적용 (desc=최신순, asc=오래된순=번호순)
  if(rSortDir==='desc') list=[...list].reverse();

  document.getElementById('roastList').innerHTML=list.map(r=>{
    const serial=serialMap[r.id];
    const bean=beanOfRoast(r)||{};
    const beanMonth=bean.stock_date?bean.stock_date.slice(2,4)+'.'+bean.stock_date.slice(5,7):'';
    const beanPrice=bean.price?Math.round(parseFloat(bean.price)):'';

    // DTR 실시간 계산
    let dtr=r.dtr_pct;
    if(!dtr&&r.pop_time&&r.eject_time&&r.mode){
      const ae=BINBON_MODES[+r.mode];
      if(ae){const ps=toSec(r.pop_time),es=toSec(r.eject_time);if(ps>es&&(ae-es)>0)dtr=((ps-es)/(ae-es)*100).toFixed(1);}
    }
    const loss=r.loss_pct||(r.input_g&&r.output_g?((+r.input_g - +r.output_g)/+r.input_g*100).toFixed(1):'');

    // 브루잉 연계 — roast_id 직접 연결 + 같은 원두 미지정 브루잉 포함
    const brews=db.brewlogs.filter(b=>
      b.roast_id===r.id||
      (b.brew_type==='own'&&b.bean_name===r.bean_name&&!b.roast_id)
    );
    let brewHTML='';
    if(brews.length){
      const avg=field=>{const vals=brews.map(b=>+b[field]).filter(v=>v>0);return vals.length?(vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1):null;};
      const scores=[['산미',avg('score_acid')],['단맛',avg('score_sweet')],['향',avg('score_aroma')],['맛',avg('score_taste')]].filter(([,v])=>v!==null);
      const items=[...brews].reverse().map(b=>{
        const sc=[b.score_acid>0?`산${b.score_acid}`:'',b.score_sweet>0?`단${b.score_sweet}`:'',b.score_aroma>0?`향${b.score_aroma}`:'',b.score_taste>0?`맛${b.score_taste}`:''].filter(Boolean).join(' ');
        const neg=b.neg_tags&&b.neg_tags.length?b.neg_tags.slice(0,3).join(' · '):'';
        return`<div class="rbrew-item">
          <span class="rbrew-idate">${b.date}${b.recipe_name?` · ${b.recipe_name}`:''}</span>
          ${sc?`<span class="rbrew-iscores">${sc}</span>`:''}
          ${neg?`<div class="rbrew-ineg">⚠ ${neg}</div>`:''}
          ${b.memo?`<div class="rbrew-imemo">"${b.memo}"</div>`:''}
        </div>`;
      }).join('');
      brewHTML=`<div class="rbrew">
        <div class="rbrew-header">
          <span class="rbrew-lbl">브루잉 ${brews.length}회</span>
          ${scores.map(([l,v])=>`<span class="rbrew-score">${l} <b>${v}</b></span>`).join('')}
        </div>
        ${items}
      </div>`;
    }

    const lc=levelColor(r.roast_level);
    const metaParts=[bean.origin,bean.shop,beanPrice?String(beanPrice):'',beanMonth].filter(Boolean).join('  ·  ');
    const statsLine=[r.mode?`모드${r.mode}`:'',dtr?`DTR ${dtr}%`:'',loss?`손실율 ${loss}%`:'',r.input_g?`투입 ${r.input_g}g`:''].filter(Boolean).join('   ');

    return`<div class="rcard" onclick="openRoastDetail('${r.id}')" style="cursor:pointer;">
      <div class="rhead">
        <span class="rserial">#${String(serial).padStart(2,'0')}</span>
        <div class="rdate">${r.date}</div>
        ${r.roast_level?`<span class="rlv" style="color:${lc};border-color:${lc}66;background:${lc}1f">${r.roast_level}</span>`:''}
        <div style="margin-left:auto"><button class="btn2" onclick="event.stopPropagation();editRoast('${r.id}')">수정</button></div>
      </div>
      <div class="rbean-name">${r.bean_name}</div>
      ${(()=>{const bl=batchLine(r);return bl?`<div class="rbatch-line">${bl}</div>`:'';})()}
      ${metaParts?`<div class="rbean-meta">${metaParts}</div>`:''}
      ${statsLine?`<div class="rstats-line"><span class="${dtr?'rdtr-inline':''}">모드${r.mode||'?'}</span>${dtr?`<span class="rdtr-inline">DTR ${dtr}%</span>`:''}${loss?`<span class="rloss-inline">손실율 ${loss}%</span>`:''}${r.input_g?`<span>투입 ${r.input_g}g</span>`:''}</div>`:''}
      ${bean.cup_notes?`<div class="rcupnotes">${bean.cup_notes}</div>`:''}
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
  const bean=beanOfRoast(r)||{};
  const lc=levelColor(r.roast_level);
  const ae2=BINBON_MODES[+r.mode];
  let popElapsedStr='',ejElapsedStr='',devSec=null;
  if(ae2&&r.pop_time) popElapsedStr=fmtMS(ae2-toSec(r.pop_time));
  if(ae2&&r.eject_time) ejElapsedStr=fmtMS(ae2-toSec(r.eject_time));
  if(r.pop_time&&r.eject_time){
    const ps=toSec(r.pop_time),es=toSec(r.eject_time);
    if(ps>es) devSec=ps-es;
  }
  const brews=db.brewlogs.filter(b=>
    b.roast_id===id||
    (b.brew_type==='own'&&b.bean_name===r.bean_name&&!b.roast_id)
  );
  const avgField=field=>{
    const vals=brews.map(b=>+b[field]).filter(v=>v>0);
    return vals.length?(vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1):null;
  };
  const brewScores=[['산미',avgField('score_acid')],['단맛',avgField('score_sweet')],['향',avgField('score_aroma')],['맛',avgField('score_taste')]].filter(([,v])=>v!==null);
  const ring=(l,v)=>{const c=v>=8?'var(--teal)':v>=6?'var(--amber)':'var(--coral)';return`<div class="scitem"><div class="scring" style="border-color:${c}">${v}</div><div class="sclbl">${l}</div></div>`;};
  const brewDetailHTML=[...brews].reverse().map(b=>{
    const sc=[b.score_acid>0?`산${b.score_acid}`:'',b.score_sweet>0?`단${b.score_sweet}`:'',b.score_aroma>0?`향${b.score_aroma}`:'',b.score_taste>0?`맛${b.score_taste}`:''].filter(Boolean).join('  ');
    const neg=b.neg_tags&&b.neg_tags.length?b.neg_tags.join(', '):'';
    const parts=[b.water_ratio,b.water_g?b.water_g+'ml':'',b.temp?b.temp+'°C':'',b.grind].filter(Boolean).join(' · ');
    return`<div class="rd-brew-item">
      <div class="rd-brew-head">
        <span class="rd-brew-date">${b.date}</span>
        ${b.recipe_name?`<span class="rd-brew-recipe">${b.recipe_name}</span>`:''}
        ${sc?`<span class="rd-brew-sc">${sc}</span>`:''}
      </div>
      ${parts?`<div class="rd-brew-params">${parts}</div>`:''}
      ${neg?`<div class="rd-brew-neg">⚠ ${neg}</div>`:''}
      ${b.memo?`<div class="rd-brew-memo">"${b.memo}"</div>`:''}
    </div>`;
  }).join('');
  document.getElementById('rdTitle').innerHTML=`<span style="font-size:12px;color:var(--muted);font-family:'DM Sans',sans-serif;font-weight:500;letter-spacing:.05em">#${String(serial).padStart(2,'0')} · ${r.date}</span><br>${r.bean_name}`;
  document.getElementById('rdContent').innerHTML=`
    <div class="ds">
      <div class="dstitle">생두 정보</div>
      ${dr('원산지',bean.origin||'')}
      ${dr('구매처',bean.shop||'')}
    </div>
    ${(r.batch_no||r.start_time||r.end_time)?`<div class="ds">
      <div class="dstitle">시간 · 배치</div>
      ${dr('배치 순서',r.batch_no?`그날 ${r.batch_no}번째`:'')}
      ${dr('시작 ~ 끝',(r.start_time||r.end_time)?`${r.start_time||'?'} ~ ${r.end_time||'?'}`:'')}
      ${(()=>{const g=batchGap(r);return g?dr(g.from==='end'?'직전 배치 후 휴식':'직전 배치 시작부터',`${g.min}분`):'';})()}
    </div>`:''}
    <div class="ds">
      <div class="dstitle">로스팅 수치</div>
      ${r.roast_level?dr('레벨',`<span style="color:${lc};font-weight:700">${r.roast_level}</span>`):''}
      ${dr('빈본 모드',r.mode?`모드${r.mode}`:'')}
      ${dr('DTR',r.dtr_pct?r.dtr_pct+'%':'')}
      ${dr('손실율',r.loss_pct?r.loss_pct+'%':'')}
      ${dr('투입',r.input_g?r.input_g+'g':'')}
      ${dr('배출',r.output_g?r.output_g+'g':'')}
      ${dr('1팝 경과',popElapsedStr?`${popElapsedStr}${r.pop_time?`<span style="color:var(--muted);font-size:11px"> (잔여 ${r.pop_time})</span>`:''}`:(r.pop_time||''))}
      ${dr('배출 경과',ejElapsedStr?`${ejElapsedStr}${r.eject_time?`<span style="color:var(--muted);font-size:11px"> (잔여 ${r.eject_time})</span>`:''}`:(r.eject_time||''))}
      ${dr('디벨롭타임',devSec!==null?devSec+'초':'')}
    </div>
    ${bean.cup_notes?`<div class="ds"><div class="dstitle">컵노트</div><div style="font-family:'Playfair Display',serif;font-size:13px;color:var(--muted2);line-height:1.7;font-style:italic">${bean.cup_notes}</div></div>`:''}
    ${r.notes?`<div class="ds"><div class="dstitle">로스팅 메모</div><div style="font-size:13px;color:var(--text2);line-height:1.7;font-style:italic">${r.notes}</div></div>`:''}
    ${brews.length?`<div class="ds">
      <div class="dstitle">브루잉 ${brews.length}회${brewScores.length?` — 평균`:''}</div>
      ${brewScores.length?`<div class="scores" style="margin-top:8px;margin-bottom:10px">${brewScores.map(([l,v])=>ring(l,v)).join('')}</div>`:''}
      ${brewDetailHTML}
    </div>`:''}
    ${(()=>{const cs=getCuppingsForRoast(id,r.bean_name);return cs.length?`<div class="ds"><div class="dstitle">커핑 ${cs.length}회</div>${cuppingMiniHtml(cs,r.bean_name)}</div>`:''})()}
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
  if(fieldId==='f_ri') updateOutputPresets();
  calcRoastLive();
}
function adjWt(fieldId,delta){
  const el=document.getElementById(fieldId);
  el.value=Math.max(0,Math.round(((+el.value||0)+delta)*10)/10);
  if(fieldId==='f_ri') updateOutputPresets();
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
  const chips=document.getElementById('rlChips');
  if(levelStr!=='—'){document.getElementById('f_rl').value=levelStr;if(chips)chips.dataset.auto='1';}
  else if(chips&&chips.dataset.auto==='1'){chips.dataset.auto='';document.getElementById('f_rl').value='';}  // DTR이 없어지면 직접 고르게
  renderLevelChips();
}

/* ── 폼 열기/저장 ── */
function openRoastForm(id, prefill){
  const r=id?db.roasts.find(x=>x.id===id):{};
  const p=prefill||{};
  // 생두는 목록에서 고르기만 (값 = 생두 ID). 재고 있는 것 먼저, 소진은 아래
  const curB=id?beanOfRoast(r):(p.bean_name?db.beans.find(b=>b.name===p.bean_name):null);
  const esc=s=>String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
  const on=db.beans.filter(b=>b.status!=='소진'),off=db.beans.filter(b=>b.status==='소진');
  document.getElementById('f_rb').innerHTML='<option value="">선택...</option>'+
    on.map(b=>`<option value="${b.id}">${esc(b.name)}${b.lot_label?' ('+esc(b.lot_label)+')':''}</option>`).join('')+
    (off.length?`<optgroup label="소진">${off.map(b=>`<option value="${b.id}">${esc(b.name)}${b.lot_label?' ('+esc(b.lot_label)+')':''}</option>`).join('')}</optgroup>`:'');
  document.getElementById('rfId').value=id||'';
  document.getElementById('f_rd').value=r.date||p.date||today();
  document.getElementById('f_rb').value=curB?curB.id:'';
  document.getElementById('f_rfp').checked=!!r.false_pop;
  document.getElementById('f_rp').value=r.pop_time||p.pop_time||'';
  document.getElementById('f_re').value=r.eject_time||p.eject_time||'';
  document.getElementById('f_rn').value=r.notes||p.notes||'';
  document.getElementById('f_ri').value=r.input_g||p.input_g||'120';
  document.getElementById('f_ro').value=r.output_g||p.output_g||'100';
  document.getElementById('f_rl').value=r.roast_level||p.roast_level||'';
  {const c=document.getElementById('rlChips');if(c)c.dataset.auto='';}
  document.getElementById('f_rb2').value=r.time_basis||'잔여';
  document.getElementById('f_rst').value=r.start_time||p.start_time||'';
  document.getElementById('f_ret').value=r.end_time||p.end_time||'';
  document.getElementById('f_rbn').value=r.batch_no||(id?'':nextBatchNo(document.getElementById('f_rd').value));
  updateBatchHint();

  document.querySelectorAll('#modeBtns .mbtn').forEach(b=>b.classList.remove('on'));
  const modeVal=r.mode||p.mode||'';
  if(modeVal){
    document.getElementById('f_rm').value=modeVal;
    document.querySelectorAll('#modeBtns .mbtn').forEach(b=>{
      b.classList.toggle('on',b.textContent==modeVal);
    });
  } else {
    document.getElementById('f_rm').value='';
  }

  document.querySelectorAll('#moRoastForm .preset-chips .pchip').forEach(c=>c.classList.remove('on'));
  // 투입량 기준으로 배출량 프리셋 동적 생성
  updateOutputPresets();
  calcRoastLive();
  openMo('moRoastForm');
}

/* 투입량 기준 배출량 프리셋 동적 생성 */
function updateOutputPresets(){
  const ig=parseFloat(document.getElementById('f_ri').value)||0;
  const chips=document.getElementById('roChips');
  if(!chips)return;
  if(ig>0){
    // 투입량 기준 83~88% 범위 5개 프리셋 (1g 단위)
    const base=Math.round(ig*0.845);
    const vals=[base-4,base-2,base,base+2,base+4].map(v=>Math.max(1,v));
    chips.innerHTML=vals.map(v=>`<span class="pchip" onclick="setWt('f_ro',${v},this)">${v}</span>`).join('');
  } else {
    chips.innerHTML=`
      <span class="pchip" onclick="setWt('f_ro',85,this)">85</span>
      <span class="pchip" onclick="setWt('f_ro',125,this)">125</span>
      <span class="pchip" onclick="setWt('f_ro',170,this)">170</span>
      <span class="pchip" onclick="setWt('f_ro',215,this)">215</span>
      <span class="pchip" onclick="setWt('f_ro',260,this)">260</span>`;
  }
}

function editRoast(id){openRoastForm(id);}

function saveRoast(){
  const id=document.getElementById('rfId').value;
  const bid=document.getElementById('f_rb').value;
  const bean=db.beans.find(b=>b.id===bid);
  if(!bean){alert('생두를 목록에서 선택하세요');return;}
  const bn=bean.name;
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
    bean_id:bean.id,
    bean_name:bn,
    shop:bean.shop||'',
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
    start_time:document.getElementById('f_rst').value,
    end_time:document.getElementById('f_ret').value,
    batch_no:String(parseInt(document.getElementById('f_rbn').value)||nextBatchNo(document.getElementById('f_rd').value,id)),
    false_pop:document.getElementById('f_rfp').checked,
  };
  Object.assign(data,roastTimes(data));  // 1팝 경과·총 로스팅시간 자동 저장
  // 수정 시 폼에 없는 기존 항목(degas_days 등)은 유지
  if(id){const i=db.roasts.findIndex(r=>r.id===id);if(i>=0)db.roasts[i]={...db.roasts[i],...data};}
  else db.roasts.push(data);
  saveDB();closeMo('moRoastForm');renderRoasts();
  const tb=document.querySelector('.tb[onclick*="roasts"]');
  if(tb) showTab('roasts',tb);
}

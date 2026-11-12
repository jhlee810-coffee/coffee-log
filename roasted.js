// roasted.js — 원두 목록 (구매한 로스팅 원두) · 2026-11-05
// 저장: db.roasted_beans (Sheets 동기화). "☕ 한 잔 기록"으로 오늘의 한 잔(dailycup.js)과 연결
//
// ✏️ 고르는 항목 (바꾸고 싶으면 여기)
const RB_PROCESSES=['워시드','내추럴','허니','무산소','기타'];
const RB_LEVELS=['라이트','미디엄라이트','미디엄','미디엄다크','다크'];
const RB_WEIGHTS=[100,150,200,250,500];
const RB_STATUS_ON='마시는 중', RB_STATUS_DONE='다 마심';

let _rbFilter='on';   // 'on' | 'done' | 'all'
let _rbSearch='';
let _rbOS='';   // 원산지/구매처 칩 선택: '' | 'origin:에티오피아' | 'shop:모모스'
let _rbForm=null;
// 항목의 원산지·구매처 (내 로스팅은 생두 정보, 산 원두는 직접 입력한 값 · 로스터리). 구매처 이름은 별칭을 하나로 합침
function rbOriginOf(it){return (it.kind==='own'?(it.bean&&it.bean.origin):it.rec.origin)||'';}
function rbShopOf(it){const s=it.kind==='own'?(it.bean&&it.bean.shop):it.rec.roastery;return (typeof canonShop==='function'?canonShop(s):s)||'';}

function rbList(){if(!Array.isArray(db.roasted_beans))db.roasted_beans=[];return db.roasted_beans;}
function rbEsc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function rbDays(roastDate){
  if(!roastDate)return null;
  const p=s=>{const [y,m,d]=s.split('-').map(Number);return Date.UTC(y,m-1,d);};
  const v=Math.round((p(today())-p(roastDate))/86400000);return isNaN(v)?null:v;
}
function rbRoasteries(){ // 예전에 쓴 로스터리 — 최근 산 곳 먼저. 새 로스터리는 저장하면 다음부터 여기 나옴
  const t={};
  rbList().forEach(b=>{if(!b.roastery)return;const d=b.buy_date||b.roast_date||'';if(!(b.roastery in t)||d>t[b.roastery])t[b.roastery]=d;});
  (db.brewlogs||[]).forEach(b=>{if(b.ext_roastery&&!(b.ext_roastery in t))t[b.ext_roastery]=b.date||'';});
  return Object.entries(t).sort((a,b)=>b[1].localeCompare(a[1])).map(x=>x[0]);
}
function rbCups(b){return (db.dailycups||[]).filter(r=>r.bean_info&&r.bean_info.rb_id===b.id);}

/* ── 원두 목록 (2026-11-12 개편) ──
   산 원두 + 내가 로스팅한 원두(1배치 = 1항목)를 생두별로 묶어서 보여 줌.
   내 로스팅은 로스팅 기록(db.roasts)을 그대로 보여 주기만 함 (데이터를 따로 만들지 않음). 산 원두는 db.roasted_beans */
let _rbKind='all';   // 'all' | 'own' | 'bought' | 'frozen'

/* 잔량(대략): 로스팅 배출 g(없으면 투입×0.85) − 그 배치로 마신 커피 원두 g 합(커피 한 잔 기록의 원두 g, 없으면 15g) */
function rbUsedG(match){return (db.dailycups||[]).filter(c=>match(c.bean_info||{})).reduce((s,c)=>s+(parseFloat((c.brew||{}).coffee_g)||15),0);}
function ownRemainG(r){
  const out=parseFloat(r.output_g)||(parseFloat(r.input_g)?parseFloat(r.input_g)*0.85:0);
  return Math.max(0,Math.round(out-rbUsedG(s=>s.roast_id===r.id)));
}
function boughtRemainG(b){return Math.max(0,Math.round((parseFloat(b.weight_g)||0)-rbUsedG(s=>s.rb_id===b.id)));}
function fmtWeight(g){g=Math.round(g||0);return g>=1000?(g/1000).toFixed(1)+'kg':g+'g';}

/* 홈 요약·원두 탭 머리에 쓰는 재고 요약 (무게는 대략) */
function stockSummary(){
  const inStock=(db.beans||[]).filter(b=>b.status!=='소진'&&b.status!=='샘플');
  let green=0,unknown=0;
  inStock.forEach(b=>{const u=beanUsage(b);if(u.remaining==null)unknown++;else green+=Math.max(0,u.remaining);});
  const own=(db.roasts||[]).filter(roastHeld).map(r=>({r,g:ownRemainG(r),bean:beanOfRoast(r)}));
  const bought=rbList().filter(b=>b.status!==RB_STATUS_DONE).map(b=>({b,g:boughtRemainG(b)}));
  const sum=a=>a.reduce((s,x)=>s+x.g,0);
  const ownKinds=new Set(own.map(x=>x.bean?x.bean.id:x.r.bean_name));
  const boughtKinds=new Set(bought.map(x=>String(x.b.name).replace(/\s+/g,'')));
  return {greenG:green,greenKinds:inStock.length,greenUnknown:unknown,
    ownKinds:ownKinds.size,ownBatches:own.length,ownG:sum(own),
    boughtKinds:boughtKinds.size,boughtItems:bought.length,boughtG:sum(bought),
    frozenG:sum(own.filter(x=>x.r.frozen))+sum(bought.filter(x=>x.b.frozen)),
    roastCount:(db.roasts||[]).length,
    inputG:(db.roasts||[]).reduce((s,r)=>s+(parseFloat(r.input_g)||DEFAULT_INPUT_G),0)};
}

function rbItems(){
  const items=[];
  (db.roasts||[]).forEach(r=>{const bean=beanOfRoast(r)||{};items.push({kind:'own',id:r.id,rec:r,bean,date:r.date||'',state:r.stock_state||'',held:roastHeld(r),frozen:r.frozen||''});});
  rbList().forEach(b=>items.push({kind:'bought',id:b.id,rec:b,bean:b,date:b.roast_date||'',state:b.status===RB_STATUS_DONE?'done':'',held:b.status!==RB_STATUS_DONE,frozen:b.frozen||''}));
  return items;
}
function rbItemStage(it,t){
  const age=it.frozen?frozenAgeDays(it.date,it.frozen,t):rbDays(it.date);
  const w=restWindow(it.kind==='own'?(it.bean&&it.bean.id?it.bean:{name:it.rec.bean_name}):it.rec);
  return {age,w,st:restStage(age,w)};
}

function renderRoastedBeans(){
  const el=document.getElementById('rbRoot');if(!el)return;
  const t=today(),q=_rbSearch.toLowerCase().replace(/\s+/g,'');
  const all=rbItems();
  const inKind=it=>_rbKind==='all'||(_rbKind==='own'?it.kind==='own':_rbKind==='bought'?it.kind==='bought':!!it.frozen);
  const inState=it=>_rbFilter==='all'||(_rbFilter==='done'?!it.held:it.held);
  const text=it=>it.kind==='own'
    ?[it.rec.bean_name,it.bean.origin,it.bean.process,it.bean.cup_notes,it.bean.shop].join('')
    :[it.rec.name,it.rec.roastery,it.rec.origin,it.rec.process,it.rec.cup_notes].join('');
  // 원산지·구매처 칩 (생두 탭과 같은 모양): 지금 보이는 종류·상태 안에서만, 각각 가나다순
  const base=all.filter(it=>inKind(it)&&inState(it));
  const srt=a=>[...new Set(a.filter(Boolean))].sort((x,y)=>String(x).localeCompare(String(y),'ko'));
  const origins=srt(base.map(rbOriginOf)),shops=srt(base.map(rbShopOf));
  if(_rbOS&&!(_rbOS.startsWith('origin:')?origins.includes(_rbOS.slice(7)):shops.includes(_rbOS.slice(5))))_rbOS='';
  const inOS=it=>!_rbOS||(_rbOS.startsWith('origin:')?rbOriginOf(it)===_rbOS.slice(7):rbShopOf(it)===_rbOS.slice(5));
  const list=base.filter(it=>inOS(it)&&(!q||text(it).toLowerCase().replace(/\s+/g,'').includes(q)));
  // 생두별로 묶기
  const groups=[],gi={};
  list.forEach(it=>{
    const own=it.kind==='own';
    const k=own?'b:'+(it.bean.id||it.rec.bean_name):'rb:'+String(it.rec.name).replace(/\s+/g,'');
    if(!(k in gi)){gi[k]=groups.length;groups.push({k,own,
      title:own?(it.bean.group_name||it.bean.name||it.rec.bean_name):it.rec.name,
      sub:own?[it.bean.origin,it.bean.shop].filter(Boolean).join(' · '):(it.rec.roastery||''),
      notes:own?(it.bean.cup_notes||''):(it.rec.cup_notes||''),items:[]});}
    groups[gi[k]].items.push(it);
  });
  groups.forEach(g=>{
    g.items.sort((a,b)=>((a.held?0:1)-(b.held?0:1))||(a.date||'').localeCompare(b.date||'')||(+a.rec.batch_no||0)-(+b.rec.batch_no||0));   // 먼저 볶은 것부터
    g.items.forEach(it=>{it.s=rbItemStage(it,t);});
    g.o=Math.min(...g.items.map(it=>it.held?(it.frozen?1.5:it.s.st.o):9));
    g.g=g.items.filter(it=>it.held).reduce((s,it)=>s+(it.kind==='own'?ownRemainG(it.rec):boughtRemainG(it.rec)),0);
    g.nh=g.items.filter(it=>it.held).length;
  });
  groups.sort((a,b)=>a.o-b.o||a.title.localeCompare(b.title,'ko'));
  const S=stockSummary();
  const fc=(k,l)=>`<div class="fc ${_rbFilter===k?'on':''}" onclick="_rbFilter='${k}';renderRoastedBeans()">${l}</div>`;
  const kc=(k,l)=>`<div class="fc ${_rbKind===k?'on':''}" onclick="_rbKind='${k}';renderRoastedBeans()">${l}</div>`;
  const oc=(k,l)=>`<div class="fc ${_rbOS===k?'on':''}" data-k="${rbEsc(k)}" onclick="_rbOS=this.dataset.k;renderRoastedBeans()">${rbEsc(l)}</div>`;
  const nHeld=all.filter(i=>i.held).length;
  el.innerHTML=`<div class="sh"><div class="stl">원두 목록</div><div class="sh-btns"><button class="btn2 ps-open" onclick="openPasteReg('roasted')">📥 붙여넣기로 등록</button><button class="btn btn-sm" onclick="openRbForm()">+ 원두 등록</button></div></div>
    <div class="rb-sum">마시는 중 <b>${nHeld}개</b> · 🔥 내 로스팅 ${S.ownKinds}종 ≈ ${fmtWeight(S.ownG)} · 🛒 산 원두 ${S.boughtKinds}종 ≈ ${fmtWeight(S.boughtG)}${S.frozenG?` · 🧊 냉동 ≈ ${fmtWeight(S.frozenG)}`:''}</div>
    <input class="search" placeholder="원두 · 로스터리 · 원산지 · 컵노트 검색..." value="${rbEsc(_rbSearch)}" oninput="_rbSearch=this.value;renderRoastedBeans();const i=document.querySelector('#rbRoot .search');i.focus();i.setSelectionRange(i.value.length,i.value.length)">
    <div class="filters">${fc('on','마시는 중')}${fc('done','다 마심·나눔')}${fc('all','전체')}</div>
    <div class="filters">${kc('all','모두')}${kc('own','🔥 내 로스팅')}${kc('bought','🛒 산 원두')}${kc('frozen','🧊 냉동')}</div>
    <div class="filters">${(origins.length||shops.length)?`<div class="frow">${oc('','전체')}${origins.map(o=>oc('origin:'+o,o)).join('')}</div>${shops.length?`<div class="frow">${shops.map(s=>oc('shop:'+s,s)).join('')}</div>`:''}`:''}</div>
    <div class="rbg-list">${groups.map(rbGroupHtml).join('')||
      `<div class="empty"><div class="empty-icon">🫘</div><div class="empty-text">${all.length?'맞는 원두가 없어요':'산 원두를 등록하거나 로스팅을 저장해 보세요'}</div></div>`}</div>`;
}
function rbGroupHtml(g){
  return `<div class="rbg ${g.own?'own':'bought'}">
    <div class="rbg-h"><div class="rbg-t">${g.own?'🔥':'🛒'} ${rbEsc(g.title)}</div>
      <div class="rbg-s">${rbEsc(g.sub)}${g.sub?' · ':''}${g.nh?`${g.nh}배치 · 잔량 ≈ ${fmtWeight(g.g)}`:'모두 정리됨'}</div>
      ${g.notes?`<div class="rbg-n">🍑 ${rbEsc(g.notes)}</div>`:''}</div>
    ${g.items.map(rbItemHtml).join('')}</div>`;
}
function rbItemHtml(it){
  const own=it.kind==='own',r=it.rec,s=it.s;
  const cups=(db.dailycups||[]).filter(c=>c.bean_info&&(own?c.bean_info.roast_id===r.id:c.bean_info.rb_id===r.id));
  const avg=cups.length?(cups.reduce((a,c)=>a+(+c.stars||0),0)/cups.length).toFixed(1):'';
  const md=d=>d?(+d.slice(5,7))+'/'+(+d.slice(8,10)):'';
  const prof=own?[r.mode?`${r.mode}-${r.dtr_pct?Math.round(parseFloat(r.dtr_pct)):'?'}`:'',r.batch_no?'#'+r.batch_no:''].filter(Boolean).join(' '):'';
  const remain=it.held?(own?ownRemainG(r):boughtRemainG(r)):0;
  const meta=own
    ?[r.input_g&&r.output_g?`${r.input_g}→${r.output_g}g`:'',r.roast_level||'',cups.length?`${cups.length}잔 ★${avg}`:'',it.held?`잔량 ≈ ${remain}g`:''].filter(Boolean).join(' · ')
    :[r.weight_g?r.weight_g+'g':'',r.price?Number(r.price).toLocaleString()+'원':'',r.buy_date?'구매 '+md(r.buy_date):'',cups.length?`${cups.length}잔 ★${avg}`:'',it.held?`잔량 ≈ ${remain}g`:''].filter(Boolean).join(' · ');
  const stBadge=!it.held?`<span class="rbi-st off">${own&&it.state==='gift'?'🎁 나눔':'다 마심'}</span>`
    :it.frozen?`<span class="rbi-st frz">🧊 ${s.age!=null?s.age+'일차에 멈춤':'냉동'}</span>`
    :`<span class="rbi-st" style="color:${s.st.c};border-color:${s.st.c}">${s.age!=null?s.age+'일차 · ':''}${s.st.l||''}</span>`;
  const btn=(on,fn,l)=>`<button class="${on?'on':''}" onclick="${fn}">${l}</button>`;
  const acts=own
    ?btn(0,`roastToCup('${r.id}')`,'☕ 한 잔 기록')+(it.state?'':btn(it.frozen,`setFrozen('roast','${r.id}')`,'🧊 '+(it.frozen?'냉동 중':'냉동')))+btn(0,`lbRoastLabel('${r.id}')`,'🏷 로스팅 라벨')+(it.state==='gift'?'':btn(0,`lbVacRoast('${r.id}')`,'🏷 진공'))
      +btn(it.state==='gift',`setRoastState('${r.id}','gift')`,'🎁 나눔')+btn(it.state==='done',`setRoastState('${r.id}','done')`,'다 마심')
    :btn(0,`openDailyCupRb('${r.id}')`,'☕ 한 잔 기록')+btn(it.frozen,`setFrozen('rb','${r.id}')`,'🧊 '+(it.frozen?'냉동 중':'냉동'))+btn(0,`lbVacRb('${r.id}')`,'🏷 진공')
      +btn(!it.held,`rbToggleDone('${r.id}')`,'다 마심');
  return `<div class="rbi ${own?'own':'bought'}${it.held?'':' off'}" onclick="${own?`openRoastDetail('${r.id}')`:`openRbForm('${r.id}')`}">
    <div class="rbi-top"><span class="rbi-tag">${own?'🔥 직접 로스팅':'🛒 산 원두'}</span><b>${rbEsc(md(it.date)||'날짜 없음')} 로스팅${prof?' · '+rbEsc(prof):''}${own?'':r.roastery?' · '+rbEsc(r.roastery):''}</b>${stBadge}</div>
    ${meta?`<div class="rbi-meta">${rbEsc(meta)}</div>`:''}
    ${it.frozen?`<div class="rb-frz">${rbEsc(frozenText(r))}</div>`:''}
    <div class="rbi-act" onclick="event.stopPropagation()">${acts}</div></div>`;
}
function rbToggleDone(id){
  const b=rbList().find(x=>x.id===id);if(!b)return;
  b.status=b.status===RB_STATUS_DONE?RB_STATUS_ON:RB_STATUS_DONE;
  saveDB();renderRoastedBeans();try{renderDash();}catch(e){}
}

/* ── 등록 / 수정 폼 ── */
function openRbForm(id){
  const b=id?rbList().find(x=>x.id===id):null;
  _rbForm=b?{...b}:{name:'',roastery:(rbRoasteries()[0]||''),roast_date:'',buy_date:today(),origin:'',process:'',level:'',weight_g:200,price:'',cup_notes:'',memo:'',status:RB_STATUS_ON};
  _rbForm._id=id||'';
  rbRenderForm();openMo('moRbForm');
}
function rbRenderForm(){
  const f=_rbForm;
  const chip=(on,l,fn)=>`<button class="dc-chip${on?' on':''}" onclick="${fn}">${rbEsc(l)}</button>`;
  const q=s=>rbEsc(s).replace(/'/g,"\\'");
  const roasteries=allShops().map(r=>chip(f.roastery===r,r,`_rbForm.roastery='${q(r)}';rbRenderForm()`)).join('');
  const origins=Object.values(BEAN_ORIGINS).flat();
  document.getElementById('rbFormBody').innerHTML=`
    <div class="mtitle">${f._id?'원두 수정':'원두 등록'}</div>
    <div class="fg"><label class="fl">원두 이름 *</label><input class="inp" placeholder="예: 에티오피아 구지 함벨라" value="${rbEsc(f.name)}" oninput="_rbForm.name=this.value"></div>
    <div class="fg"><label class="fl">로스터리 *</label>
      ${roasteries?`<div class="dc-chips" style="margin-bottom:6px">${roasteries}</div>`:''}
      <input class="inp" placeholder="목록에 없으면 새로 입력 (다음부터 목록에 나옴)" value="${rbEsc(f.roastery)}" oninput="_rbForm.roastery=this.value"></div>
    <div class="fg"><label class="fl">로스팅 날짜 * <span class="fl-hint">봉투에 적힌 날짜</span></label>
      <input class="inp" type="date" value="${rbEsc(f.roast_date)}" oninput="_rbForm.roast_date=this.value" onchange="_rbForm.roast_date=this.value"></div>
    <div class="fg"><label class="fl">로스터리 권장 숙성 <span class="fl-hint">로스팅 후 며칠부터 며칠까지 · 비우면 기본 규칙(${(()=>{const w=restWindow({name:f.name,origin:f.origin,process:f.process});return w.label+' '+w.min+'~'+w.max+'일';})()})</span></label>
      <div class="rest-row"><input class="inp" type="number" inputmode="numeric" placeholder="${restWindow({name:f.name,origin:f.origin,process:f.process}).min}" value="${rbEsc(f.rest_min||'')}" oninput="_rbForm.rest_min=this.value"><span>~</span>
        <input class="inp" type="number" inputmode="numeric" placeholder="${restWindow({name:f.name,origin:f.origin,process:f.process}).max}" value="${rbEsc(f.rest_max||'')}" oninput="_rbForm.rest_max=this.value"><span>일</span></div></div>
    <div class="fg"><label class="fl">용량</label><div class="dc-chips">${RB_WEIGHTS.map(w=>chip(+f.weight_g===w,w+'g',`_rbForm.weight_g=${w};rbRenderForm()`)).join('')}</div></div>
    <button class="dc-more-btn" style="margin-top:4px" onclick="_rbForm._more=!_rbForm._more;rbRenderForm()">${f._more?'▴ 접기':'▾ 더 입력하기 (원산지 · 가공 · 로스팅 정도 · 가격 · 컵노트)'}</button>
    ${f._more?`<div style="margin-top:10px">
      <div class="fg"><label class="fl">원산지</label><select class="sel" onchange="_rbForm.origin=this.value"><option value="">선택 안 함</option>${
        Object.entries(BEAN_ORIGINS).map(([g,l])=>`<optgroup label="${g}">${l.map(o=>`<option${f.origin===o?' selected':''}>${o}</option>`).join('')}</optgroup>`).join('')}
        ${f.origin&&!origins.includes(f.origin)?`<option selected>${rbEsc(f.origin)}</option>`:''}</select></div>
      <div class="fg"><label class="fl">가공</label><div class="dc-chips">${RB_PROCESSES.map(p=>chip(f.process===p,p,`_rbForm.process=_rbForm.process==='${p}'?'':'${p}';rbRenderForm()`)).join('')}</div></div>
      <div class="fg"><label class="fl">로스팅 정도 <span class="fl-hint">로스터리 표기</span></label><div class="dc-chips">${RB_LEVELS.map(p=>chip(f.level===p,p,`_rbForm.level=_rbForm.level==='${p}'?'':'${p}';rbRenderForm()`)).join('')}</div></div>
      <div class="fr"><div class="fg"><label class="fl">가격 (원)</label><input class="inp" inputmode="numeric" value="${rbEsc(f.price)}" oninput="_rbForm.price=this.value.replace(/[^0-9]/g,'')"></div>
        <div class="fg"><label class="fl">구매일</label><input class="inp" type="date" value="${rbEsc(f.buy_date)}" onchange="_rbForm.buy_date=this.value"></div></div>
      <div class="fg"><label class="fl">컵노트 <span class="fl-hint">탭해서 추가·제거</span></label><input class="inp" placeholder="예: 자스민, 복숭아, 꿀" value="${rbEsc(f.cup_notes)}" oninput="_rbForm.cup_notes=this.value">
        <div class="ctag-section cupnote-chips" style="margin-top:6px">${Object.entries(CUPNOTE_GROUPS).map(([g,l])=>`<div class="ctag-cat"><div class="ctag-cat-label">${g}</div><div class="ctag-list">${
          l.map(n=>`<span class="ctag cpos${hasPick(f.cup_notes||'',n)?' on':''}" onclick="rbToggleNote('${n}')">${n}</span>`).join('')}</div></div>`).join('')}</div></div>
      <div class="fg"><label class="fl">메모</label><input class="inp" value="${rbEsc(f.memo)}" oninput="_rbForm.memo=this.value"></div>
    </div>`:''}
    <label class="dec-row" style="margin-top:12px"><input type="checkbox" ${f.decaf?'checked':''} onchange="_rbForm.decaf=this.checked"> 디카페인 원두</label>
    ${f._id?`<div class="fg" style="margin-top:12px"><label class="fl">상태</label><div class="dc-segs" style="grid-template-columns:1fr 1fr">${
      [RB_STATUS_ON,RB_STATUS_DONE].map(s=>`<button class="dc-seg${f.status===s?' on':''}" onclick="_rbForm.status='${s}';rbRenderForm()">${s}</button>`).join('')}</div></div>`:''}
    <div class="fa">${f._id?`<button class="btnd" onclick="rbDelete()">삭제</button>`:''}<button class="btn2" onclick="closeMo('moRbForm')">취소</button><button class="btn btn-sm" onclick="rbSave()">저장</button></div>`;
}
function rbToggleNote(n){
  const f=_rbForm,box=document.querySelector('#rbFormBody .cupnote-chips'),st=box?box.scrollTop:0;
  const cur=(f.cup_notes||'').trim();
  if(hasPick(cur,n))f.cup_notes=cur.replace(new RegExp('(^|[\\s,]+)'+reEsc(n)+'(?=$|[\\s,])','i'),'').replace(/^[\s,]+|[\s,]+$/g,'').replace(/\s*,\s*(,\s*)+/g,', ');
  else f.cup_notes=cur?cur.replace(/[\s,]+$/,'')+', '+n:n;
  const mb=document.getElementById('rbFormBody'),y=mb.scrollTop;
  rbRenderForm();mb.scrollTop=y;const b2=document.querySelector('#rbFormBody .cupnote-chips');if(b2)b2.scrollTop=st;
}
function rbSave(){
  const f=_rbForm;
  if(!f.name.trim()){alert('원두 이름을 넣어 주세요.');return;}
  if(!f.roastery.trim()){alert('로스터리를 넣어 주세요.');return;}
  if(!f.roast_date){alert('로스팅 날짜를 넣어 주세요. (디개싱 일수 계산에 필요해요)');return;}
  const data={id:f._id||('rb_'+genId()),name:f.name.trim(),roastery:canonShop(f.roastery),roast_date:f.roast_date,buy_date:f.buy_date||'',
    origin:f.origin||'',process:f.process||'',level:f.level||'',weight_g:f.weight_g?String(f.weight_g):'',price:f.price||'',
    cup_notes:(f.cup_notes||'').trim(),memo:(f.memo||'').trim(),status:f.status||RB_STATUS_ON,decaf:!!f.decaf,rest_min:String(parseInt(f.rest_min)||''),rest_max:String(parseInt(f.rest_max)||'')};
  const list=rbList();const i=list.findIndex(x=>x.id===data.id);
  if(i>=0)list[i]={...list[i],...data};else list.push(data);
  saveDB();closeMo('moRbForm');renderRoastedBeans();
}
function rbDelete(){
  const b=rbList().find(x=>x.id===_rbForm._id);if(!b)return;
  const n=rbCups(b).length;
  if(!confirm(`"${b.name}"을(를) 삭제할까요?${n?`\n\n마신 기록 ${n}건은 그대로 남아요.`:''}`))return;
  db.roasted_beans=rbList().filter(x=>x.id!==b.id);
  saveDB();closeMo('moRbForm');renderRoastedBeans();
}

/* 원두 카드 → 오늘의 한 잔 (이 원두가 골라진 상태로) */
function rbSnap(b){return {roast_id:'',rb_id:b.id,bean:b.name,roastery:b.roastery||'',roast_date:b.roast_date||'',mode:'',dtr:'',loss:'',batch_no:'',decaf:!!b.decaf,frozen:b.frozen||''};}
function openDailyCupRb(id){
  const b=rbList().find(x=>x.id===id);if(!b)return;
  const tb=[...document.querySelectorAll('.tb')].find(t=>(t.getAttribute('onclick')||'').includes("'dailycup'"));
  if(tb)showTab('dailycup',tb);
  if(typeof dcNew==='function'&&(!_dc||_dc.editId))dcNew();
  _dc.sel=rbSnap(b);renderDailyCup();window.scrollTo(0,0);
}

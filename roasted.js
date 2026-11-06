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
let _rbForm=null;

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

/* ── 목록 ── */
function renderRoastedBeans(){
  const el=document.getElementById('rbRoot');if(!el)return;
  const all=rbList();
  const q=_rbSearch.toLowerCase().replace(/\s+/g,'');
  let list=all.filter(b=>_rbFilter==='all'||(_rbFilter==='done'?b.status===RB_STATUS_DONE:b.status!==RB_STATUS_DONE));
  if(q)list=list.filter(b=>[b.name,b.roastery,b.origin,b.process,b.cup_notes].join('').toLowerCase().replace(/\s+/g,'').includes(q));
  list=list.slice().sort((a,b)=>(b.roast_date||'')>(a.roast_date||'')?1:-1);
  const fc=(k,l)=>`<div class="fc ${_rbFilter===k?'on':''}" onclick="_rbFilter='${k}';renderRoastedBeans()">${l}</div>`;
  const nOn=all.filter(b=>b.status!==RB_STATUS_DONE).length;
  el.innerHTML=`<div class="sh"><div class="stl">원두 목록</div><button class="btn btn-sm" onclick="openRbForm()">+ 원두 등록</button></div>
    <input class="search" placeholder="원두 · 로스터리 · 원산지 · 컵노트 검색..." value="${rbEsc(_rbSearch)}" oninput="_rbSearch=this.value;renderRoastedBeans();const i=document.querySelector('#rbRoot .search');i.focus();i.setSelectionRange(i.value.length,i.value.length)">
    <div class="filters">${fc('on',`${RB_STATUS_ON} ${nOn}`)}${fc('done',RB_STATUS_DONE)}${fc('all','전체')}</div>
    <div class="grid">${list.map(rbCard).join('')||
      `<div class="empty"><div class="empty-icon">🫘</div><div class="empty-text">${all.length?'맞는 원두가 없어요':'산 원두를 등록해 보세요'}</div></div>`}</div>`;
}
function rbCard(b){
  const done=b.status===RB_STATUS_DONE;
  const d=rbDays(b.roast_date);
  const cups=rbCups(b);
  const avg=cups.length?(cups.reduce((s,r)=>s+(+r.stars||0),0)/cups.length).toFixed(1):'';
  const sub=[b.origin,b.process,b.level].filter(Boolean).join(' · ');
  const meta=[b.roast_date?`${b.roast_date.slice(5).replace('-','/')} 로스팅`:'',d!=null&&!done?`${d}일차`:'',b.weight_g?b.weight_g+'g':'',b.price?Number(b.price).toLocaleString()+'원':''].filter(Boolean).join(' · ');
  return `<div class="bcard rb-card${done?' sogin':''}" onclick="openRbForm('${b.id}')">
    <div class="bog">${rbEsc(b.roastery||'—')}</div>
    <div class="bnm">${rbEsc(b.name)}</div>
    <div class="bsub">${rbEsc(sub)||'&nbsp;'}</div>
    ${b.cup_notes?`<div class="bnote">${rbEsc(b.cup_notes)}</div>`:''}
    <div class="bstock">${rbEsc(meta)}${cups.length?` · 마신 기록 ${cups.length}회 ★${avg}`:''}</div>
    ${done?'':`<button class="dc-open" onclick="event.stopPropagation();openDailyCupRb('${b.id}')">☕ 한 잔 기록</button>`}
    <div class="bfoot"><span class="bfmeta">${b.buy_date?'구매 '+rbEsc(b.buy_date.slice(2).replace(/-/g,'.')):''}</span>${done?'<span class="sogin-bdg">다 마심</span>':''}</div>
  </div>`;
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
  const t=today(),ago=n=>{const d=new Date();d.setDate(d.getDate()-n);return localDate(d);};
  const rdChips=[['오늘',t],['어제',ago(1)],['3일 전',ago(3)],['1주 전',ago(7)]].map(([l,v])=>chip(f.roast_date===v,l,`_rbForm.roast_date='${v}';rbRenderForm()`)).join('');
  document.getElementById('rbFormBody').innerHTML=`
    <div class="mtitle">${f._id?'원두 수정':'원두 등록'}</div>
    <div class="fg"><label class="fl">원두 이름 *</label><input class="inp" placeholder="예: 에티오피아 구지 함벨라" value="${rbEsc(f.name)}" oninput="_rbForm.name=this.value"></div>
    <div class="fg"><label class="fl">로스터리 *</label>
      ${roasteries?`<div class="dc-chips" style="margin-bottom:6px">${roasteries}</div>`:''}
      <input class="inp" placeholder="목록에 없으면 새로 입력 (다음부터 목록에 나옴)" value="${rbEsc(f.roastery)}" oninput="_rbForm.roastery=this.value"></div>
    <div class="fg"><label class="fl">로스팅 날짜 * <span class="fl-hint">봉투에 적힌 날짜</span></label>
      <div class="dc-chips" style="margin-bottom:6px">${rdChips}</div>
      <input class="inp" type="date" value="${rbEsc(f.roast_date)}" onchange="_rbForm.roast_date=this.value;rbRenderForm()"></div>
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
    cup_notes:(f.cup_notes||'').trim(),memo:(f.memo||'').trim(),status:f.status||RB_STATUS_ON};
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
function rbSnap(b){return {roast_id:'',rb_id:b.id,bean:b.name,roastery:b.roastery||'',roast_date:b.roast_date||'',mode:'',dtr:'',loss:'',batch_no:''};}
function openDailyCupRb(id){
  const b=rbList().find(x=>x.id===id);if(!b)return;
  const tb=[...document.querySelectorAll('.tb')].find(t=>(t.getAttribute('onclick')||'').includes("'dailycup'"));
  if(tb)showTab('dailycup',tb);
  if(typeof dcNew==='function'&&(!_dc||_dc.editId))dcNew();
  _dc.sel=rbSnap(b);renderDailyCup();window.scrollTo(0,0);
}

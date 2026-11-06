// dailycup.js — 오늘의 한 잔 (매일 마신 커피 간단 평가) · 2026-11-05
// 저장: db.dailycups (기존 항목과 분리된 새 배열, Google Sheets 동기화 포함 → PC에서 Claude가 읽어 분석 가능)
//
// ════════════════════════════════════════════════════════════════
//  ✏️ 바꾸고 싶으면 여기만 고치면 됨 (태그 · 선택지 · 힌트 문구)
// ════════════════════════════════════════════════════════════════
// 좋았던 점: 단맛·산미·향은 따로 고르므로 겹치는 것(향 또렷·꽃향·과일향·달다·상큼한 산미)은 뺌 (2026-11-06)
const DC_GOOD_TAGS=['초콜릿·견과','깔끔','부드러움','뒷맛 길다','식어도 맛있음'];
const DC_ACIDITY=['밝고 좋은 산미','부드럽고 좋은 산미','무거운 산미','신맛이 강해서 별로','산미 거의 없음'];   // 하나만
const DC_AROMA=['향 안 남','향 남','좋은 향 또렷','★ 컵노트가 확 느껴짐'];                                  // 하나만
const DC_AROMA_NOTES='★ 컵노트가 확 느껴짐';   // 이걸 고르면 원두 컵노트 칩이 뜸
const DC_COOL=['더 좋아짐','비슷함','나빠짐','단맛 올라옴','신맛 강해짐','향 또렷해짐'];                     // 식었을 때 (여러 개)
const DC_BLOOM=['30초','45초','1분','1분 30초'];
const DC_DILUTE=['0','10','20','30','40'];
const DC_TIMES=['2:30','3:00','3:30','4:00','4:30'];
const DC_WATERS=['백산수10+딥스골드1'];
// 레시피 프리셋: 고르면 아래 값이 한 번에 채워짐 (decafOf/decafTwin: 디카페인 원두를 고르면 자동으로 짝 프리셋)
const DC_PRESETS=[
  {name:'펄사 15g',dripper:'펄사 미니',grinder:'ZP6',clicks:'75',coffee_g:'15',water_g:'250',dilute_g:'20',temp:'94',bloom:'1분',water:'백산수10+딥스골드1',
   steps:'스위치 닫고 50g → 1분 오픈 50g → 1:30 50g → 2:00 50g → 2:30 50g',decafTwin:'펄사 15g 디카페인'},
  {name:'펄사 15g 디카페인',dripper:'펄사 미니',grinder:'ZP6',clicks:'75',coffee_g:'15',water_g:'250',dilute_g:'20',temp:'90',bloom:'30초',water:'백산수10+딥스골드1',
   steps:'스위치 닫고 50g → 1분 오픈 50g → 1:30 50g → 2:00 50g → 2:30 50g',decaf:true,regularTwin:'펄사 15g'},
];
const DC_BAD_TAGS=['향 약함','발효취·술 냄새','단맛 없음','밋밋함','떫음','물 같음(얇음)','풋내·곡물 냄새','탄맛·스모키','텁텁함(구운 빵 맛)','오래된 맛(종이·눅눅)'];
const DC_BALANCE=[
  {v:'sour2',  l:'많이 시다'},
  {v:'sour1',  l:'약간 시다'},
  {v:'good',   l:'딱 좋다'},
  {v:'bitter1',l:'약간 쓰다'},
  {v:'bitter2',l:'많이 쓰다'},
];
const DC_BALANCE_BOTH={v:'both',l:'시고 쓰다 (둘 다)'};
const DC_STRENGTH=[{v:'weak',l:'연하다'},{v:'ok',l:'적당'},{v:'strong',l:'진하다'}];
const DC_DRIPPERS=['하리오 V60','하리오 네오','하리오 알파','펄사 미니','옥소 래피드 브루어'];
const DC_GRINDERS=[
  {name:'코만단테 C40',min:5,max:50},
  {name:'ZP6',min:5,max:250},
  {name:'A4Z',min:35,max:350},
];
// 힌트: 최근 7번 기록 중 조건에 맞는 게 3번 이상이면 화면 위에 표시
//   sameBean:true → 같은 생두 안에서 3번 이상일 때 (문구의 {bean}은 생두 이름으로 바뀜)
const DC_HINT_WINDOW=7, DC_HINT_MIN=3;
const DC_HINTS=[
  {id:'under',  match:r=>r.balance==='sour1'||r.balance==='sour2'||(r.bad||[]).includes('물 같음(얇음)'),
   text:'추출이 덜 된 것 같아요. 분쇄도를 조금 곱게, 또는 물 온도를 올려 보세요.'},
  {id:'over',   match:r=>r.balance==='bitter1'||r.balance==='bitter2'||(r.bad||[]).includes('떫음'),
   text:'추출이 너무 된 것 같아요. 분쇄도를 조금 굵게, 또는 물 온도를 내려 보세요.'},
  {id:'channel',match:r=>r.balance==='both',
   text:'물이 고르게 지나가지 않는 것 같아요. 분쇄도보다 물 붓는 방법과 원두 층을 고르게 펴는 걸 먼저 확인해 보세요.'},
  {id:'weak',   match:r=>r.strength==='weak',   text:'원두 양을 조금 늘리거나 물을 줄여 보세요.'},
  {id:'strong', match:r=>r.strength==='strong', text:'원두 양을 조금 줄이거나 물을 늘려 보세요.'},
  {id:'underroast',sameBean:true,match:r=>(r.bad||[]).includes('풋내·곡물 냄새'),
   text:'{bean}은(는) 덜 볶였을 수 있어요. DTR을 올리거나 다른 모드를 시도해 보세요.'},
  {id:'overroast', sameBean:true,match:r=>(r.bad||[]).includes('탄맛·스모키')||(r.bad||[]).includes('텁텁함(구운 빵 맛)'),
   text:'{bean}은(는) 너무 볶였을 수 있어요. DTR을 낮춰 보세요.'},
  {id:'ferment',   sameBean:true,match:r=>(r.bad||[]).includes('발효취·술 냄새'),
   text:'{bean}은(는) 숙성을 며칠 더 해 보세요.'},
  {id:'stale',  match:r=>(r.bad||[]).includes('오래된 맛(종이·눅눅)'),
   text:'원두 보관 상태를 확인해 보세요(밀봉, 소분 냉동).'},
];
// ════════════════════════════════════════════════════════════════

const DC_HINT_CLOSED_KEY='dailyCupHintClosed';  // 닫은 힌트 (이 기기 화면 상태만)
let _dc=null;          // 작성 중인 기록
let _dcTab='list';     // 'list' | 'ana'
let _dcFilter='';
let _dcAnaBatch='', _dcAnaBean='';
let _dcPickQ='';

/* ── 헬퍼 ── */
function dcList(){if(!Array.isArray(db.dailycups))db.dailycups=[];return db.dailycups;}
function dcEsc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function dcMD(d){if(!d)return '';const p=d.split('-');return p.length===3?(+p[1])+'/'+(+p[2]):d;}
function dcDays(drink,roast){
  if(!drink||!roast)return null;
  const p=s=>{const [y,m,d]=s.split('-').map(Number);return Date.UTC(y,m-1,d);};
  const v=Math.round((p(drink)-p(roast))/86400000);return isNaN(v)?null:v;
}
function dcShort(name){
  const w=String(name||'').trim().split(/\s+/);
  const origins=new Set((db.beans||[]).map(b=>b.origin).filter(Boolean));
  if(w.length>1&&origins.has(w[0]))w.shift();
  return w.slice(0,w[1]&&/^(AA|AB|PB|G1|G2)$/i.test(w[1])?2:1).join(' ')||String(name||'');
}
function dcName(s){return (s&&(s.manual||s.rb_id))?s.bean:dcShort(s&&s.bean);}
function dcRoastDTR(r){
  let dtr=r.dtr_pct;
  if(!dtr&&r.pop_time&&r.eject_time&&r.mode){
    const ae=BINBON_MODES[+r.mode];
    if(ae){const ps=toSec(r.pop_time),es=toSec(r.eject_time);if(ps>es&&(ae-es)>0)dtr=((ps-es)/(ae-es)*100).toFixed(1);}
  }
  return dtr?String(+(+dtr).toFixed(1)):'';
}
function dcRoastLoss(r){
  if(r.loss_pct)return String(r.loss_pct);
  if(r.input_g&&r.output_g)return ((+r.input_g - +r.output_g)/+r.input_g*100).toFixed(1);
  return '';
}
function dcProfile(s){ // "3-12" (구매 원두는 로스터리)
  if(s&&s.rb_id)return s.roastery||'구매';
  if(!s||!s.mode)return '';
  return s.dtr?`${s.mode}-${Math.round(+s.dtr)}`:`${s.mode}번`;
}
function dcBatchKey(s){return s.roast_id?s.roast_id:s.rb_id?`rb:${s.rb_id}`:`m:${s.bean}|${s.roast_date||''}`;}
function dcSnapFromRoast(r){
  const bn=typeof beanOfRoast==='function'?beanOfRoast(r):null;
  return {roast_id:r.id,bean_id:bn?bn.id:'',decaf:!!(bn&&bn.decaf),bean:r.bean_name||'',roast_date:r.date||'',mode:r.mode?String(r.mode):'',
    dtr:dcRoastDTR(r),loss:dcRoastLoss(r),batch_no:r.batch_no||''};
}
function dcStars(n){return '★'.repeat(n||0);}
function dcBeanNotes(sel){ // 고른 원두의 컵노트 (생두/원두 목록)
  if(!sel)return [];
  let txt='';
  if(sel.rb_id){const b=(db.roasted_beans||[]).find(x=>x.id===sel.rb_id);txt=b?b.cup_notes:'';}
  else if(sel.roast_id){const r=db.roasts.find(x=>x.id===sel.roast_id);const b=r?beanOfRoast(r):null;txt=b?b.cup_notes:'';}
  else{const b=db.beans.find(x=>x.name===sel.bean);txt=b?b.cup_notes:'';}
  txt=String(txt||'');
  return [...new Set((/[,·\/]/.test(txt)?txt.split(/[,·\/]/):txt.split(/\s+/)).map(x=>x.trim()).filter(x=>x&&x.length<=12))];
}
function dcBalLabel(v){if(v==='both')return DC_BALANCE_BOTH.l;const x=DC_BALANCE.find(b=>b.v===v);return x?x.l:'';}
function dcStrLabel(v){const x=DC_STRENGTH.find(b=>b.v===v);return x?x.l:'';}
function dcSummary(r){
  const s=r.bean_info||{};
  const prof=dcProfile(s);
  const head=`${dcMD(r.date)} · ${dcName(s)}${prof?' '+prof:''}${r.degas_days!=null?` (${r.degas_days}일차)`:''}`;
  const parts=[head,dcStars(r.stars)];
  if(r.sweet)parts.push('단맛'+r.sweet);
  if(r.acidity)parts.push(r.acidity);
  if(r.aroma)parts.push(r.aroma.replace('★ ','')+(r.notes_felt&&r.notes_felt.length?`(${r.notes_felt.join(', ')})`:''));
  if(r.balance)parts.push(dcBalLabel(r.balance));
  if(r.strength&&r.strength!=='ok')parts.push(dcStrLabel(r.strength));
  if(r.good&&r.good.length)parts.push(r.good.join(', '));
  if(r.bad&&r.bad.length)parts.push('아쉬움: '+r.bad.join(', '));
  if(r.cool&&r.cool.length)parts.push('식으면 '+r.cool.join(', '));
  return parts.join(' · ');
}
function dcSortedRecords(){
  return dcList().slice().sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:(b.created_at||0)-(a.created_at||0));
}
/* 고르기 목록: 최근에 마신 배치 먼저 → 나머지는 최근 로스팅 순 */
function dcBatchChoices(){
  const out=[],seen=new Set();
  dcSortedRecords().forEach(r=>{
    const s=r.bean_info||{};const k=dcBatchKey(s);if(seen.has(k))return;seen.add(k);
    const live=s.roast_id?db.roasts.find(x=>x.id===s.roast_id):null;
    const liveRb=s.rb_id&&typeof rbList==='function'?rbList().find(x=>x.id===s.rb_id):null;
    out.push({snap:live?dcSnapFromRoast(live):liveRb?rbSnap(liveRb):{...s},drunk:true,last:r.date});
  });
  const rest=[];
  db.roasts.forEach((r,i)=>{if(!seen.has(r.id))rest.push({snap:dcSnapFromRoast(r),d:r.date||'',i});});
  (db.roasted_beans||[]).forEach((b,i)=>{if(b.status!=='다 마심'&&!seen.has('rb:'+b.id))rest.push({snap:rbSnap(b),d:b.roast_date||'',i:1e6+i});});
  rest.sort((a,b)=>a.d<b.d?1:a.d>b.d?-1:b.i-a.i).forEach(x=>out.push({snap:x.snap,drunk:false}));
  return out;
}
function dcLastBrew(){
  const r=dcSortedRecords().find(x=>x.brew&&Object.keys(x.brew).length);
  return r?{...r.brew}:{};
}
function dcGrinder(name){return DC_GRINDERS.find(g=>g.name===name)||null;}
function dcAllRecipes(){
  const conv=r=>({name:r.name,coffee_g:r.coffee||r.coffee_g||'',water_g:r.water||r.water_g||'',temp:r.temp||''});
  return [...(db.recipes||[]).map(conv),...OFFICIAL_RECIPES.map(conv)];
}
function dcDrippers(){ // 기본 목록 + 직접 추가했던 드리퍼
  const extra=dcList().map(r=>r.brew&&r.brew.dripper).filter(d=>d&&!DC_DRIPPERS.includes(d));
  return [...DC_DRIPPERS,...new Set(extra)];
}

/* ── 상태 ── */
function dcNew(){
  const lb=dcLastBrew();
  _dc={editId:null,date:today(),sel:null,stars:0,balance:'',strength:'',good:[],bad:[],
       sweet:0,acidity:'',aroma:'',notes_felt:[],cool:[],memo_hot:'',memo_cool:'',
       brew:{recipe:lb.recipe||'',dripper:lb.dripper||'',grinder:lb.grinder||'',clicks:lb.clicks||'',
             coffee_g:lb.coffee_g||'',water_g:lb.water_g||'',temp:lb.temp||'',time:lb.time||'',
             bloom:lb.bloom||'',dilute_g:lb.dilute_g||'',water:lb.water||DC_WATERS[0]},
       memo:'',more:false};
}

/* ── 화면 ── */
function renderDailyCup(){
  if(!_dc)dcNew();
  const el=document.getElementById('dcRoot');if(!el)return;
  el.innerHTML=dcHintsHtml()+dcEntryHtml()+dcTabsHtml();
}
function dcRerender(){const y=window.scrollY;renderDailyCup();window.scrollTo(0,y);}

function dcHintsHtml(){
  const recent=dcSortedRecords().slice(0,DC_HINT_WINDOW);
  if(recent.length<DC_HINT_MIN)return '';
  let closed={};try{closed=JSON.parse(localStorage.getItem(DC_HINT_CLOSED_KEY)||'{}');}catch(e){}
  const stamp=recent[0].id;  // 새 기록이 생기면 닫았던 힌트도 다시 판단
  const out=[];
  DC_HINTS.forEach(h=>{
    if(h.sameBean){
      const byBean={};recent.filter(h.match).forEach(r=>{const b=(r.bean_info||{}).bean||'';byBean[b]=(byBean[b]||0)+1;});
      Object.entries(byBean).forEach(([b,n])=>{if(n>=DC_HINT_MIN)out.push({key:h.id+'|'+b,text:h.text.replace('{bean}',dcShort(b))});});
    }else if(recent.filter(h.match).length>=DC_HINT_MIN)out.push({key:h.id,text:h.text});
  });
  return out.filter(x=>closed[x.key]!==stamp).map(x=>`<div class="dc-hint"><span>💡 ${dcEsc(x.text)}</span><button onclick="dcCloseHint('${dcEsc(x.key).replace(/'/g,"\\'")}','${stamp}')">✕</button></div>`).join('');
}
function dcCloseHint(key,stamp){
  let c={};try{c=JSON.parse(localStorage.getItem(DC_HINT_CLOSED_KEY)||'{}');}catch(e){}
  c[key]=stamp;localStorage.setItem(DC_HINT_CLOSED_KEY,JSON.stringify(c));dcRerender();
}

function dcEntryHtml(){
  const e=_dc;
  const deg=e.sel?dcDays(e.date,e.sel.roast_date):null;
  // 빠른 선택: 최근 배치 3개
  window._dcQuick=dcBatchChoices().slice(0,3);
  const quick=window._dcQuick.map((c,i)=>{
    const on=e.sel&&dcBatchKey(e.sel)===dcBatchKey(c.snap);
    return `<button class="dc-qbatch${on?' on':''}" onclick="dcSelect({...window._dcQuick[${i}].snap})">
      <b>${dcEsc(dcName(c.snap))}</b><span>${dcEsc([dcMD(c.snap.roast_date),dcProfile(c.snap)].filter(Boolean).join(' · '))}</span></button>`;
  }).join('');
  const selBox=e.sel?`<div class="dc-sel"><div class="dc-sel-name">${dcEsc(e.sel.bean)}</div>
      <div class="dc-sel-meta">${dcEsc([e.sel.roast_date?dcMD(e.sel.roast_date)+' 로스팅':'',dcProfile(e.sel),e.sel.batch_no?`그날 ${e.sel.batch_no}번째`:'',e.sel.manual?'직접 입력':'',e.sel.rb_id?'산 원두':''].filter(Boolean).join(' · '))}</div>
      <div class="dc-sel-deg" id="dcDegText">${deg!=null?`디개싱 <b>${deg}일차</b>`:'로스팅 날짜 없음'}</div></div>`:'';
  const stars=[1,2,3,4,5].map(n=>`<button class="dc-star${e.stars>=n?' on':''}" onclick="dcSetStars(${n})" aria-label="별 ${n}개">★</button>`).join('');
  return `<div class="sh"><div class="stl">${e.editId?'기록 수정':'오늘의 한 잔'}</div>${e.editId?'<button class="btn2" onclick="dcCancelEdit()">수정 취소</button>':''}</div>
  <div class="dc-card">
    <div class="dc-lbl">원두 <span class="dc-req">필수</span></div>
    ${quick?`<div class="dc-qbatches">${quick}</div>`:''}
    <button class="dc-pickbtn" onclick="dcOpenPick()">${e.sel?'다른 원두 고르기':'원두 고르기'} ▸</button>
    ${selBox}
    <div class="dc-lbl" style="margin-top:14px">만족도 <span class="dc-req">필수</span></div>
    <div class="dc-stars">${stars}</div>
    <div class="dc-date">마신 날짜 <input class="inp" type="date" value="${e.date}" onchange="dcDateChanged(this.value)"></div>
    <button class="dc-more-btn" onclick="_dc.more=!_dc.more;dcRerender()">${e.more?'▴ 접기':'▾ 더 입력하기'}${dcMoreCount()?` (${dcMoreCount()})`:''}</button>
    ${e.more?dcMoreHtml():''}
    <button class="dc-save" onclick="dcSave()">${e.editId?'수정 저장':'저장'}</button>
  </div>`;
}
function dcMoreCount(){const e=_dc;return (e.sweet?1:0)+(e.acidity?1:0)+(e.aroma?1:0)+(e.balance?1:0)+(e.strength?1:0)+e.good.length+e.bad.length+e.cool.length+(e.memo?1:0)+(e.memo_hot?1:0)+(e.memo_cool?1:0);}
function dcMoreHtml(){
  const e=_dc,b=e.brew;
  const chip=(on,l,fn)=>`<button class="dc-chip${on?' on':''}" onclick="${fn}">${dcEsc(l)}</button>`;
  const q=s=>dcEsc(s).replace(/'/g,"\\'");
  const bal=DC_BALANCE.map(x=>`<button class="dc-bal${e.balance===x.v?' on':''}" onclick="dcSet('balance','${x.v}')">${x.l}</button>`).join('');
  const str=DC_STRENGTH.map(x=>`<button class="dc-seg${e.strength===x.v?' on':''}" onclick="dcSet('strength','${x.v}')">${x.l}</button>`).join('');
  const good=DC_GOOD_TAGS.map(t=>chip(e.good.includes(t),t,`dcToggle('good','${q(t)}')`)).join('');
  const bad=DC_BAD_TAGS.map(t=>chip(e.bad.includes(t),t,`dcToggle('bad','${q(t)}')`)).join('');
  const recs=DC_PRESETS.map((p,i)=>chip(b.recipe===p.name,'⚡ '+p.name,`dcApplyPreset(${i})`)).join('')+
    dcAllRecipes().map((r,i)=>chip(b.recipe===r.name,r.name,`dcSetRecipe(${i})`)).join('');
  const preset=DC_PRESETS.find(p=>p.name===b.recipe);
  const one=(arr,cur,k)=>arr.map(v=>chip(cur===v,v,`dcSet('${k}','${q(v)}')`)).join('');
  const sweet=[1,2,3,4,5].map(n=>`<button class="dc-seg${e.sweet===n?' on':''}" onclick="dcSetNum('sweet',${n})">${n}</button>`).join('');
  const notes=e.aroma===DC_AROMA_NOTES?(()=>{const bn=dcBeanNotes(e.sel);const all=[...new Set([...bn,...e.notes_felt])];
    return `<div class="dc-mini">느낀 컵노트 <span class="dc-opt">${bn.length?'이 원두 컵노트':'등록된 컵노트 없음'} · 여러 개</span></div><div class="dc-chips">${
      all.map(n=>chip(e.notes_felt.includes(n),n,`dcToggle('notes_felt','${q(n)}')`)).join('')}<button class="dc-chip add" onclick="dcAddNote()">+ 직접 추가</button></div>`;})():'';
  const cool=DC_COOL.map(t=>chip(e.cool.includes(t),t,`dcToggle('cool','${q(t)}')`)).join('');
  const bloom=DC_BLOOM.map(v=>chip(b.bloom===v,v,`dcSetBrew('bloom','${v}')`)).join('')+chip(b.bloom&&!DC_BLOOM.includes(b.bloom),b.bloom&&!DC_BLOOM.includes(b.bloom)?b.bloom:'직접',`dcAskBrew('bloom','불림 시간 (예: 40초)')`);
  const dil=DC_DILUTE.map(v=>chip(String(b.dilute_g)===v,v+'g',`dcSetBrew('dilute_g','${v}')`)).join('')+chip(b.dilute_g!==''&&b.dilute_g!=null&&!DC_DILUTE.includes(String(b.dilute_g)),b.dilute_g!==''&&b.dilute_g!=null&&!DC_DILUTE.includes(String(b.dilute_g))?b.dilute_g+'g':'직접',`dcAskBrew('dilute_g','가수 (g)')`);
  const times=DC_TIMES.map(v=>chip(b.time===v,v,`dcSetBrew('time','${v}')`)).join('');
  const waters=[...new Set([...DC_WATERS,...dcList().map(r=>r.brew&&r.brew.water).filter(Boolean),b.water].filter(Boolean))].map(w=>chip(b.water===w,w,`dcSetBrew('water','${q(w)}')`)).join('')+`<button class="dc-chip add" onclick="dcAskBrew('water','물 이름 (예: 에비앙)')">+ 직접 추가</button>`;
  const drs=dcDrippers().map(d=>chip(b.dripper===d,d,`dcSetBrew('dripper','${q(d)}')`)).join('')+`<button class="dc-chip add" onclick="dcAddDripper()">+ 직접 추가</button>`;
  const grs=DC_GRINDERS.map(g=>chip(b.grinder===g.name,g.name,`dcSetGrinder('${q(g.name)}')`)).join('');
  const G=dcGrinder(b.grinder);
  let clickSel='';
  if(G){let o='<option value="">클릭</option>';for(let c=G.min;c<=G.max;c++)o+=`<option value="${c}"${+b.clicks===c?' selected':''}>${c}클릭</option>`;
    clickSel=`<div class="dc-clicks"><button class="dc-adj" onclick="dcClick(-1)">−1</button><select class="sel" onchange="_dc.brew.clicks=this.value">${o}</select><button class="dc-adj" onclick="dcClick(1)">+1</button></div>`;}
  const inp=(k,ph,mode)=>`<input class="inp" ${mode?`inputmode="${mode}"`:''} placeholder="${ph}" value="${dcEsc(b[k])}" oninput="_dc.brew.${k}=this.value">`;
  return `<div class="dc-more">
    <div class="dc-sub">① 맛</div>
    <div class="dc-mini">단맛</div><div class="dc-segs dc-segs5">${sweet}</div>
    <div class="dc-mini">산미 <span class="dc-opt">하나만</span></div><div class="dc-chips">${one(DC_ACIDITY,e.acidity,'acidity')}</div>
    <div class="dc-mini">향 <span class="dc-opt">하나만</span></div><div class="dc-chips">${one(DC_AROMA,e.aroma,'aroma')}</div>${notes}
    <div class="dc-sub">② 맛 균형 · 농도</div><div class="dc-bals">${bal}</div>
    <button class="dc-both${e.balance==='both'?' on':''}" onclick="dcSet('balance','both')">${DC_BALANCE_BOTH.l}</button>
    <div class="dc-segs" style="margin-top:6px">${str}</div>
    <div class="dc-sub">③ 따뜻할 때 · 식었을 때</div>
    <input class="inp" placeholder="따뜻할 때 (짧게)" value="${dcEsc(e.memo_hot)}" oninput="_dc.memo_hot=this.value">
    <div class="dc-mini">식었을 때 <span class="dc-opt">여러 개</span></div><div class="dc-chips">${cool}</div>
    <input class="inp" style="margin-top:6px" placeholder="식었을 때 (짧게)" value="${dcEsc(e.memo_cool)}" oninput="_dc.memo_cool=this.value">
    <div class="dc-sub">④ 좋았던 점 · 아쉬운 점</div><div class="dc-chips">${good}</div>
    <div class="dc-chips" style="margin-top:8px">${bad}</div>
    <div class="dc-sub">⑤ 추출 정보 <span class="dc-opt">지난번 값으로 채워져 있어요</span></div>
    <div class="dc-mini">레시피 <span class="dc-opt">⚡ 프리셋은 아래 값을 한 번에 채움</span></div><div class="dc-chips">${recs}</div>
    ${preset&&preset.steps?`<div class="dc-steps-note">${dcEsc(preset.steps)}</div>`:''}
    <div class="dc-mini">드리퍼</div><div class="dc-chips">${drs}</div>
    <div class="dc-mini">그라인더 · 클릭수</div><div class="dc-chips">${grs}</div>${clickSel}
    <div class="dc-grid4">
      <div><div class="dc-mini">원두 g</div>${inp('coffee_g','15','decimal')}</div>
      <div><div class="dc-mini">물 g</div>${inp('water_g','240','decimal')}</div>
      <div><div class="dc-mini">물 온도</div>${inp('temp','93','decimal')}</div>
      <div><div class="dc-mini">디카페인</div><div class="dc-dec">${e.sel&&e.sel.decaf?'☕ 디카페인 원두':'아님'}</div></div>
    </div>
    <div class="dc-mini">불림</div><div class="dc-chips">${bloom}</div>
    <div class="dc-mini">가수</div><div class="dc-chips">${dil}</div>
    <div class="dc-mini">총 추출 시간 ${b.time?`<b class="dc-tval">${dcEsc(b.time)}</b>`:''}</div><div class="dc-chips">${times}<button class="dc-chip" onclick="dcTimeAdj(-10)">−10초</button><button class="dc-chip" onclick="dcTimeAdj(10)">+10초</button></div>
    <div class="dc-mini">물</div><div class="dc-chips">${waters}</div>
    <div class="dc-sub">⑥ 한 줄 메모</div>
    <input class="inp" placeholder="예: 식으니 단맛이 올라옴" value="${dcEsc(e.memo)}" oninput="_dc.memo=this.value">
  </div>`;
}
function dcDateChanged(v){ // 달력을 닫지 않도록 화면 전체를 다시 그리지 않고 디개싱 글자만 바꿈
  _dc.date=v||today();
  const el=document.getElementById('dcDegText');
  if(el&&_dc.sel){const d=dcDays(_dc.date,_dc.sel.roast_date);el.innerHTML=d!=null?`디개싱 <b>${d}일차</b>`:'로스팅 날짜 없음';}
}
function dcSelect(snap){_dc.sel=snap;closeMo('moDcPick');if(!_dc.editId)dcMatchDecafPreset();dcRerender();}
function dcSetNum(k,n){_dc[k]=_dc[k]===n?0:n;dcRerender();}
function dcAddNote(){const v=(prompt('느낀 컵노트')||'').trim();if(v&&!_dc.notes_felt.includes(v)){_dc.notes_felt.push(v);}dcRerender();}
function dcAskBrew(k,label){const v=(prompt(label,_dc.brew[k]||'')||'').trim();if(v){_dc.brew[k]=k==='dilute_g'?v.replace(/[^0-9.]/g,''):v;}dcRerender();}
function dcTimeAdj(d){
  const t=_dc.brew.time||'3:00',p=t.split(':');let s=(+p[0])*60+(+p[1]||0)+d;if(s<0)s=0;
  _dc.brew.time=Math.floor(s/60)+':'+String(s%60).padStart(2,'0');dcRerender();
}
function dcApplyPreset(i){
  const p=DC_PRESETS[i];if(!p)return;
  if(_dc.brew.recipe===p.name){_dc.brew.recipe='';dcRerender();return;}
  ['dripper','grinder','clicks','coffee_g','water_g','dilute_g','temp','bloom','water'].forEach(k=>{if(p[k]!=null)_dc.brew[k]=p[k];});
  _dc.brew.recipe=p.name;dcRerender();
}
/* 디카페인 원두를 고르면 짝 프리셋으로 바꿔 줌 (반대도) */
function dcMatchDecafPreset(){
  const cur=DC_PRESETS.find(p=>p.name===_dc.brew.recipe);if(!cur||!_dc.sel)return;
  const twin=_dc.sel.decaf?cur.decafTwin:cur.regularTwin;
  const i=DC_PRESETS.findIndex(p=>p.name===twin);
  if(i>=0){_dc.brew.recipe='';dcApplyPreset(i);}
}
function dcSetStars(n){_dc.stars=_dc.stars===n?0:n;dcRerender();}
function dcSet(k,v){_dc[k]=_dc[k]===v?'':v;if(k==='aroma'&&_dc.aroma!==DC_AROMA_NOTES)_dc.notes_felt=[];dcRerender();}   // 같은 걸 다시 누르면 해제 (맛 균형 막대/둘 다는 한 칸이라 하나만 선택됨)
function dcToggle(k,v){const a=_dc[k],i=a.indexOf(v);if(i>=0)a.splice(i,1);else a.push(v);dcRerender();}
function dcSetBrew(k,v){_dc.brew[k]=_dc.brew[k]===v?'':v;dcRerender();}
function dcSetRecipe(i){
  const r=dcAllRecipes()[i];if(!r)return;
  if(_dc.brew.recipe===r.name){_dc.brew.recipe='';dcRerender();return;}
  Object.assign(_dc.brew,{recipe:r.name,coffee_g:r.coffee_g||_dc.brew.coffee_g,water_g:r.water_g||_dc.brew.water_g,temp:r.temp||_dc.brew.temp});
  dcRerender();
}
function dcAddDripper(){
  const v=(prompt('드리퍼 이름을 입력하세요')||'').trim();
  if(v){_dc.brew.dripper=v;dcRerender();}
}
function dcSetGrinder(name){
  if(_dc.brew.grinder===name){_dc.brew.grinder='';_dc.brew.clicks='';dcRerender();return;}
  _dc.brew.grinder=name;
  const prev=dcSortedRecords().find(r=>r.brew&&r.brew.grinder===name&&r.brew.clicks);
  _dc.brew.clicks=prev?prev.brew.clicks:'';
  dcRerender();
}
function dcClick(d){
  const G=dcGrinder(_dc.brew.grinder);if(!G)return;
  const base=+_dc.brew.clicks||Math.round((G.min+G.max)/4);
  _dc.brew.clicks=String(Math.min(G.max,Math.max(G.min,base+d)));dcRerender();
}

/* ── 원두 고르기 ── */
function dcOpenPick(filter){
  _dcPickQ=filter||'';
  document.getElementById('dcPickSearch').value=_dcPickQ;
  dcRenderPick();openMo('moDcPick');
}
function dcRenderPick(){
  _dcPickQ=document.getElementById('dcPickSearch').value;
  const q=_dcPickQ.toLowerCase().replace(/\s+/g,'');
  const list=dcBatchChoices().filter(c=>!q||c.snap.bean.toLowerCase().replace(/\s+/g,'').includes(q));
  const counts={};dcList().forEach(r=>{const k=dcBatchKey(r.bean_info||{});counts[k]=(counts[k]||0)+1;});
  const t=_dc.date||today();
  document.getElementById('dcPickList').innerHTML=list.slice(0,60).map((c,i)=>{
    const s=c.snap,d=dcDays(t,s.roast_date),n=counts[dcBatchKey(s)]||0;
    return `<div class="dc-pick-item${c.drunk?' drunk':''}" onclick="dcPickIdx(${i})">
      <div class="dc-pi-name">${dcEsc(s.bean)}</div>
      <div class="dc-pi-meta">${s.rb_id?'<span class="dc-rbtag">산 원두</span> ':''}${dcEsc([dcMD(s.roast_date),dcProfile(s),s.batch_no?`그날 ${s.batch_no}번째`:'',d!=null?`${d}일차`:'',n?`${n}번 마심`:''].filter(Boolean).join(' · '))}</div></div>`;
  }).join('')||'<div class="dc-empty">맞는 로스팅 기록이 없어요. 아래 "직접 입력"을 써 주세요.</div>';
  window._dcPickList=list;
}
function dcPickIdx(i){const c=(window._dcPickList||[])[i];if(c)dcSelect({...c.snap});}
function dcPickManual(){
  const name=document.getElementById('dcManName').value.trim();
  if(!name){alert('원두 이름을 넣어 주세요.');return;}
  dcSelect({roast_id:'',bean:name,roast_date:document.getElementById('dcManDate').value,mode:'',dtr:'',loss:'',batch_no:'',manual:true});
}

/* ── 저장 ── */
function dcClean(o){ // 빈 값은 저장 안 함 (동기화 용량 절약)
  const out={};Object.entries(o).forEach(([k,v])=>{
    if(v===''||v==null||(Array.isArray(v)&&!v.length))return;
    if(typeof v==='object'&&!Array.isArray(v)){const c=dcClean(v);if(Object.keys(c).length)out[k]=c;return;}
    out[k]=v;});
  return out;
}
function dcSave(){
  const e=_dc;
  if(!e.sel){alert('원두를 골라 주세요.');return;}
  if(!e.stars){alert('만족도(별)를 눌러 주세요.');return;}
  const list=dcList();
  const old=e.editId?list.find(x=>x.id===e.editId):null;
  const rec=dcClean({
    id:e.editId||('dc_'+genId()),
    date:e.date,
    bean_info:{roast_id:e.sel.roast_id,bean_id:e.sel.bean_id,rb_id:e.sel.rb_id,roastery:e.sel.roastery,decaf:e.sel.decaf||'',bean:e.sel.bean,roast_date:e.sel.roast_date,mode:e.sel.mode,dtr:e.sel.dtr,loss:e.sel.loss,batch_no:e.sel.batch_no,manual:e.sel.manual||''},
    degas_days:dcDays(e.date,e.sel.roast_date),
    stars:e.stars,sweet:e.sweet||'',acidity:e.acidity,aroma:e.aroma,notes_felt:e.notes_felt.slice(),
    balance:e.balance,strength:e.strength,good:e.good.slice(),bad:e.bad.slice(),
    cool:e.cool.slice(),memo_hot:(e.memo_hot||'').trim(),memo_cool:(e.memo_cool||'').trim(),
    brew:{...e.brew},memo:(e.memo||'').trim(),
    created_at:old?old.created_at:Date.now(),
    updated_at:old?Date.now():'',
  });
  if(old)list[list.indexOf(old)]=rec;else list.push(rec);
  saveDB();
  const wasEdit=!!old;
  dcNew();renderDailyCup();
  if(!wasEdit)window.scrollTo(0,0);
  document.getElementById('saveInd').textContent=wasEdit?'☕ 수정됨':'☕ 저장됨';
}
function dcCancelEdit(){dcNew();renderDailyCup();}

/* ── 기록 / 분석 탭 ── */
function dcTabsHtml(){
  return `<div class="dc-tabs"><button class="${_dcTab==='list'?'on':''}" onclick="_dcTab='list';dcRerender()">기록 보기</button>
    <button class="${_dcTab==='ana'?'on':''}" onclick="_dcTab='ana';dcRerender()">분석</button></div>`+
    (_dcTab==='ana'?dcAnaHtml():dcListHtml());
}
function dcListHtml(){
  const all=dcSortedRecords();
  if(!all.length)return '<div class="dc-empty">아직 기록이 없어요. 위에서 원두와 별점만 넣고 저장해 보세요.</div>';
  const beans=[...new Set(all.map(r=>(r.bean_info||{}).bean).filter(Boolean))];
  const list=_dcFilter?all.filter(r=>(r.bean_info||{}).bean===_dcFilter):all;
  return `<select class="sel dc-filter" onchange="_dcFilter=this.value;dcRerender()"><option value="">모든 원두 (${all.length})</option>${
    beans.map(b=>`<option value="${dcEsc(b)}"${b===_dcFilter?' selected':''}>${dcEsc(b)}</option>`).join('')}</select>`+
    list.map(r=>`<div class="dc-row"><div class="dc-row-sum">${dcEsc(dcSummary(r))}</div>
      ${r.memo?`<div class="dc-row-memo">“${dcEsc(r.memo)}”</div>`:''}
      ${r.memo_hot||r.memo_cool?`<div class="dc-row-memo">${r.memo_hot?'따뜻: '+dcEsc(r.memo_hot):''}${r.memo_hot&&r.memo_cool?' / ':''}${r.memo_cool?'식음: '+dcEsc(r.memo_cool):''}</div>`:''}
      ${r.brew?`<div class="dc-row-brew">${dcEsc([r.brew.recipe,r.brew.dripper,r.brew.grinder?r.brew.grinder+(r.brew.clicks?' '+r.brew.clicks+'클릭':''):'',r.brew.coffee_g?r.brew.coffee_g+'g':'',r.brew.water_g?r.brew.water_g+'g':'',r.brew.temp?r.brew.temp+'°C':'',r.brew.bloom?'불림 '+r.brew.bloom:'',r.brew.dilute_g!=null&&r.brew.dilute_g!==''?'가수 '+r.brew.dilute_g+'g':'',r.brew.time,r.brew.water].filter(Boolean).join(' · '))}</div>`:''}
      <div class="dc-row-btns"><button class="btn2" onclick="dcEdit('${r.id}')">수정</button><button class="btnd" onclick="dcDelete('${r.id}')">삭제</button></div></div>`).join('');
}
function dcEdit(id){
  const r=dcList().find(x=>x.id===id);if(!r)return;
  const s=r.bean_info||{};
  const live=s.roast_id?db.roasts.find(x=>x.id===s.roast_id):null;
  const liveRb=s.rb_id&&typeof rbList==='function'?rbList().find(x=>x.id===s.rb_id):null;
  _dc={editId:r.id,date:r.date,sel:live?dcSnapFromRoast(live):liveRb?rbSnap(liveRb):{...s},stars:r.stars||0,balance:r.balance||'',strength:r.strength||'',
       good:(r.good||[]).slice(),bad:(r.bad||[]).slice(),
       sweet:+r.sweet||0,acidity:r.acidity||'',aroma:r.aroma||'',notes_felt:(r.notes_felt||[]).slice(),cool:(r.cool||[]).slice(),memo_hot:r.memo_hot||'',memo_cool:r.memo_cool||'',
       brew:{recipe:'',dripper:'',grinder:'',clicks:'',coffee_g:'',water_g:'',temp:'',time:'',bloom:'',dilute_g:'',water:'',...(r.brew||{})},memo:r.memo||'',more:true};
  renderDailyCup();window.scrollTo(0,0);
}
function dcDelete(id){
  const r=dcList().find(x=>x.id===id);if(!r)return;
  if(!confirm(`이 기록을 삭제할까요? 되돌릴 수 없어요.\n\n${dcSummary(r)}`))return;
  db.dailycups=dcList().filter(x=>x.id!==id);
  saveDB();if(_dc&&_dc.editId===id)dcNew();dcRerender();
}

/* ── 분석 ── */
function dcAvg(a){return a.length?a.reduce((x,y)=>x+y,0)/a.length:0;}
function dcBar(label,avg,n,opts={}){
  const w=Math.round(avg/5*100);
  return `<div class="dc-bar-row${opts.dim?' dim':''}${opts.best?' best':''}"><div class="dc-bar-l">${dcEsc(label)}</div>
    <div class="dc-bar-track"><div class="dc-bar-fill" style="width:${w}%"></div></div>
    <div class="dc-bar-v">${avg.toFixed(1)}<span>${n}회${opts.dim?' · 기록 적음':''}${opts.best?' · 최고':''}</span></div></div>`;
}
function dcAnaHtml(){
  const all=dcList();
  if(!all.length)return '<div class="dc-empty">기록이 쌓이면 여기서 분석을 볼 수 있어요.</div>';
  // 1. 배치별 숙성 곡선
  const batches={};all.forEach(r=>{const s=r.bean_info||{};const k=dcBatchKey(s);(batches[k]=batches[k]||{s,recs:[]}).recs.push(r);});
  const bKeys=Object.keys(batches).sort((a,b)=>batches[b].recs.length-batches[a].recs.length);
  if(!_dcAnaBatch||!batches[_dcAnaBatch])_dcAnaBatch=bKeys[0];
  const B=batches[_dcAnaBatch];
  const byDay={};B.recs.forEach(r=>{if(r.degas_days==null)return;(byDay[r.degas_days]=byDay[r.degas_days]||[]).push(r.stars);});
  const days=Object.keys(byDay).map(Number).sort((a,b)=>a-b);
  const bestAvg=Math.max(...days.map(d=>dcAvg(byDay[d])));
  const curve=days.map(d=>{const a=dcAvg(byDay[d]);return dcBar(`${d}일차`,a,byDay[d].length,{best:days.length>1&&a===bestAvg});}).join('')||'<div class="dc-empty">로스팅 날짜가 없어 일수를 계산할 수 없어요.</div>';
  const bestDays=days.filter(d=>dcAvg(byDay[d])===bestAvg);
  const bOpts=bKeys.map(k=>{const s=batches[k].s;return `<option value="${dcEsc(k)}"${k===_dcAnaBatch?' selected':''}>${dcEsc([dcName(s),dcMD(s.roast_date),dcProfile(s)].filter(Boolean).join(' · '))} (${batches[k].recs.length})</option>`;}).join('');
  // 2. 프로파일별 평균 (같은 생두 안)
  const beans={};all.forEach(r=>{const b=(r.bean_info||{}).bean;if(b)(beans[b]=beans[b]||[]).push(r);});
  const beanKeys=Object.keys(beans).sort((a,b)=>beans[b].length-beans[a].length);
  if(!_dcAnaBean||!beans[_dcAnaBean])_dcAnaBean=beanKeys[0];
  const prof={};beans[_dcAnaBean].forEach(r=>{const p=dcProfile(r.bean_info||{})||'프로파일 없음';(prof[p]=prof[p]||[]).push(r.stars);});
  const profRows=Object.entries(prof).sort((a,b)=>dcAvg(b[1])-dcAvg(a[1])).map(([p,a])=>dcBar(p,dcAvg(a),a.length,{dim:a.length<2})).join('');
  const beanOpts=beanKeys.map(b=>`<option value="${dcEsc(b)}"${b===_dcAnaBean?' selected':''}>${dcEsc(b)} (${beans[b].length})</option>`).join('');
  // 3. 자주 나온 태그
  const top3=(rs,k)=>{const c={};rs.forEach(r=>(r[k]||[]).forEach(t=>c[t]=(c[t]||0)+1));return Object.entries(c).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([t,n])=>`${t} ${n}`).join(', ');};
  const tagRows=beanKeys.map(b=>{const g=top3(beans[b],'good'),x=top3(beans[b],'bad');if(!g&&!x)return '';
    return `<div class="dc-tag-row"><b>${dcEsc(dcShort(b))}</b>${g?`<div>👍 ${dcEsc(g)}</div>`:''}${x?`<div>👎 ${dcEsc(x)}</div>`:''}</div>`;}).join('')||'<div class="dc-empty">태그를 고른 기록이 아직 없어요.</div>';
  return `<div class="dc-card"><div class="dc-ana-t">① 배치별 숙성 곡선</div>
      <select class="sel" onchange="_dcAnaBatch=this.value;dcRerender()">${bOpts}</select>
      <div class="dc-ana-note">디개싱 며칠째에 마셨을 때 별점이 어땠는지${bestDays.length&&days.length>1?` — 가장 좋았던 날: <b>${bestDays.map(d=>d+'일차').join(', ')}</b>`:''}</div>${curve}</div>
    <div class="dc-card"><div class="dc-ana-t">② 프로파일별 평균 별점 <span class="dc-opt">모드-DTR</span></div>
      <select class="sel" onchange="_dcAnaBean=this.value;dcRerender()">${beanOpts}</select>
      <div class="dc-ana-note">같은 생두를 다르게 볶았을 때 매일 마시기 좋은 쪽. 2번 미만은 흐리게.</div>${profRows}</div>
    <div class="dc-card"><div class="dc-ana-t">③ 자주 나온 태그 <span class="dc-opt">생두별 상위 3개</span></div>${tagRows}</div>`;
}

/* 생두 카드에서 바로 열기 (생두 목록 → ☕ 한 잔 기록) */
function openDailyCupFor(beanId){
  const b=db.beans.find(x=>x.id===beanId);const beanName=b?b.name:'';
  const tb=[...document.querySelectorAll('.tb')].find(t=>(t.getAttribute('onclick')||'').includes("'dailycup'"));
  if(tb)showTab('dailycup',tb);
  window.scrollTo(0,0);
  dcOpenPick(beanName);
}

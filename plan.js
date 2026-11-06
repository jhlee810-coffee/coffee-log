// plan.js — 오늘 로스팅 계획 (빈본 탭) · 2026-11-07
// 저장: db.roast_plans = { 'YYYY-MM-DD': {date, source, file_version, items:[...]} } (Sheets 동기화)
// item: {bean_id, bean_name, mode, dtr, input_g, gift, note, status:''|'done'|'skip', roast_id}
//
// Claude가 만든 계획: 사이트의 plans/YYYY-MM-DD.json 을 빈본 탭에서 "불러오기"
//   {"date":"2026-11-08","version":1,"items":[{"bean_id":"…","bean":"케냐 카구모 AA","mode":3,"dtr":13,"input_g":120,"gift":false,"note":""}]}
// 붙여넣기 형식(한 줄에 한 배치): "1. 카구모 AA 3-13 120g 🎁"  (모드-DTR, g·🎁/나눔은 생략 가능)

let _planOffOnce=false;     // "계획 밖 1회": 다음 저장까지 계획을 적용하지 않음
let _planAppliedKey='';     // 이미 타이머에 넣은 배치 (같은 배치를 계속 덮어쓰지 않게)
let _planRemote=null;       // 사이트에 올라온 오늘 계획 파일
let _planEdit=null;         // 편집 중 사본

function planToday(){return today();}
function planGet(){db.roast_plans=db.roast_plans||{};return db.roast_plans[planToday()]||null;}
function planCurIdx(p){p=p||planGet();if(!p)return -1;return p.items.findIndex(x=>!x.status);}
function planEsc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function planBean(it){return (db.beans||[]).find(b=>b.id===it.bean_id)||null;}
function planBeanName(it){const b=planBean(it);return b?b.name:(it.bean_name||'?');}
function planShort(it){const n=planBeanName(it);return typeof dashShort==='function'?dashShort(n):n;}
function planItemText(it){return `${planShort(it)} · ${it.mode}-${it.dtr} · ${it.input_g||120}g${it.gift?' 🎁':''}`;}

/* ── 빈본 탭 위 한 줄 ── */
function renderPlanBar(){
  const el=document.getElementById('planBar');if(!el)return;
  const p=planGet();
  const remoteBtn=_planRemote&&(!p||p.file_version!==_planRemote.version)?`<button class="pb-btn hi" onclick="planImportRemote()">Claude 계획 불러오기 (${_planRemote.items.length}배치)</button>`:'';
  if(!p||!p.items.length){
    el.innerHTML=`<div class="pb-row"><span class="pb-t">📋 오늘 로스팅 계획 없음</span>${remoteBtn}<button class="pb-btn" onclick="openPlanEditor()">계획 만들기</button></div>`;return;
  }
  const i=planCurIdx(p),n=p.items.length,done=p.items.filter(x=>x.status==='done').length;
  if(i<0){el.innerHTML=`<div class="pb-row"><span class="pb-t">✓ 오늘 계획 끝 (${done}/${n} 로스팅)</span>${remoteBtn}<button class="pb-btn" onclick="openPlanEditor()">계획 보기</button></div>`;return;}
  const it=p.items[i];
  el.innerHTML=_planOffOnce
    ?`<div class="pb-row off"><span class="pb-t">✋ 계획 밖으로 볶는 중 — 저장하면 계획으로 돌아가요</span><button class="pb-btn" onclick="_planOffOnce=false;_planAppliedKey='';renderPlanBar();planApplyToTimer()">취소</button></div>`
    :`<div class="pb-row"><span class="pb-t">📋 계획 <b>${i+1}/${n}</b> · ${planEsc(planItemText(it))}${it.note?` <small>${planEsc(it.note)}</small>`:''}</span></div>
      <div class="pb-btns">${remoteBtn}<button class="pb-btn" onclick="planSkip()">건너뛰기</button><button class="pb-btn" onclick="_planOffOnce=true;renderPlanBar()">계획 밖 1회</button><button class="pb-btn" onclick="openPlanEditor()">목록 ✎</button></div>`;
}

/* ── 타이머에 지금 배치 넣기 (타이머가 시작 화면일 때만) ── */
let _timerAtSetup=true;
function planOnTimerState(st){
  const was=_timerAtSetup;_timerAtSetup=!(st&&st.active);
  if(_timerAtSetup&&!was)planApplyToTimer();   // 로스팅이 끝나 시작 화면으로 돌아오면 다음 배치
}
function planApplyToTimer(force){
  const p=planGet();if(!p||_planOffOnce||!_timerAtSetup)return;
  const i=planCurIdx(p);if(i<0)return;
  const key=p.date+'#'+i+'#'+(p.updated_at||0);
  if(!force&&_planAppliedKey===key)return;
  const fr=document.getElementById('timerFrame');if(!fr||!fr.contentWindow||!fr.getAttribute('src'))return;
  const it=p.items[i];
  fr.contentWindow.postMessage({type:'plan_apply',bean_name:planBeanName(it),mode:+it.mode,dtr:+it.dtr,input_g:String(it.input_g||120),label:`계획 ${i+1}/${p.items.length}`},'*');
  _planAppliedKey=key;
}
function planSkip(){
  const p=planGet();const i=planCurIdx(p);if(i<0)return;
  p.items[i].status='skip';p.updated_at=Date.now();saveDB();renderPlanBar();planApplyToTimer();
}

/* ── 로스팅 기록 저장할 때 (roasts.js saveRoast에서 호출) ── */
// 같은 생두면 이번 계획 배치로 보고 완료 처리 + 계획값을 기록에 남김. 다른 생두면 계획 밖 배치로 봄
function planDecorateRoast(data,isNew){
  if(!isNew)return;
  const off=_planOffOnce;_planOffOnce=false;
  const p=planGet();const i=planCurIdx(p);
  if(off||i<0||data.date!==planToday())return;
  const it=p.items[i];
  if(it.bean_id&&data.bean_id!==it.bean_id)return;
  data.plan_date=p.date;data.plan_no=String(i+1);data.plan_mode=String(it.mode);data.plan_dtr=String(it.dtr);
  if(it.gift&&!data.stock_state)data.stock_state='gift';
  it.status='done';it.roast_id=data.id;p.updated_at=Date.now();
}
function planAfterSave(){renderPlanBar();_planAppliedKey='';}

/* ── 편집 화면 ── */
function openPlanEditor(){
  const p=planGet();
  _planEdit=p?JSON.parse(JSON.stringify(p)):{date:planToday(),source:'manual',items:[]};
  renderPlanEditor();openMo('moPlan');
}
function planBeanOptions(sel){
  const esc=planEsc,on=(db.beans||[]).filter(b=>b.status!=='소진'),off=(db.beans||[]).filter(b=>b.status==='소진');
  return '<option value="">생두 선택</option>'+on.map(b=>`<option value="${b.id}"${b.id===sel?' selected':''}>${esc(b.name)}</option>`).join('')+
    (off.length?`<optgroup label="소진">${off.map(b=>`<option value="${b.id}"${b.id===sel?' selected':''}>${esc(b.name)}</option>`).join('')}</optgroup>`:'');
}
function planLeftG(beanId){
  const b=(db.beans||[]).find(x=>x.id===beanId);if(!b||typeof beanUsage!=='function')return null;
  const u=beanUsage(b);return u.remaining;
}
function renderPlanEditor(){
  const e=_planEdit;
  const used={};  // 계획 안에서 같은 생두를 여러 번 쓰면 잔량 경고에 합산
  const rows=e.items.map((it,i)=>{
    const st=it.status==='done'?'✓':it.status==='skip'?'↷':String(i+1);
    used[it.bean_id]=(used[it.bean_id]||0)+(it.status?0:(+it.input_g||120));
    const left=planLeftG(it.bean_id);const warn=left!=null&&!it.status&&left-used[it.bean_id]<0;
    return `<div class="pl-row${it.status?' done':''}">
      <div class="pl-top"><span class="pl-no">${st}</span>
        <select class="sel" onchange="_planEdit.items[${i}].bean_id=this.value;renderPlanEditor()">${planBeanOptions(it.bean_id)}</select></div>
      ${!it.bean_id&&it.bean_name?`<div class="pl-warn">⚠ "${planEsc(it.bean_name)}" — 생두 목록에서 찾지 못했어요. 골라 주세요</div>`:''}
      ${warn?`<div class="pl-warn">⚠ 남은 양 ≈ ${Math.max(0,Math.round(left))}g — 계획량보다 적어요</div>`:''}
      <div class="pl-grid">
        <div><div class="pl-l">모드</div><select class="sel" onchange="_planEdit.items[${i}].mode=+this.value">${[1,2,3,4,5,6,7,8].map(m=>`<option${+it.mode===m?' selected':''}>${m}</option>`).join('')}</select></div>
        <div><div class="pl-l">DTR %</div><div class="pl-step"><button onclick="planAdj(${i},'dtr',-1)">−</button><b>${it.dtr}</b><button onclick="planAdj(${i},'dtr',1)">+</button></div></div>
        <div><div class="pl-l">투입 g</div><div class="pl-step"><button onclick="planAdj(${i},'input_g',-10)">−</button><b>${it.input_g||120}</b><button onclick="planAdj(${i},'input_g',10)">+</button></div></div>
      </div>
      <div class="pl-act"><button class="${it.gift?'on':''}" onclick="_planEdit.items[${i}].gift=!_planEdit.items[${i}].gift;renderPlanEditor()">🎁 나눔</button>
        <button onclick="planMove(${i},-1)">↑</button><button onclick="planMove(${i},1)">↓</button>
        ${it.status?`<button onclick="_planEdit.items[${i}].status='';renderPlanEditor()">다시</button>`:''}
        <button class="del" onclick="_planEdit.items.splice(${i},1);renderPlanEditor()">삭제</button></div>
      ${it.note?`<div class="pl-note">${planEsc(it.note)}</div>`:''}
    </div>`;}).join('');
  document.getElementById('planBody').innerHTML=`<div class="mtitle">📋 ${planEsc(e.date)} 로스팅 계획</div>
    ${rows||'<div class="pl-empty">아직 배치가 없어요. 아래에서 추가하거나 붙여넣으세요.</div>'}
    <button class="pl-add" onclick="planAddRow()">+ 배치 추가</button>
    <details class="pl-paste"><summary>글로 붙여넣기 (Claude가 짜 준 계획 등)</summary>
      <textarea class="ta" id="planPaste" placeholder="1. 카구모 AA 3-13 120g&#10;2. 카구모 AA 2-12 120g 🎁&#10;3. 합티무 3-12"></textarea>
      <div class="pl-paste-btns"><button class="btn2" onclick="planPasteText(false)">뒤에 추가</button><button class="btn2" onclick="planPasteText(true)">전부 바꾸기</button></div>
    </details>
    <div class="fa">${planGet()?'<button class="btnd" onclick="planDelete()">계획 지우기</button>':''}<button class="btn2" onclick="closeMo(\'moPlan\')">취소</button><button class="btn btn-sm" onclick="planSave()">저장</button></div>`;
}
function planAdj(i,k,d){const it=_planEdit.items[i];it[k]=Math.max(k==='dtr'?5:10,(+it[k]||(k==='dtr'?12:120))+d);renderPlanEditor();}
function planMove(i,d){const a=_planEdit.items,j=i+d;if(j<0||j>=a.length)return;[a[i],a[j]]=[a[j],a[i]];renderPlanEditor();}
function planAddRow(){
  const last=_planEdit.items[_planEdit.items.length-1];
  _planEdit.items.push(last?{...last,status:'',roast_id:'',gift:false,note:''}:{bean_id:'',mode:3,dtr:12,input_g:120,gift:false,note:'',status:''});
  renderPlanEditor();
}
function planSave(){
  const e=_planEdit;
  e.items=e.items.filter(x=>x.bean_id||x.bean_name);
  const miss=e.items.filter(x=>!x.bean_id&&!x.status);
  if(miss.length){alert(`생두 목록에서 못 찾은 배치가 ${miss.length}개 있어요.\n각 줄에서 생두를 골라 주세요: ${miss.map(x=>x.bean_name||'(빈칸)').join(', ')}`);renderPlanEditor();return;}
  e.items.forEach(x=>{const b=planBean(x);if(b)x.bean_name=b.name;});
  e.updated_at=Date.now();
  db.roast_plans=db.roast_plans||{};
  // 지난 날짜 계획은 30일만 보관
  Object.keys(db.roast_plans).forEach(d=>{if(typeof dashDays==='function'&&dashDays(d,planToday())>30)delete db.roast_plans[d];});
  db.roast_plans[e.date]=e;
  saveDB();closeMo('moPlan');_planAppliedKey='';renderPlanBar();planApplyToTimer(true);
}
function planDelete(){
  if(!confirm('오늘 계획을 지울까요? (이미 볶은 기록은 그대로)'))return;
  delete db.roast_plans[planToday()];saveDB();closeMo('moPlan');renderPlanBar();
}

/* ── 글 붙여넣기 → 계획 ── */
function planNorm(s){return String(s||'').toLowerCase().replace(/[\s\[\]().,·_\-#]/g,'');}
function planFindBean(text){
  const q=planNorm(text);if(!q)return null;
  const beans=(db.beans||[]).slice().sort((a,b)=>(a.status==='소진')-(b.status==='소진')||String(b.stock_date||'').localeCompare(String(a.stock_date||'')));
  let hit=beans.find(b=>planNorm(b.name)===q)||beans.find(b=>planNorm(b.name).includes(q));
  if(!hit){const toks=String(text).split(/\s+/).map(planNorm).filter(t=>t.length>=2);hit=beans.find(b=>toks.length&&toks.every(t=>planNorm(b.name).includes(t)));}
  return hit||null;
}
function planParseLine(line){
  let s=line.trim();if(!s)return null;
  s=s.replace(/^\s*\d+\s*[.)]\s*/,'');
  const gift=/🎁|나눔/.test(s);s=s.replace(/🎁|나눔/g,'');
  let input_g=120;const g=s.match(/(\d{2,4})\s*g\b/i);if(g){input_g=+g[1];s=s.replace(g[0],'');}
  let mode=null,dtr=null;const md=s.match(/(?:모드\s*)?([1-8])\s*[-–번]\s*(?:DTR\s*)?(\d{1,2}(?:\.\d)?)\s*%?/i);
  if(md){mode=+md[1];dtr=Math.round(+md[2]);s=s.replace(md[0],'');}
  let note='';const nm=s.match(/[\/|]\s*(.+)$/);if(nm){note=nm[1].trim();s=s.slice(0,nm.index);}
  const name=s.replace(/\s+/g,' ').trim();
  const b=planFindBean(name);
  return {bean_id:b?b.id:'',bean_name:b?b.name:name,mode:mode||3,dtr:dtr||12,input_g,gift,note,status:''};
}
function planPasteText(replace){
  const t=document.getElementById('planPaste').value;
  const items=t.split(/\n/).map(planParseLine).filter(Boolean);
  if(!items.length){alert('읽을 수 있는 줄이 없어요.');return;}
  _planEdit.items=replace?items:_planEdit.items.concat(items);
  renderPlanEditor();
}

/* ── Claude가 만든 계획 파일 (사이트 plans/날짜.json) ── */
async function planCheckRemote(){
  try{
    const r=await fetch('plans/'+planToday()+'.json?nc='+Date.now(),{cache:'no-store'});
    if(!r.ok){_planRemote=null;return;}
    const j=await r.json();
    if(j&&j.date===planToday()&&Array.isArray(j.items)&&j.items.length){_planRemote=j;}else _planRemote=null;
  }catch(e){_planRemote=null;}
  renderPlanBar();
}
function planImportRemote(){
  const j=_planRemote;if(!j)return;
  const cur=planGet();
  if(cur&&cur.items.some(x=>x.status)&&!confirm('오늘 이미 진행한 계획이 있어요. Claude 계획으로 바꿀까요?\n(이미 볶은 기록은 그대로, 남은 배치만 바뀜)'))return;
  const items=j.items.map(x=>{const b=x.bean_id?(db.beans||[]).find(bb=>bb.id===x.bean_id):planFindBean(x.bean||x.bean_name);
    return {bean_id:b?b.id:'',bean_name:b?b.name:(x.bean||x.bean_name||''),mode:+x.mode||3,dtr:Math.round(+x.dtr||12),input_g:+x.input_g||120,gift:!!x.gift,note:x.note||'',status:''};});
  db.roast_plans=db.roast_plans||{};
  if(cur)items.forEach((x,i)=>{const o=cur.items[i];if(o&&o.status&&o.bean_id===x.bean_id){x.status=o.status;x.roast_id=o.roast_id||'';}});
  db.roast_plans[planToday()]={date:planToday(),source:'claude',file_version:j.version,items,updated_at:Date.now()};
  saveDB();_planAppliedKey='';renderPlanBar();planApplyToTimer(true);
  if(items.some(x=>!x.bean_id))openPlanEditor();   // 못 찾은 생두가 있으면 바로 고르게
}

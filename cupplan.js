// cupplan.js — 오늘 커핑 계획 (쉬운 커핑 탭) · 2026-11-09
// 로스팅 계획(plan.js)과 같은 방식. 저장: db.cupping_plans = { 'YYYY-MM-DD': {date, source, file_version, settings, items:[...], updated_at} } (Sheets 동기화)
// settings: {coffee_g, water_g, temp, grind}
// item: {a_roast_id, b_roast_id, a_ref:'11/7#1', b_ref, question, blind_mode:'self'|'app'|'none', status:''|'done'|'skip', ec_id}
//
// 붙여넣기 형식:
//   설정: 8.3g 150g 93도 지피식스7.5
//   1. 11/7#1 vs 11/7#2 | 같은 DTR, 총 시간 짧은 쪽이 나은가
// Claude가 만든 계획: 사이트의 cupplans/YYYY-MM-DD.json 을 쉬운 커핑 탭에서 "불러오기"
//   {"date":"2026-11-09","version":1,"settings":{...},"items":[{"a":"11/7#1","b":"11/7#2","question":"…"}]}

const CP_DEFAULT_SET={coffee_g:'8.3',water_g:'150',temp:'93',grind:'지피식스 7.5'};
let _cpEdit=null;      // 편집 중 사본
let _cpRemote=null;    // 사이트에 올라온 오늘 커핑 계획 파일

function cpToday(){return today();}
function cpGet(){db.cupping_plans=db.cupping_plans||{};return db.cupping_plans[cpToday()]||null;}
function cpCurIdx(p){p=p||cpGet();if(!p)return -1;return p.items.findIndex(x=>!x.status);}
function cpRoast(id){return id?(db.roasts||[]).find(r=>r.id===id)||null:null;}
function cpBatch(r){return r?(+r.batch_no||ecBatchMap()[r.id]||''):'';}
function cpRef(r){return r?ecMD(r.date)+'#'+cpBatch(r):'';}
function cpShort(n){const w=String(n||'').trim().split(/\s+/),o=new Set((db.beans||[]).map(b=>b.origin).filter(Boolean));if(w.length>1&&o.has(w[0]))w.shift();return w[0]&&w[0].length<=1&&w[1]?w[0]+' '+w[1]:(w[0]||'');}  // '엘 오브라헤'처럼 한 글자면 두 단어
function cpRoastInfo(r){
  if(!r)return '';
  const dtr=ecRoastDTR(r);
  return [cpShort(r.bean_name),(r.mode||'?')+'-'+(dtr||'?'),r.total_time?'총 '+r.total_time:''].filter(Boolean).join(' · ');
}
// "11/7#1" → 로스팅 기록 (연도는 계획 날짜 기준, 계획 달보다 큰 달이면 작년)
function cpFindRef(ref,planDate){
  const m=String(ref||'').match(/(\d{1,2})\s*\/\s*(\d{1,2})\s*#\s*(\d{1,2})/);if(!m)return null;
  const [py,pm]=(planDate||cpToday()).split('-').map(Number);
  const y=+m[1]>pm?py-1:py,d=`${y}-${String(m[1]).padStart(2,'0')}-${String(m[2]).padStart(2,'0')}`;
  return (db.roasts||[]).find(r=>r.date===d&&String(cpBatch(r))===String(+m[3]))||null;
}
function cpItemLabel(it){
  const a=cpRoast(it.a_roast_id),b=cpRoast(it.b_roast_id);
  const sa=a?cpShort(a.bean_name):(it.a_ref||'?'),sb=b?cpShort(b.bean_name):(it.b_ref||'?');
  const na=a?cpBatch(a)+'번':'',nb=b?cpBatch(b)+'번':'';
  return sa===sb?`${sa} ${na} vs ${nb}`:`${sa} ${na} vs ${sb} ${nb}`;
}
function cpSave(p){p.updated_at=Date.now();db.cupping_plans=db.cupping_plans||{};db.cupping_plans[p.date]=p;saveDB();}

/* ── 붙여넣기 읽기 ── */
function cpParseSettings(line){
  const s=line.replace(/^\s*설정\s*[:：]\s*/,'');
  const g=[...s.matchAll(/([\d.]+)\s*g\b/gi)].map(x=>x[1]);
  const t=s.match(/([\d.]+)\s*(?:도|°C?|℃)/);
  let rest=s.replace(/([\d.]+)\s*g\b/gi,'').replace(/([\d.]+)\s*(?:도|°C?|℃)/,'').trim().replace(/\s{2,}/g,' ');
  rest=rest.replace(/([가-힣])(\d)/g,'$1 $2');   // 지피식스7.5 → 지피식스 7.5
  return {coffee_g:g[0]||CP_DEFAULT_SET.coffee_g,water_g:g[1]||CP_DEFAULT_SET.water_g,temp:t?t[1]:CP_DEFAULT_SET.temp,grind:rest||CP_DEFAULT_SET.grind};
}
function cpItemFromRefs(a,b,question,blind,planDate){
  const ra=cpFindRef(a,planDate),rb=cpFindRef(b,planDate);
  return {a_roast_id:ra?ra.id:'',b_roast_id:rb?rb.id:'',a_ref:String(a||'').trim(),b_ref:String(b||'').trim(),
    question:String(question||'').trim(),blind_mode:blind||'self',status:'',ec_id:''};
}
function cpParseText(text,planDate){
  let settings=null;const items=[];
  String(text||'').split(/\r?\n/).forEach(line=>{
    const s=line.trim();if(!s)return;
    if(/^설정\s*[:：]/.test(s)){settings=cpParseSettings(s);return;}
    const body=s.replace(/^\d+\s*[.)]\s*/,'');
    const [left,...q]=body.split('|');
    const refs=left.split(/\s+vs\.?\s+/i);
    if(refs.length<2)return;
    items.push(cpItemFromRefs(refs[0],refs[1],q.join('|'),'self',planDate));
  });
  return {settings,items};
}

/* ── 쉬운 커핑 탭 위 배너 ── */
function cpBannerHtml(){
  if(typeof db==='undefined'||!db)return '';
  const p=cpGet();
  const remote=_cpRemote&&(!p||(p.source==='claude'&&p.file_version!==_cpRemote.version));
  const btn=(t,f,cls)=>`<button class="pb-btn${cls?' '+cls:''}" onclick="${f}">${t}</button>`;
  let h;
  if(remote)h=`<div class="pb-row"><span class="pb-t">📋 Claude 커핑 계획 <b>${_cpRemote.items.length}비교</b></span>${btn('불러오기','cpImportRemote()','hi')}${p?btn('목록','cpOpenList()'):''}</div>`;
  else if(!p||!p.items.length)h=`<div class="pb-row off"><span class="pb-t">📋 오늘 커핑 계획 없음</span>${btn('계획 만들기','cpOpenEditor()')}</div>`;
  else{
    const i=cpCurIdx(p),n=p.items.length,done=p.items.filter(x=>x.status==='done').length;
    if(i<0)h=`<div class="pb-row"><span class="pb-t">✓ 오늘 커핑 끝 (${done}/${n})</span>${btn('목록','cpOpenList()')}</div>`;
    else{const it=p.items[i];
      h=`<div class="pb-row"><span class="pb-t">📋 커핑 계획 다음 <b>${i+1}/${n}</b>: ${ecEsc(cpItemLabel(it))}</span>${btn('시작',`cpStart(${i})`,'hi')}${btn('건너뛰기','cpSkip()')}${btn('목록','cpOpenList()')}</div>`+
        (it.question?`<div class="pb-note">❓ ${ecEsc(it.question)}</div>`:'');}
  }
  return `<div class="plan-bar cp-bar">${h}</div>`;
}
function cpRefresh(){if(typeof renderEasyCup==='function'&&_ecView!=='form')renderEasyCup();}
async function cpCheckRemote(){
  try{
    const r=await fetch('cupplans/'+cpToday()+'.json?nc='+Date.now(),{cache:'no-store'});
    if(!r.ok){_cpRemote=null;return;}
    const j=await r.json();
    _cpRemote=j&&j.date===cpToday()&&Array.isArray(j.items)&&j.items.length?j:null;
  }catch(e){_cpRemote=null;}
  cpRefresh();
}
function cpImportRemote(){
  const j=_cpRemote;if(!j)return;
  const cur=cpGet();
  if(cur&&cur.items.some(x=>x.status)&&!confirm('오늘 이미 진행한 커핑 계획이 있어요. Claude 계획으로 바꿀까요?\n(이미 저장한 커핑 기록은 그대로)'))return;
  const items=j.items.map(x=>cpItemFromRefs(x.a,x.b,x.question,x.blind_mode,j.date));
  if(cur)items.forEach((x,i)=>{const o=cur.items[i];if(o&&o.status&&o.a_roast_id===x.a_roast_id&&o.b_roast_id===x.b_roast_id){x.status=o.status;x.ec_id=o.ec_id||'';}});
  cpSave({date:cpToday(),source:'claude',file_version:j.version,settings:{...CP_DEFAULT_SET,...(j.settings||{})},items});
  cpRefresh();
  if(items.some(x=>!x.a_roast_id||!x.b_roast_id))cpOpenEditor();   // 못 찾은 원두가 있으면 바로 고르게
}

/* ── 시작 · 건너뛰기 · 완료 ── */
function cpStart(i){
  const p=cpGet();if(!p)return;const it=p.items[i];if(!it)return;
  const a=cpRoast(it.a_roast_id),b=cpRoast(it.b_roast_id);
  if(!a||!b){alert('이 비교의 원두를 아직 못 골랐어요. 목록에서 골라 주세요.');cpOpenEditor();return;}
  if(_ec&&_ecView==='form'&&!confirm('작성 중인 비교가 있어요. 닫고 계획 비교를 시작할까요?'))return;
  _ec=ecNewState();
  _ec.A=ecSnapRoast(a);_ec.B=ecSnapRoast(b);
  _ec.settings={...CP_DEFAULT_SET,...(p.settings||{})};
  const m=it.blind_mode||'self';
  _ec.blindMode=m;_ec.blind=m==='app';
  _ec.order=m==='self'?['S1','S2']:m==='app'?(Math.random()<.5?['A','B']:['B','A']):['A','B'];
  _ec.planRef={date:p.date,idx:i,question:it.question||'',n:p.items.length};
  ecGo('form');
}
function cpSkip(){
  const p=cpGet();const i=cpCurIdx(p);if(i<0)return;
  p.items[i].status='skip';cpSave(p);cpRefresh();
}
// 쉬운 커핑 저장할 때(easycup.js ecSubmit) — 계획에서 시작한 비교면 완료
function cpMarkDone(ref,ecId){
  const p=(db.cupping_plans||{})[ref.date];if(!p||!p.items[ref.idx])return;
  p.items[ref.idx].status='done';p.items[ref.idx].ec_id=ecId;p.updated_at=Date.now();
}

/* ── 계획 목록 (표) ── */
function cpResult(it){
  if(it.status!=='done')return '';
  const rec=ecLoad().find(x=>x.id===it.ec_id);if(!rec)return '저장됨';
  const f=rec.picks.final;
  const x=rec[f];return f==='same'?'비김':`${cpShort(x.bean)}${x.batch?' #'+x.batch:''} · ${x.mode||'?'}-${x.dtr||'?'} (${f})`;
}
function cpOpenList(){
  const p=cpGet();if(!p){cpOpenEditor();return;}
  const st=p.settings||{};
  const stTxt=x=>x.status==='done'?'✓ 완료':x.status==='skip'?'↷ 건너뜀':'대기';
  const rows=p.items.map((it,i)=>{
    const rec=it.ec_id?ecLoad().find(x=>x.id===it.ec_id):null;
    return `<tr class="${it.status||'wait'}"><td>${i+1}</td><td>${ecEsc(cpItemLabel(it))}<div class="cp-sub">${ecEsc(it.a_ref||cpRef(cpRoast(it.a_roast_id)))} vs ${ecEsc(it.b_ref||cpRef(cpRoast(it.b_roast_id)))}</div></td>
      <td>${ecEsc(it.question)}</td><td>${stTxt(it)}${!it.status?`<br><button class="btn2 cp-go" onclick="closeMo('moCupPlan');cpStart(${i})">시작</button>`:''}</td>
      <td>${ecEsc(cpResult(it))}${rec?`<div class="cp-sub">${ecEsc(rec.summary||'')}</div>`:''}</td></tr>`;
  }).join('');
  document.getElementById('cupPlanBody').innerHTML=`<div class="mtitle">☕ ${ecEsc(p.date)} 커핑 계획</div>
    <div class="ec-hint">설정: 원두 ${ecEsc(st.coffee_g)}g · 물 ${ecEsc(st.water_g)}g · ${ecEsc(st.temp)}°C · ${ecEsc(st.grind)}</div>
    <div class="cp-tbl-wrap"><table class="cp-tbl"><thead><tr><th>#</th><th>A vs B</th><th>질문</th><th>상태</th><th>결과</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="fa"><button class="btn2" onclick="closeMo('moCupPlan')">닫기</button><button class="btn btn-sm" onclick="cpOpenEditor()">✎ 편집</button></div>`;
  openMo('moCupPlan');
}

/* ── 편집 화면 ── */
function cpRoastOptions(sel){
  const list=(db.roasts||[]).slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(cpBatch(b)||0)-(cpBatch(a)||0)).slice(0,80);
  return '<option value="">직접 골라 주세요</option>'+list.map(r=>`<option value="${r.id}"${r.id===sel?' selected':''}>${ecEsc(cpRef(r)+' '+cpRoastInfo(r))}</option>`).join('');
}
function cpOpenEditor(){
  const p=cpGet();
  _cpEdit=p?JSON.parse(JSON.stringify(p)):{date:cpToday(),source:'manual',settings:{...CP_DEFAULT_SET},items:[]};
  _cpEdit.settings={...CP_DEFAULT_SET,...(_cpEdit.settings||{})};
  cpRenderEditor();openMo('moCupPlan');
}
function cpSideHtml(i,side){
  const it=_cpEdit.items[i],k=side==='A'?'a':'b',r=cpRoast(it[k+'_roast_id']);
  return `<div class="cp-side"><span class="ec-badge">${side}</span><select class="sel" onchange="cpSetRoast(${i},'${k}',this.value)">${cpRoastOptions(it[k+'_roast_id'])}</select></div>
    ${r?`<div class="cp-info">${ecEsc(r.bean_name)} · ${ecEsc(cpRoastInfo(r).split(' · ').slice(1).join(' · '))}</div>`
       :`<div class="pl-warn">⚠ ${it[k+'_ref']?`"${ecEsc(it[k+'_ref'])}" — 로스팅 기록에서 찾지 못했어요. `:''}직접 골라 주세요</div>`}`;
}
function cpRenderEditor(){
  const e=_cpEdit,st=e.settings;
  const set=(k,l,u)=>`<label class="ec-set"><span>${l}</span><input class="inp" value="${ecEsc(st[k]||'')}" oninput="_cpEdit.settings.${k}=this.value">${u?`<em>${u}</em>`:''}</label>`;
  const bm=(i,m,l)=>`<button class="${(e.items[i].blind_mode||'self')===m?'on':''}" onclick="_cpEdit.items[${i}].blind_mode='${m}';cpRenderEditor()">${l}</button>`;
  const rows=e.items.map((it,i)=>{
    const no=it.status==='done'?'✓':it.status==='skip'?'↷':String(i+1);
    return `<div class="pl-row${it.status?' done':''}">
      <div class="pl-top"><span class="pl-no">${no}</span><input class="inp" placeholder="질문 한 줄 (무엇을 보려는 비교?)" value="${ecEsc(it.question)}" oninput="_cpEdit.items[${i}].question=this.value"></div>
      ${cpSideHtml(i,'A')}${cpSideHtml(i,'B')}
      <div class="pl-act">${bm(i,'self','혼자 섞기')}${bm(i,'app','앱이 섞기')}${bm(i,'none','블라인드 없음')}</div>
      <div class="pl-act"><button onclick="cpMove(${i},-1)">↑</button><button onclick="cpMove(${i},1)">↓</button>
        ${it.status?`<button onclick="_cpEdit.items[${i}].status='';cpRenderEditor()">다시</button>`:''}
        <button class="del" onclick="_cpEdit.items.splice(${i},1);cpRenderEditor()">삭제</button></div>
    </div>`;}).join('');
  document.getElementById('cupPlanBody').innerHTML=`<div class="mtitle">☕ ${ecEsc(e.date)} 커핑 계획</div>
    <div class="ec-card" style="margin-bottom:10px"><div class="ec-card-t">공통 설정</div>${set('coffee_g','원두','g')}${set('water_g','물','g')}${set('temp','물 온도','°C')}${set('grind','분쇄','')}</div>
    ${rows||'<div class="pl-empty">아직 비교가 없어요. 아래에 붙여넣거나 추가하세요.</div>'}
    <button class="pl-add" onclick="cpAddRow()">+ 비교 추가</button>
    <details class="pl-paste"${e.items.length?'':' open'}><summary>글로 붙여넣기 (Claude가 짜 준 계획 등)</summary>
      <textarea class="ta" id="cupPlanPaste" placeholder="설정: 8.3g 150g 93도 지피식스7.5&#10;1. 11/7#1 vs 11/7#2 | 총 시간 짧은 쪽이 나은가&#10;2. 11/8#3 vs 11/8#4 | 풋내 확인"></textarea>
      <div class="pl-paste-btns"><button class="btn2" onclick="cpPaste(false)">뒤에 추가</button><button class="btn2" onclick="cpPaste(true)">전부 바꾸기</button></div>
    </details>
    <div class="fa">${cpGet()?'<button class="btnd" onclick="cpDelete()">계획 지우기</button>':''}<button class="btn2" onclick="closeMo(\'moCupPlan\')">취소</button><button class="btn btn-sm" onclick="cpSaveEdit()">저장</button></div>`;
}
function cpSetRoast(i,k,id){const it=_cpEdit.items[i];it[k+'_roast_id']=id;const r=cpRoast(id);if(r)it[k+'_ref']=cpRef(r);cpRenderEditor();}
function cpMove(i,d){const a=_cpEdit.items,j=i+d;if(j<0||j>=a.length)return;[a[i],a[j]]=[a[j],a[i]];cpRenderEditor();}
function cpAddRow(){_cpEdit.items.push({a_roast_id:'',b_roast_id:'',a_ref:'',b_ref:'',question:'',blind_mode:'self',status:'',ec_id:''});cpRenderEditor();}
function cpPaste(replace){
  const t=document.getElementById('cupPlanPaste').value;
  const r=cpParseText(t,_cpEdit.date);
  if(!r.items.length&&!r.settings){alert('읽을 수 있는 줄이 없어요.\n예: 1. 11/7#1 vs 11/7#2 | 질문');return;}
  if(r.settings)_cpEdit.settings=r.settings;
  if(replace&&_cpEdit.items.some(x=>x.status)&&!confirm('이미 끝낸 비교도 지워져요. 전부 바꿀까요?'))return;
  _cpEdit.items=replace?r.items:_cpEdit.items.concat(r.items);
  cpRenderEditor();
}
function cpSaveEdit(){
  const e=_cpEdit;
  if(!e.items.length){alert('비교가 하나도 없어요. 계획을 지우려면 "계획 지우기"를 누르세요.');return;}
  const cur=cpGet();
  cpSave({...e,source:cur&&cur.source==='claude'?'claude':e.source||'manual',file_version:cur?cur.file_version:e.file_version});
  closeMo('moCupPlan');cpRefresh();
}
function cpDelete(){
  if(!confirm('오늘 커핑 계획을 지울까요? (저장한 커핑 기록은 그대로)'))return;
  delete db.cupping_plans[cpToday()];saveDB();closeMo('moCupPlan');cpRefresh();
}

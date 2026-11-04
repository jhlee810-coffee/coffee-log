// easycup.js — 쉬운 커핑 (원두 2개 비교) · 2026-11-04
// 기존 커핑(db.cuppings)과 완전히 분리: 별도 localStorage 키 'easyCuppingLog'에만 저장 (Sheets 동기화 대상 아님)

const EC_KEY='easyCuppingLog';
const EC_STEPS=['마른 가루 향 맡기','물 붓고 4분 뒤 향 맡기','뜨거울 때 맛보기','따뜻할 때 맛보기','식었을 때 맛보기'];
const EC_QS=[
  {key:'aroma', label:'향',   q:'어느 쪽 향이 더 또렷하고 좋아?'},
  {key:'sweet', label:'단맛', q:'어느 쪽이 더 달게 느껴져?'},
  {key:'after', label:'뒷맛', q:'어느 쪽이 삼킨 뒤 더 깔끔하고 오래 남아?'},
  {key:'final', label:'최종 선택', q:'하나만 다시 마신다면?', required:true},
];

let _ec=null;          // 작성 중인 비교 (null이면 목록 화면)
let _ecView='list';    // 'list' | 'form' | 'done'
let _ecLastId=null;    // 방금 저장한 기록 id
let _ecFilter='';
let _ecPickSide=null;  // 고르는 중인 자리 'A'|'B'

/* ── 저장소 ── */
function ecLoad(){try{const a=JSON.parse(localStorage.getItem(EC_KEY)||'[]');return Array.isArray(a)?a:[];}catch(e){return [];}}
function ecSave(list){localStorage.setItem(EC_KEY,JSON.stringify(list));}

/* ── 헬퍼 ── */
function ecEsc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function ecDays(cupDate,roastDate){
  if(!cupDate||!roastDate)return null;
  const p=s=>{const [y,m,d]=s.split('-').map(Number);return Date.UTC(y,m-1,d);};
  const v=Math.round((p(cupDate)-p(roastDate))/86400000);
  return isNaN(v)?null:v;
}
function ecMD(d){if(!d)return '';const p=d.split('-');return p.length===3?(+p[1])+'/'+(+p[2]):d;}
function ecRoastDTR(r){
  let dtr=r.dtr_pct;
  if(!dtr&&r.pop_time&&r.eject_time&&r.mode){
    const ae=(typeof BINBON_MODES!=='undefined')?BINBON_MODES[+r.mode]:null;
    if(ae){const ps=toSec(r.pop_time),es=toSec(r.eject_time);if(ps>es&&(ae-es)>0)dtr=((ps-es)/(ae-es)*100).toFixed(1);}
  }
  return dtr?String(+(+dtr).toFixed(1)):'';
}
function ecRoastLoss(r){
  if(r.loss_pct)return String(r.loss_pct);
  if(r.input_g&&r.output_g)return ((+r.input_g - +r.output_g)/+r.input_g*100).toFixed(1);
  return '';
}
function ecBatchMap(){ // 같은 날 몇 번째 배치였는지 (기록 순서 기준)
  const m={},cnt={};
  (db.roasts||[]).forEach(r=>{cnt[r.date]=(cnt[r.date]||0)+1;m[r.id]=cnt[r.date];});
  return m;
}
function ecShort(name){ // "케냐 카구모 AA 2026" → "카구모"
  const w=String(name||'').trim().split(/\s+/);
  const origins=new Set((db.beans||[]).map(b=>b.origin).filter(Boolean));
  if(w.length>1&&origins.has(w[0]))w.shift();
  return w[0]||'';
}
function ecVariant(s){ // "2번 12%"
  if(!s)return '';
  const parts=[];
  if(s.mode)parts.push(s.mode+'번');
  if(s.dtr!==''&&s.dtr!=null)parts.push(s.dtr+'%');
  return parts.join(' ');
}
function ecSideLabel(s,other){
  if(!s)return '?';
  let v=ecVariant(s);
  const ov=other?ecVariant(other):null;
  if((!v||v===ov)&&s.roast_date)v=(v?v+' ':'')+ecMD(s.roast_date)+' 로스팅';
  return v||'';
}
function ecPickWord(p){return p==='A'?'A':p==='B'?'B':p==='same'?'비슷함':'';}
function ecSummary(rec){
  const A=rec.A,B=rec.B;
  const same=ecShort(A.bean)===ecShort(B.bean);
  let head;
  if(same) head=`${ecMD(rec.date)} ${ecShort(A.bean)} · ${ecSideLabel(A,B)} (A) vs ${ecSideLabel(B,A)} (B)`;
  else head=`${ecMD(rec.date)} ${ecShort(A.bean)} ${ecSideLabel(A,B)} (A) vs ${ecShort(B.bean)} ${ecSideLabel(B,A)} (B)`;
  head=head.replace(/\s+\(/g,' (').replace(/\s{2,}/g,' ');
  const parts=['aroma','sweet','after'].filter(k=>rec.picks[k]).map(k=>`${EC_QS.find(q=>q.key===k).label} ${ecPickWord(rec.picks[k])}`);
  const fin=rec.picks.final==='same'?'비김':rec.picks.final;
  return head+(parts.length?' · '+parts.join(' / '):'')+` → 최종 ${fin}`+(rec.blind?' · 블라인드':'');
}
function ecWinnerSide(rec){return rec.picks.final==='A'||rec.picks.final==='B'?rec.picks.final:(rec.keep||null);}

/* ── 화면 진입 ── */
function renderEasyCup(){
  const el=document.getElementById('ecRoot');
  if(!el)return;
  if(_ecView==='form'&&_ec)el.innerHTML=ecFormHtml();
  else if(_ecView==='done')el.innerHTML=ecDoneHtml();
  else el.innerHTML=ecListHtml();
}
function ecGo(view){_ecView=view;renderEasyCup();window.scrollTo(0,0);}

function ecNewState(){
  return {editId:null,date:today(),A:null,B:null,blind:false,order:['A','B'],revealed:false,
          steps:[false,false,false,false,false],picks:{aroma:'',sweet:'',after:'',final:''},memo:'',
          tournament_id:null,round:1,keep:''};
}
function ecStartNew(){_ec=ecNewState();ecGo('form');}
function ecCancel(){
  if(_ec&&(_ec.A||_ec.B||_ec.picks.final)&&!confirm('작성 중인 비교를 닫을까요? 저장되지 않아요.'))return;
  _ec=null;ecGo('list');
}

/* ── 작성 화면 ── */
function ecSideCard(side){
  const s=_ec[side];
  const deg=s?ecDays(_ec.date,s.roast_date):null;
  if(!s){
    return `<div class="ec-side"><div class="ec-side-hd"><span class="ec-badge">${side}</span><span class="ec-side-empty">아직 안 골랐어요</span></div>
      <div class="ec-side-btns"><button class="ec-bigbtn" onclick="ecOpenPick('${side}')">로스팅 기록에서 고르기</button>
      <button class="ec-bigbtn ghost" onclick="ecOpenManual('${side}')">직접 입력</button></div></div>`;
  }
  const meta=[s.roast_date?ecMD(s.roast_date)+' 로스팅':'',s.mode?s.mode+'번 모드':'',s.dtr?'DTR '+s.dtr+'%':'',
    s.loss?'손실 '+s.loss+'%':'',s.batch?'그날 '+s.batch+'번째':''].filter(Boolean).join(' · ');
  return `<div class="ec-side"><div class="ec-side-hd"><span class="ec-badge">${side}</span><span class="ec-side-name">${ecEsc(s.bean)}</span></div>
    <div class="ec-side-meta">${ecEsc(meta)}${s.memo?`<br>메모: ${ecEsc(s.memo)}`:''}</div>
    <div class="ec-side-deg">${deg!=null?`디개싱 <b>${deg}일</b>`:'로스팅 날짜가 없어 디개싱 일수를 계산할 수 없어요'}</div>
    <div class="ec-side-btns"><button class="btn2" onclick="ecOpenPick('${side}')">다시 고르기</button>
    <button class="btn2" onclick="ecOpenManual('${side}')">직접 수정</button></div></div>`;
}
function ecCupName(i){return _ec.blind?(i+1)+'번 컵':_ec.order[i];}
function ecFormHtml(){
  const e=_ec;
  const tour=e.tournament_id?`<div class="ec-tour-note">🏆 토너먼트 ${e.round}번째 비교 — 지난 승자가 A 자리에 들어가 있어요</div>`:'';
  const steps=EC_STEPS.map((t,i)=>`<button class="ec-step${e.steps[i]?' on':''}" onclick="ecToggleStep(${i})"><span>${e.steps[i]?'✓':i+1}</span>${t}</button>`).join('');
  // 블라인드: 컵 1/2 순서대로 버튼, 실제 값은 A/B로 저장
  const qs=EC_QS.map(q=>{
    const cur=e.picks[q.key];
    const btn=(val,label)=>`<button class="ec-pick${cur===val?' on':''}" onclick="ecSetPick('${q.key}','${val}')">${label}</button>`;
    const sameLabel=q.key==='final'?'비김':'비슷함';
    return `<div class="ec-q"><div class="ec-q-hd"><b>${q.label}</b>${q.required?' <span class="ec-req">필수</span>':' <span class="ec-opt">선택</span>'}</div>
      <div class="ec-q-txt">${q.q}</div>
      <div class="ec-pick-row">${btn(e.order[0],ecCupName(0))}${btn(e.order[1],ecCupName(1))}${btn('same',sameLabel)}</div></div>`;
  }).join('');
  const blindInfo=e.blind?`<div class="ec-blind-box">
      <div>컵 바닥 표시용: <b>1번 컵 = ${e.revealed?ecEsc(e.order[0]+' · '+ecShort(e[e.order[0]]?.bean||'')):'?'}</b> / <b>2번 컵 = ${e.revealed?ecEsc(e.order[1]+' · '+ecShort(e[e.order[1]]?.bean||'')):'?'}</b></div>
      ${e.revealed?'':'<button class="btn2" onclick="ecReveal()">정답 보기</button>'}
      <button class="btn2" onclick="ecShuffle()">다시 섞기</button></div>`:'';
  return `<div class="sh"><div class="stl">${e.editId?'쉬운 커핑 수정':'새 비교'}</div><button class="btn2" onclick="ecCancel()">닫기</button></div>
  ${tour}
  <div class="ec-card"><div class="ec-card-t">1. 커핑 날짜</div>
    <input class="inp" type="date" value="${e.date}" onchange="ecSetDate(this.value)"></div>
  <div class="ec-card"><div class="ec-card-t">2. 비교할 원두 2개</div>${ecSideCard('A')}${ecSideCard('B')}</div>
  <div class="ec-card"><div class="ec-card-t">3. 블라인드</div>
    <div class="ec-pick-row two"><button class="ec-pick${!e.blind?' on':''}" onclick="ecSetBlind(false)">끄기 (A / B로 보기)</button>
    <button class="ec-pick${e.blind?' on':''}" onclick="ecSetBlind(true)">켜기 (1번 / 2번 컵)</button></div>
    ${e.blind?'<div class="ec-hint">어느 원두가 몇 번 컵인지 무작위로 섞었어요. 저장할 때 정답을 알려 줘요.</div>':''}
    ${blindInfo}</div>
  <div class="ec-card"><div class="ec-card-t">4. 진행 순서 <span class="ec-opt">체크는 선택</span></div><div class="ec-steps">${steps}</div></div>
  <div class="ec-card"><div class="ec-card-t">5. 평가</div>${qs}
    <div class="ec-q"><div class="ec-q-hd"><b>한 줄 메모</b> <span class="ec-opt">선택</span></div>
    <input class="inp" id="ecMemo" placeholder="예: B가 향이 더 또렷" value="${ecEsc(e.memo)}" oninput="_ec.memo=this.value"></div></div>
  <button class="ec-save" onclick="ecSubmit()">${e.editId?'수정 저장':'저장하기'}</button>`;
}
function ecToggleStep(i){_ec.steps[i]=!_ec.steps[i];renderEasyCup();}
function ecSetDate(v){_ec.date=v||today();renderEasyCup();}
function ecSetPick(k,v){_ec.picks[k]=_ec.picks[k]===v&&k!=='final'?'':v;renderEasyCup();}
function ecSetBlind(on){
  if(on===_ec.blind)return;
  _ec.blind=on;_ec.revealed=false;
  _ec.order=on?(Math.random()<.5?['A','B']:['B','A']):['A','B'];
  renderEasyCup();
}
function ecShuffle(){
  if(!confirm('컵 순서를 다시 섞을까요? (이미 고른 평가는 원두 기준으로 그대로 남아요)'))return;
  _ec.order=Math.random()<.5?['A','B']:['B','A'];_ec.revealed=false;renderEasyCup();
}
function ecReveal(){if(confirm('정답을 볼까요? 블라인드가 풀려요.')){_ec.revealed=true;renderEasyCup();}}

/* ── 로스팅 기록 고르기 ── */
function ecOpenPick(side){
  _ecPickSide=side;
  document.getElementById('ecPickTitle').textContent=side+' 자리에 넣을 로스팅 고르기';
  const inp=document.getElementById('ecPickSearch');
  const other=_ec[side==='A'?'B':'A'];
  inp.value=other?ecShort(other.bean):'';   // 같은 생두끼리 비교가 많아서 다른 쪽 생두로 미리 거름
  ecRenderPickList();
  openMo('moEcPick');
}
function ecRenderPickList(){
  const q=document.getElementById('ecPickSearch').value.trim().toLowerCase().replace(/\s+/g,'');
  const bm=ecBatchMap();
  const list=(db.roasts||[]).map((r,i)=>({r,i})).filter(({r})=>!q||String(r.bean_name||'').toLowerCase().replace(/\s+/g,'').includes(q))
    .sort((a,b)=>a.r.date<b.r.date?1:a.r.date>b.r.date?-1:b.i-a.i);
  const el=document.getElementById('ecPickList');
  if(!list.length){el.innerHTML='<div class="ec-hint" style="padding:14px 0">맞는 로스팅 기록이 없어요. 검색어를 지우거나 "직접 입력"을 써 주세요.</div>';return;}
  el.innerHTML=list.slice(0,80).map(({r})=>{
    const dtr=ecRoastDTR(r),loss=ecRoastLoss(r);
    const meta=[r.mode?r.mode+'번 모드':'',dtr?'DTR '+dtr+'%':'',loss?'손실 '+loss+'%':'','그날 '+bm[r.id]+'번째'].filter(Boolean).join(' · ');
    return `<div class="ec-pick-item" onclick="ecChooseRoast('${r.id}')"><div class="ec-pi-top"><span>${ecMD(r.date)}</span><b>${ecEsc(r.bean_name)}</b></div><div class="ec-pi-meta">${meta}</div></div>`;
  }).join('')+(list.length>80?`<div class="ec-hint">최근 80개만 보여요. 생두 이름으로 걸러 보세요.</div>`:'');
}
function ecChooseRoast(id){
  const r=(db.roasts||[]).find(x=>x.id===id);if(!r)return;
  _ec[_ecPickSide]={roast_id:r.id,bean:r.bean_name||'',roast_date:r.date||'',mode:r.mode?String(r.mode):'',
    dtr:ecRoastDTR(r),loss:ecRoastLoss(r),batch:ecBatchMap()[r.id]||'',memo:'',manual:false};
  closeMo('moEcPick');renderEasyCup();
}

/* ── 직접 입력 ── */
function ecOpenManual(side){
  _ecPickSide=side;
  const s=_ec[side]||{};
  document.getElementById('ecManTitle').textContent=side+' 직접 입력';
  const beans=[...new Set([...(db.beans||[]).map(b=>b.name)])];
  document.getElementById('ecManBeans').innerHTML=beans.map(n=>`<option value="${ecEsc(n)}">`).join('');
  document.getElementById('ecManBean').value=s.bean||'';
  document.getElementById('ecManDate').value=s.roast_date||'';
  document.getElementById('ecManMode').value=s.mode||'';
  document.getElementById('ecManDtr').value=s.dtr||'';
  document.getElementById('ecManMemo').value=s.memo||'';
  openMo('moEcManual');
}
function ecSaveManual(){
  const bean=document.getElementById('ecManBean').value.trim();
  if(!bean){alert('생두 이름을 넣어 주세요.');return;}
  const prev=_ec[_ecPickSide]||{};
  _ec[_ecPickSide]={roast_id:prev.manual===false?prev.roast_id:null,bean,
    roast_date:document.getElementById('ecManDate').value,
    mode:document.getElementById('ecManMode').value,
    dtr:document.getElementById('ecManDtr').value.trim().replace('%',''),
    loss:prev.loss||'',batch:prev.batch||'',memo:document.getElementById('ecManMemo').value.trim(),manual:true};
  closeMo('moEcManual');renderEasyCup();
}

/* ── 저장 ── */
function ecSubmit(){
  const e=_ec;
  if(!e.A||!e.B){alert('A와 B 원두를 둘 다 골라 주세요.');return;}
  if(!e.picks.final){alert('"최종 선택"은 꼭 골라 주세요.');return;}
  if(e.blind&&!e.revealed){
    const who=k=>`${k} · ${e[k].bean} ${ecVariant(e[k])}`.trim();
    alert(`정답 공개!\n\n1번 컵 = ${who(e.order[0])}\n2번 컵 = ${who(e.order[1])}`);
  }
  const list=ecLoad();
  const snap=s=>({...s,degas_days:ecDays(e.date,s.roast_date)});
  const old=e.editId?list.find(x=>x.id===e.editId):null;
  const rec={
    id:e.editId||('ec_'+genId()),
    date:e.date,
    A:snap(e.A),B:snap(e.B),
    blind:e.blind,
    blind_order:e.blind?e.order.slice():null,   // [1번 컵, 2번 컵]
    steps:e.steps.slice(),
    picks:{...e.picks},
    memo:(e.memo||'').trim(),
    tournament_id:e.tournament_id||null,
    round:e.round||1,
    keep:old?old.keep||'':'',
    created_at:old?old.created_at:Date.now(),
    updated_at:Date.now(),
  };
  if(!rec.tournament_id)rec.tournament_id=rec.id;
  rec.summary=ecSummary(rec);
  if(old)list[list.indexOf(old)]=rec;else list.push(rec);
  ecSave(list);
  _ecLastId=rec.id;_ec=null;
  ecGo(old?'list':'done');
}

/* ── 저장 후 화면 (토너먼트 이어 하기) ── */
function ecDoneHtml(){
  const rec=ecLoad().find(x=>x.id===_ecLastId);
  if(!rec){_ecView='list';return ecListHtml();}
  const w=rec.picks.final;
  const winTxt=w==='same'?'비김':`${w} 승 — ${ecEsc(rec[w].bean)} ${ecEsc(ecVariant(rec[w]))}`;
  return `<div class="sh"><div class="stl">저장 완료</div></div>
  <div class="ec-card"><div class="ec-done-big">${winTxt}</div><div class="ec-sum">${ecEsc(rec.summary)}</div>
  ${rec.blind?`<div class="ec-hint">블라인드 정답: 1번 컵 = ${rec.blind_order[0]}, 2번 컵 = ${rec.blind_order[1]}</div>`:''}</div>
  <button class="ec-save" onclick="ecNextFromWinner('${rec.id}')">🏆 승자로 다음 비교하기</button>
  <div class="ec-pick-row two" style="margin-top:10px"><button class="ec-pick" onclick="ecStartNew()">새 비교 시작</button><button class="ec-pick" onclick="ecGo('list')">기록 보기</button></div>`;
}
function ecNextFromWinner(id){
  const rec=ecLoad().find(x=>x.id===id);if(!rec)return;
  if(rec.picks.final==='same'){
    document.getElementById('ecKeepA').textContent='A 남기기 · '+ecShort(rec.A.bean)+' '+ecVariant(rec.A);
    document.getElementById('ecKeepB').textContent='B 남기기 · '+ecShort(rec.B.bean)+' '+ecVariant(rec.B);
    document.getElementById('moEcKeep').dataset.id=id;
    openMo('moEcKeep');return;
  }
  ecContinue(rec,rec.picks.final);
}
function ecKeep(side){
  const id=document.getElementById('moEcKeep').dataset.id;
  const list=ecLoad();const rec=list.find(x=>x.id===id);if(!rec)return;
  rec.keep=side;ecSave(list);closeMo('moEcKeep');
  ecContinue(rec,side);
}
function ecContinue(rec,side){
  const w=rec[side];
  _ec=ecNewState();
  _ec.date=rec.date;
  _ec.A={roast_id:w.roast_id,bean:w.bean,roast_date:w.roast_date,mode:w.mode,dtr:w.dtr,loss:w.loss,batch:w.batch,memo:w.memo,manual:w.manual};
  _ec.tournament_id=rec.tournament_id||rec.id;
  _ec.round=(rec.round||1)+1;
  ecGo('form');
}

/* ── 기록 목록 · 집계 ── */
function ecMatch(rec,q){
  if(!q)return true;
  const n=s=>String(s||'').toLowerCase().replace(/\s+/g,'');
  return n(rec.A.bean).includes(q)||n(rec.B.bean).includes(q)||n(rec.memo).includes(q);
}
function ecTally(list){
  const t={};
  const key=s=>`${s.bean}${ecVariant(s)?' – '+(s.mode?s.mode+'번 모드 ':'')+(s.dtr?s.dtr+'%':''):''}`.trim();
  list.forEach(r=>{
    const f=r.picks.final;
    [['A','B'],['B','A']].forEach(([me,op])=>{
      const k=key(r[me]);t[k]=t[k]||{w:0,l:0,d:0};
      if(f==='same')t[k].d++;else if(f===me)t[k].w++;else t[k].l++;
    });
  });
  return Object.entries(t).sort((a,b)=>b[1].w-a[1].w||a[1].l-b[1].l||a[0].localeCompare(b[0]));
}
function ecListHtml(){
  const all=ecLoad();
  const q=_ecFilter.toLowerCase().replace(/\s+/g,'');
  const list=all.filter(r=>ecMatch(r,q)).sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:(b.created_at||0)-(a.created_at||0));
  const head=`<div class="sh"><div class="stl">쉬운 커핑 (2개 비교)</div><button class="btn btn-sm" onclick="ecStartNew()">+ 새 비교</button></div>`;
  if(!all.length)return head+`<button class="ec-save" onclick="ecStartNew()">첫 비교 시작하기</button>
    <div class="empty"><div class="empty-icon">⚖️</div><div class="empty-text">원두 2개를 놓고 어느 쪽이 더 나은지 골라 보세요</div></div>`+ecExportHtml(0);
  // 토너먼트 묶음 (2판 이상)
  const byT={};all.forEach(r=>{const k=r.tournament_id||r.id;(byT[k]=byT[k]||[]).push(r);});
  const seen=new Set();
  const rows=list.map(r=>{
    const k=r.tournament_id||r.id,grp=byT[k];
    if(grp.length<2)return ecRowHtml(r);
    if(seen.has(k))return '';
    seen.add(k);
    const g=grp.slice().sort((a,b)=>(a.round||1)-(b.round||1));
    const last=g[g.length-1],ws=ecWinnerSide(last);
    const champ=ws?`${ecShort(last[ws].bean)} ${ecVariant(last[ws])}${last.picks.final==='same'?' (비김 후 남김)':''}`:'마지막 판 비김';
    const shown=g.filter(x=>ecMatch(x,q)).reverse();
    return `<div class="ec-tour"><div class="ec-tour-hd">🏆 토너먼트 ${ecMD(g[0].date)} · ${g.length}판 · 최종 승자: <b>${ecEsc(champ)}</b></div>${shown.map(x=>ecRowHtml(x,true)).join('')}</div>`;
  }).join('');
  const tally=ecTally(list).map(([k,v])=>`<div class="ec-tally-row"><span>${ecEsc(k)}</span><b>${v.w}승 ${v.l}패 ${v.d}무</b></div>`).join('');
  return head+`<input class="search" placeholder="생두 이름으로 거르기..." value="${ecEsc(_ecFilter)}" oninput="ecSetFilter(this.value)" id="ecFilterInp">
    <div class="ec-sec-t">기록 ${list.length}건 (최신순)</div>${rows||'<div class="ec-hint">맞는 기록이 없어요.</div>'}
    <div class="ec-sec-t">생두별 승패</div><div class="ec-card">${tally||'<div class="ec-hint">기록이 없어요.</div>'}</div>`+ecExportHtml(all.length);
}
function ecRowHtml(r,inTour){
  return `<div class="ec-row"><div class="ec-row-sum">${inTour?`<span class="ec-round">${r.round}판</span>`:''}${ecEsc(r.summary||ecSummary(r))}</div>
    ${r.memo?`<div class="ec-row-memo">“${ecEsc(r.memo)}”</div>`:''}
    <div class="ec-row-meta">디개싱 A ${r.A.degas_days??'-'}일 · B ${r.B.degas_days??'-'}일${r.keep?` · 비김 후 ${r.keep} 남김`:''}</div>
    <div class="ec-row-btns"><button class="btn2" onclick="ecEdit('${r.id}')">수정</button><button class="btnd" onclick="ecDelete('${r.id}')">삭제</button></div></div>`;
}
function ecSetFilter(v){
  _ecFilter=v;renderEasyCup();
  const inp=document.getElementById('ecFilterInp');if(inp){inp.focus();inp.setSelectionRange(v.length,v.length);}
}
function ecEdit(id){
  const r=ecLoad().find(x=>x.id===id);if(!r)return;
  const strip=s=>{const c={...s};delete c.degas_days;return c;};
  _ec={editId:r.id,date:r.date,A:strip(r.A),B:strip(r.B),blind:!!r.blind,order:r.blind_order||['A','B'],revealed:true,
       steps:(r.steps||[]).slice(),picks:{...r.picks},memo:r.memo||'',tournament_id:r.tournament_id,round:r.round||1,keep:r.keep||''};
  ecGo('form');
}
function ecDelete(id){
  const list=ecLoad();const r=list.find(x=>x.id===id);if(!r)return;
  if(!confirm(`이 기록을 삭제할까요? 되돌릴 수 없어요.\n\n${r.summary||ecSummary(r)}`))return;
  ecSave(list.filter(x=>x.id!==id));renderEasyCup();
}

/* ── 내보내기 ── */
function ecExportHtml(n){
  return `<div class="ec-sec-t">내보내기 · 백업</div><div class="ec-card">
    <div class="ec-hint" style="margin-bottom:10px">쉬운 커핑 기록은 이 휴대폰(브라우저)에만 저장돼요. 가끔 백업 파일을 받아 두세요.</div>
    <div class="ec-pick-row two">
      <button class="ec-pick" onclick="ecCopyText()" ${n?'':'disabled'}>📋 텍스트로 복사</button>
      <button class="ec-pick" onclick="ecDownloadCSV()" ${n?'':'disabled'}>📊 CSV 내려받기</button>
      <button class="ec-pick" onclick="ecDownloadJSON()" ${n?'':'disabled'}>💾 백업 파일 받기</button>
      <label class="ec-pick" style="text-align:center">📂 백업 불러오기<input type="file" accept=".json,application/json" style="display:none" onchange="ecImportJSON(this)"></label>
    </div></div>`;
}
function ecSorted(){return ecLoad().sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:(a.created_at||0)-(b.created_at||0));}
function ecCopyText(){
  const txt=ecSorted().map(r=>(r.summary||ecSummary(r))+(r.memo?` · 메모: ${r.memo}`:'')).join('\n');
  const done=()=>alert(`${ecLoad().length}건을 복사했어요. 원하는 곳에 붙여넣기 하세요.`);
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(done,()=>ecCopyFallback(txt,done));}
  else ecCopyFallback(txt,done);
}
function ecCopyFallback(txt,done){
  const ta=document.createElement('textarea');ta.value=txt;ta.style.position='fixed';ta.style.opacity='0';
  document.body.appendChild(ta);ta.focus();ta.select();
  let ok=false;try{ok=document.execCommand('copy');}catch(e){}
  ta.remove();
  if(ok)done();else prompt('복사가 막혀 있어요. 아래 글을 길게 눌러 복사하세요.',txt);
}
function ecDownload(name,content,type){
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([content],{type}));
  a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),2000);
}
const EC_CSV_COLS=[
  ['커핑날짜',r=>r.date],['토너먼트',r=>r.tournament_id],['판',r=>r.round],['블라인드',r=>r.blind?'예':'아니오'],
  ['1번컵',r=>r.blind_order?r.blind_order[0]:''],['2번컵',r=>r.blind_order?r.blind_order[1]:''],
  ...['A','B'].flatMap(s=>[
    [s+'_생두',r=>r[s].bean],[s+'_로스팅날짜',r=>r[s].roast_date],[s+'_모드',r=>r[s].mode],[s+'_DTR',r=>r[s].dtr],
    [s+'_손실률',r=>r[s].loss],[s+'_배치순서',r=>r[s].batch],[s+'_디개싱일수',r=>r[s].degas_days],[s+'_메모',r=>r[s].memo],[s+'_로스팅ID',r=>r[s].roast_id],
  ]),
  ['향',r=>ecPickWord(r.picks.aroma)],['단맛',r=>ecPickWord(r.picks.sweet)],['뒷맛',r=>ecPickWord(r.picks.after)],
  ['최종',r=>r.picks.final==='same'?'비김':r.picks.final],['비김후남김',r=>r.keep],
  ['진행체크',r=>(r.steps||[]).map((v,i)=>v?i+1:'').filter(Boolean).join(' ')],
  ['메모',r=>r.memo],['요약',r=>r.summary||ecSummary(r)],['ID',r=>r.id],
];
function ecCsvCell(v){v=v==null?'':String(v);return /[",\n\r]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;}
function ecDownloadCSV(){
  const lines=[EC_CSV_COLS.map(c=>c[0]).join(',')].concat(ecSorted().map(r=>EC_CSV_COLS.map(c=>ecCsvCell(c[1](r))).join(',')));
  ecDownload('쉬운커핑_'+today()+'.csv','﻿'+lines.join('\r\n'),'text/csv;charset=utf-8');
}
function ecDownloadJSON(){
  ecDownload('쉬운커핑_백업_'+today()+'.json',JSON.stringify({type:'easyCuppingLog',version:1,exported_at:new Date().toISOString(),items:ecLoad()},null,1),'application/json');
}
function ecImportJSON(input){
  const f=input.files[0];if(!f)return;
  const rd=new FileReader();
  rd.onload=ev=>{
    try{
      const p=JSON.parse(ev.target.result);
      const items=Array.isArray(p)?p:p.items;
      if(!Array.isArray(items))throw new Error('쉬운 커핑 백업 파일이 아니에요');
      const list=ecLoad(),ids=new Set(list.map(x=>x.id));
      let add=0,skip=0;
      items.forEach(it=>{
        if(!it||!it.id||!it.A||!it.B||!it.picks){skip++;return;}
        if(ids.has(it.id)){skip++;return;}
        list.push(it);ids.add(it.id);add++;
      });
      ecSave(list);renderEasyCup();
      alert(`불러오기 완료: ${add}건 추가, ${skip}건은 이미 있거나 형식이 달라 건너뜀`);
    }catch(err){alert('불러오기 실패: '+err.message);}
  };
  rd.readAsText(f);input.value='';
}

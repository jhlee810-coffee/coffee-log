// easycup.js — 쉬운 커핑 (원두 2개 비교) · 2026-11-04, 2026-11-09 단계별 진행·혼자 섞기
// 기존 커핑(db.cuppings)과 분리: localStorage 'easyCuppingLog'가 원본, 2026-11-09부터 db.easycups에도 사본(Sheets 동기화)

const EC_KEY='easyCuppingLog';
// 2026-11-09: 혼자서도 순서대로 따라 하는 커핑 — 단계(시간) 안에 그 단계 평가가 들어 있음
const EC_DEFAULT_SET={coffee_g:'8.3',water_g:'150',temp:'93',grind:'지피식스 7.5'};
const EC_STAGES=[   // 인덱스(0~6)는 저장된 진행체크(steps)와 같아야 해서 바꾸지 말 것. t=시작(초), end=끝(초)
  {t:null,end:0,   label:'마른 향',        time:'물 붓기 전',   act:'분쇄 직후, 두 볼의 마른 향을 번갈아 맡아요',qs:[]},
  {t:0,   end:240, label:'물 붓기 → 기다리기',time:'0:00 ~ 4:00',  act:'{temp}°C 물을 {water}g까지, 가루가 다 젖게 빠르게 부어요. 다 부으면 4:00까지 손대지 않고 기다려요',qs:[],start:true},
  {t:240, end:270, label:'크러스트 깨기',  time:'4:00 ~ 4:30',  act:'스푼으로 3번 밀면서 코를 대고 향을 맡아요. 스푼은 컵마다 뜨거운 물에 헹궈요',qs:['aroma','aroma_t']},
  {t:270, end:600, label:'걷어내기 → 식히기',time:'4:30 ~ 10:00', act:'4:30~5:00 두 스푼으로 위의 거품과 가루를 걷어내요. 끝나면 10:00까지 기다려요',qs:[]},
  {t:600, end:900, label:'맛보기',         time:'10:00 ~ 15:00',act:'스푼으로 떠서 후루룩 세게 마셔요. 2~3분마다 다시 맛봐요',qs:['acid','sweet']},
  {t:900, end:1200,label:'식었을 때',      time:'15:00 ~ 20:00',act:'미지근할 때 차이가 가장 잘 보여요. 다시 맛봐요',qs:['after','issue']},
  {t:1200,end:null,label:'최종 선택',      time:'20:00 ~',      act:'지금까지 느낀 걸 떠올려서 하나만 골라요',qs:['final','conf']},
];
const EC_QS=[
  {key:'aroma', label:'향',   q:'어느 쪽 향이 더 또렷하고 좋아?'},
  {key:'acid',  label:'산미', q:'어느 쪽 산미가 더 기분 좋아? (쥬시 vs 찌름)'},
  {key:'sweet', label:'단맛', q:'어느 쪽이 더 달아?'},
  {key:'after', label:'뒷맛', q:'어느 쪽이 삼킨 뒤 더 깔끔하고 오래 남아?'},
  {key:'green', label:'풋내·떫은맛', q:'풋내나 떫은맛이 난 쪽은?',flaw:true},
  {key:'final', label:'최종 선택', q:'하나만 다시 마신다면?', required:true},
];

let _ec=null;          // 작성 중인 비교 (null이면 목록 화면)
let _ecView='list';    // 'list' | 'form' | 'done'
let _ecLastId=null;    // 방금 저장한 기록 id
let _ecFilter='';
let _ecPickSide=null;  // 고르는 중인 자리 'A'|'B'

/* ── 저장소 ── */
function ecLoad(){
  let a=[];try{a=JSON.parse(localStorage.getItem(EC_KEY)||'[]');}catch(e){}
  if((!Array.isArray(a)||!a.length)&&typeof db!=='undefined'&&db&&Array.isArray(db.easycups)&&db.easycups.length)a=db.easycups.slice();  // 폰 저장소가 비면 동기화 사본에서
  return Array.isArray(a)?a:[];
}
// 2026-11-09: 저장할 때 db.easycups에도 사본 → Sheets 동기화 (PC에서 읽어 로스팅 계획에 씀)
function ecSave(list){localStorage.setItem(EC_KEY,JSON.stringify(list));
  if(typeof db!=='undefined'&&db&&typeof saveDB==='function'){db.easycups=list;saveDB();}}

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
  (db.roasts||[]).forEach(r=>{cnt[r.date]=(cnt[r.date]||0)+1;m[r.id]=+r.batch_no||cnt[r.date];});  // 저장된 배치 순서 우선
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
function ecPickWord(p){return p==='A'?'A':p==='B'?'B':p==='same'?'비슷함':p==='both'?'둘 다':p==='none'?'없음':'';}
function ecSummary(rec){
  const A=rec.A,B=rec.B;
  const same=ecShort(A.bean)===ecShort(B.bean);
  let head;
  if(same) head=`${ecMD(rec.date)} ${ecShort(A.bean)} · ${ecSideLabel(A,B)} (A) vs ${ecSideLabel(B,A)} (B)`;
  else head=`${ecMD(rec.date)} ${ecShort(A.bean)} ${ecSideLabel(A,B)} (A) vs ${ecShort(B.bean)} ${ecSideLabel(B,A)} (B)`;
  head=head.replace(/\s+\(/g,' (').replace(/\s{2,}/g,' ');
  const parts=['aroma','acid','sweet','after','green'].filter(k=>rec.picks&&rec.picks[k]).map(k=>`${EC_QS.find(q=>q.key===k).label} ${ecPickWord(rec.picks[k])}`);
  const fin=rec.picks.final==='same'?'비김':rec.picks.final;
  const cup=o=>['A','B'].filter(k=>o&&o[k]&&o[k].length).map(k=>k+' '+o[k].join('·')).join(' / ');
  const ex=[cup(rec.aroma_types)?'향종류 '+cup(rec.aroma_types):'',cup(rec.issues)?'문제 '+cup(rec.issues):''].filter(Boolean);
  return head+(parts.length?' · '+parts.join(' / '):'')+(ex.length?' · '+ex.join(' / '):'')+` → 최종 ${fin}`+(rec.confidence?` (확신: ${rec.confidence})`:'')+(rec.blind?' · 블라인드':'');
}
function ecWinnerSide(rec){return rec.picks.final==='A'||rec.picks.final==='B'?rec.picks.final:(rec.keep||null);}

/* ── 화면 진입 ── */
function renderEasyCup(){
  const el=document.getElementById('ecRoot');
  if(!el)return;
  // 커핑 계획(cupplan.js): 목록·저장 완료 화면 위에 배너
  const bar=_ecView!=='form'&&typeof cpBannerHtml==='function'?cpBannerHtml():'';
  if(typeof cpCheckRemote==='function'&&Date.now()-(window._cpChecked||0)>60000){window._cpChecked=Date.now();cpCheckRemote();}
  if(_ecView==='form'&&_ec)el.innerHTML=ecFormHtml();
  else if(_ecView==='done')el.innerHTML=bar+ecDoneHtml();
  else el.innerHTML=bar+ecListHtml();
}
function ecGo(view){_ecView=view;renderEasyCup();window.scrollTo(0,0);}

function ecNewState(){
  return {editId:null,date:today(),A:null,B:null,blindMode:'self',blind:false,order:['S1','S2'],revealed:false,seat1:'',
          settings:{...EC_DEFAULT_SET},t0:null,stageNow:0,cupAroma:{},cupIssue:{},conf:'',
          steps:EC_STAGES.map(()=>false),picks:{aroma:'',acid:'',sweet:'',after:'',green:'',final:''},memo:'',
          tournament_id:null,round:1,keep:''};
}
function ecStartNew(){_ec=ecNewState();ecGo('form');}
function ecCancel(){
  if(_ec&&(_ec.A||_ec.B||_ec.picks.final||_ec.t0)&&!confirm('작성 중인 비교를 닫을까요? 저장되지 않아요.'))return;
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
    <div class="ec-side-meta">${ecEsc(meta)} · ${deg!=null?`디개싱 <b>${deg}일</b>`:'디개싱 일수 알 수 없음(로스팅 날짜 없음)'}${s.memo?`<br>메모: ${ecEsc(s.memo)}`:''}</div>
    <div class="ec-side-btns sm"><button class="btn2" onclick="ecOpenPick('${side}')">다시 고르기</button>
    <button class="btn2" onclick="ecOpenManual('${side}')">직접 수정</button></div></div>`;
}
function ecCupName(i){const m=_ec.blindMode;return m==='self'?(i+1)+'번 자리':m==='app'?(i+1)+'번 컵':_ec.order[i];}
function ecFmt(sec){sec=Math.max(0,Math.floor(sec));return Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0');}
function ecElapsed(){return _ec&&_ec.t0?(Date.now()-_ec.t0)/1000:null;}
function ecStageIdx(){const el=ecElapsed();if(el==null)return 0;let k=1;EC_STAGES.forEach((st,i)=>{if(st.t!=null&&el>=st.t)k=i;});return k;}
function ecGuide(t){const st=_ec.settings||{};return t.replace('{temp}',st.temp||'93').replace('{water}',st.water_g||'150');}
const EC_AROMA_T=['과일','꽃','고소'], EC_ISSUE_T=['없음','풋내','떫음','목마름'];
function ecCupToggle(field,id,v){   // field: 'cupAroma' | 'cupIssue'
  const o=_ec[field],a=(o[id]||[]).slice();
  if(field==='cupIssue'){
    if(v==='없음')o[id]=a.includes('없음')?[]:['없음'];
    else{const b=a.filter(x=>x!=='없음'),i=b.indexOf(v);if(i>=0)b.splice(i,1);else b.push(v);o[id]=b;}
  }else{const i=a.indexOf(v);if(i>=0)a.splice(i,1);else a.push(v);o[id]=a;}
  ecRerenderKeep();
}
function ecSetConf(v){_ec.conf=_ec.conf===v?'':v;ecRerenderKeep();}
function ecCupChipsHtml(field,opts,flaw){
  return [0,1].map(i=>{const id=_ec.order[i],cur=_ec[field][id]||[];
    return `<div class="ec-cupx${flaw?' flaw':''}"><b>${ecCupName(i)}</b><div class="dc-chips">${opts.map(v=>`<button class="ec-chip${flaw&&v==='없음'?' none':''}${cur.includes(v)?' on':''}" onclick="ecCupToggle('${field}','${id}','${v}')">${v}</button>`).join('')}</div></div>`;}).join('');
}
function ecQHtml(key){
  if(key==='aroma_t')return `<div class="ec-q"><div class="ec-q-hd"><b>향 종류</b> <span class="ec-opt">컵마다 · 여러 개</span></div>${ecCupChipsHtml('cupAroma',EC_AROMA_T,false)}</div>`;
  if(key==='issue')return `<div class="ec-q"><div class="ec-q-hd"><b>풋내·떫음·목마름</b> <span class="ec-opt">컵마다 · 여러 개</span></div><div class="ec-q-txt">컵마다 느낀 걸 골라요 (없으면 "없음")</div>${ecCupChipsHtml('cupIssue',EC_ISSUE_T,true)}</div>`;
  if(key==='conf')return `<div class="ec-q"><div class="ec-q-hd"><b>확신도</b> <span class="ec-opt">선택</span></div><div class="ec-q-txt">최종 선택에 얼마나 확신해요?</div><div class="ec-pick-row two">${['확실','애매'].map(v=>`<button class="ec-pick${_ec.conf===v?' on':''}" onclick="ecSetConf('${v}')">${v}</button>`).join('')}</div></div>`;
  const e=_ec,q=EC_QS.find(x=>x.key===key),cur=e.picks[key];
  const btn=(val,label)=>`<button class="ec-pick${cur===val?' on':''}" onclick="ecSetPick('${q.key}','${val}')">${label}</button>`;
  const row=q.flaw
    ?`<div class="ec-pick-row four">${btn(e.order[0],ecCupName(0))}${btn(e.order[1],ecCupName(1))}${btn('both','둘 다')}${btn('none','없음')}</div>`
    :`<div class="ec-pick-row">${btn(e.order[0],ecCupName(0))}${btn(e.order[1],ecCupName(1))}${btn('same',q.key==='final'?'비김':'비슷함')}</div>`;
  return `<div class="ec-q"><div class="ec-q-hd"><b>${q.label}</b>${q.required?' <span class="ec-req">필수</span>':' <span class="ec-opt">선택</span>'}</div>
    <div class="ec-q-txt">${q.q}</div>${row}</div>`;
}
function ecStagesHtml(){
  const e=_ec,now=ecStageIdx(),el=ecElapsed(),run=el!=null,edit=!!e.editId;
  const nextI=run?now+1:1;
  return EC_STAGES.map((st,i)=>{
    const state=edit?'edit':i===now?'now':i<now&&run?'past':i===nextI?'next':'later';
    const act=ecGuide(st.act||'');
    const lack=run&&state==='past'&&st.qs.some(k=>EC_QS.find(x=>x.key===k)&&!e.picks[k]);
    let badge='';
    if(state==='now')badge=run&&st.end!=null?`● 지금 · 남은 <b id="ecBadgeNow">${ecFmt(st.end-el)}</b>`:'● 지금';
    else if(state==='next')badge=run?`다음 · <b id="ecBadgeNext">${ecFmt(st.t-el)}</b> 후 시작`:'다음';
    else if(state==='past')badge=lack?'지남 · ⚠ 평가 안 함':'지남 ✓';
    else if(state==='later')badge='이후';
    const startBtn=st.start?(e.t0
      ?`<div class="ec-hint">타이머 진행 중 · <button class="btn2" onclick="ecStartPour(true)">처음부터 다시</button></div>`
      :`<button class="ec-save" style="margin:10px 0 0" onclick="ecStartPour()">⏱ 물 붓기 시작</button>`):'';
    const evl=st.qs.length?st.qs.map(ecQHtml).join(''):'<div class="ec-noeval">평가 없음 — 할 일만 해요</div>';
    return `<div class="ec-stage st-${state}${e.steps[i]?' done':''}" id="ecStage${i}">
      <div class="ec-sbar"><span class="ec-sb ${state}">${badge}</span><span class="ec-rng">${st.time}</span></div>
      <button class="ec-step${e.steps[i]?' on':''}" onclick="ecToggleStep(${i})"><span>${e.steps[i]?'✓':i+1}</span><b>${st.label}</b></button>
      <div class="ec-blk act"><div class="ec-tag">🖐 할 일</div><div class="ec-blk-t">${ecEsc(act)}</div>${startBtn}</div>
      <div class="ec-blk evl"><div class="ec-tag">📝 평가</div>${evl}</div></div>`;
  }).join('');
}
function ecClockHtml(){
  const e=_ec,el=ecElapsed();
  const q=e.planRef&&e.planRef.question?`<div class="ec-clock-q">❓ ${ecEsc(e.planRef.question)}</div>`:'';
  if(el==null)return q?`<div class="ec-clock qonly">${q}</div>`:'';
  const i=ecStageIdx(),nx=EC_STAGES.slice(i+1).find(x=>x.t!=null);
  return `<div class="ec-clock" onclick="ecScrollStage()"><div class="ec-clock-n" id="ecClock">${ecFmt(el)}</div>
    <div class="ec-clock-s">지금 <b>${EC_STAGES[i].label}</b> <span class="ec-clock-r">${EC_STAGES[i].time}</span>${nx?`<br><span id="ecClockNext">다음 ${nx.label} ${ecFmt(nx.t)} (${ecFmt(nx.t-el)} 남음)</span>`:''}</div>${q}</div>`;
}
function ecSelfGuide(){
  return `<div class="ec-guide"><b>혼자 섞기 순서</b><ol>
    <li>커핑볼 바닥에 테이프로 A, B 붙이기</li><li>각 볼에 해당 원두를 갈아 넣기</li><li>눈을 감고 두 볼을 여러 번 섞기</li>
    <li>종이에 적은 1, 2 자리에 하나씩 올리기</li><li>이제부터 평가는 <b>자리 번호(1번 / 2번)</b>로만 해요</li></ol></div>`;
}
function ecRevealHtml(){
  const e=_ec;if(e.blindMode!=='self')return '';
  if(e.editId)return `<div class="ec-card"><div class="ec-card-t">✅ 정답 확인</div><div class="ec-hint">1번 자리 = ${ecEsc(e.seat1||e.order[0])} · 2번 자리 = ${ecEsc(e.order[1])}</div></div>`;
  const nm=k=>e[k]?ecShort(e[k].bean)+' '+ecVariant(e[k]):'';
  return `<div class="ec-card" id="ecReveal"><div class="ec-card-t">✅ 정답 확인 <span class="ec-req">필수</span></div>
    <div class="ec-stage-g">볼을 들어 바닥을 확인하세요</div>
    <div class="ec-q-txt">1번 자리는?</div>
    <div class="ec-pick-row two"><button class="ec-pick${e.seat1==='A'?' on':''}" onclick="_ec.seat1='A';ecRerenderKeep()">A<br><small>${ecEsc(nm('A'))}</small></button>
    <button class="ec-pick${e.seat1==='B'?' on':''}" onclick="_ec.seat1='B';ecRerenderKeep()">B<br><small>${ecEsc(nm('B'))}</small></button></div></div>`;
}
function ecRecipeHtml(){
  const e=_ec,st=e.settings||{};
  const set=(k,label,unit,type)=>`<label class="ec-set"><span>${label}</span><input class="inp" ${type==='num'?'type="number" inputmode="decimal" step="0.1"':''} value="${ecEsc(st[k]||'')}" oninput="_ec.settings.${k}=this.value">${unit?`<em>${unit}</em>`:''}</label>`;
  const hint=`<div class="ec-hint">커핑볼을 저울에 올리고 물을 ${ecEsc(st.water_g||'150')}g까지 부어요. 모든 컵을 똑같이.</div>`;
  if(!e.recipeOpen){
    const sum=[ecMD(e.date),st.coffee_g?'원두 '+st.coffee_g+'g':'',st.water_g?'물 '+st.water_g+'g':'',st.temp?st.temp+'°C':'',st.grind?'분쇄 '+st.grind:''].filter(Boolean).join(' · ');
    return `<div class="ec-card"><div class="ec-card-t">☕ 레시피</div><div class="ec-recipe-sum">${ecEsc(sum)}</div>${hint}
      <button class="btn2" style="margin-top:8px" onclick="_ec.recipeOpen=true;ecRerenderKeep()">날짜·레시피 수정</button></div>`;
  }
  return `<div class="ec-card"><div class="ec-card-t">☕ 레시피</div>
    <label class="ec-set"><span>커핑 날짜</span><input class="inp" type="date" value="${e.date}" onchange="_ec.date=this.value||today()" onblur="ecSetDate(this.value)"></label>
    ${set('coffee_g','원두','g','num')}${set('water_g','물','g','num')}${set('temp','물 온도','°C','num')}${set('grind','분쇄','')}${hint}
    <button class="btn2" style="margin-top:8px" onclick="_ec.recipeOpen=false;ecRerenderKeep()">접기</button></div>`;
}
function ecFormHtml(){
  const e=_ec;
  const tour=e.tournament_id?`<div class="ec-tour-note">🏆 토너먼트 ${e.round}번째 비교 — 지난 승자가 A 자리에 들어가 있어요</div>`:'';
  const blindBtn=(m,l)=>`<button class="ec-pick${e.blindMode===m?' on':''}" onclick="ecSetBlind('${m}')">${l}</button>`;
  const blindInfo=e.blindMode==='app'?`<div class="ec-hint">어느 원두가 몇 번 컵인지 무작위로 섞었어요. 저장할 때 정답을 알려 줘요.</div><div class="ec-blind-box">
      <div>컵 바닥 표시용: <b>1번 컵 = ${e.revealed?ecEsc(e.order[0]+' · '+ecShort(e[e.order[0]]?.bean||'')):'?'}</b> / <b>2번 컵 = ${e.revealed?ecEsc(e.order[1]+' · '+ecShort(e[e.order[1]]?.bean||'')):'?'}</b></div>
      ${e.revealed?'':'<button class="btn2" onclick="ecReveal()">정답 보기</button>'}
      <button class="btn2" onclick="ecShuffle()">다시 섞기</button></div>`:e.blindMode==='self'&&!e.editId?ecSelfGuide():'';
  return `<div class="sh"><div class="stl">${e.editId?'쉬운 커핑 수정':'새 비교'}</div><button class="btn2" onclick="ecCancel()">닫기</button></div>
  <div class="ec-card"><div class="ec-card-t">🆚 비교할 원두 2개</div>${ecSideCard('A')}${ecSideCard('B')}
    ${e.planRef?`<div class="ec-plan-q">📋 커핑 계획 ${e.planRef.idx+1}/${e.planRef.n}${e.planRef.question?`<b>❓ ${ecEsc(e.planRef.question)}</b>`:''}</div>`:''}</div>
  ${tour}
  ${ecRecipeHtml()}
  <div class="ec-card"><div class="ec-card-t">🥣 컵 배치 (블라인드)</div>
    <div class="ec-pick-row">${blindBtn('self','① 혼자 섞기')}${blindBtn('app','② 앱이 섞기')}${blindBtn('none','③ 블라인드 없음')}</div>
    ${blindInfo}</div>
  <div class="ec-card"><div class="ec-card-t">⏱ 진행 순서 · 평가</div><div class="ec-steps">${ecStagesHtml()}</div></div>
  ${ecRevealHtml()}
  <div class="ec-card"><div class="ec-q"><div class="ec-q-hd"><b>한 줄 메모</b> <span class="ec-opt">선택</span></div>
    <input class="inp" id="ecMemo" placeholder="예: 2번이 향이 더 또렷" value="${ecEsc(e.memo)}" oninput="_ec.memo=this.value"></div></div>
  <button class="ec-save" onclick="ecSubmit()">${e.editId?'수정 저장':'저장하기'}</button>
  ${e.t0||e.planRef?`<div style="height:${e.t0?110:60}px"></div>`:''}${ecClockHtml()}`;
}
function ecRerenderKeep(){const y=window.scrollY;renderEasyCup();window.scrollTo(0,y);}
function ecToggleStep(i){_ec.steps[i]=!_ec.steps[i];ecRerenderKeep();}
function ecStartPour(again){
  if(again&&!confirm('타이머를 0:00부터 다시 시작할까요?'))return;
  _ec.t0=Date.now();_ec.steps[0]=true;_ec.steps[1]=true;_ec.stageNow=1;_ec._bp={};ecAudio();ecRerenderKeep();
}
function ecScrollStage(){const el=document.getElementById('ecStage'+ecStageIdx());if(el)el.scrollIntoView({behavior:'smooth',block:'center'});}
// 단계 알림: 다음 단계 10초 전 삐, 시작할 때 삐삐 (+ 진동) — 화면 색 변화가 기본 신호, 소리는 보조
let _ecAC=null;
function ecAudio(){try{if(!_ecAC)_ecAC=new (window.AudioContext||window.webkitAudioContext)();if(_ecAC.state==='suspended')_ecAC.resume();}catch(x){}return _ecAC;}
function ecBeep(f,d,v){const a=ecAudio();if(!a)return;try{const o=a.createOscillator(),g=a.createGain();o.frequency.value=f;g.gain.value=v||.5;o.connect(g);g.connect(a.destination);o.start();o.stop(a.currentTime+d);}catch(x){}}
function ecBeepTick(el){
  const bp=_ec._bp=_ec._bp||{};
  EC_STAGES.forEach((st,i)=>{if(st.t==null||i<2)return;
    if(el>=st.t-10&&el<st.t&&!bp['p'+i]){bp['p'+i]=1;ecBeep(880,.15,.5);}
    if(el>=st.t&&el<st.t+3&&!bp['s'+i]){bp['s'+i]=1;ecBeep(1200,.2,.6);setTimeout(()=>ecBeep(1200,.2,.6),350);try{navigator.vibrate&&navigator.vibrate([200,100,200]);}catch(x){}}
  });
}
// 1초마다 시계만 바꾸고, 단계가 바뀔 때만 화면을 다시 그림 (입력 중인 메모는 그대로)
setInterval(function(){
  if(!_ec||!_ec.t0||_ecView!=='form')return;
  const c=document.getElementById('ecClock');if(!c)return;
  const el=ecElapsed(),i=ecStageIdx();
  ecBeepTick(el);
  if(i!==_ec.stageNow){_ec.stageNow=i;const a=document.activeElement;if(a&&a.id==='ecMemo')return;ecRerenderKeep();return;}
  c.textContent=ecFmt(el);
  const nx=EC_STAGES.slice(i+1).find(x=>x.t!=null),n=document.getElementById('ecClockNext');
  if(n&&nx)n.textContent=`다음 ${nx.label} ${ecFmt(nx.t)} (${ecFmt(nx.t-el)} 남음)`;
  const bn=document.getElementById('ecBadgeNow'),st=EC_STAGES[i];if(bn&&st.end!=null)bn.textContent=ecFmt(st.end-el);
  const bx=document.getElementById('ecBadgeNext');if(bx&&nx)bx.textContent=ecFmt(nx.t-el);
  const ck=document.querySelector('.ec-clock');if(ck)ck.classList.toggle('warn',!!(nx&&nx.t-el<=10));
},1000);
function ecSetDate(v){const n=v||today();_ec.date=n;ecRerenderKeep();}
function ecSetPick(k,v){_ec.picks[k]=_ec.picks[k]===v&&k!=='final'?'':v;ecRerenderKeep();}
function ecSetBlind(m){
  if(m===_ec.blindMode)return;
  const had=Object.values(_ec.picks).some(Boolean);
  if(had&&!confirm('블라인드 방식을 바꾸면 고른 평가가 지워져요. 바꿀까요?'))return;
  _ec.blindMode=m;_ec.blind=m==='app';_ec.revealed=false;_ec.seat1='';
  _ec.order=m==='self'?['S1','S2']:m==='app'?(Math.random()<.5?['A','B']:['B','A']):['A','B'];
  Object.keys(_ec.picks).forEach(k=>_ec.picks[k]='');_ec.cupAroma={};_ec.cupIssue={};
  ecRerenderKeep();
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
function ecSnapRoast(r){
  return {roast_id:r.id,bean:r.bean_name||'',roast_date:r.date||'',mode:r.mode?String(r.mode):'',
    dtr:ecRoastDTR(r),loss:ecRoastLoss(r),batch:ecBatchMap()[r.id]||'',memo:'',manual:false};
}
function ecChooseRoast(id){
  const r=(db.roasts||[]).find(x=>x.id===id);if(!r)return;
  _ec[_ecPickSide]=ecSnapRoast(r);
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
  const mode=e.blindMode||(e.blind?'app':'none');
  let order=e.order.slice(),picks={...e.picks};
  if(mode==='self'&&!e.editId){
    if(!e.seat1){alert('"정답 확인"에서 1번 자리가 A인지 B인지 골라 주세요.');document.getElementById('ecReveal')?.scrollIntoView({block:'center'});return;}
    const s2=e.seat1==='A'?'B':'A',mp={S1:e.seat1,S2:s2};
    Object.keys(picks).forEach(k=>{if(mp[picks[k]])picks[k]=mp[picks[k]];});   // 자리 번호 → A/B 원두
    order=[e.seat1,s2];
  }
  const seatMap=mode==='self'&&!e.editId&&e.seat1?{S1:e.seat1,S2:e.seat1==='A'?'B':'A'}:{};
  const remap=o=>{const r={};Object.entries(o||{}).forEach(([k,v])=>{if(v&&v.length)r[seatMap[k]||k]=v.slice();});return r;};
  const cupA=remap(e.cupAroma),cupI=remap(e.cupIssue);
  if(mode==='app'&&!e.revealed){
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
    blind:mode!=='none',
    blind_mode:mode,                             // 'self' 혼자 섞기 | 'app' 앱이 섞기 | 'none'
    blind_order:mode!=='none'?order:null,        // [1번 자리(컵), 2번 자리(컵)]
    seat1:mode==='self'?order[0]:'',
    settings:{...(e.settings||{})},              // 원두 g · 물 g · 온도 · 분쇄
    steps:e.steps.slice(),
    picks,
    ...(Object.keys(cupA).length?{aroma_types:cupA}:{}),...(Object.keys(cupI).length?{issues:cupI}:{}),...(e.conf?{confidence:e.conf}:{}),
    memo:(e.memo||'').trim(),
    tournament_id:e.tournament_id||null,
    round:e.round||1,
    keep:old?old.keep||'':'',
    created_at:old?old.created_at:Date.now(),
    updated_at:Date.now(),
  };
  if(!rec.tournament_id)rec.tournament_id=rec.id;
  if(e.planRef&&!old){rec.plan_date=e.planRef.date;rec.plan_no=e.planRef.idx+1;if(typeof cpMarkDone==='function')cpMarkDone(e.planRef,rec.id);}  // 커핑 계획 완료
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
  ${rec.blind_mode==='self'?`<div class="ec-done-seat">1번 자리 = ${ecEsc(ecShort(rec[rec.blind_order[0]].bean)+' '+ecVariant(rec[rec.blind_order[0]]))} (${rec.blind_order[0]})<br>2번 자리 = ${ecEsc(ecShort(rec[rec.blind_order[1]].bean)+' '+ecVariant(rec[rec.blind_order[1]]))} (${rec.blind_order[1]})</div>`
    :rec.blind&&rec.blind_order?`<div class="ec-hint">블라인드 정답: 1번 컵 = ${rec.blind_order[0]}, 2번 컵 = ${rec.blind_order[1]}</div>`:''}</div>
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
  const bm=r.blind_mode||(r.blind?'app':'none');
  _ec={editId:r.id,date:r.date,A:strip(r.A),B:strip(r.B),blindMode:bm,blind:bm==='app',order:r.blind_order||['A','B'],revealed:true,seat1:r.seat1||'',
       settings:{...(r.settings||{})},t0:null,stageNow:0,
       cupAroma:{...(r.aroma_types||{})},cupIssue:{...(r.issues||{})},conf:r.confidence||'',
       steps:EC_STAGES.map((x,i)=>!!(r.steps||[])[i]),picks:{aroma:'',acid:'',sweet:'',after:'',green:'',final:'',...r.picks},memo:r.memo||'',tournament_id:r.tournament_id,round:r.round||1,keep:r.keep||''};
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
    <div class="ec-hint" style="margin-bottom:10px">쉬운 커핑 기록은 이 휴대폰에 저장되고, 동기화 시트에도 사본이 올라가요. 가끔 백업 파일도 받아 두세요.</div>
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
  ['블라인드방식',r=>({self:'혼자 섞기',app:'앱이 섞기',none:'없음'})[r.blind_mode||(r.blind?'app':'none')]],
  ['원두g',r=>(r.settings||{}).coffee_g],['물g',r=>(r.settings||{}).water_g],['물온도',r=>(r.settings||{}).temp],['분쇄',r=>(r.settings||{}).grind],
  ['향',r=>ecPickWord(r.picks.aroma)],['산미',r=>ecPickWord(r.picks.acid)],['단맛',r=>ecPickWord(r.picks.sweet)],['뒷맛',r=>ecPickWord(r.picks.after)],['풋내떫은맛',r=>ecPickWord(r.picks.green)],
  ['A_향종류',r=>((r.aroma_types||{}).A||[]).join('·')],['B_향종류',r=>((r.aroma_types||{}).B||[]).join('·')],['A_문제',r=>((r.issues||{}).A||[]).join('·')],['B_문제',r=>((r.issues||{}).B||[]).join('·')],
  ['최종',r=>r.picks.final==='same'?'비김':r.picks.final],['확신도',r=>r.confidence],['비김후남김',r=>r.keep],
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

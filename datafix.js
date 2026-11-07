// datafix.js — 로스팅↔생두 ID 연결, 로스팅 계산값, 한 번만 하는 데이터 정리 · 2026-11-06

/* 로스팅 기록의 생두: bean_id(생두 목록 ID)가 기준. 옛 기록은 이름으로 찾음 */
function beanOfRoast(r){
  if(!r)return null;
  if(r.bean_id){const b=db.beans.find(x=>x.id===r.bean_id);if(b)return b;}
  return db.beans.find(x=>x.name===r.bean_name)||null;
}
/* 배치 보관 상태 (2026-11-07): '' = 내가 보유, 'gift' = 지인 나눔, 'done' = 다 마심 */
const ROAST_STOCK_STATES=[{v:'',l:'보유'},{v:'gift',l:'🎁 나눔'},{v:'done',l:'다 마심'}];
function roastHeld(r){return !r||!r.stock_state;}
function roastStateLabel(v){const x=ROAST_STOCK_STATES.find(s=>s.v===(v||''));return x?x.l:'';}
function setRoastState(id,v){
  const r=(db.roasts||[]).find(x=>x.id===id);if(!r)return;
  r.stock_state=r.stock_state===v?'':v;
  saveDB();
  try{if(document.getElementById('tab-roasts').classList.contains('on'))renderRoasts();}catch(e){}
  try{renderDash();}catch(e){}
}
/* 로스팅 기록 → 커피 한 잔 (이 배치가 골라진 상태로) */
function roastToCup(id){
  const r=(db.roasts||[]).find(x=>x.id===id);if(!r)return;
  const tb=[...document.querySelectorAll('.tb')].find(t=>(t.getAttribute('onclick')||'').includes("'dailycup'"));
  if(tb)showTab('dailycup',tb);
  if(!_dc||_dc.editId)dcNew();
  dcSelect(dcSnapFromRoast(r));window.scrollTo(0,0);
}
/* ✏️ 원두별 최적 숙성(디개싱) 기간 (일). 위에서부터 먼저 맞는 규칙. 생두/원두에 직접 넣은 값(rest_min·rest_max)이 있으면 그게 우선 */
const REST_RULES=[
  {label:'게이샤',                 min:14, max:28, test:x=>/게이샤|geisha|gesha/i.test((x.name||'')+' '+(x.variety||''))},
  {label:'케냐·에티오피아 워시드', min:7,  max:21, test:x=>/케냐|에티오피아|kenya|ethiopia/i.test((x.origin||'')+' '+(x.name||''))&&/wash|워시드/i.test((x.process||'')+' '+(x.name||''))},
];
const REST_DEFAULT={label:'기본', min:7, max:21};
function restWindow(x){
  if(!x)return {...REST_DEFAULT};
  const mn=parseInt(x.rest_min),mx=parseInt(x.rest_max);
  const rule=REST_RULES.find(r=>r.test(x))||REST_DEFAULT;
  if(mn>0||mx>0)return {label:x.roastery!==undefined?'로스터리 권장':'직접 지정',min:mn>0?mn:rule.min,max:mx>0?mx:rule.max,own:true};
  return {label:rule.label,min:rule.min,max:rule.max};
}
/* 디개싱 단계: 최적기 전 = 숙성 중(n일 남음) / 최적기 / 지남 */
function restStage(days,w){
  if(days==null)return {l:'',c:'var(--muted)',o:9};
  if(days<w.min)return {l:`숙성 중 · ${w.min-days}일 남음`,c:'var(--amber)',o:1,wait:w.min-days};
  if(days<=w.max)return {l:'최적기',c:'#7ed6a5',o:0};
  if(days<=w.max+14)return {l:'최적기 지남',c:'var(--muted2)',o:2};
  return {l:'오래됨',c:'var(--coral)',o:3};
}
function roastOfBean(r,b){return r.bean_id?r.bean_id===b.id:r.bean_name===b.name;}

/* 1팝 경과·총 로스팅시간 (모드 자동배출 − 잔여) → "m:ss" */
function roastTimes(r){
  const ae=BINBON_MODES[+r.mode];
  const sec=t=>{if(!t)return null;const p=String(t).split(':');return p.length===2?(+p[0])*60+(+p[1]):null;};
  const f=s=>s==null||s<0?'':Math.floor(s/60)+':'+String(Math.round(s%60)).padStart(2,'0');
  if(!ae)return {pop_elapsed:'',total_time:''};
  let pr=sec(r.pop_time),er=sec(r.eject_time);
  if(r.time_basis==='진행'){pr=pr!=null?ae-pr:null;er=er!=null?ae-er:null;}
  if(er!=null&&+r.eject_over_s)er-=+r.eject_over_s;   // 자동배출 뒤 n초에 뺀 경우
  return {pop_elapsed:pr!=null?f(ae-pr):'',total_time:er!=null?f(ae-er):''};
}
/* 계산값이 없는 로스팅 기록에 채우기 (바뀐 게 있으면 true) */
function backfillRoastTimes(){
  let n=0;
  (db.roasts||[]).forEach(r=>{
    const t=roastTimes(r);
    if(t.pop_elapsed&&r.pop_elapsed!==t.pop_elapsed){r.pop_elapsed=t.pop_elapsed;n++;}
    if(t.total_time&&r.total_time!==t.total_time){r.total_time=t.total_time;n++;}
    if(!r.bean_id){const b=db.beans.find(x=>x.name===r.bean_name);if(b){r.bean_id=b.id;n++;}}
  });
  return n>0;
}

/* ── 2026-11-06 한 번만: 사용자 요청 데이터 정리 ── */
const MIGRATION_20261106='fix-20261106';
function migrate20261106(){
  if(!db||!Array.isArray(db.beans))return false;
  db.migrations=db.migrations||[];
  if(db.migrations.includes(MIGRATION_20261106))return false;
  const B=id=>db.beans.find(b=>b.id===id);
  const link=(roastPred,beanId)=>{const b=B(beanId);if(!b)return;db.roasts.filter(roastPred).forEach(r=>{r.bean_id=b.id;r.bean_name=b.name;if(!r.shop)r.shop=b.shop||'';});};
  // ① 레리다 카스카다 #0486: 100g 샘플(112) = 1차 샘플, 1kg(14) = 2차. 로스팅 "…카스카다 0486" → 샘플
  [['112','1차 샘플'],['14','2차']].forEach(([id,lot])=>{const b=B(id);if(b){b.group_name='파나마 핀카레리다 게이샤 내추럴 카스카다 #0486';b.lot_label=lot;}});
  link(r=>r.bean_name==='파나마 핀카레리다 게이샤 내추럴 카스카다 0486','112');
  // ② 카구모: 2026 = 1차, 10/9 구매 = 2차
  [['5','1차'],['mv1wir3tnhd','2차']].forEach(([id,lot])=>{const b=B(id);if(b){b.group_name='케냐 카구모 AA';b.lot_label=lot;}});
  // ③ 라 노리아 lot2 로스팅 → 생두 "에콰도르 라 노리아 그린 게샤 Lot2 더블발효 워시드", 원산지 에콰도르
  link(r=>r.bean_name==='에콰도르 라 노리아 게이샤 무산소 워시드 lot2','17');
  if(B('17')&&!B('17').origin)B('17').origin='에콰도르';
  // ④ 100g 봉투 가격 → 만원/kg (×10): 라 노리아, 라 살바헤, 칼라카, 레리다 블랙허니, 레리다 0486 샘플, 알로 타미루
  ['17','18','106','111','112','10'].forEach(id=>{const b=B(id);if(b&&parseFloat(b.price)>0){b.price=String(+(parseFloat(b.price)*10).toFixed(2));if(!b.stock_initial)b.stock_initial='100';}});
  // ⑤ 재고 있음으로
  ['mszyenvj8ll','mszyic8wko7','mszymug740d'].forEach(id=>{const b=B(id);if(b)b.status='재고있음';});
  db.migrations.push(MIGRATION_20261106);
  return true;
}

/* ── 2026-11-06 두 번째 (사용자 확인: 추정대로 연결) ──
   KWAMI 2025 허니(5/21) → 생두 9, 나리뇨 버번치로소(5/20) → 생두 11.
   "파나마 핀카레리다 게이샤 내추럴"(5/21)은 후보가 둘(14 / 112)이라 연결 안 함 */
const MIGRATION_20261106B='fix-20261106b';
function migrate20261106b(){
  if(!db||!Array.isArray(db.beans))return false;
  db.migrations=db.migrations||[];
  if(db.migrations.includes(MIGRATION_20261106B))return false;
  const link=(name,beanId)=>{const b=db.beans.find(x=>x.id===beanId);if(!b)return;
    db.roasts.filter(r=>r.bean_name===name&&!r.bean_id).forEach(r=>{r.bean_id=b.id;r.bean_name=b.name;if(!r.shop)r.shop=b.shop||'';});};
  link('에티오피아 KWAMI 2025 허니','9');
  link('콜롬비아 나리뇨 버번치로소 워시드','11');
  db.migrations.push(MIGRATION_20261106B);
  return true;
}

/* ── 2026-11-06 세 번째 (사용자: 샘플과 1kg은 다른 생두로) ──
   레리다 카스카다 0486 샘플(112)과 카스카다 2025m #0486 1kg(14)의 묶음(group_name·lot_label)을 풂.
   로스팅 연결(샘플 로스팅 → 112)은 그대로 */
const MIGRATION_20261106C='fix-20261106c';
function migrate20261106c(){
  if(!db||!Array.isArray(db.beans))return false;
  db.migrations=db.migrations||[];
  if(db.migrations.includes(MIGRATION_20261106C))return false;
  ['112','14'].forEach(id=>{const b=db.beans.find(x=>x.id===id);if(b){delete b.group_name;delete b.lot_label;}});
  db.migrations.push(MIGRATION_20261106C);
  return true;
}

/* ── 2026-11-06 네 번째: 기존 생두에 수분율 10.0 / 밀도 700 기본값 (입력 여부는 '안 함') ── */
const MIGRATION_20261106D='fix-20261106d';
function migrate20261106d(){
  if(!db||!Array.isArray(db.beans))return false;
  db.migrations=db.migrations||[];
  if(db.migrations.includes(MIGRATION_20261106D))return false;
  db.beans.forEach(b=>{
    if(b.moisture==null||b.moisture===''){b.moisture=10.0;b.moisture_set=false;}
    if(b.density==null||b.density===''){b.density=700;b.density_set=false;}
  });
  db.migrations.push(MIGRATION_20261106D);
  return true;
}

/* 로스팅 단계 기준(roasts.js ROAST_LEVELS)이 바뀌었으면 DTR 있는 기록을 새 기준으로 다시 지정.
   DTR 없는 기록은 폼에서 고른 단계 그대로 */
function roastDTRValue(r){
  let d=parseFloat(r.dtr_pct);if(d>0)return d;
  const ae=BINBON_MODES[+r.mode];
  const sec=t=>{if(!t)return null;const p=String(t).split(':');return p.length===2?(+p[0])*60+(+p[1]):null;};
  let ps=sec(r.pop_time),es=sec(r.eject_time);
  if(!ae||ps==null||es==null)return null;
  if(r.time_basis==='진행'){ps=ae-ps;es=ae-es;}
  if(+r.eject_over_s)es-=+r.eject_over_s;
  return ps>es&&ae-es>0?(ps-es)/(ae-es)*100:null;
}
function reapplyRoastLevels(){
  if(typeof roastLevelRule!=='function'||!db||!Array.isArray(db.roasts))return false;
  const rule=roastLevelRule();
  if(db.level_rule===rule)return false;
  db.roasts.forEach(r=>{const d=roastDTRValue(r);if(d!=null)r.roast_level=dtrToLevel(d);});  // 8% 미만이면 비움
  db.level_rule=rule;
  return true;
}

/* 구매량이 들어갔는데 상태가 '재고량미입력'으로 남은 생두 → '재고있음' (2026-11-07, 매번 확인) */
function fixStockStatus(){
  let n=0;
  (db.beans||[]).forEach(b=>{if(b.status==='재고량미입력'&&parseFloat(b.stock_initial)>0){b.status='재고있음';n++;}});
  return n>0;
}

/* ── 2026-11-07 한 번만: 알로 타미루(10)는 1kg 구매였음(사용자 확인) → 11/6에 ×10 한 가격 되돌림 (41.5 → 4.15) ── */
const MIGRATION_20261107B='fix-20261107b';
function migrate20261107b(){
  if(!db||!Array.isArray(db.beans))return false;
  db.migrations=db.migrations||[];
  if(db.migrations.includes(MIGRATION_20261107B))return false;
  const b=db.beans.find(x=>x.id==='10');
  if(b&&Math.abs(parseFloat(b.price)-41.5)<0.001)b.price='4.15';   // 그 사이 직접 고친 값이면 건드리지 않음
  db.migrations.push(MIGRATION_20261107B);
  return true;
}

/* ── 2026-11-07 한 번만: 타이머 목표대로 뺀 기존 기록 → 목표 DTR 정수로 (사용자 요청) ──
   배출 시각이 '정수 DTR로 계산한 타이머 배출 시각'과 초 단위까지 같으면 목표대로 뺀 것으로 봄 */
const MIGRATION_20261107D='fix-20261107d';
function migrate20261107d(){
  if(!db||!Array.isArray(db.roasts))return false;
  db.migrations=db.migrations||[];
  if(db.migrations.includes(MIGRATION_20261107D))return false;
  const sec=t=>{if(!t)return null;const p=String(t).split(':');return p.length===2?(+p[0])*60+(+p[1]):null;};
  db.roasts.forEach(r=>{
    if(r.dtr_source)return;
    const ae=BINBON_MODES[+r.mode];let pr=sec(r.pop_time),er=sec(r.eject_time);
    if(!ae||pr==null||er==null)return;
    if(r.time_basis==='진행'){pr=ae-pr;er=ae-er;}
    const pe=ae-pr,calc=(pr-er)/(ae-er)*100;
    let best=null;
    for(let t=5;t<=40;t++){const ej=Math.round(pe/(1-t/100));if(ae-ej===er&&(best==null||Math.abs(t-calc)<Math.abs(best-calc)))best=t;}
    if(best!=null){r.dtr_pct=String(best);r.dtr_target=String(best);r.dtr_source='target';const l=dtrToLevel(best);r.roast_level=l;}
    else r.dtr_source='time';
  });
  db.migrations.push(MIGRATION_20261107D);
  return true;
}

/* ── 2026-11-07 한 번만: 엘 오브라헤 옛 가짜 팝 3건 표시 (다시 볶을 때 주의용) ──
   5/29 #6: 기록된 1팝(2:13)이 가짜 → 가짜 시점으로, 예상 계산에서 뺌 / 5/29 #7: 2분 초반 가짜 팝 / 9/3 #9: 1차 팝 오류 → 예상 계산에서 뺌 */
const MIGRATION_20261107E='fix-20261107e';
function migrate20261107e(){
  if(!db||!Array.isArray(db.roasts))return false;
  db.migrations=db.migrations||[];
  if(db.migrations.includes(MIGRATION_20261107E))return false;
  const f=(date,no)=>db.roasts.find(r=>r.date===date&&String(r.batch_no)===String(no)&&/오브라헤/.test(r.bean_name||''));
  const a=f('2026-05-29',6);if(a){a.false_pop=true;a.false_pop_times=a.false_pop_times||[a.pop_time||'2:13'];a.pop_unreliable=true;}
  const b=f('2026-05-29',7);if(b){b.false_pop=true;b.false_pop_note='2분 초반';}
  const c=f('2026-09-03',9);if(c){c.false_pop=true;c.pop_unreliable=true;c.false_pop_note='1차 팝 오류';}
  db.migrations.push(MIGRATION_20261107E);
  return true;
}

/* ── 2026-11-07 한 번만: 그 전 로스팅의 배출 무게는 정전기로 부정확했을 가능성 (사용자) ── */
const MIGRATION_20261107G='fix-20261107g';
function migrate20261107g(){
  if(!db||!Array.isArray(db.roasts))return false;
  db.migrations=db.migrations||[];
  if(db.migrations.includes(MIGRATION_20261107G))return false;
  db.roasts.forEach(r=>{if((r.date||'')<'2026-11-07'&&r.output_g)r.weight_unreliable=true;});
  db.migrations.push(MIGRATION_20261107G);
  return true;
}

/* 앱 열 때(동기화 뒤) 한 번 실행 — 바뀐 게 있으면 한 번만 저장 */
function runDataFixes(){
  let changed=false;
  try{changed=migrate20261106()||changed;}catch(e){console.warn('데이터 정리 실패',e);}
  try{changed=migrate20261106b()||changed;}catch(e){console.warn('데이터 정리 2 실패',e);}
  try{changed=migrate20261106c()||changed;}catch(e){console.warn('데이터 정리 3 실패',e);}
  try{changed=migrate20261106d()||changed;}catch(e){console.warn('데이터 정리 4 실패',e);}
  try{changed=migrate20261107b()||changed;}catch(e){console.warn('알로 가격 되돌리기 실패',e);}
  try{changed=migrate20261107d()||changed;}catch(e){console.warn('목표 DTR 정리 실패',e);}
  try{changed=migrate20261107e()||changed;}catch(e){console.warn('가짜 팝 표시 실패',e);}
  try{changed=migrate20261107g()||changed;}catch(e){console.warn('무게 표시 실패',e);}
  try{changed=backfillRoastTimes()||changed;}catch(e){console.warn('로스팅 계산값 채우기 실패',e);}
  try{changed=reapplyRoastLevels()||changed;}catch(e){console.warn('로스팅 단계 다시 지정 실패',e);}
  try{changed=fixStockStatus()||changed;}catch(e){console.warn('재고 상태 정리 실패',e);}
  if(changed){saveDB();try{renderBeans();}catch(e){}try{renderDash();}catch(e){}}
}

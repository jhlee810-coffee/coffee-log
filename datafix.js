// datafix.js — 로스팅↔생두 ID 연결, 로스팅 계산값, 한 번만 하는 데이터 정리 · 2026-11-06

/* 로스팅 기록의 생두: bean_id(생두 목록 ID)가 기준. 옛 기록은 이름으로 찾음 */
function beanOfRoast(r){
  if(!r)return null;
  if(r.bean_id){const b=db.beans.find(x=>x.id===r.bean_id);if(b)return b;}
  return db.beans.find(x=>x.name===r.bean_name)||null;
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

/* 앱 열 때(동기화 뒤) 한 번 실행 — 바뀐 게 있으면 한 번만 저장 */
function runDataFixes(){
  let changed=false;
  try{changed=migrate20261106()||changed;}catch(e){console.warn('데이터 정리 실패',e);}
  try{changed=backfillRoastTimes()||changed;}catch(e){console.warn('로스팅 계산값 채우기 실패',e);}
  if(changed){saveDB();try{renderBeans();}catch(e){}try{renderDash();}catch(e){}}
}

function renderBeans(){
  const origins=[...new Set(db.beans.map(b=>b.origin).filter(Boolean))];
  const shops=[...new Set(db.beans.map(b=>b.shop).filter(Boolean))];
  const varieties=[...new Set(db.beans.map(b=>b.variety).filter(Boolean))];
  const fc=(key,lbl)=>`<div class="fc ${cf===key?'on':''}" onclick="setF('${key}')">${lbl}</div>`;
  document.getElementById('originFilters').innerHTML=
    fc('all','전체')+
    (origins.length?`<span class="flabel">원산지</span>`+origins.map(o=>fc(`origin:${o}`,o)).join(''):'')+
    (shops.length?`<span class="flabel">구매처</span>`+shops.map(s=>fc(`shop:${s}`,s)).join(''):'')+
    (varieties.length?`<span class="flabel">품종</span>`+varieties.map(v=>fc(`variety:${v}`,v)).join(''):'');
  let beans=db.beans;
  if(cf!=='all'){
    if(cf.startsWith('origin:')){const val=cf.slice(7);beans=beans.filter(b=>b.origin===val);}
    else if(cf.startsWith('shop:')){const val=cf.slice(5);beans=beans.filter(b=>b.shop===val);}
    else if(cf.startsWith('variety:')){const val=cf.slice(8);beans=beans.filter(b=>b.variety===val);}
    else beans=beans.filter(b=>b.origin===cf);
  }
  if(cs){const q=cs.toLowerCase();beans=beans.filter(b=>(b.name+b.origin+(b.variety||'')+(b.cup_notes||'')+(b.shop||'')).toLowerCase().includes(q));}
  // 소진 생두는 맨 아래로 (그 외 순서는 그대로)
  beans=beans.filter(b=>b.status!=='소진').concat(beans.filter(b=>b.status==='소진'));
  renderStockFillBanner();
  document.getElementById('beanCards').innerHTML=beans.map(beanCard).join('')||
    '<div class="empty"><div class="empty-icon">🫘</div><div class="empty-text">생두가 없습니다</div></div>';
}

function beanCard(b){
  const oc=ORIGIN_COLORS[b.origin]||'var(--teal)';
  const isSogin=b.status==='소진';
  const isSample=b.status==='샘플';
  const isDimmed=isSogin||isSample;
  const bc=isSogin?'var(--coral)':isSample?'var(--amber)':oc;
  const price=b.price?Math.round(parseFloat(b.price)):'';
  const dateStr=b.stock_date?b.stock_date.slice(2,4)+'.'+b.stock_date.slice(5,7):'—';
  const metaParts=[b.shop||'—'];
  if(price) metaParts.push(String(price));
  metaParts.push(dateStr);
  const meta=metaParts.join('  ');
  const sc=b.score_momos||b.score_wonderroom||'';
  return`<div class="bcard${isDimmed?' sogin':''}" style="border-top-color:${bc}" onclick="showBeanDetail('${b.id}')">
    <div class="bog" style="color:${bc}">${b.origin||'—'}</div>
    <div class="bnm">${b.name}</div>
    <div class="bsub">${[b.variety,b.process].filter(Boolean).join(' · ')||'&nbsp;'}</div>
    ${b.cup_notes?`<div class="bnote">${b.cup_notes}</div>`:''}
    ${(()=>{if(isSogin)return'';const u=beanUsage(b);if(!u.count&&u.remaining===null)return'';
      const parts=[];if(u.remaining!==null)parts.push(`잔량 ≈ ${Math.max(0,Math.round(u.remaining))}g`);if(u.count)parts.push(`로스팅 ${u.count}회`);
      return`<div class="bstock${u.remaining!==null&&u.remaining<SOLDOUT_REMAIN_G?' low':''}">${parts.join(' · ')}</div>`;})()}
    ${db.roasts.some(r=>roastOfBean(r,b))?`<button class="dc-open" onclick="event.stopPropagation();openDailyCupFor('${b.id}')">☕ 한 잔 기록</button>`:''}
    <div class="bfoot">
      <span class="bfmeta">${meta}</span>
      <span style="display:flex;align-items:center;gap:6px">
        ${isSogin?'<span class="sogin-bdg">소진</span>':''}
        ${isSample?'<span class="sample-bdg">샘플</span>':''}
        ${sc?`<span class="bfscore">★ ${sc}</span>`:''}
      </span>
    </div>
  </div>`;
}

function setF(f){cf=f;renderBeans();}
function filterBeans(q){cs=q;renderBeans();}

function showBeanDetail(id){
  const b=db.beans.find(x=>x.id===id);if(!b)return;
  const rc=db.roasts.filter(r=>roastOfBean(r,b)).length;
  const bl=db.brewlogs.filter(r=>r.bean_name===b.name).length;
  document.getElementById('bdName').textContent=b.name;
  document.getElementById('bdContent').innerHTML=`
    <div class="ds"><div class="dstitle">기본 정보</div>
      ${dr('원산지',b.origin)}${dr('지역/농장',b.region)}${dr('품종',b.variety)}
      ${dr('가공방식',b.process)}${dr('고도',b.altitude?(b.altitude+'m'):'')}
      ${dr('구매처',b.shop)}${dr('가격',b.price?(b.price+'만원/kg'):'')}
      ${dr('초기재고',b.stock_initial?(b.stock_initial+'g'):'')}${dr('상태',b.status)}
    </div>
    ${(b.score_momos||b.score_wonderroom)?`<div class="ds"><div class="dstitle">스코어</div>${dr('모모스',b.score_momos)}${dr('원더룸',b.score_wonderroom)}</div>`:''}
    ${b.cup_notes?`<div class="ds"><div class="dstitle">컵노트</div><div style="font-family:'Playfair Display',serif;font-size:13px;color:var(--muted2);line-height:1.7;font-style:italic">${b.cup_notes}</div></div>`:''}
    <div class="ds"><div class="dstitle">기록</div>${dr('로스팅',rc+'회')}${dr('브루잉',bl+'회')}${dr('커핑',getCuppingsForBean(b.name).length+'회')}</div>
    ${(()=>{const cs=getCuppingsForBean(b.name);return cs.length?`<div class="ds"><div class="dstitle">커핑 히스토리</div>${cuppingMiniHtml(cs,b.name)}</div>`:''})()}
    <div style="display:flex;gap:8px;margin-top:4px">
      <button class="btn2" onclick="editBean('${b.id}');closeMo('moBeanDetail')">수정</button>
      <button class="btnd" onclick="deleteBean('${b.id}')">삭제</button>
    </div>`;
  openMo('moBeanDetail');
}

/* ── 소진 추정 + 앱 실행 시 확인 (2026-11-04) ──
   구매량(stock_initial)이 있으면: 잔량 = 구매량 − 로스팅 투입량 합계 → 120g 미만이면 확인 (120g 미만 남은 건 같은 산지 생두에 섞어 처분하는 습관 반영)
   구매량이 없으면: 로스팅 8회 이상이면 확인
   "아직 있음" 답하면 soldout_skip_used(그때까지의 투입량)를 저장 → 이후 로스팅이 더 생기기 전까진 다시 안 물음 */
const SOLDOUT_REMAIN_G=120, SOLDOUT_MIN_COUNT=8, DEFAULT_INPUT_G=120;
function beanUsage(b){
  const rs=(db.roasts||[]).filter(r=>roastOfBean(r,b));
  const used=rs.reduce((s,r)=>s+(parseFloat(r.input_g)||DEFAULT_INPUT_G),0);
  const init=parseFloat(b.stock_initial);
  return {count:rs.length,used,remaining:init>0?init-used:null};
}
function soldOutCandidates(){
  return db.beans.filter(b=>{
    if(b.status==='소진')return false;
    const u=beanUsage(b);
    if(b.soldout_skip_used!=null&&u.used<=+b.soldout_skip_used)return false;
    return u.remaining!==null?u.remaining<SOLDOUT_REMAIN_G:u.count>=SOLDOUT_MIN_COUNT;
  });
}
let soldOutChecked=false;
function checkSoldOutCandidates(){
  if(soldOutChecked)return;soldOutChecked=true;  // 앱 실행당 1번
  const list=soldOutCandidates();
  if(!list.length)return;
  let mo=document.getElementById('moSoldOut');
  if(!mo){
    mo=document.createElement('div');mo.className='mo';mo.id='moSoldOut';
    mo.innerHTML=`<div class="mbox"><div class="mtitle">🫘 소진 확인</div>
      <div style="font-size:13px;color:var(--text2);margin-bottom:12px">로스팅 기록상 거의 다 쓴 것 같은 생두예요. 소진됐나요?</div>
      <div id="soldOutList"></div>
      <div class="fa"><button class="btn2" onclick="closeMo('moSoldOut')">나중에</button></div></div>`;
    document.body.appendChild(mo);
  }
  document.getElementById('soldOutList').innerHTML=list.map(b=>{
    const u=beanUsage(b);
    const why=u.remaining!==null
      ?`구매 ${Math.round(+b.stock_initial)}g − 사용 ${Math.round(u.used)}g = 잔량 ≈ ${Math.max(0,Math.round(u.remaining))}g`
      :`로스팅 ${u.count}회 (사용 ≈ ${Math.round(u.used)}g, 구매량 미입력)`;
    return`<div class="so-row" id="so_${b.id}">
      <div class="so-name">${b.name}</div><div class="so-why">${why}</div>
      <div class="so-btns"><button class="btn btn-sm" onclick="answerSoldOut('${b.id}',true)">소진 처리</button>
      <button class="btn2" onclick="answerSoldOut('${b.id}',false)">아직 있음</button></div></div>`;
  }).join('');
  openMo('moSoldOut');
}
function answerSoldOut(id,soldOut){
  const b=db.beans.find(x=>x.id===id);if(!b)return;
  if(soldOut){b.status='소진';delete b.soldout_skip_used;}
  else b.soldout_skip_used=beanUsage(b).used;
  saveDB();
  const row=document.getElementById('so_'+id);
  if(row)row.innerHTML=`<div class="so-name">${b.name}</div><div class="so-why">${soldOut?'✓ 소진 처리됨':'✓ 보유 중으로 표시 — 다음 로스팅 후 다시 확인'}</div>`;
  try{renderBeans();}catch(e){}try{renderDash();}catch(e){}
  if(!soldOutCandidates().length)setTimeout(()=>closeMo('moSoldOut'),900);
}

/* ── 구매량: 보통 1kg, 좋은 생두는 2~5kg (2026-11-04) ── */
const KG_OPTS=[0.1,0.5,1,2,3];  // 구매량 칩 (kg) — 100g/500g/1kg/2kg/3kg, 그 밖은 칸에 직접 입력
function kgLabel(k){return k<1?Math.round(k*1000)+'g':k+'kg';}
/* 결제 금액(원) + 구매량(g) → 만원/kg 자동 계산 */
function calcBeanPrice(){
  const pay=parseFloat(String(document.getElementById('f_bpay').value).replace(/[^0-9.]/g,''));
  const g=parseFloat(document.getElementById('f_bst').value);
  const hint=document.getElementById('f_bprHint');
  if(pay>0&&g>0){
    const v=+(pay/10000/(g/1000)).toFixed(2);
    document.getElementById('f_bpr').value=v;
    if(hint)hint.textContent=`${Math.round(pay).toLocaleString()}원 ÷ ${g>=1000?(g/1000)+'kg':g+'g'} = ${v}만원/kg`;
  }else if(hint)hint.textContent='결제 금액과 구매량을 넣으면 자동 계산';
}
function renderKgBtns(){
  const v=parseFloat(document.getElementById('f_bst').value);
  document.getElementById('kgBtns').innerHTML=KG_OPTS.map(k=>
    `<button type="button" class="${v===k*1000?'on':''}" onclick="document.getElementById('f_bst').value='${k*1000}';renderKgBtns();calcBeanPrice()">${kgLabel(k)}</button>`).join('');
}

/* ── 구매량 미입력 생두 한 번에 입력 ── */
function stockMissingBeans(){
  const miss=db.beans.filter(b=>!(parseFloat(b.stock_initial)>0));
  return miss.filter(b=>b.status!=='소진').concat(miss.filter(b=>b.status==='소진'));
}
function renderStockFillBanner(){
  const el=document.getElementById('stockFillBanner');if(!el)return;
  const n=stockMissingBeans().length;
  el.innerHTML=n?`<div class="sf-banner" onclick="openStockFill()">📦 구매량 미입력 생두 <b>${n}개</b> — 한 번에 입력하기 ›</div>`:'';
}
function openStockFill(){
  let mo=document.getElementById('moStockFill');
  if(!mo){
    mo=document.createElement('div');mo.className='mo';mo.id='moStockFill';
    mo.innerHTML=`<div class="mbox"><div class="mtitle">📦 구매량 입력</div>
      <div style="font-size:13px;color:var(--text2);margin-bottom:8px">구매했던 양을 탭하면 바로 저장돼요.</div>
      <div id="stockFillList"></div>
      <div class="fa"><button class="btn btn-sm" onclick="closeStockFill()">완료</button></div></div>`;
    document.body.appendChild(mo);
  }
  const list=stockMissingBeans();
  document.getElementById('stockFillList').innerHTML=list.map(b=>`<div class="so-row" id="sf_${b.id}">${stockFillRow(b)}</div>`).join('')
    ||'<div class="so-why">구매량이 비어 있는 생두가 없어요 👍</div>';
  openMo('moStockFill');
}
function stockFillRow(b,justSet){
  const u=beanUsage(b);
  const info=[u.count?`로스팅 ${u.count}회 · 사용 ≈ ${Math.round(u.used)}g`:'로스팅 기록 없음',b.status||'상태 없음'].join(' · ');
  const done=justSet?`<div class="so-why" style="color:var(--amber)">✓ ${justSet/1000}kg 저장 · 잔량 ≈ ${Math.max(0,Math.round(u.remaining))}g${u.remaining<SOLDOUT_REMAIN_G&&b.status!=='소진'?' (거의 다 씀 → 완료 후 소진 확인)':''}</div>`:'';
  return`<div class="so-name">${b.name}${b.status==='소진'?' <span class="sogin-bdg">소진</span>':''}</div>
    <div class="so-why">${info}</div>${done}
    <div class="alt-seg sf-kg">${KG_OPTS.map(k=>`<button type="button" class="${+b.stock_initial===k*1000?'on':''}" onclick="setStockFill('${b.id}',${k*1000})">${kgLabel(k)}</button>`).join('')}
      <button type="button" onclick="setStockFill('${b.id}',null)">직접</button></div>`;
}
function setStockFill(id,g){
  const b=db.beans.find(x=>x.id===id);if(!b)return;
  if(g===null){
    const s=prompt('구매량을 입력하세요 (예: 1500 또는 1.5kg)','')||'';
    const m=s.match(/\d+(\.\d+)?/);if(!m)return;
    let v=parseFloat(m[0]);if(/kg/i.test(s))v=Math.round(v*1000);
    if(!(v>0))return;g=v;
  }
  b.stock_initial=String(g);
  if(!b.status||b.status==='재고량미입력')b.status='재고있음';
  saveDB();
  document.getElementById('sf_'+id).innerHTML=stockFillRow(b,g);
}
function closeStockFill(){
  closeMo('moStockFill');
  try{renderBeans();}catch(e){}
  // 입력한 구매량으로 거의 다 쓴 생두가 생겼으면 바로 소진 확인
  soldOutChecked=false;checkSoldOutCandidates();
}

/* ── 생두 등록 폼: 직접 입력 대신 고르는 항목들 (2026-11-04) ── */
const BEAN_ORIGINS={
  '아프리카':['에티오피아','케냐','르완다','부룬디','탄자니아','우간다','말라위','잠비아','콩고민주공화국','짐바브웨','카메룬'],
  '중미·카리브':['과테말라','온두라스','엘살바도르','니카라과','코스타리카','파나마','멕시코','자메이카','도미니카공화국','쿠바','아이티'],
  '남미':['콜롬비아','에콰도르','페루','볼리비아','브라질','베네수엘라'],
  '아시아·태평양':['예멘','인도네시아','인도','베트남','태국','미얀마','라오스','중국','대만','필리핀','동티모르','파푸아뉴기니','하와이','네팔'],
};
const BEAN_PROCESSES={
  '워시드':['Washed','Fully Washed','Double Fermentation Washed','Anaerobic Washed','Semi Washed','Wet Hulled'],
  '내추럴':['Natural','Anaerobic Natural','Natural Cascada','Carbonic Maceration','Thermal Shock'],
  '허니':['Honey','Classic Honey','White Honey','Yellow Honey','Red Honey','Black Honey','Pulped Natural'],
};
const BEAN_SHOPS=['모모스','커피리브레','세웅지씨','뉴빈','씨에이치빈','커만사','엠아이커피','모지포그라운드','더블유빈'];
const BEAN_VARIETIES=['게이샤','SL28','SL34','Ruiru11','Batian','Heirloom','74110','74112','74158','Kurume','버번','레드 버번','핑크 버번','옐로 버번','시드라','티피카','카투라','카투아이','파카마라','파카스','마라고지페','카스티요','Bourbon Chiroso'];
// ✏️ 컵노트 고르기 목록 (묶음 순서 = 화면 순서). 여기에 넣으면 생두·원두 폼 모두에 나옴
const CUPNOTE_GROUPS={
  '꽃':['자스민','장미','라벤더','오렌지꽃','아카시아','히비스커스','카모마일','엘더플라워','목련','백합','인동꽃','제비꽃','플로럴'],
  '시트러스':['레몬','라임','오렌지','블러드오렌지','자몽','귤','만다린','탠저린','유자','한라봉','깔라만시','베르가못','오렌지필','레몬그라스'],
  '베리':['딸기','라즈베리','블루베리','블랙베리','크랜베리','블랙커런트','레드커런트','오디','산딸기','베리'],
  '핵과·과수':['복숭아','백도','황도','천도복숭아','넥타린','살구','자두','플럼','체리','청사과','사과','홍사과','배','서양배','모과','매실'],
  '열대과일':['망고','파인애플','패션후르츠','리치','람부탄','망고스틴','구아바','파파야','바나나','코코넛','키위','용과','멜론','수박'],
  '포도·와인':['청포도','적포도','머스캣','샤인머스캣','거봉','화이트와인','레드와인','로제와인','샴페인','와이니'],
  '건과일·잼':['건포도','무화과','대추야자','프룬','말린 살구','말린 체리','베리잼','과일잼','마멀레이드'],
  '단맛':['꿀','메이플시럽','흑설탕','황설탕','캐러멜','토피','버터스카치','바닐라','마시멜로','누가','사탕수수','조청','연유','크렘브륄레','솜사탕'],
  '초콜릿·견과':['밀크초콜릿','다크초콜릿','카카오닙스','코코아','브라우니','아몬드','헤이즐넛','피칸','호두','마카다미아','땅콩','프랄린'],
  '차·허브':['홍차','얼그레이','우롱차','녹차','백차','보이차','자스민차','루이보스','민트','바질','세이지','타임','허브'],
  '향신료':['시나몬','정향','카다몬','넛맥','생강','아니스','흑후추','핑크페퍼'],
  '곡물·로스트':['토스트','비스킷','쿠키','그레이엄크래커','맥아','보리차','시리얼','볶은 곡물','스모키','담배','삼나무','우디'],
  '질감·여운':['쥬시','실키','크리미','버터리','벨벳','라운드','클린','밝은 산미','부드러운 산미','긴 여운','달콤한 여운','밸런스','복합적','티라이크'],
};
const BEAN_CUPNOTES=[...new Set(Object.values(CUPNOTE_GROUPS).flat())];
const ALT_OPTS=(()=>{const a=[];for(let m=800;m<=2600;m+=50)a.push(String(m));return a;})();
const CUSTOM_OPT='__custom';

// select 채우기: groups는 {그룹명:[값]} 또는 [값]. 목록에 없는 기존값은 맨 위에 넣어서 보존
function fillPickSelect(id,groups,current,placeholder,customLabel){
  const sel=document.getElementById(id);
  const esc=s=>String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
  const all=Array.isArray(groups)?groups:Object.values(groups).flat();
  let html=`<option value="">${placeholder}</option>`;
  if(current&&!all.includes(current))html+=`<option value="${esc(current)}">${esc(current)}</option>`;
  if(Array.isArray(groups))html+=groups.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
  else html+=Object.entries(groups).map(([g,vs])=>`<optgroup label="${esc(g)}">${vs.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('')}</optgroup>`).join('');
  html+=`<option value="${CUSTOM_OPT}">✏️ ${customLabel||'직접 입력…'}</option>`;
  sel.innerHTML=html;
  sel.value=current||'';
  sel.dataset.prev=sel.value;
  sel.onchange=()=>pickSelectChanged(sel);
}
// '직접 입력…' 선택 시 입력창 → 옵션 추가 후 선택, 취소하면 이전 값으로
/* 구매처 목록: 최근 구매한 곳 먼저(생두 구매일 순) → 그 밖에 등록된 곳 → 기본 목록.
   새 구매처는 직접 입력해서 생두를 저장하면 다음부터 목록·칩에 자동으로 나옴 */
function recentShops(){
  const used=db.beans.filter(x=>x.shop).slice().sort((a,c)=>(c.stock_date||'').localeCompare(a.stock_date||'')).map(x=>x.shop);
  return [...new Set([...used,...BEAN_SHOPS])];
}
function renderShopChips(){
  const el=document.getElementById('f_bshChips');if(!el)return;
  const cur=document.getElementById('f_bsh').value;
  const esc=s=>String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
  el.innerHTML=allShops().map(s=>`<span class="pchip${s===cur?' on':''}" data-v="${esc(s)}" onclick="setPickValue('f_bsh',this.dataset.v);renderShopChips()">${esc(s)}</span>`).join('');
}
function pickSelectChanged(sel){
  if(sel.id==='f_bsh')setTimeout(renderShopChips,0);
  if(sel.value!==CUSTOM_OPT){sel.dataset.prev=sel.value;return;}
  const numeric=sel.id.startsWith('f_ba');
  let v=prompt(numeric?'고도를 숫자로 입력하세요 (m)':'직접 입력하세요','');
  v=(v||'').trim();
  if(numeric)v=(v.match(/\d+/)||[''])[0];
  if(!v){sel.value=sel.dataset.prev||'';return;}
  if(![...sel.options].some(o=>o.value===v)){
    const o=document.createElement('option');o.value=v;o.textContent=v;
    sel.insertBefore(o,sel.options[1]||null);
  }
  sel.value=v;sel.dataset.prev=v;
}

// 고도: 단일(1600) / 범위(1600~1900). 예전 "1700 1800" 형식도 범위로 인식
let altRangeMode=false;
function setAltMode(range){
  altRangeMode=range;
  document.getElementById('altSingle').classList.toggle('on',!range);
  document.getElementById('altRange').classList.toggle('on',range);
  document.getElementById('altTilde').style.display=range?'':'none';
  document.getElementById('f_ba2').style.display=range?'':'none';
  document.getElementById('f_ba1').options[0].textContent=range?'최저':'선택';
}
function initAltitude(alt){
  const nums=(String(alt||'').match(/\d+/g)||[]);
  fillPickSelect('f_ba1',ALT_OPTS,nums[0]||'','선택','직접 입력(숫자)…');
  fillPickSelect('f_ba2',ALT_OPTS,nums[1]||'','최고','직접 입력(숫자)…');
  setAltMode(nums.length>=2);
}
function readAltitude(){
  const a=document.getElementById('f_ba1').value,b=document.getElementById('f_ba2').value;
  const ok=v=>v&&v!==CUSTOM_OPT;
  if(!altRangeMode||!ok(b))return ok(a)?a:'';
  if(!ok(a))return b;
  let lo=+a,hi=+b;if(lo>hi)[lo,hi]=[hi,lo];
  return lo===hi?String(lo):`${lo}~${hi}`;
}

// 품종·컵노트: 입력칸은 그대로 두고, 칩을 탭하면 추가/제거
const PICK_CHIPS={f_bv:BEAN_VARIETIES,f_bnt:CUPNOTE_GROUPS};
const reEsc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function hasPick(text,item){return new RegExp('(^|[\\s,])'+reEsc(item)+'(?=$|[\\s,])','i').test(text);}
function togglePick(inputId,item){
  const inp=document.getElementById(inputId);
  if(hasPick(inp.value,item)){
    inp.value=inp.value.replace(new RegExp('(^|[\\s,]+)'+reEsc(item)+'(?=$|[\\s,])','i'),'')
      .replace(/^[\s,]+|[\s,]+$/g,'').replace(/\s*,\s*(,\s*)+/g,', ');
  } else {
    const cur=inp.value.trim().replace(/[\s,]+$/,'');
    inp.value=cur?cur+', '+item:item;
  }
  renderPickChips(inputId);
}
function renderPickChips(inputId){
  const v=document.getElementById(inputId).value;
  const src=PICK_CHIPS[inputId];
  const chip=it=>`<span class="ctag cpos${hasPick(v,it)?' on':''}" onclick="togglePick('${inputId}','${it}')">${it}</span>`;
  document.getElementById(inputId+'_chips').innerHTML=Array.isArray(src)?src.map(chip).join(''):
    Object.entries(src).map(([g,l])=>`<div class="ctag-cat"><div class="ctag-cat-label">${g}</div><div class="ctag-list">${l.map(chip).join('')}</div></div>`).join('');
}

function openBeanForm(id){
  setTimeout(()=>{try{calcBeanPrice();}catch(e){}},0);
  document.getElementById('bfTitle').textContent=id?'생두 수정':'생두 추가';
  document.getElementById('bfId').value=id||'';
  const b=(id?db.beans.find(x=>x.id===id):null)||{};
  ['f_bn','f_br','f_bv','f_bpr','f_bst','f_bnt','f_bsm','f_bsw','f_bdate'].forEach(i=>{
    const el=document.getElementById(i);if(el)el.value='';
  });
  // 상태 선택지 초기화 (샘플은 더 이상 구매 안 해서 목록에서 뺌 — 기존 샘플 생두를 열 때만 임시로 추가됨)
  document.getElementById('f_bss').innerHTML=['','재고있음','잔량부족','소진','재고량미입력']
    .map(v=>`<option value="${v}">${v||'선택'}</option>`).join('');
  // 선택형 항목 (수정 시 기존값 유지, 목록에 없던 값도 보존)
  const shops=allShops();
  fillPickSelect('f_bo',BEAN_ORIGINS,b.origin||'','선택','직접 입력 (기타 국가)…');
  fillPickSelect('f_bp',BEAN_PROCESSES,b.process||'','선택');
  fillPickSelect('f_bsh',shops,b.shop||'','선택','직접 입력 (새 구매처)…');
  renderShopChips();
  initAltitude(b.altitude);
  if(!id){
    // 새 생두 기본값: 오늘 구매 + 재고있음
    const t=new Date();t.setMinutes(t.getMinutes()-t.getTimezoneOffset());
    document.getElementById('f_bdate').value=t.toISOString().slice(0,10);
    document.getElementById('f_bss').value='재고있음';
    document.getElementById('f_bst').value='1000';  // 기본 1kg 구매
    document.getElementById('f_bpay').value='';document.getElementById('f_bdec').checked=false;
  }
  if(id&&b.id){
    document.getElementById('f_bn').value=b.name||'';
    document.getElementById('f_br').value=b.region||'';
    document.getElementById('f_bv').value=b.variety||'';
    document.getElementById('f_bpr').value=b.price||'';
    document.getElementById('f_bpay').value=b.pay_amount||'';
    document.getElementById('f_bdec').checked=!!b.decaf;
    document.getElementById('f_bst').value=b.stock_initial||'';
    document.getElementById('f_bdate').value=b.stock_date||'';
    setPickValue('f_bss',b.status||'');  // 예전 '샘플' 상태도 보존
    document.getElementById('f_bnt').value=b.cup_notes||'';
    document.getElementById('f_bsm').value=b.score_momos||'';
    document.getElementById('f_bsw').value=b.score_wonderroom||'';
  }
  renderPickChips('f_bv');renderPickChips('f_bnt');renderKgBtns();
  openMo('moBeanForm');
}

function editBean(id){openBeanForm(id);}

// 외부에서 선택형 값 채우기 (목록에 없으면 옵션 추가)
function setPickValue(id,v){
  const sel=document.getElementById(id);v=(v||'').trim();
  if(v&&![...sel.options].some(o=>o.value===v)){
    const o=document.createElement('option');o.value=v;o.textContent=v;sel.insertBefore(o,sel.options[1]||null);
  }
  sel.value=v;sel.dataset.prev=v;
}
function pickVal(id){const v=document.getElementById(id).value;return v===CUSTOM_OPT?'':v.trim();}
function saveBean(){
  const id=document.getElementById('bfId').value;
  const name=document.getElementById('f_bn').value.trim();
  if(!name){alert('원두명을 입력하세요');return;}
  const data={
    id:id||genId(),
    name,
    origin:pickVal('f_bo'),
    region:document.getElementById('f_br').value.trim(),
    variety:document.getElementById('f_bv').value.trim(),
    process:pickVal('f_bp'),
    altitude:readAltitude(),
    shop:canonShop(pickVal('f_bsh')),
    price:document.getElementById('f_bpr').value,
    pay_amount:String(document.getElementById('f_bpay').value).replace(/[^0-9]/g,''),
    decaf:document.getElementById('f_bdec').checked,
    stock_initial:document.getElementById('f_bst').value,
    stock_date:document.getElementById('f_bdate').value,
    status:document.getElementById('f_bss').value,
    cup_notes:document.getElementById('f_bnt').value.trim(),
    score_momos:document.getElementById('f_bsm').value,
    score_wonderroom:document.getElementById('f_bsw').value,
  };
  // 폼에 없는 필드(cup_notes_source, soldout_skip_used, group_name, lot_label 등)는 보존
  if(id){const i=db.beans.findIndex(b=>b.id===id);if(i>=0){
    const oldName=db.beans[i].name;db.beans[i]={...db.beans[i],...data};
    // 이름을 바꾸면 이 생두로 연결된 로스팅 기록의 이름도 같이
    db.roasts.forEach(r=>{if(r.bean_id===id||(!r.bean_id&&r.bean_name===oldName)){r.bean_id=id;r.bean_name=name;}});
  }}
  else db.beans.push(data);
  saveDB();closeMo('moBeanForm');renderBeans();
}

function deleteBean(id){
  if(!confirm('삭제하시겠습니까?'))return;
  db.beans=db.beans.filter(b=>b.id!==id);
  saveDB();closeMo('moBeanDetail');renderBeans();
}

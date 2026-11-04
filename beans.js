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
  const rc=db.roasts.filter(r=>r.bean_name===b.name).length;
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
const BEAN_CUPNOTES=['자스민','베르가못','장미','라벤더','레몬','라임','오렌지','자몽','귤','청사과','배','복숭아','살구','망고','파인애플','패션후르츠','리치','블루베리','라즈베리','딸기','블랙커런트','체리','자두','포도','건포도','와인','꿀','흑설탕','카라멜','메이플','초콜릿','다크초콜릿','밀크초콜릿','견과류','아몬드','홍차','얼그레이','허브','시나몬'];
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
function pickSelectChanged(sel){
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
const PICK_CHIPS={f_bv:BEAN_VARIETIES,f_bnt:BEAN_CUPNOTES};
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
  document.getElementById(inputId+'_chips').innerHTML=PICK_CHIPS[inputId].map(it=>
    `<span class="ctag cpos${hasPick(v,it)?' on':''}" onclick="togglePick('${inputId}','${it}')">${it}</span>`).join('');
}

function openBeanForm(id){
  document.getElementById('bfTitle').textContent=id?'생두 수정':'생두 추가';
  document.getElementById('bfId').value=id||'';
  const b=(id?db.beans.find(x=>x.id===id):null)||{};
  ['f_bn','f_br','f_bv','f_bpr','f_bst','f_bnt','f_bsm','f_bsw','f_bdate'].forEach(i=>{
    const el=document.getElementById(i);if(el)el.value='';
  });
  document.getElementById('f_bss').value='';
  // 선택형 항목 (수정 시 기존값 유지, 목록에 없던 값도 보존)
  const shops=[...new Set(BEAN_SHOPS.concat(db.beans.map(x=>x.shop).filter(Boolean)))].sort((a,c)=>a.localeCompare(c,'ko'));
  fillPickSelect('f_bo',BEAN_ORIGINS,b.origin||'','선택','직접 입력 (기타 국가)…');
  fillPickSelect('f_bp',BEAN_PROCESSES,b.process||'','선택');
  fillPickSelect('f_bsh',shops,b.shop||'','선택','직접 입력 (새 구매처)…');
  initAltitude(b.altitude);
  if(!id){
    // 새 생두 기본값: 오늘 구매 + 재고있음
    const t=new Date();t.setMinutes(t.getMinutes()-t.getTimezoneOffset());
    document.getElementById('f_bdate').value=t.toISOString().slice(0,10);
    document.getElementById('f_bss').value='재고있음';
  }
  if(id&&b.id){
    document.getElementById('f_bn').value=b.name||'';
    document.getElementById('f_br').value=b.region||'';
    document.getElementById('f_bv').value=b.variety||'';
    document.getElementById('f_bpr').value=b.price||'';
    document.getElementById('f_bst').value=b.stock_initial||'';
    document.getElementById('f_bdate').value=b.stock_date||'';
    document.getElementById('f_bss').value=b.status||'';
    document.getElementById('f_bnt').value=b.cup_notes||'';
    document.getElementById('f_bsm').value=b.score_momos||'';
    document.getElementById('f_bsw').value=b.score_wonderroom||'';
  }
  renderPickChips('f_bv');renderPickChips('f_bnt');
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
    shop:pickVal('f_bsh'),
    price:document.getElementById('f_bpr').value,
    stock_initial:document.getElementById('f_bst').value,
    stock_date:document.getElementById('f_bdate').value,
    status:document.getElementById('f_bss').value,
    cup_notes:document.getElementById('f_bnt').value.trim(),
    score_momos:document.getElementById('f_bsm').value,
    score_wonderroom:document.getElementById('f_bsw').value,
  };
  if(id){const i=db.beans.findIndex(b=>b.id===id);if(i>=0)db.beans[i]=data;}
  else db.beans.push(data);
  saveDB();closeMo('moBeanForm');renderBeans();
}

function deleteBean(id){
  if(!confirm('삭제하시겠습니까?'))return;
  db.beans=db.beans.filter(b=>b.id!==id);
  saveDB();closeMo('moBeanDetail');renderBeans();
}

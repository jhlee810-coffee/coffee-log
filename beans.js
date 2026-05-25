function renderBeans(){
  const origins=[...new Set(db.beans.map(b=>b.origin).filter(Boolean))];
  document.getElementById('originFilters').innerHTML=
    `<div class="fc ${cf==='all'?'on':''}" onclick="setF('all')">전체</div>`+
    origins.map(o=>`<div class="fc ${cf===o?'on':''}" onclick="setF('${o}')">${o}</div>`).join('');
  let beans=db.beans;
  if(cf!=='all') beans=beans.filter(b=>b.origin===cf);
  if(cs){const q=cs.toLowerCase();beans=beans.filter(b=>(b.name+b.origin+(b.cup_notes||'')+(b.shop||'')).toLowerCase().includes(q));}
  document.getElementById('beanCards').innerHTML=beans.map(beanCard).join('')||
    '<div class="empty"><div class="empty-icon">🫘</div><div class="empty-text">생두가 없습니다</div></div>';
}

function beanCard(b){
  const oc=ORIGIN_COLORS[b.origin]||'var(--teal)';
  const isSogin=b.status==='소진';
  const dateStr=b.stock_date?b.stock_date.slice(2,4)+'.'+b.stock_date.slice(5,7):'—';
  const meta=[b.shop||'—',dateStr,b.price?b.price+'만':''||'—'].filter(Boolean).join('  ');
  const sc=b.score_momos||b.score_wonderroom||'';
  return`<div class="bcard${isSogin?' sogin':''}" style="border-top-color:${isSogin?'var(--coral)':oc}" onclick="showBeanDetail('${b.id}')">
    <div class="bog" style="color:${isSogin?'var(--coral)':oc}">${b.origin||'—'}</div>
    <div class="bnm">${b.name}</div>
    <div class="bsub">${[b.variety,b.process].filter(Boolean).join(' · ')||'&nbsp;'}</div>
    ${b.cup_notes?`<div class="bnote">${b.cup_notes}</div>`:''}
    <div class="bfoot">
      <span class="bfmeta">${meta}</span>
      <span style="display:flex;align-items:center;gap:6px">
        ${isSogin?'<span class="sogin-bdg">소진</span>':''}
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
    <div class="ds"><div class="dstitle">기록</div>${dr('로스팅',rc+'회')}${dr('브루잉',bl+'회')}</div>
    <div style="display:flex;gap:8px;margin-top:4px">
      <button class="btn2" onclick="editBean('${b.id}');closeMo('moBeanDetail')">수정</button>
      <button class="btnd" onclick="deleteBean('${b.id}')">삭제</button>
    </div>`;
  openMo('moBeanDetail');
}

function openBeanForm(id){
  document.getElementById('bfTitle').textContent=id?'생두 수정':'생두 추가';
  document.getElementById('bfId').value=id||'';
  const b=id?db.beans.find(x=>x.id===id):{};
  ['f_bn','f_bo','f_br','f_bv','f_ba','f_bsh','f_bpr','f_bst','f_bnt','f_bsm','f_bsw','f_bdate'].forEach(i=>{
    const el=document.getElementById(i);if(el)el.value='';
  });
  document.getElementById('f_bp').value='';
  document.getElementById('f_bss').value='';
  if(id&&b){
    document.getElementById('f_bn').value=b.name||'';
    document.getElementById('f_bo').value=b.origin||'';
    document.getElementById('f_br').value=b.region||'';
    document.getElementById('f_bv').value=b.variety||'';
    document.getElementById('f_bp').value=b.process||'';
    document.getElementById('f_ba').value=b.altitude||'';
    document.getElementById('f_bsh').value=b.shop||'';
    document.getElementById('f_bpr').value=b.price||'';
    document.getElementById('f_bst').value=b.stock_initial||'';
    document.getElementById('f_bdate').value=b.stock_date||'';
    document.getElementById('f_bss').value=b.status||'';
    document.getElementById('f_bnt').value=b.cup_notes||'';
    document.getElementById('f_bsm').value=b.score_momos||'';
    document.getElementById('f_bsw').value=b.score_wonderroom||'';
  }
  openMo('moBeanForm');
}

function editBean(id){openBeanForm(id);}

function saveBean(){
  const id=document.getElementById('bfId').value;
  const name=document.getElementById('f_bn').value.trim();
  if(!name){alert('원두명을 입력하세요');return;}
  const data={
    id:id||genId(),
    name,
    origin:document.getElementById('f_bo').value.trim(),
    region:document.getElementById('f_br').value.trim(),
    variety:document.getElementById('f_bv').value.trim(),
    process:document.getElementById('f_bp').value,
    altitude:document.getElementById('f_ba').value.trim(),
    shop:document.getElementById('f_bsh').value.trim(),
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

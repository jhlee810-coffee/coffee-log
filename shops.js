// shops.js — 구매처·로스터리 통합 목록 + 이름 합치기 · 2026-11-06
//
// ✏️ 같은 곳인데 이름이 다르게 들어간 경우 → 오른쪽 이름으로 합쳐짐 (앱 열 때 자동 정리)
const SHOP_ALIASES={
  '리브레':'커피리브레',
  '커피 리브레':'커피리브레',
  '커피리브래':'커피리브레',
  'MI커피':'엠아이커피',
  'mi커피':'엠아이커피',
  'MI 커피':'엠아이커피',
  '엠아이 커피':'엠아이커피',
};
function canonShop(name){
  const v=String(name||'').trim().replace(/\s+/g,' ');
  if(!v)return '';
  if(SHOP_ALIASES[v])return SHOP_ALIASES[v];
  const k=v.toLowerCase().replace(/\s+/g,'');
  for(const [a,b] of Object.entries(SHOP_ALIASES)){if(a.toLowerCase().replace(/\s+/g,'')===k)return b;}
  return v;
}

/* 생두 구매처 + 원두 로스터리 + 브루잉·구매검토에 적은 곳을 한 목록으로 — 최근에 쓴 곳이 먼저(내림차순).
   새로 타이핑해서 저장한 곳은 다음부터 자동으로 들어감 */
function allShops(){
  const last={};
  const add=(name,date)=>{const n=canonShop(name);if(!n)return;const d=date||'';if(!(n in last)||d>last[n])last[n]=d;};
  (db.beans||[]).forEach(b=>add(b.shop,b.stock_date));
  (db.roasted_beans||[]).forEach(b=>add(b.roastery,b.buy_date||b.roast_date));
  (db.roasts||[]).forEach(r=>add(r.shop,r.date));
  (db.brewlogs||[]).forEach(b=>add(b.ext_roastery,b.date));
  (db.wishlist||[]).forEach(w=>add(w.source,''));
  (typeof BEAN_SHOPS!=='undefined'?BEAN_SHOPS:[]).forEach(s=>add(s,''));
  return Object.entries(last).sort((a,b)=>b[1].localeCompare(a[1])||a[0].localeCompare(b[0],'ko')).map(x=>x[0]);
}

/* 텍스트 칸 아래 칩: 탭하면 칸에 들어감. 컨테이너 id = 입력칸 id + '_shops' */
function renderShopPick(inputId){
  const inp=document.getElementById(inputId),el=document.getElementById(inputId+'_shops');
  if(!inp||!el)return;
  const cur=canonShop(inp.value);
  const esc=s=>String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
  el.innerHTML=allShops().map(s=>`<span class="pchip${s===cur?' on':''}" data-v="${esc(s)}" onclick="document.getElementById('${inputId}').value=this.dataset.v;renderShopPick('${inputId}')">${esc(s)}</span>`).join('');
}

/* 앱 열 때 한 번: 저장된 이름을 합친 이름으로 바꿈 (바뀐 게 있을 때만 저장) */
function normalizeShopNames(){
  if(!db)return;
  let n=0;
  const fix=(o,k)=>{if(o&&o[k]){const c=canonShop(o[k]);if(c!==o[k]){o[k]=c;n++;}}};
  (db.beans||[]).forEach(b=>fix(b,'shop'));
  (db.roasts||[]).forEach(r=>fix(r,'shop'));
  (db.roasted_beans||[]).forEach(b=>fix(b,'roastery'));
  (db.brewlogs||[]).forEach(b=>fix(b,'ext_roastery'));
  (db.wishlist||[]).forEach(w=>fix(w,'source'));
  (db.dailycups||[]).forEach(r=>fix(r.bean_info,'roastery'));
  if(n){saveDB();try{if(typeof renderBeans==='function')renderBeans();}catch(e){}}
  return n;
}

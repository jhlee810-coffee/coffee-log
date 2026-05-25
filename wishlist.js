function renderWishlist(){
  document.getElementById('wishList').innerHTML=[...db.wishlist].reverse().map(w=>`
    <div class="wcard">
      <div class="wmain">
        <div class="wname">${w.name}</div>
        <div class="wmeta">${[w.source,w.price].filter(Boolean).join(' · ')}</div>
        ${w.memo?`<div class="wmemo">${w.memo}</div>`:''}
        ${w.url?`<a class="wurl" href="${w.url}" target="_blank">${w.url}</a>`:''}
      </div>
      <div class="wact">
        <button class="btn btn-sm" onclick="buyWish('${w.id}')">구매확정</button>
        <button class="btnd" onclick="deleteWish('${w.id}')">삭제</button>
      </div>
    </div>`).join('')||
    '<div class="empty"><div class="empty-icon">🔍</div><div class="empty-text">구매 검토 목록이 없습니다</div></div>';
}

function openWishForm(){
  ['f_wn','f_wp','f_ws','f_wu','f_wm'].forEach(i=>document.getElementById(i).value='');
  openMo('moWish');
}

function saveWish(){
  const name=document.getElementById('f_wn').value.trim();
  if(!name){alert('생두명을 입력하세요');return;}
  db.wishlist.push({
    id:genId(),name,
    price:document.getElementById('f_wp').value.trim(),
    source:document.getElementById('f_ws').value.trim(),
    url:document.getElementById('f_wu').value.trim(),
    memo:document.getElementById('f_wm').value.trim(),
  });
  saveDB();closeMo('moWish');renderWishlist();
}

function deleteWish(id){
  if(!confirm('삭제?'))return;
  db.wishlist=db.wishlist.filter(w=>w.id!==id);
  saveDB();renderWishlist();
}

function buyWish(id){
  const w=db.wishlist.find(x=>x.id===id);if(!w)return;
  db.wishlist=db.wishlist.filter(x=>x.id!==id);
  saveDB();
  document.querySelectorAll('.tb').forEach((t,i)=>{t.classList.remove('on');if(i===1)t.classList.add('on');});
  document.querySelectorAll('.sec').forEach(s=>s.classList.remove('on'));
  document.getElementById('tab-beans').classList.add('on');
  renderBeans();
  openBeanForm();
  document.getElementById('f_bn').value=w.name;
  document.getElementById('f_bsh').value=w.source;
  document.getElementById('f_bpr').value=w.price;
}

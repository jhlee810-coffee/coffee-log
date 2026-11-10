// paste.js — 생두·원두 붙여넣기 등록 · 2026-11-10
// 모바일 Claude가 봉투 사진을 읽어 만든 글("항목: 값" 줄, 여러 개는 --- 로 구분)을 붙여넣어 한 번에 등록.
// 저장: 생두 → db.beans, 원두(구매) → db.roasted_beans (기존 등록 폼과 같은 필드 이름)
// 맞는 필드가 없는 항목(수확연도, 원두의 지역·농장·고도·품종 등)은 메모(memo)에 덧붙임. 생두는 memo 필드가 새로 생김 (상세 화면에 표시)
// 가격: 생두는 kg당 원 → 만원/kg(price)로 바꿔 저장. 원두는 구매한 가격(원) 그대로 저장 (kg 환산 없음 — 2026-11-10 사용자 요청)
//
// 형식 예시는 COFFEE_LOG_FOR_CLAUDE.md 의 "붙여넣기 등록 형식" 참고

/* 항목 이름(별칭) → 내부 키. 별칭을 더하고 싶으면 여기 */
const PST_ALIAS={
  kind:['종류','구분','type'],
  name:['이름','원두명','생두명','상품명','제품명','name'],
  origin:['원산지','국가','나라','origin'],
  region:['지역','산지','region'],
  farm:['농장','농원','생산자','farm'],
  altitude:['고도','해발','altitude','masl'],
  variety:['품종','variety'],
  process:['가공','가공방식','프로세스','process'],
  harvest:['수확연도','수확년도','수확','크롭','crop','harvest'],
  shop:['구매처','판매처','구입처','shop'],
  buy_date:['구매일','구입일','구매날짜','buy_date'],
  price:['가격','kg당가격','price'],
  qty:['수량','용량','무게','qty'],
  cup_notes:['컵노트','향미','cupnotes','cupnote'],
  memo:['메모','비고','memo','note'],
  roastery:['로스터리','로스터','roastery'],
  roast_date:['로스팅날짜','로스팅일','로스팅일자','로스트일','roast_date'],
  level:['로스팅정도','배전도','로스트레벨','로스팅레벨','level'],
};
const pstNormLabel=s=>String(s||'').toLowerCase().replace(/[\s_\-]/g,'');
const PST_KEY=(()=>{const m={};Object.entries(PST_ALIAS).forEach(([k,l])=>l.forEach(a=>{m[pstNormLabel(a)]=k;}));return m;})();
const PST_KINDS={green:'생두',roasted:'원두'};
const PST_EXAMPLE=`종류: 생두
이름: 케냐 카구모 AA
원산지: 케냐
지역: 키리냐가
농장: 카구모 팩토리
고도: 1700-1800
품종: SL28, SL34
가공: 워시드
수확연도: 2025/26
구매처: 커피리브레
구매일: 2026-11-10
가격: 28000
수량: 1000
컵노트: 자몽, 블랙커런트, 흑설탕
메모: 상품 페이지 기준
---
종류: 원두
이름: …
로스터리: …
로스팅날짜: 2026-11-08
로스팅정도: 라이트`;

let _pst={step:'in',kind:'green',text:'',items:[],done:null};
const pstEsc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ── 값 읽기 ── */
function pstNum(s){const m=String(s||'').replace(/,/g,'').match(/\d+(?:\.\d+)?/);return m?parseFloat(m[0]):0;}
// 가격: kg당 원 ("28,000원", "28000", "2.8만원" → 28000)
function pstPrice(s){const n=pstNum(s);if(!n)return '';return String(Math.round(/만/.test(s)?n*10000:n));}
// 수량: g ("1000", "1kg" → 1000)
function pstQty(s){const n=pstNum(s);if(!n)return '';return String(Math.round(/kg|킬로/i.test(s)?n*1000:n));}
function pstDate(s){
  s=String(s||'').trim();if(!s)return '';
  const ok=(y,m,d)=>m>=1&&m<=12&&d>=1&&d<=31?`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`:'';
  let m=s.match(/(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})/);if(m)return ok(+m[1],+m[2],+m[3]);
  m=s.match(/(?:^|\D)(\d{2})\s*[-./]\s*(\d{1,2})\s*[-./]\s*(\d{1,2})(?:\D|$)/);if(m)return ok(2000+(+m[1]),+m[2],+m[3]);
  const y=new Date().getFullYear();
  m=s.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일?/)||s.match(/^(\d{1,2})\s*[/.]\s*(\d{1,2})$/);if(m)return ok(y,+m[1],+m[2]);
  return '';
}
// 고도: 숫자 1개 → "1700", 2개 → "1700~1800" (앱의 기존 저장 형식)
function pstAlt(s){
  const n=(String(s||'').match(/\d{3,4}/g)||[]).map(Number).slice(0,2).sort((a,b)=>a-b);
  if(!n.length)return '';return n.length===2&&n[0]!==n[1]?`${n[0]}~${n[1]}`:String(n[0]);
}
// 구매처·로스터리 끝의 괄호 설명은 뗌: "커피정경 (情逕)" → "커피정경", "커피 마시는 고래 (네이버 스마트스토어)" → "커피 마시는 고래"
const pstPlain=s=>String(s||'').replace(/\s*[(（][^)）]*[)）]\s*$/,'').trim();
const pstIsDecaf=it=>/디카페인|decaf/i.test((it.f.name||'')+' '+(it.f.process||''));
function pstList(s){return String(s||'').split(/[,，、]/).map(x=>x.trim()).filter(Boolean).join(', ');}
// 가공: 생두는 앱 목록 표기(Washed/Natural/Honey), 원두는 고르기 칩(워시드/내추럴/허니/무산소/기타)에 맞춤
function pstProcGreen(s){s=String(s||'').trim();return ({'워시드':'Washed','내추럴':'Natural','허니':'Honey'})[s]||s;}
function pstProcRb(s){
  s=String(s||'').trim();if(!s)return '';
  if(/무산소|anaerob/i.test(s))return '무산소';
  if(/허니|honey/i.test(s))return '허니';
  if(/내추럴|natural/i.test(s))return '내추럴';
  if(/워시드|wash/i.test(s))return '워시드';
  return s;
}
function pstLevel(s){
  const t=String(s||'').replace(/\s+/g,'').toLowerCase();if(!t)return '';
  return ({'라이트':'라이트','light':'라이트','미디엄라이트':'미디엄라이트','mediumlight':'미디엄라이트','미디엄':'미디엄','medium':'미디엄','미디엄다크':'미디엄다크','mediumdark':'미디엄다크','다크':'다크','dark':'다크'})[t]||String(s).trim();
}

/* ── 글 → 항목 ── */
function pstSplitBlocks(text){
  const blocks=[];let cur=[];
  String(text||'').replace(/\r/g,'').split('\n').forEach(line=>{
    if(/^\s*(?:-{3,}|={3,}|\*{3,}|_{3,}|—{2,})\s*$/.test(line)){blocks.push(cur);cur=[];}
    else cur.push(line);
  });
  blocks.push(cur);
  return blocks.filter(b=>b.some(l=>l.trim()));
}
function pstParseBlock(lines,defKind){
  const f={},ignored=[];let last=null;
  lines.forEach(raw=>{
    if(/^\s*```/.test(raw))return;
    const s=raw.replace(/^\s*(?:[-*•·>]\s+)/,'').replace(/[`*]/g,'').trim();
    if(!s)return;
    const m=s.match(/^([^:：]{1,14}?)\s*[:：]\s*(.*)$/);
    if(m){
      const key=PST_KEY[pstNormLabel(m[1])];
      if(key){
        const v=m[2].trim();
        if(!f[key])f[key]=v;
        else if(key==='memo')f[key]+=' · '+v;
        else if(key==='cup_notes')f[key]+=', '+v;
        last=key;
      }else{if(Object.keys(f).length)ignored.push(m[1].trim());last=null;}   // 첫 항목 앞의 인사말 줄은 무시 목록에도 안 올림
    }else if(last){f[last]=(f[last]+' '+s).trim();}   // 줄바꿈된 긴 값은 앞 항목에 이어 붙임
  });
  const known=Object.keys(f).length;
  if(!f.name&&known<2)return null;   // 항목이 거의 없는 덩어리(인사말 등)는 버림
  let kind=null;
  if(f.kind){if(/생두|green/i.test(f.kind))kind='green';else if(/원두|로스팅|roast/i.test(f.kind))kind='roasted';}
  if(!kind)kind=(f.roastery||f.roast_date||f.level)?'roasted':defKind;
  const parseWarns=[];
  const date=k=>{const raw=f[k];const v=pstDate(raw);if(raw&&!v)parseWarns.push(`${k==='buy_date'?'구매일':'로스팅날짜'} "${raw}"을(를) 날짜로 읽지 못했어요`);return v;};
  const v={
    name:(f.name||'').trim(),origin:f.origin||'',region:f.region||'',farm:f.farm||'',altitude:pstAlt(f.altitude),
    variety:pstList(f.variety),process:f.process||'',harvest:f.harvest||'',shop:f.shop||'',buy_date:date('buy_date'),
    price:pstPrice(f.price),qty:pstQty(f.qty),cup_notes:pstList(f.cup_notes),memo:f.memo||'',
    roastery:f.roastery||'',roast_date:date('roast_date'),level:f.level||'',
  };
  return {kind,f:v,ignored,parseWarns,dup:'skip'};
}
function pstParse(text,defKind){return pstSplitBlocks(text).map(b=>pstParseBlock(b,defKind)).filter(Boolean);}

/* ── 항목 → 저장할 기록 (기존 생두/원두 등록 폼과 같은 필드) ── */
function pstUniqueId(prefix){
  const used=new Set([...(db.beans||[]),...rbList()].map(x=>x.id));
  let id;do{id=prefix+genId();}while(used.has(id));
  return id;
}
function pstBuild(it){
  const f=it.f,g=+f.qty||0,kg=+f.price||0,alt=pstAlt(f.altitude);
  const cup=pstList(f.cup_notes),variety=pstList(f.variety);
  if(it.kind==='green'){
    const region=[f.region,f.farm].map(s=>String(s||'').trim()).filter(Boolean).join(' / ');   // 기존 표기 "지역 / 농장"
    const memo=[f.harvest?'수확연도: '+f.harvest.trim():'',String(f.memo||'').trim()].filter(Boolean).join(' · ');
    const rec={id:pstUniqueId(''),name:f.name.trim(),origin:f.origin.trim(),region,variety,process:pstProcGreen(f.process),altitude:alt,
      shop:canonShop(pstPlain(f.shop)),price:kg?String(+(kg/10000).toFixed(2)):'',pay_amount:'',decaf:pstIsDecaf(it),rest_min:'',rest_max:'',
      moisture:BEAN_MOISTURE_DEFAULT,moisture_set:false,density:BEAN_DENSITY_DEFAULT,density_set:false,
      stock_initial:g?String(g):'',stock_date:f.buy_date||'',status:'재고있음',cup_notes:cup,score_momos:'',score_wonderroom:''};
    if(memo)rec.memo=memo;
    return rec;
  }
  const decaf=pstIsDecaf(it);
  const procRaw0=String(f.process||'').trim();
  const proc=pstProcRb(procRaw0===''||/^디카페인$/.test(procRaw0)?'':procRaw0),procRaw=procRaw0;
  const trivial=['washed','워시드','natural','내추럴','honey','허니','anaerobic','무산소'];
  const roastery=canonShop(pstPlain(f.roastery||f.shop));
  const extras=[f.region&&'지역: '+f.region.trim(),f.farm&&'농장: '+f.farm.trim(),alt&&'고도: '+alt+'m',variety&&'품종: '+variety,f.harvest&&'수확연도: '+f.harvest.trim(),
    procRaw&&proc!==procRaw&&!trivial.includes(procRaw.toLowerCase())&&!(decaf&&/^디카페인$/.test(procRaw))&&'가공: '+procRaw,
    f.roastery&&f.shop&&canonShop(pstPlain(f.shop))!==roastery&&'구매처: '+canonShop(pstPlain(f.shop))].filter(Boolean);
  const memo=[...extras,String(f.memo||'').trim()].filter(Boolean).join(' · ');
  return {id:pstUniqueId('rb_'),name:f.name.trim(),roastery,roast_date:f.roast_date||'',buy_date:f.buy_date||'',origin:f.origin.trim(),
    process:proc,level:pstLevel(f.level),weight_g:g?String(g):'',price:kg?String(kg):'',cup_notes:cup,memo,status:RB_STATUS_ON,decaf,rest_min:'',rest_max:''};   // 원두 가격 = 구매 가격(원) 그대로
}

/* ── 같은 이름 확인 ── */
function pstNorm(s){return String(s||'').toLowerCase().replace(/[\s\[\]().,·_\-#\/]/g,'');}
function pstDup(it){
  const q=pstNorm(it.f.name);if(!q)return null;
  const list=it.kind==='green'?(db.beans||[]):rbList();
  return list.find(x=>{const n=pstNorm(x.name);return n&&(n===q||(Math.min(n.length,q.length)>=4&&(n.includes(q)||q.includes(n))));})||null;
}
function pstDupInfo(it,x){
  return it.kind==='green'
    ?[x.shop,x.stock_date,x.stock_initial?x.stock_initial+'g':'',x.status].filter(Boolean).join(' · ')
    :[x.roastery,x.roast_date?x.roast_date+' 로스팅':'',x.status].filter(Boolean).join(' · ');
}

/* ── 화면 ── */
function openPasteReg(kind){
  _pst.kind=kind==='roasted'?'roasted':'green';
  if(_pst.step==='done'){_pst.text='';_pst.items=[];}
  _pst.step='in';
  let mo=document.getElementById('moPaste');
  if(!mo){mo=document.createElement('div');mo.className='mo';mo.id='moPaste';mo.innerHTML='<div class="mbox" id="pasteBody"></div>';document.body.appendChild(mo);}
  pstRender();openMo('moPaste');
}
function pstRender(){
  const el=document.getElementById('pasteBody');if(!el)return;
  if(_pst.step==='in'){
    el.innerHTML=`<div class="mtitle">📥 붙여넣기로 ${PST_KINDS[_pst.kind]} 등록</div>
      <div class="ps-help">Claude가 봉투 사진을 보고 만든 글을 붙여넣으세요.<br>한 원두에 <b>항목: 값</b> 줄들, 여러 개면 <b>---</b> 로 구분해요. <b>종류: 생두</b> 또는 <b>종류: 원두</b>가 있으면 그대로 따라가요 (없으면 ${PST_KINDS[_pst.kind]}).<br>수량은 g. 가격은 생두 = kg당 원, 원두 = 구매한 가격(원) 그대로.</div>
      <textarea class="ta ps-ta" id="pstText" placeholder="${pstEsc(PST_EXAMPLE)}" oninput="_pst.text=this.value">${pstEsc(_pst.text)}</textarea>
      <div class="fa"><button class="btn2" onclick="closeMo('moPaste')">취소</button><button class="btn btn-sm" onclick="pstRead()">읽기 ›</button></div>`;
    return;
  }
  if(_pst.step==='done'){
    const d=_pst.done;
    el.innerHTML=`<div class="mtitle">✓ 등록했어요</div>
      <div class="ps-done">${d.added.map(a=>`<div>${a.kind==='green'?'🫘 생두':'☕ 원두'} · ${pstEsc(a.name)}</div>`).join('')||'<div>등록한 항목이 없어요</div>'}
        ${d.skipped?`<div class="ps-ign">건너뜀 ${d.skipped}개</div>`:''}</div>
      <div class="fa"><button class="btn2" onclick="_pst.text='';_pst.items=[];_pst.step='in';pstRender()">더 붙여넣기</button><button class="btn btn-sm" onclick="closeMo('moPaste')">닫기</button></div>`;
    return;
  }
  // preview
  const n=_pst.items.length;
  el.innerHTML=`<div class="mtitle">📥 읽은 결과 ${n}개</div>
    <div class="ps-help">값을 바로 고칠 수 있어요. 확인하고 등록을 누르세요.</div>
    ${_pst.items.map(pstCard).join('')}
    <div class="fa"><button class="btn2" onclick="_pst.step='in';pstRender()">‹ 다시</button><button class="btn2" onclick="closeMo('moPaste')">취소</button><button class="btn btn-sm" id="pstGo" onclick="pstRegister()"></button></div>`;
  pstFooter();
}
function pstRead(){
  const t=(document.getElementById('pstText')||{}).value||_pst.text;_pst.text=t;
  const items=pstParse(t,_pst.kind);
  if(!items.length){alert('읽을 수 있는 원두 정보가 없어요.\n"항목: 값" 형식의 줄이 필요해요. (예: 이름: 케냐 카구모 AA)');return;}
  _pst.items=items;_pst.step='preview';pstRender();
  const b=document.getElementById('pasteBody');if(b)b.scrollTop=0;
}

/* 한 줄 입력칸/날짜칸 */
function pstField(i,k,label,opt){
  opt=opt||{};const v=_pst.items[i].f[k];
  const type=opt.date?'date':'text';
  const ev=opt.date?`onchange="pstSet(${i},'${k}',this.value)"`:`oninput="pstSet(${i},'${k}',this.value)"`;
  return `<div class="${opt.full?'ps-full':''}"><div class="ps-l">${label}${opt.req?' *':''}</div><input class="inp" type="${type}"${opt.num?' inputmode="numeric"':''} placeholder="${pstEsc(opt.ph||'')}" value="${pstEsc(v)}" ${ev}></div>`;
}
function pstCard(it,i){
  const g=it.kind==='green';
  const F=(k,l,o)=>pstField(i,k,l,o);
  const fields=g
    ?[F('name','이름',{full:1,req:1}),F('origin','원산지'),F('region','지역'),F('farm','농장'),F('altitude','고도 (m)',{ph:'1700-1800'}),
      F('variety','품종'),F('process','가공'),F('harvest','수확연도'),F('shop','구매처'),F('buy_date','구매일',{date:1}),
      F('price','가격 (원/kg)',{num:1}),F('qty','수량 (g)',{num:1}),F('cup_notes','컵노트',{full:1}),F('memo','메모',{full:1})]
    :[F('name','이름',{full:1,req:1}),F('roastery','로스터리',{req:1}),F('roast_date','로스팅날짜',{date:1,req:1}),F('level','로스팅정도'),F('process','가공'),
      F('origin','원산지'),F('region','지역'),F('farm','농장'),F('altitude','고도 (m)',{ph:'1700-1800'}),F('variety','품종'),F('harvest','수확연도'),
      F('buy_date','구매일',{date:1}),F('shop','구매처'),F('price','가격 (원, 구매한 금액)',{num:1}),F('qty','수량 (g)',{num:1}),F('cup_notes','컵노트',{full:1}),F('memo','메모',{full:1})];
  return `<div class="ps-card" id="pstC${i}">
    <div class="ps-top"><span class="ps-no">${i+1}</span>
      <div class="ps-kind">${Object.entries(PST_KINDS).map(([k,l])=>`<button class="${it.kind===k?'on':''}" onclick="pstKind(${i},'${k}')">${l}</button>`).join('')}</div>
      <button class="ps-x" onclick="pstRemove(${i})">✕ 빼기</button></div>
    <div id="pstD${i}">${pstDupHtml(it,i)}</div>
    <div class="ps-grid">${fields.join('')}</div>
    <div class="ps-w" id="pstW${i}">${pstWarnHtml(it)}</div>
    <div class="ps-s" id="pstS${i}">${pstSumHtml(it)}</div>
  </div>`;
}
function pstDupHtml(it,i){
  const x=pstDup(it);if(!x)return '';
  return `<div class="ps-dup">⚠ 이미 있어요 — <b>${pstEsc(x.name)}</b><div class="ps-ign">${pstEsc(pstDupInfo(it,x))}</div>
    <div class="ps-seg"><button class="${it.dup==='add'?'on':''}" onclick="pstDupSet(${i},'add')">새로 추가</button><button class="${it.dup!=='add'?'on':''}" onclick="pstDupSet(${i},'skip')">건너뛰기</button></div></div>`;
}
function pstWarnHtml(it){
  const f=it.f,w=[],e=[];
  if(!f.name.trim())e.push('이름이 비어 있어요 — 이름을 넣어야 등록돼요');
  if(it.kind==='roasted'){
    if(!f.roastery.trim()&&!f.shop.trim())w.push('로스터리가 비어 있어요');
    if(!f.roast_date)w.push('로스팅날짜가 비어 있어요 — 디개싱 일수를 계산할 수 없어요');
  }
  if(it.kind==='green'&&+f.price&&+f.price<1000)w.push(`가격 ${f.price}원 — kg당 "원" 단위가 맞나요? (2.8만원이면 28000)`);
  (it.parseWarns||[]).forEach(x=>w.push(x));
  const ign=(it.ignored||[]).length?`<div class="ps-ign">무시한 항목: ${pstEsc(it.ignored.join(', '))}</div>`:'';
  return e.map(x=>`<div class="err">⛔ ${pstEsc(x)}</div>`).join('')+w.map(x=>`<div>⚠ ${pstEsc(x)}</div>`).join('')+ign;
}
function pstSumHtml(it){
  if(!it.f.name.trim())return '';
  const r=pstBuild(it);
  const parts=it.kind==='green'
    ?[r.price?`${r.price}만원/kg`:'',r.stock_initial?`구매량 ${(+r.stock_initial).toLocaleString()}g`:'',r.process?`가공 ${r.process}`:'',r.altitude?`고도 ${r.altitude}m`:'',r.region?`지역 ${r.region}`:'']
    :[r.price?`가격 ${(+r.price).toLocaleString()}원`:'',r.decaf?'디카페인':'',r.weight_g?`${(+r.weight_g).toLocaleString()}g`:'',r.process?`가공 ${r.process}`:'',r.level?`정도 ${r.level}`:''];
  return '<b>저장될 값</b> · '+pstEsc(parts.filter(Boolean).join(' · ')||'—')+(r.memo?`<br>메모 → ${pstEsc(r.memo)}`:'');
}
function pstFooter(){
  const ok=_pst.items.filter(it=>it.f.name.trim()&&(!pstDup(it)||it.dup==='add')).length;
  const go=document.getElementById('pstGo');
  if(go){go.textContent=ok?`등록 (${ok})`:'등록할 항목 없음';go.disabled=!ok;}
  _pst.items.forEach((it,i)=>{const c=document.getElementById('pstC'+i);if(c)c.classList.toggle('skip',!!pstDup(it)&&it.dup!=='add');});
}
function pstRefresh(i){
  const it=_pst.items[i];if(!it)return;
  const w=document.getElementById('pstW'+i),s=document.getElementById('pstS'+i),d=document.getElementById('pstD'+i);
  if(w)w.innerHTML=pstWarnHtml(it);if(s)s.innerHTML=pstSumHtml(it);
  if(d)d.innerHTML=pstDupHtml(it,i);   // 이름을 고치면 같은 이름 여부도 바뀜 (버튼만 있는 칸이라 입력 포커스에 영향 없음)
  pstFooter();
}
// 값 바꾸기: 입력칸 포커스를 잃지 않게 카드 전체를 다시 그리지 않고 경고·요약만 갱신
function pstSet(i,k,v){
  const it=_pst.items[i];if(!it)return;
  if(k==='price')v=v.replace(/[^0-9]/g,'');
  it.f[k]=k==='qty'?v.replace(/[^0-9]/g,''):v;
  pstRefresh(i);
}
function pstKind(i,k){const it=_pst.items[i];if(!it||it.kind===k)return;it.kind=k;it.dup='skip';pstRender();}
function pstDupSet(i,v){const it=_pst.items[i];if(!it)return;it.dup=v;const d=document.getElementById('pstD'+i);if(d)d.innerHTML=pstDupHtml(it,i);pstFooter();}
function pstRemove(i){_pst.items.splice(i,1);if(!_pst.items.length){_pst.step='in';}pstRender();}

/* ── 등록 ── */
function pstRegister(){
  const added=[];let skipped=0;
  const gb=[],rb=[];
  _pst.items.forEach(it=>{
    if(!it.f.name.trim()||(pstDup(it)&&it.dup!=='add')){skipped++;return;}
    const rec=pstBuild(it);
    (it.kind==='green'?gb:rb).push(rec);
    added.push({kind:it.kind,name:rec.name});
  });
  if(!added.length){alert('등록할 항목이 없어요.');return;}
  if(!Array.isArray(db.beans))db.beans=[];
  gb.forEach(r=>db.beans.push(r));
  rb.forEach(r=>rbList().push(r));
  saveDB();
  try{renderBeans();}catch(e){}try{renderRoastedBeans();}catch(e){}try{renderDash();}catch(e){}
  _pst.done={added,skipped};_pst.step='done';_pst.text='';_pst.items=[];
  pstRender();
}

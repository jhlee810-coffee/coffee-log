// brewcmp.js — 쉬운 커핑 > "브루잉 비교" (2~3잔) · 2026-11-18
// 같은 원두를 그라인더·분쇄도·불림·레시피·배치 등을 바꿔 내린 2~3잔(A·B·C)을 나란히 비교.
// 저장: 쉬운 커핑과 같은 목록(localStorage 'easyCuppingLog' + db.easycups → Sheets 동기화)에 kind:'brew' 로 같이 저장.
// 화면 한 장(마법사 아님). 원두 고르기·추출값 입력은 오늘의 한 잔(dailycup.js)의 상수·함수를 재사용.
//
// 저장 구조 (kind:'brew')
//   { id:'ec_…', kind:'brew', n:2|3, date,
//     A:{원두 스냅샷+degas_days}, B:{…}, C:{…}(3잔일 때만),   ← 쉬운 커핑의 A·B 와 같은 모양 (옛 코드가 깨지지 않게)
//     brews:{A:{recipe,dripper,filter,grinder,clicks,coffee_g,water_g,dilute_g,temp,bloom,time,water}, B:…, C:…},
//     drain:{A:'2:45',…}, cup_memo:{A:'…'}, cup_dates:{B:'2026-11-20'}(다른 날 내렸을 때만), flaws:{A:['목마름',…]},
//     changed:['그라인더','분쇄도'], changed_auto:true|false,
//     picks:{warm:{aroma,acid,sweet,after,body}, cool:{…}, final:'A'|'B'|'C'|'same', aroma…body(=따뜻할 때, 옛 CSV용)},
//     blind, blind_mode:'none'|'self'|'app', blind_order:[1번 자리 잔, 2번 자리 잔, …],
//     memo, summary, created_at, updated_at }

const BC_IDS=['A','B','C'];
const BC_CHANGE=['그라인더','분쇄도','불림 시간','온도','레시피','드리퍼','필터','원두 배치','디게싱 일수','기타'];
const BC_QS=[{key:'aroma',label:'향'},{key:'acid',label:'산미'},{key:'sweet',label:'단맛'},{key:'after',label:'뒷맛'},{key:'body',label:'바디감'}];
const BC_FLAWS=['목마름','떫음','탁함'];
const BC_FILTERS=['하이플럭스 155','카펙 TH-2','TH-3'];
const BC_BREW_KEYS=['recipe','dripper','filter','grinder','clicks','coffee_g','water_g','dilute_g','temp','bloom','time','water'];

let _bc=null;            // 작성 중인 브루잉 비교
let _bcType='cup', _bcN=2;   // 시작 화면 선택
let _bcLastId=null;

function bcQ(t){return ecEsc(t).replace(/'/g,"\\'");}

/* ── 시작 화면: 커핑 / 브루잉 비교 ── */
function ecChoose(){_bcType='cup';_bcN=2;ecGo('choose');}
function bcChooseHtml(){
  const tab=(v,l)=>`<button class="ec-pick${_bcType===v?' on':''}" onclick="_bcType='${v}';renderEasyCup()">${l}</button>`;
  const cnt=n=>`<button class="ec-pick${_bcN===n?' on':''}" onclick="_bcN=${n};renderEasyCup()">${n}잔 <small>${n===2?'A · B':'A · B · C'}</small></button>`;
  return `<div class="sh"><div class="stl">새 비교</div><button class="btn2" onclick="ecGo('list')">닫기</button></div>
  <div class="ec-card"><div class="ec-pick-row two">${tab('cup','🥣 커핑')}${tab('brew','🧪 브루잉 비교')}</div>
    ${_bcType==='cup'
      ?`<div class="ec-hint" style="margin-top:10px">원두 2개를 커핑볼에 놓고 어느 쪽이 더 나은지 고르는 기존 쉬운 커핑이에요.</div>`
      :`<div class="ec-hint" style="margin-top:10px">같은 원두를 그라인더·분쇄도·불림·레시피 등을 바꿔 내린 잔끼리 나란히 비교해요.</div>
        <div class="ec-q-txt" style="margin:12px 0 6px">몇 잔을 비교할까요?</div><div class="ec-pick-row two">${cnt(2)}${cnt(3)}</div>`}
    <button class="ec-save" style="margin-top:14px" onclick="bcChooseGo()">${_bcType==='cup'?'커핑 시작':'브루잉 비교 시작'}</button></div>`;
}
function bcChooseGo(){if(_bcType==='cup')ecStartNew();else bcStartNew(_bcN);}

/* ── 상태 ── */
function bcBlankBrew(){const o={};BC_BREW_KEYS.forEach(k=>o[k]='');return o;}
function bcNewCup(id,brew){return {id,sel:null,brew:{...bcBlankBrew(),...brew},date:'',drain:'',memo:'',touched:false,more:false,recMore:false};}
function bcStartNew(n){
  const lb=typeof dcLastBrew==='function'?dcLastBrew():{};
  const base={recipe:lb.recipe||'',dripper:lb.dripper||'',filter:lb.filter||'',grinder:lb.grinder||'',clicks:lb.clicks||'',coffee_g:lb.coffee_g||'',water_g:lb.water_g||'',
    temp:lb.temp||DC_TEMP_DEFAULT,time:lb.time||'',bloom:lb.bloom||'',dilute_g:lb.dilute_g||'',water:lb.water||DC_WATERS[0]};
  _bc={editId:null,keep:null,date:today(),n,cups:BC_IDS.slice(0,n).map(id=>bcNewCup(id,base)),changed:null,
       blind:'none',order:[],revealed:false,seatMap:{},picks:{warm:{},cool:{},final:''},flaws:{},memo:''};
  ecGo('bform');
}
function bcCancel(){
  if(_bc&&(_bc.cups.some(c=>c.sel)||_bc.picks.final)&&!confirm('작성 중인 비교를 닫을까요? 저장되지 않아요.'))return;
  _bc=null;ecGo('list');
}
function bcRerender(){const y=window.scrollY;renderEasyCup();window.scrollTo(0,y);}
// 앞 잔과 같게 시작: 손대지 않은 잔은 앞 잔(원두·추출값·날짜)을 그대로 따라감. 손댄 잔은 그대로 둠
function bcSync(){
  for(let j=1;j<_bc.cups.length;j++){const c=_bc.cups[j],p=_bc.cups[j-1];
    if(c.touched)continue;c.sel=p.sel?{...p.sel}:null;c.brew={...p.brew};c.date=p.date;}
}
function bcTouch(i){if(i>0)_bc.cups[i].touched=true;}
function bcCopyPrev(i){const c=_bc.cups[i];c.touched=false;bcSync();bcRerender();}
function bcAge(i){
  const c=_bc.cups[i];if(!c||!c.sel||!c.sel.roast_date)return null;
  const on=c.date||_bc.date;
  return typeof dcAgeOf==='function'?dcAgeOf(c.sel,on):ecDays(on,c.sel.roast_date);
}

/* ── 추출값 입력 (오늘의 한 잔과 같은 항목 + 필터) ── */
function bcSetB(i,k,v){const b=_bc.cups[i].brew;b[k]=b[k]===v?'':v;bcTouch(i);bcSync();bcRerender();}
function bcAsk(i,k,label){const b=_bc.cups[i].brew;const v=(prompt(label,b[k]||'')||'').trim();if(v){b[k]=k==='dilute_g'?v.replace(/[^0-9.]/g,''):v;bcTouch(i);bcSync();bcRerender();}}
function bcInp(i,k,el){_bc.cups[i].brew[k]=el.value;bcTouch(i);bcSync();bcSoft();}
function bcApplyPreset(i,p){
  const b=_bc.cups[i].brew;
  ['dripper','grinder','clicks','coffee_g','water_g','dilute_g','temp','bloom','time'].forEach(k=>{if(p[k]!=null)b[k]=p[k];});
  b.recipe=p.name;
}
function bcRecipe(i,name){
  const c=_bc.cups[i],b=c.brew,list=dcRecipeList();let it=list.find(x=>x.name===name);if(!it)return;
  if(b.recipe===name){b.recipe='';}
  else{
    if(it.kind==='p')bcApplyPreset(i,it.p);
    else{const r=dcAllRecipes()[it.i];if(r){b.recipe=r.name;b.coffee_g=r.coffee_g||b.coffee_g;b.water_g=r.water_g||b.water_g;b.temp=r.temp||b.temp;}}
  }
  bcTouch(i);bcSync();bcRerender();
}
function bcGrinder(i,name){
  const b=_bc.cups[i].brew;
  if(b.grinder===name){b.grinder='';b.clicks='';}
  else{b.grinder=name;const prev=dcSortedRecords().find(r=>r.brew&&r.brew.grinder===name&&r.brew.clicks);b.clicks=prev?prev.brew.clicks:'';}
  bcTouch(i);bcSync();bcRerender();
}
function bcClick(i,d){
  const b=_bc.cups[i].brew,G=dcGrinder(b.grinder);if(!G)return;
  const base=+b.clicks||Math.round((G.min+G.max)/4);
  b.clicks=String(Math.min(G.max,Math.max(G.min,base+d)));bcTouch(i);bcSync();bcRerender();
}
function bcClicksSel(i,v){_bc.cups[i].brew.clicks=v;bcTouch(i);bcSync();bcSoft();}
function bcTime(i,d){
  const b=_bc.cups[i].brew,m=String(b.time||'3:00').match(/(\d+):(\d{1,2})/);
  let sec=m?(+m[1])*60+(+m[2]):180;sec=Math.max(0,sec+d);
  b.time=Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0');bcTouch(i);bcSync();bcRerender();
}
function bcBrewSum(b){
  const g=b.grinder?b.grinder+(b.clicks?' '+dcClickLabel(b.grinder,b.clicks):''):'';
  const parts=[b.recipe,b.dripper,b.filter?'필터 '+b.filter:'',g,(b.coffee_g||b.water_g)?`${b.coffee_g||'?'}g → ${b.water_g||'?'}g`:'',
    b.dilute_g!==''&&b.dilute_g!=null?`가수 ${b.dilute_g}g`:'',dcTempLabel(b.temp),b.bloom?'불림 '+b.bloom:'',b.time?'⏱ '+b.time:'',b.water].filter(Boolean);
  return parts.length?parts.map(t=>`<span>${ecEsc(t)}</span>`).join(''):'<i>추출 정보가 비어 있어요</i>';
}
function bcFilterList(b){
  const past=ecLoad().filter(r=>r.kind==='brew').flatMap(r=>Object.values(r.brews||{}).map(x=>x&&x.filter)).filter(Boolean);
  return [...new Set([...BC_FILTERS,...past,b.filter].filter(Boolean))];
}
function bcRecipeChipsHtml(i){
  const c=_bc.cups[i],b=c.brew,list=dcRecipeList();
  const isOn=it=>b.recipe===it.name;
  const chip=it=>`<button class="dc-chip${isOn(it)?' on':''}" onclick="bcRecipe(${i},'${bcQ(it.name)}')">${ecEsc(it.name)}</button>`;
  const main=DC_MAIN_RECIPES.map(n=>list.find(x=>x.name===n)).filter(Boolean);
  const rest=list.filter(x=>!main.includes(x)),restOn=main.some(isOn)?null:rest.find(isOn);
  const unknown=b.recipe&&!list.some(x=>x.name===b.recipe)?`<button class="dc-chip on" onclick="bcSetB(${i},'recipe','${bcQ(b.recipe)}')">${ecEsc(b.recipe)}</button>`:'';
  return `<div class="dc-chips">${main.map(chip).join('')}${restOn&&!c.recMore?chip(restOn):''}${unknown}<button class="dc-chip add" onclick="_bc.cups[${i}].recMore=!_bc.cups[${i}].recMore;bcRerender()">${c.recMore?'기타 ▴':'기타 ▾'}</button></div>`+
    (c.recMore?`<div class="dc-chips dc-rec-more">${rest.map(chip).join('')||'<span class="dc-opt">다른 레시피가 없어요</span>'}</div>`:'');
}
function bcDetailHtml(i){
  const c=_bc.cups[i],b=c.brew;
  const chip=(on,l,fn)=>`<button class="dc-chip${on?' on':''}" onclick="${fn}">${ecEsc(l)}</button>`;
  const set=(k,v)=>`bcSetB(${i},'${k}','${bcQ(v)}')`;
  const has=v=>v!==''&&v!=null;
  const all=[...new Set([...DC_WATERS,...dcList().map(r=>r.brew&&r.brew.water).filter(Boolean),b.water].filter(Boolean))];
  const waters=all.map(w=>chip(b.water===w,w,set('water',w))).join('')+`<button class="dc-chip add" onclick="bcAsk(${i},'water','물 이름 (예: 에비앙)')">+ 직접 추가</button>`;
  const drs=dcDrippers().map(d=>chip(b.dripper===d,d,set('dripper',d))).join('')+`<button class="dc-chip add" onclick="bcAsk(${i},'dripper','드리퍼 이름을 입력하세요')">+ 직접 추가</button>`;
  const fls=bcFilterList(b).map(f=>chip(b.filter===f,f,set('filter',f))).join('')+`<button class="dc-chip add" onclick="bcAsk(${i},'filter','필터 이름 (예: 하이플럭스 155)')">+ 직접 추가</button>`;
  const grs=DC_GRINDERS.map(g=>chip(b.grinder===g.name,g.name,`bcGrinder(${i},'${bcQ(g.name)}')`)).join('');
  const G=dcGrinder(b.grinder);
  let clickSel='';
  if(G){let o='<option value="">클릭</option>';for(let k=G.min;k<=G.max;k++)o+=`<option value="${k}"${+b.clicks===k?' selected':''}>${dcClickLabel(G.name,k)}</option>`;
    clickSel=`<div class="dc-clicks"><button class="dc-adj" onclick="bcClick(${i},-1)">${G.scale?'−0.1':'−1'}</button><select class="sel" onchange="bcClicksSel(${i},this.value)">${o}</select><button class="dc-adj" onclick="bcClick(${i},1)">${G.scale?'+0.1':'+1'}</button></div>`;}
  const tcur=String(b.temp==null?'':b.temp),tchip=v=>chip(tcur===v,v,set('temp',v));
  const tempChips=DC_TEMPS.map(tchip).join('')+(tcur&&![...DC_TEMPS,...DC_TEMP_COLD].includes(tcur)?chip(true,tcur,set('temp',tcur)):'');
  const bloom=DC_BLOOM.map(v=>chip(b.bloom===v,v,set('bloom',v))).join('')+chip(b.bloom&&!DC_BLOOM.includes(b.bloom),b.bloom&&!DC_BLOOM.includes(b.bloom)?b.bloom:'직접',`bcAsk(${i},'bloom','불림 시간 (예: 40초)')`);
  const dnow=has(b.dilute_g)&&!DC_DILUTE.includes(String(b.dilute_g));
  const dil=DC_DILUTE.map(v=>chip(String(b.dilute_g)===v,v+'g',set('dilute_g',v))).join('')+chip(dnow,dnow?b.dilute_g+'g':'직접',`bcAsk(${i},'dilute_g','가수 (g)')`);
  const times=DC_TIMES.map(v=>chip(b.time===v,v,set('time',v))).join('');
  const inp=(k,ph)=>`<input class="inp" id="bcIn_${i}_${k}" inputmode="decimal" placeholder="${ph}" value="${ecEsc(b[k])}" oninput="bcInp(${i},'${k}',this)">`;
  return `<div class="dc-more">
    <div class="dc-mini">레시피 <span class="dc-opt">누르면 아래 값을 한 번에 채움</span></div>${bcRecipeChipsHtml(i)}
    <div class="dc-mini">드리퍼</div><div class="dc-chips">${drs}</div>
    <div class="dc-mini">필터</div><div class="dc-chips">${fls}</div>
    <div class="dc-mini">그라인더 · 클릭수</div><div class="dc-chips">${grs}</div>${clickSel}
    <div class="dc-grid4"><div><div class="dc-mini">원두 g</div>${inp('coffee_g','15')}</div><div><div class="dc-mini">물 g</div>${inp('water_g','240')}</div></div>
    <div class="dc-mini">물 온도 ${has(b.temp)?`<b class="dc-tval">${ecEsc(dcTempLabel(b.temp))}</b>`:''}</div><div class="dc-chips">${tempChips}</div>
    <div class="dc-mini dc-opt" style="margin-top:6px">저온 추출</div><div class="dc-chips">${DC_TEMP_COLD.map(tchip).join('')}</div>
    <div class="dc-mini">불림</div><div class="dc-chips">${bloom}</div>
    <div class="dc-mini">가수</div><div class="dc-chips">${dil}</div>
    <div class="dc-mini">총 추출 시간 ${b.time?`<b class="dc-tval">${ecEsc(b.time)}</b>`:''}</div><div class="dc-chips">${times}<button class="dc-chip" onclick="bcTime(${i},-5)">−5초</button><button class="dc-chip" onclick="bcTime(${i},5)">+5초</button></div>
    <div class="dc-mini">물</div><div class="dc-chips">${waters}</div>
    <div class="dc-mini">내린 날 <span class="dc-opt">다른 날 내린 잔일 때만 바꾸세요 (디게싱 일수가 달라져요)</span></div>
    <input class="inp" type="date" value="${c.date||_bc.date}" onchange="bcCupDate(${i},this.value)">
  </div>`;
}

/* ── 잔 카드 ── */
function bcSetSel(i,snap){const c=_bc.cups[i];c.sel=snap;bcTouch(i);bcSync();bcRerender();}
function bcOpenPick(i){
  if(typeof _dc==='undefined'||!_dc)dcNew();
  dcOpenPick('',snap=>bcSetSel(i,snap),_bc.cups[i].date||_bc.date);   // 오늘의 한 잔의 원두 고르기 창을 그대로 씀
}
function bcQuick(i,k){const x=(window._bcQuick||[])[k];if(x)bcSetSel(i,{...x.snap});}
function bcDateTop(v){_bc.date=v||today();bcSoft();}
function bcCupDate(i,v){const c=_bc.cups[i];c.date=(v&&v!==_bc.date)?v:'';bcTouch(i);bcSync();bcSoft();}
function bcDrain(i,el){_bc.cups[i].drain=el.value.trim();}
function bcDrainNorm(i,el){let v=el.value.trim().replace(/[：.]/g,':');if(/^\d{1,2}:\d$/.test(v))v=v.replace(':',':0');el.value=v;_bc.cups[i].drain=v;}
function bcCupHtml(i){
  const c=_bc.cups[i],s=c.sel;
  let quick='';
  if(i===0){
    window._bcQuick=typeof dcRecommend==='function'?dcRecommend():[];
    quick=window._bcQuick.length?`<div class="dc-qtitle">⭐ 추천 원두 <span>오늘의 한 잔과 같은 순서</span></div><div class="dc-qbatches q8">`+window._bcQuick.map((x,k)=>{
      const sn=x.snap,bn=sn.bean_id?(db.beans||[]).find(b=>b.id===sn.bean_id):null;
      const nm=sn.rb_id?sn.bean:(typeof dashFullName==='function'?dashFullName(sn.bean,bn):dcShort(sn.bean));
      const on=s&&dcBatchKey(s)===dcBatchKey(sn),stl=x.fz?'🧊 냉동':(x.st.short||x.st.l);
      const lh=sn.roast_id?dcLossHtml(dcLossOfSnap(sn)):'';
      return `<button class="dc-qbatch${on?' on':''}${x.fz?' frz':''}" onclick="bcQuick(0,${k})"><b class="dc-qname">${ecEsc(nm)}</b><span>${ecEsc([dcMD(sn.roast_date),dcProfile(sn)].filter(Boolean).join(' · '))}</span>${lh?`<span class="dc-q-loss">${lh}</span>`:''}<i class="dc-q-ev">${ecEsc(stl)}</i></button>`;
    }).join('')+`</div>`:'';
  }
  const selBox=s?`<div class="dc-sel"><div class="dc-sel-name">${ecEsc(s.bean)}</div><div class="dc-sel-meta">${dcSelMetaHtml(s)}</div><div class="dc-sel-deg" id="bcDeg${i}">${dcDegHtml(s,bcAge(i))}</div></div>`:'';
  const follow=i===0?'':!c.touched
    ?`<span class="bc-follow">앞 잔과 같게 시작 · 바뀐 것만 고치세요</span>`
    :`<button class="bc-copy" onclick="bcCopyPrev(${i})">↺ 앞 잔과 같게</button>`;
  return `<div class="ec-card bc-cup"><div class="bc-cup-hd"><span class="ec-badge">${c.id}</span><b>${c.id} 잔</b>${follow}</div>
    ${quick}
    <button class="dc-pickbtn" onclick="bcOpenPick(${i})">${s?'다른 원두 고르기':'원두 고르기'} ▸</button>${selBox}
    <div class="dc-mini">추출 <span class="dc-opt">${i===0?'지난번 오늘의 한 잔 값이 채워져 있어요':'앞 잔 값 그대로'}</span></div>
    <div class="dc-bsum" id="bcSum${i}">${bcBrewSum(c.brew)}</div>
    <button class="dc-more-btn" style="margin-top:8px" onclick="_bc.cups[${i}].more=!_bc.cups[${i}].more;bcRerender()">${c.more?'▴ 추출 수정 접기':'▾ 추출 수정 (레시피 · 드리퍼 · 필터 · 그라인더 · 온도 · 불림 · 시간)'}</button>
    ${c.more?bcDetailHtml(i):''}
    <div class="bc-two"><div><div class="dc-mini">물빠짐 완료 시간</div><input class="inp" inputmode="text" placeholder="예: 2:45" value="${ecEsc(c.drain)}" oninput="bcDrain(${i},this)" onchange="bcDrainNorm(${i},this)"></div>
      <div><div class="dc-mini">짧은 메모</div><input class="inp" placeholder="예: 물이 늦게 빠짐" value="${ecEsc(c.memo)}" oninput="_bc.cups[${i}].memo=this.value"></div></div></div>`;
}

/* ── 이번에 바꾼 것 (자동 선택 + 수정) ── */
function bcAutoChanged(){
  const cs=_bc.cups,diff=f=>new Set(cs.map(c=>String(f(c)==null?'':f(c)))).size>1;
  const batch=diff(c=>c.sel?dcBatchKey(c.sel):'');
  const byGr={};cs.forEach(c=>{(byGr[c.brew.grinder||'']=byGr[c.brew.grinder||'']||new Set()).add(String(c.brew.clicks||''));});
  const clickDiff=Object.values(byGr).some(set=>set.size>1);   // 같은 그라인더를 쓴 잔끼리 클릭수가 다르면 '분쇄도'
  const hit={'그라인더':diff(c=>c.brew.grinder),'분쇄도':clickDiff,'불림 시간':diff(c=>c.brew.bloom),'온도':diff(c=>c.brew.temp),
    '레시피':diff(c=>c.brew.recipe),'드리퍼':diff(c=>c.brew.dripper),'필터':diff(c=>c.brew.filter),'원두 배치':batch,
    '디게싱 일수':!batch&&diff(c=>{const i=cs.indexOf(c);return bcAge(i);})};
  return BC_CHANGE.filter(k=>hit[k]);
}
function bcEffChanged(){return _bc.changed||bcAutoChanged();}
function bcChangedHtml(){
  const eff=bcEffChanged(),auto=_bc.changed==null;
  return `<div class="dc-chips">${BC_CHANGE.map(k=>`<button class="dc-chip${eff.includes(k)?' on':''}" onclick="bcToggleChanged('${k}')">${k}</button>`).join('')}</div>
    <div class="ec-hint" style="margin-top:8px">${auto?'잔끼리 다른 항목을 자동으로 골라 뒀어요 · 눌러서 고치세요':'직접 고친 상태예요 · <button class="bc-copy" onclick="_bc.changed=null;bcSoft()">자동으로 다시</button>'}</div>`;
}
function bcToggleChanged(k){
  const eff=bcEffChanged().slice(),x=eff.indexOf(k);
  if(x>=0)eff.splice(x,1);else eff.push(k);
  _bc.changed=BC_CHANGE.filter(v=>eff.includes(v));bcSoft();
}
// 입력창을 다시 그리지 않고 요약·디게싱·바꾼 것만 갱신 (타이핑 중 포커스 유지)
function bcSoft(){
  if(!_bc)return;
  _bc.cups.forEach((c,j)=>{
    const sm=document.getElementById('bcSum'+j);if(sm)sm.innerHTML=bcBrewSum(c.brew);
    ['coffee_g','water_g'].forEach(k=>{const el=document.getElementById(`bcIn_${j}_${k}`);if(el&&document.activeElement!==el)el.value=c.brew[k]||'';});
    const dg=document.getElementById('bcDeg'+j);if(dg&&c.sel)dg.innerHTML=dcDegHtml(c.sel,bcAge(j));
  });
  const ch=document.getElementById('bcChanged');if(ch)ch.innerHTML=bcChangedHtml();
  const tg=document.getElementById('bcTags');if(tg)tg.innerHTML=bcTagsHtml();
}

/* ── 비교 값 (저장 기록 / 작성 중 공통) ── */
function bcVal(item,rec,id){
  const b=(rec.brews||{})[id]||{},s=rec[id]||{};
  switch(item){
    case '그라인더':return b.grinder||'-';
    case '분쇄도':return b.grinder?(dcClickLabel(b.grinder,b.clicks)||'-'):(b.clicks||'-');
    case '불림 시간':return b.bloom||'없음';
    case '온도':return dcTempLabel(b.temp)||'-';
    case '레시피':return b.recipe||'-';
    case '드리퍼':return b.dripper||'-';
    case '필터':return b.filter||'-';
    case '원두 배치':return [ecMD(s.roast_date),dcProfile(s)].filter(Boolean).join(' ')||s.bean||'-';
    case '디게싱 일수':return s.degas_days!=null&&s.degas_days!==''?s.degas_days+'일':'-';
  }
  return '';
}
function bcIdsOf(rec){return BC_IDS.slice(0,rec.n||(rec.C?3:2));}
function bcDiffs(rec){   // 바꾼 것마다 잔별 값: [{item, text:'A ZP6 / B C40'}]
  const ids=bcIdsOf(rec),beanDiff=new Set(ids.map(id=>(rec[id]||{}).bean)).size>1;
  return (rec.changed||[]).filter(k=>k!=='기타').map(k=>({item:k,text:ids.map(id=>{
    const v=bcVal(k,rec,id);return id+' '+(k==='원두 배치'&&beanDiff?ecShort((rec[id]||{}).bean)+' ':'')+v;}).join(' / ')}));
}
function bcPseudo(){const r={n:_bc.n,brews:{}};_bc.cups.forEach((c,i)=>{r[c.id]={...(c.sel||{}),degas_days:bcAge(i)};r.brews[c.id]=c.brew;});return r;}
function bcTag(id){   // 잔 이름 옆에 붙일 "무엇이 다른 잔인지" (예: ZP6 5.5)
  const ps=bcPseudo();return bcEffChanged().filter(k=>k!=='기타').map(k=>bcVal(k,ps,id)).join(' · ');
}
function bcTagsHtml(){
  return _bc.cups.map(c=>`<span class="bc-tag1"><b>${c.id}</b> ${ecEsc(bcTag(c.id)||'—')}</span>`).join('');
}

/* ── 블라인드 (선택) ── */
function bcOpts(){return _bc.blind==='none'?BC_IDS.slice(0,_bc.n):Array.from({length:_bc.n},(_,k)=>'S'+(k+1));}
function bcOptLabel(o){if(o==='same')return '비슷함';if(o[0]==='S')return o[1]+(_bc.blind==='app'?'번 컵':'번 자리');return o;}
function bcShuffleOrder(){const a=BC_IDS.slice(0,_bc.n);for(let k=a.length-1;k>0;k--){const j=Math.floor(Math.random()*(k+1));[a[k],a[j]]=[a[j],a[k]];}return a;}
function bcSetBlind(m){
  if(m===_bc.blind)return;
  const had=Object.values(_bc.picks.warm).some(Boolean)||Object.values(_bc.picks.cool).some(Boolean)||_bc.picks.final||Object.values(_bc.flaws).some(a=>a&&a.length);
  if(had&&!confirm('블라인드 방식을 바꾸면 고른 평가가 지워져요. 바꿀까요?'))return;
  _bc.blind=m;_bc.revealed=false;_bc.seatMap={};_bc.order=m==='app'?bcShuffleOrder():[];
  _bc.picks={warm:{},cool:{},final:''};_bc.flaws={};bcRerender();
}
function bcShuffle(){
  if(!confirm('컵 순서를 다시 섞을까요? (고른 평가는 지워져요)'))return;
  _bc.order=bcShuffleOrder();_bc.revealed=false;_bc.picks={warm:{},cool:{},final:''};_bc.flaws={};bcRerender();
}
function bcReveal(){if(confirm('정답을 볼까요? 블라인드가 풀려요.')){_bc.revealed=true;bcRerender();}}
function bcSeat(s,id){_bc.seatMap[s]=_bc.seatMap[s]===id?'':id;bcRerender();}
function bcBlindHtml(){
  const e=_bc;
  if(e.keep)return `<div class="ec-card"><div class="ec-card-t">🥣 블라인드</div><div class="ec-hint">블라인드로 했던 기록이에요 (정답이 공개된 상태로 보여요).</div></div>`;
  const btn=(m,l)=>`<button class="ec-pick${e.blind===m?' on':''}" onclick="bcSetBlind('${m}')">${l}</button>`;
  const seatsTxt=Array.from({length:e.n},(_,k)=>(k+1)).join('·');
  let info='';
  if(e.blind==='self')info=`<div class="ec-hint">컵 바닥에 ${seatsTxt}번을 붙이고, 눈을 감고 섞어서 놓으세요. 평가는 <b>자리 번호</b>로만 하고, 저장 전에 "정답 확인"에서 자리마다 어느 잔인지 골라 주세요.</div>`;
  else if(e.blind==='app'){
    info=`<div class="ec-hint">어느 잔이 몇 번 컵인지 무작위로 섞었어요. 저장할 때 정답을 알려 줘요.</div><div class="ec-blind-box">
      <div>${e.order.map((id,k)=>`<b>${k+1}번 컵 = ${e.revealed?ecEsc(id+(bcTag(id)?' · '+bcTag(id):'')):'?'}</b>`).join(' / ')}</div>
      ${e.revealed?'':'<button class="btn2" onclick="bcReveal()">정답 보기</button>'}<button class="btn2" onclick="bcShuffle()">다시 섞기</button></div>`;
  }
  return `<div class="ec-card"><div class="ec-card-t">🥣 블라인드 <span class="ec-opt">선택 · 안 켜도 돼요</span></div>
    <div class="ec-pick-row">${btn('none','안 함')}${btn('self','혼자 섞기')}${btn('app','앱이 섞기')}</div>${info}</div>`;
}
function bcSeatMapHtml(){
  const e=_bc;if(e.blind!=='self'||e.keep)return '';
  const ids=BC_IDS.slice(0,e.n);
  return `<div class="ec-card" id="bcReveal"><div class="ec-card-t">✅ 정답 확인 <span class="ec-req">필수</span></div>
    <div class="ec-hint" style="margin-bottom:8px">컵을 들어 바닥을 확인하고, 자리마다 어느 잔이었는지 골라 주세요.</div>
    ${Array.from({length:e.n},(_,k)=>{const s='S'+(k+1);
      return `<div class="bc-prow"><span class="bc-pl">${k+1}번 자리</span><div class="bc-pbtns" style="--c:${ids.length}">${ids.map(id=>`<button class="ec-pick${e.seatMap[s]===id?' on':''}" onclick="bcSeat('${s}','${id}')">${id}<br><small>${ecEsc(bcTag(id))}</small></button>`).join('')}</div></div>`;}).join('')}</div>`;
}

/* ── 비교 선택 · 맛 체크 · 최종 ── */
function bcPick(when,key,v){
  if(when==='final'){_bc.picks.final=_bc.picks.final===v?'':v;}
  else{const o=_bc.picks[when];o[key]=o[key]===v?'':v;}
  bcRerender();
}
function bcPickRow(when,q){
  const cur=_bc.picks[when][q.key]||'',opts=[...bcOpts(),'same'];
  return `<div class="bc-prow"><span class="bc-pl">${q.label}</span><div class="bc-pbtns" style="--c:${opts.length}">${opts.map(o=>`<button class="ec-pick${cur===o?' on':''}" onclick="bcPick('${when}','${q.key}','${o}')">${bcOptLabel(o)}</button>`).join('')}</div></div>`;
}
function bcFlaw(o,f){const a=(_bc.flaws[o]||[]).slice(),i=a.indexOf(f);if(i>=0)a.splice(i,1);else a.push(f);_bc.flaws[o]=a;bcRerender();}
function bcFlawHtml(){
  return `<div class="ec-q-txt" style="margin:14px 0 6px"><b>맛 체크</b> <span class="ec-opt">잔마다 · 해당하면 켜기</span></div>`+bcOpts().map(o=>{
    const cur=_bc.flaws[o]||[];
    return `<div class="bc-prow"><span class="bc-pl">${bcOptLabel(o)}</span><div class="bc-pbtns" style="--c:3">${BC_FLAWS.map(f=>`<button class="ec-pick flaw${cur.includes(f)?' on':''}" onclick="bcFlaw('${o}','${f}')">${f}</button>`).join('')}</div></div>`;}).join('');
}

/* ── 작성 화면 (한 장) ── */
function bcFormHtml(){
  const e=_bc,opts=[...bcOpts(),'same'];
  return `<div class="sh"><div class="stl">${e.editId?'브루잉 비교 수정':'🧪 브루잉 비교'} · ${e.n}잔</div><button class="btn2" onclick="bcCancel()">닫기</button></div>
  <div class="ec-card"><div class="dc-date" style="margin:0">비교한 날 <input class="inp" type="date" value="${e.date}" onchange="bcDateTop(this.value)"></div></div>
  ${e.cups.map((_,i)=>bcCupHtml(i)).join('')}
  <div class="ec-card"><div class="ec-card-t">🔧 이번에 바꾼 것 <span class="ec-opt">여러 개</span></div><div id="bcChanged">${bcChangedHtml()}</div>
    <div class="bc-tags" id="bcTags">${bcTagsHtml()}</div></div>
  ${bcBlindHtml()}
  <div class="ec-card"><div class="ec-card-t">🔥 따뜻할 때</div>${BC_QS.map(q=>bcPickRow('warm',q)).join('')}
    <div class="ec-card-t" style="margin-top:16px">🧊 식은 뒤 <span class="ec-opt">비워도 저장돼요</span></div>${BC_QS.map(q=>bcPickRow('cool',q)).join('')}
    ${bcFlawHtml()}</div>
  <div class="ec-card"><div class="ec-card-t">🏁 최종 선택 <span class="ec-req">필수</span></div><div class="ec-q-txt">하나만 다시 마신다면?</div>
    <div class="bc-pbtns" style="--c:${opts.length}">${opts.map(o=>`<button class="ec-pick${e.picks.final===o?' on':''}" onclick="bcPick('final','','${o}')">${bcOptLabel(o)}</button>`).join('')}</div>
    <div class="ec-q" style="margin-top:12px"><div class="ec-q-hd"><b>한 줄 메모</b> <span class="ec-opt">선택</span></div>
    <input class="inp" placeholder="예: 분쇄도 낮춘 쪽이 단맛이 길었음" value="${ecEsc(e.memo)}" oninput="_bc.memo=this.value"></div></div>
  ${bcSeatMapHtml()}
  <button class="ec-save" onclick="bcSubmit()">${e.editId?'수정 저장':'저장하기'}</button>`;
}

/* ── 저장 ── */
function bcSummary(rec){
  const ids=bcIdsOf(rec),beans=[...new Set(ids.map(id=>ecShort((rec[id]||{}).bean)))];
  const ch=(rec.changed||[]).join('·')||'없음',df=bcDiffs(rec).map(d=>d.item+' '+d.text);
  const pk=w=>BC_QS.filter(q=>rec.picks&&rec.picks[w]&&rec.picks[w][q.key]).map(q=>q.label+' '+ecPickWord(rec.picks[w][q.key])).join(' / ');
  const warm=pk('warm'),cool=pk('cool'),f=rec.picks.final;
  return `${ecMD(rec.date)} ${beans.join('/')} · 브루잉 비교 ${ids.length}잔 · 바꾼 것 ${ch}${df.length?` (${df.join('; ')})`:''}`+
    (warm?` · 따뜻할 때 ${warm}`:'')+(cool?` · 식은 뒤 ${cool}`:'')+` → 최종 ${f==='same'?'비슷함':f}`+(rec.blind?' · 블라인드':'');
}
function bcSubmit(){
  const e=_bc;
  if(e.cups.some(c=>!c.sel)){alert('모든 잔의 원두를 골라 주세요.');return;}
  if(!e.picks.final){alert('"최종 선택"은 꼭 골라 주세요.');return;}
  const ids=BC_IDS.slice(0,e.n);
  let seatCup={};   // 자리/컵 번호 → 잔
  if(e.blind!=='none'&&!e.keep){
    const seats=bcOpts();
    if(e.blind==='app')seats.forEach((s,k)=>seatCup[s]=e.order[k]);
    else{
      seats.forEach(s=>seatCup[s]=e.seatMap[s]||'');
      const vals=Object.values(seatCup);
      if(vals.some(v=>!v)||new Set(vals).size!==vals.length){alert('"정답 확인"에서 자리마다 어느 잔인지 (겹치지 않게) 골라 주세요.');document.getElementById('bcReveal')?.scrollIntoView({block:'center'});return;}
    }
    if(e.blind==='app'&&!e.revealed)alert('정답 공개!\n\n'+e.order.map((id,k)=>`${k+1}번 컵 = ${id}${bcTag(id)?' · '+bcTag(id):''}`).join('\n'));
  }
  const mp=v=>(!v||v==='same')?v:(seatCup[v]||v);
  const picks={warm:{},cool:{},final:mp(e.picks.final)};
  ['warm','cool'].forEach(w=>BC_QS.forEach(q=>{const v=e.picks[w][q.key];if(v)picks[w][q.key]=mp(v);}));
  BC_QS.forEach(q=>{if(picks.warm[q.key])picks[q.key]=picks.warm[q.key];});   // 옛 CSV·집계가 읽는 평평한 값 = 따뜻할 때
  const flaws={};Object.entries(e.flaws).forEach(([o,a])=>{if(a&&a.length)flaws[seatCup[o]||o]=a.slice();});
  const list=ecLoad(),old=e.editId?list.find(x=>x.id===e.editId):null;
  const rec={id:e.editId||('ec_'+genId()),kind:'brew',n:e.n,date:e.date,
    brews:{},drain:{},cup_memo:{},cup_dates:{},flaws,
    changed:bcEffChanged().slice(),changed_auto:e.changed==null,picks,
    blind:e.keep?!!e.keep.blind:e.blind!=='none',blind_mode:e.keep?e.keep.blind_mode:e.blind,
    blind_order:e.keep?e.keep.blind_order:(e.blind!=='none'?bcOpts().map(s=>seatCup[s]):null),
    memo:(e.memo||'').trim(),created_at:old?old.created_at:Date.now(),updated_at:Date.now()};
  e.cups.forEach((c,i)=>{
    const s=c.sel;
    rec[c.id]={...dcClean({roast_id:s.roast_id,bean_id:s.bean_id,rb_id:s.rb_id,roastery:s.roastery,decaf:s.decaf||'',bean:s.bean,roast_date:s.roast_date,mode:s.mode,dtr:s.dtr,loss:s.loss,batch_no:s.batch_no,manual:s.manual||'',frozen:s.frozen||''}),degas_days:bcAge(i)};
    rec.brews[c.id]=dcClean({...c.brew});
    if(c.drain)rec.drain[c.id]=c.drain;if(c.memo.trim())rec.cup_memo[c.id]=c.memo.trim();if(c.date&&c.date!==e.date)rec.cup_dates[c.id]=c.date;
  });
  ['drain','cup_memo','cup_dates'].forEach(k=>{if(!Object.keys(rec[k]).length)delete rec[k];});
  if(!Object.keys(rec.flaws).length)delete rec.flaws;
  rec.summary=bcSummary(rec);
  if(old)list[list.indexOf(old)]=rec;else list.push(rec);
  ecSave(list);
  _bcLastId=rec.id;_bc=null;
  ecGo(old?'list':'bdone');
}
function bcDoneHtml(){
  const rec=ecLoad().find(x=>x.id===_bcLastId);
  if(!rec){_ecView='list';return ecListHtml();}
  const f=rec.picks.final;
  return `<div class="sh"><div class="stl">저장 완료</div></div>
  <div class="ec-card"><div class="ec-done-big">${f==='same'?'비슷함':'최종 선택: '+f+' 잔'}</div>
    <div class="ec-sum">${ecEsc(rec.summary)}</div></div>
  <div class="ec-pick-row two" style="margin-top:10px"><button class="ec-pick" onclick="ecChoose()">새 비교 시작</button><button class="ec-pick" onclick="ecGo('list')">기록 보기</button></div>`;
}

/* ── 목록 한 줄 ── */
function bcRowHtml(r){
  const ids=bcIdsOf(r),df=bcDiffs(r);
  const pk=w=>BC_QS.filter(q=>r.picks&&r.picks[w]&&r.picks[w][q.key]).map(q=>`${q.label} <b>${ecEsc(ecPickWord(r.picks[w][q.key]))}</b>`).join(' · ');
  const f=r.picks.final,warm=pk('warm'),cool=pk('cool');
  const beans=[...new Set(ids.map(id=>ecShort((r[id]||{}).bean)))].join(' / ');
  const ex=[];
  const per=(o,lab)=>{const t=ids.filter(id=>o&&o[id]&&o[id].length).map(id=>id+' '+(Array.isArray(o[id])?o[id].join('·'):o[id])).join(' / ');if(t)ex.push(lab+' '+t);};
  per(r.drain,'물빠짐');per(r.flaws,'문제');per(r.cup_memo,'메모');
  return `<div class="ec-row bc-row"><div class="bc-rtag">🧪 브루잉 비교 · ${ids.length}잔${r.blind?' · 블라인드':''}</div>
    <div class="ec-row-sum">${ecMD(r.date)} <b>${ecEsc(beans)}</b> · 바꾼 것 <b>${ecEsc((r.changed||[]).join('·')||'없음')}</b></div>
    ${df.length?`<div class="bc-rdiff">${df.map(d=>`<div><span>${ecEsc(d.item)}</span>${ecEsc(d.text)}</div>`).join('')}</div>`:''}
    ${warm?`<div class="bc-rpick">🔥 ${warm}</div>`:''}${cool?`<div class="bc-rpick">🧊 ${cool}</div>`:''}
    <div class="bc-rfinal">최종 <b>${f==='same'?'비슷함':ecEsc(f)}</b></div>
    ${r.memo?`<div class="ec-row-memo">“${ecEsc(r.memo)}”</div>`:''}
    ${ex.length?`<div class="ec-row-meta">${ecEsc(ex.join(' · '))}</div>`:''}
    <div class="ec-row-meta">디개싱 ${ids.map(id=>id+' '+((r[id]||{}).degas_days??'-')+'일').join(' · ')}</div>
    <div class="ec-row-btns"><button class="btn2" onclick="ecEdit('${r.id}')">수정</button><button class="btnd" onclick="ecDelete('${r.id}')">삭제</button></div></div>`;
}

/* ── 수정 ── */
function bcEdit(id){
  const r=ecLoad().find(x=>x.id===id);if(!r||r.kind!=='brew')return;
  const ids=bcIdsOf(r);
  const strip=s=>{const c={...s};delete c.degas_days;return c;};
  const clone=o=>JSON.parse(JSON.stringify(o||{}));
  _bc={editId:r.id,keep:r.blind?{blind:r.blind,blind_mode:r.blind_mode,blind_order:r.blind_order}:null,date:r.date,n:ids.length,
    cups:ids.map(k=>({id:k,sel:strip(r[k]),brew:{...bcBlankBrew(),...clone((r.brews||{})[k])},date:(r.cup_dates||{})[k]||'',drain:(r.drain||{})[k]||'',memo:(r.cup_memo||{})[k]||'',touched:true,more:false,recMore:false})),
    changed:(r.changed_auto===false)?(r.changed||[]).slice():null,
    blind:'none',order:[],revealed:true,seatMap:{},
    picks:{warm:clone((r.picks||{}).warm),cool:clone((r.picks||{}).cool),final:(r.picks||{}).final||''},flaws:clone(r.flaws),memo:r.memo||''};
  ecGo('bform');
}

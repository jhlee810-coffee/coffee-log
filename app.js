const SK='coffee_v3';
const GAS_URL='https://script.google.com/macros/s/AKfycbz2vHupdUOhyN7Tj4Pjm92X4rkVkyjUC0VFJ-46gk2UM8Da_u2WJRzUjDYjYbgtA3eJ/exec';
const NEG=['강한 쓴맛','역함','떫음','흙냄새','곰팡이냄새','과발효','밋밋함','텁텁함','연기냄새','너무 신맛','잡미','고무냄새','약품냄새','발효취','퀴퀴함','풀냄새','쓴 여운','금속맛','너무 진함','너무 묽음','건조함','떫은 여운','과추출','미추출','식은맛','탄맛','굽내','풋내'];

const OFFICIAL_RECIPES=[
  {id:'r_484',type:'내 메인 레시피',name:'484 레시피',coffee:15,water:240,temp:96,grind:'코만단테 22클릭',water_ratio:'백산수10:딥스골드1',desc:'40g 블룸→1분 80g→2분 40g, 2:30 종료. 백산수딥스골드75+에비앙25 기준',steps:[{time:'0:00',action:'블룸',detail:'전체 골고루 적시듯 원형 투입',water:'40g'},{time:'1:00',action:'2차 투입',detail:'중심부터 원형으로',water:'80g'},{time:'2:00',action:'3차 투입',detail:'중심부터 원형으로',water:'40g'},{time:'2:30',action:'종료',detail:'드립 완료 확인',water:'✓'}],color:''},
  {id:'r_46',type:'Tetsu Kasuya',name:'4:6 Method',coffee:20,water:300,temp:93,grind:'굵게 (프렌치프레스 수준)',water_ratio:'',desc:'앞 40%로 산미·단맛, 뒤 60%로 농도 조절. 45초 간격 5회 푸어',steps:[{time:'0:00',action:'1차 — 산미·단맛 조절',detail:'작게→달콤 / 크게→산미',water:'60g'},{time:'0:45',action:'2차 — 산미·단맛 조절',detail:'1+2차 합계 120g = 전체 40%',water:'60g'},{time:'1:30',action:'3차 — 농도 조절 시작',detail:'나머지 60% 구간 시작',water:'60g'},{time:'2:15',action:'4차',detail:'',water:'60g'},{time:'3:00',action:'5차 · 종료',detail:'3:30~4:00 완료 목표',water:'60g'}],color:'am'},
  {id:'r_switch',type:'Hario V60 Switch',name:'Switch 침지+투과',coffee:15,water:240,temp:93,grind:'미디엄-파인',water_ratio:'',desc:'스위치 닫고 블룸 → 추가투입 후 스위치 개방. 침지+투과 복합 방식',steps:[{time:'0:00',action:'블룸 (스위치 닫기)',detail:'30g 투입, 40초 대기',water:'30g'},{time:'0:40',action:'추가 투입',detail:'140g 천천히 원형 투입',water:'140g'},{time:'0:55',action:'스위치 열기',detail:'드립 시작. 1:45~2:00 완료 목표',water:'↓'},{time:'2:00',action:'종료',detail:'',water:'✓'}],color:'co'},
  {id:'r_hoffmann',type:'James Hoffmann',name:'Ultimate V60',coffee:30,water:500,temp:92,grind:'미디엄',water_ratio:'',desc:'45초 블룸 후 연속 투입+스월링. 균일추출로 클린컵 지향',steps:[{time:'0:00',action:'블룸',detail:'60g 투입, 45초 대기',water:'60g'},{time:'0:45',action:'연속 투입',detail:'0:45~1:30 사이 440g까지 투입',water:'440g'},{time:'1:30',action:'스월링',detail:'드리퍼 가볍게 스월링',water:''},{time:'3:30',action:'종료 목표',detail:'3:30~4:00 완료',water:'✓'}],color:'am'},
];

const ORIGIN_COLORS={
  '에티오피아':'var(--amber)',
  '케냐':'var(--coral)',
  '콜롬비아':'var(--purple)',
  '에콰도르':'var(--green)',
  '온두라스':'var(--teal)',
  '파나마':'#c084fc',
  '과테말라':'#fb923c',
  '페루':'#c9a876',
};

let db=loadDB();
let cf='all',cs='';
let openTimerId=null;

function loadDB(){
  try{
    const s=localStorage.getItem(SK);
    if(s){
      const p=JSON.parse(s);
      if(!p.beans||!p.beans.length) p.beans=INITIAL_DATA.beans;
      if(!p.roasts||!p.roasts.length) p.roasts=INITIAL_DATA.roasts;
      if(!p.recipes) p.recipes=[];
      if(!p.brewlogs) p.brewlogs=[];
      if(!p.wishlist) p.wishlist=[];
      if(!p.cuppings) p.cuppings=[];
      if(!p.dailycups) p.dailycups=[];
      if(!p.roasted_beans) p.roasted_beans=[];
      return p;
    }
  }catch(e){}
  const d=JSON.parse(JSON.stringify(INITIAL_DATA));
  d.recipes=[];d.brewlogs=[];d.wishlist=[];d.cuppings=[];d.dailycups=[];d.roasted_beans=[];
  return d;
}

function saveDB(){
  db._savedAt=Date.now();
  localStorage.setItem(SK,JSON.stringify(db));
  document.getElementById('saveInd').textContent='저장됨 '+new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});
  pushToSheets();
}

/* ── Sheets 전송용 압축 (2026-11-04) ──
   Sheets는 A1 셀 한 칸(최대 50,000자)에 전체 JSON을 저장함 → 앱이 압축해서 보냄.
   형식: {_z:'<deflate-raw 압축 후 base64>', _enc:'deflate-raw-b64', _savedAt}
   읽을 때 _z가 있으면 풀고, 없으면(옛 형식) 그대로 사용. 압축 불가 기기는 옛 형식으로 전송. */
const SHEET_CELL_MAX=50000;
function _b64FromBytes(u8){let s='';for(let i=0;i<u8.length;i+=0x8000)s+=String.fromCharCode.apply(null,u8.subarray(i,i+0x8000));return btoa(s);}
function _bytesFromB64(b){const s=atob(b),u8=new Uint8Array(s.length);for(let i=0;i<s.length;i++)u8[i]=s.charCodeAt(i);return u8;}
async function _pipe(u8,stream){return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(stream)).arrayBuffer());}
async function packForSheets(obj){
  const json=JSON.stringify(obj);
  if(typeof CompressionStream==='undefined')return json;
  try{
    const z=_b64FromBytes(await _pipe(new TextEncoder().encode(json),new CompressionStream('deflate-raw')));
    // 다시 풀어서 원본과 같은지 확인 — 다르면 압축 안 하고 보냄
    if(await unpackZ(z)!==json)return json;
    return JSON.stringify({_z:z,_enc:'deflate-raw-b64',_savedAt:obj._savedAt||0});
  }catch(e){console.warn('압축 실패, 원본 전송:',e);return json;}
}
async function unpackZ(z){return new TextDecoder().decode(await _pipe(_bytesFromB64(z),new DecompressionStream('deflate-raw')));}
async function unpackFromSheets(data){
  if(data&&data._z)return JSON.parse(await unpackZ(data._z));
  return data;
}

async function pushToSheets(){
  // 안전장치 (2026-11-07): 생두·로스팅이 하나도 없는 데이터는 절대 클라우드에 올리지 않음
  // (기기 저장소가 비었는데 동기화가 실패한 상태에서 빈 데이터로 덮어쓰는 사고 방지)
  if(!(db&&((db.beans||[]).length||(db.roasts||[]).length))){console.warn('빈 데이터라 업로드 안 함');return;}
  try{
    const body=await packForSheets(db);
    if(body.length>SHEET_CELL_MAX){
      console.warn('Sheets 셀 한도 초과:',body.length);
      document.getElementById('saveInd').textContent='⚠ 클라우드 용량 초과 — 이 기기에만 저장됨';
    }
    await fetch(GAS_URL,{method:'POST',body,headers:{'Content-Type':'text/plain'}});
  }catch(e){console.warn('Sheets 저장 실패:',e);}
}

async function syncFromSheets(){
  const ind=document.getElementById('saveInd');
  try{
    const res=await fetch(GAS_URL+'?t='+Date.now());
    const json=await res.json();
    if(json.ok&&json.data){
      const remote=await unpackFromSheets(json.data);  // 풀기 실패 시 catch로 → 로컬 데이터 유지
      if(!remote||!Array.isArray(remote.beans))throw new Error('클라우드 데이터 형식 이상');
      const remoteAt=remote._savedAt||0;
      const localAt=db._savedAt||0;
      if(remoteAt>=localAt){
        /* 클라우드가 같거나 최신 → 항상 클라우드 우선 */
        db=remote;
        if(!db.recipes)db.recipes=[];
        if(!db.brewlogs)db.brewlogs=[];
        if(!db.wishlist)db.wishlist=[];
        if(!db.cuppings)db.cuppings=[];
        if(!db.dailycups)db.dailycups=[];  // 오늘의 한 잔 (dailycup.js)
        if(!db.roasted_beans)db.roasted_beans=[];  // 원두 목록 (roasted.js)
        localStorage.setItem(SK,JSON.stringify(db));
        ind.textContent='☁ 동기화 '+new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});
      }else{
        /* 로컬이 더 최신 → 클라우드 업데이트 */
        pushToSheets();
        ind.textContent='↑ 업로드 '+new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});
      }
    }else{
      /* 시트가 비어 있음 → 현재 데이터 첫 업로드 */
      db._savedAt=Date.now();
      localStorage.setItem(SK,JSON.stringify(db));
      ind.textContent='⬆ 업로드 중...';
      await pushToSheets();
      ind.textContent='☁ 업로드 완료 '+new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});
    }
  }catch(e){
    console.warn('Sheets 동기화 실패:',e);
    ind.textContent='로드됨 '+new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});
  }
  try{renderDash();}catch(e){}
  // 실제 데이터가 없으면(기기 저장소 비었고 동기화도 실패) 아래 자동 정리·저장을 하지 않음
  if(!(db.beans||[]).length)return;
  // 동기화 끝난 최신 데이터로 소진 후보 확인 (앱 실행당 1번, beans.js)
  setTimeout(()=>{try{checkSoldOutCandidates();}catch(e){}},400);
  // 옛 로스팅 기록에 같은 날 배치 순서 채우기 (한 번만, roasts.js)
  try{backfillBatchNo();}catch(e){console.warn('배치 순서 채우기 실패',e);}
  // 같은 구매처 다른 이름 합치기 (shops.js SHOP_ALIASES)
  try{normalizeShopNames();}catch(e){console.warn('구매처 이름 정리 실패',e);}
  // 로스팅↔생두 ID 연결·계산값·한 번만 하는 정리 (datafix.js)
  try{runDataFixes();}catch(e){console.warn('데이터 정리 실패',e);}
}

function genId(){return Date.now().toString(36)+Math.random().toString(36).slice(2,5);}
function toSec(t){const p=t.split(':');return+p[0]*60+ +p[1];}
function fmtMS(s){const a=Math.max(0,Math.round(s)),m=Math.floor(a/60),sec=a%60;return `${m}:${String(sec).padStart(2,'0')}`;}

function exportData(){
  const json=JSON.stringify(db);
  const blob=new Blob([json],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='coffee-log-backup-'+new Date().toISOString().slice(0,10)+'.json';
  a.click();
}

function importData(input){
  const file=input.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=function(e){
    try{
      const parsed=JSON.parse(e.target.result);
      if(!parsed.beans)throw new Error('올바른 백업 파일이 아닙니다');
      if(!confirm(`데이터를 가져오면 현재 기기의 데이터가 덮어씌워집니다.\n생두 ${(parsed.beans||[]).length}개 / 로스팅 ${(parsed.roasts||[]).length}개 / 커핑 ${(parsed.cuppings||[]).length}개\n\n계속하시겠습니까?`))return;
      parsed._savedAt=Date.now(); /* 가져온 데이터가 클라우드보다 항상 최신으로 인식되도록 */
      localStorage.setItem(SK,JSON.stringify(parsed));
      location.reload();
    }catch(err){alert('가져오기 실패: '+err.message);}
  };
  reader.readAsText(file);
  input.value='';
}

function showTab(name,el){
  window.curTab=name;
  document.querySelectorAll('.sec').forEach(s=>s.classList.remove('on'));
  document.querySelectorAll('.tb').forEach(t=>t.classList.remove('on'));
  document.getElementById('tab-'+name).classList.add('on');
  el.classList.add('on');
  if(name==='timer'){
    const fr=document.getElementById('timerFrame');
    if(!fr.getAttribute('src')){
      fr.src='binbon_timer.html?v=20261107d';
      fr.addEventListener('load',function(){
        fr.contentWindow.postMessage({type:'beans_list',beans:db.beans,roasts:db.roasts},'*');
        if(window.planApplyToTimer)setTimeout(()=>planApplyToTimer(true),150);
      },{once:true});
    } else {
      fr.contentWindow.postMessage({type:'beans_list',beans:db.beans,roasts:db.roasts},'*');
      if(window.planApplyToTimer)setTimeout(()=>planApplyToTimer(),150);
    }
    if(window.renderPlanBar){renderPlanBar();planCheckRemote();}
  }
  const fn={dash:renderDash,beans:renderBeans,roasts:renderRoasts,brewing:renderBrewing,wishlist:renderWishlist,cupping:renderCupping,dailycup:typeof renderDailyCup==='function'?renderDailyCup:null,roasted:typeof renderRoastedBeans==='function'?renderRoastedBeans:null,easycup:typeof renderEasyCup==='function'?renderEasyCup:null};
  if(fn[name]) fn[name]();
  if(window.updateRoastBar) updateRoastBar();
}

function showBrewSub(i){
  document.querySelectorAll('.subsec').forEach(s=>s.classList.remove('on'));
  document.querySelectorAll('.st2').forEach(t=>t.classList.remove('on'));
  document.getElementById('bsub'+i).classList.add('on');
  document.getElementById('bst'+i).classList.add('on');
}

function fillSel(selId,items){
  const s=document.getElementById(selId);const v=s.value;
  s.innerHTML='<option value="">선택...</option>'+items.map(i=>`<option value="${i}" ${i===v?'selected':''}>${i}</option>`).join('');
}

/* 로컬(한국) 날짜 — toISOString()은 UTC라 오전 9시 전엔 전날 날짜가 됨 (2026-11-04 수정) */
function localDate(d){d=d||new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function today(){return localDate();}
function openMo(id){document.getElementById(id).classList.add('open');}
function closeMo(id){document.getElementById(id).classList.remove('open');}

function dr(k,v){return v?`<div class="dr"><div class="dk">${k}</div><div class="dv">${v}</div></div>`:''}

/* 범용 프리셋 칩 헬퍼 */
function chipSet(id,val,chip){
  document.getElementById(id).value=val;
  if(chip){
    chip.closest('.preset-chips').querySelectorAll('.pchip').forEach(c=>c.classList.remove('on'));
    chip.classList.add('on');
  }
}
function chipAdj(id,delta,min,max){
  const el=document.getElementById(id);
  let v=(+el.value||0)+delta;
  if(min!==undefined)v=Math.max(min,v);
  if(max!==undefined)v=Math.min(max,v);
  el.value=v;
}
/* 저장된 값으로 칩 하이라이트 동기화 */
function syncChips(inputId){
  const el=document.getElementById(inputId);
  if(!el)return;
  const val=String(el.value).trim();
  const fg=el.closest('.fg');
  if(!fg)return;
  fg.querySelectorAll('.pchip').forEach(c=>{
    c.classList.toggle('on',c.textContent.trim()===val||c.dataset.v===val);
  });
}

document.querySelectorAll('.mo').forEach(el=>el.addEventListener('click',e=>{if(e.target===el)el.classList.remove('open');}));

document.getElementById('f_blbean').addEventListener('change',function(){updateRoastSel(this.value,'');showBrewDegassing();});

try{renderDash();}catch(e){}
document.getElementById('saveInd').textContent='☁ 동기화 중...';
syncFromSheets();

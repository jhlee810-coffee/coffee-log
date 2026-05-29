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
  '페루':'#94a3b8',
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
      return p;
    }
  }catch(e){}
  const d=JSON.parse(JSON.stringify(INITIAL_DATA));
  d.recipes=[];d.brewlogs=[];d.wishlist=[];d.cuppings=[];
  return d;
}

function saveDB(){
  db._savedAt=Date.now();
  localStorage.setItem(SK,JSON.stringify(db));
  document.getElementById('saveInd').textContent='저장됨 '+new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});
  pushToSheets();
}

async function pushToSheets(){
  try{
    await fetch(GAS_URL,{method:'POST',body:JSON.stringify(db),headers:{'Content-Type':'text/plain'}});
  }catch(e){console.warn('Sheets 저장 실패:',e);}
}

async function syncFromSheets(){
  const ind=document.getElementById('saveInd');
  try{
    const res=await fetch(GAS_URL+'?t='+Date.now());
    const json=await res.json();
    if(json.ok&&json.data){
      const remote=json.data;
      const remoteAt=remote._savedAt||0;
      const localAt=db._savedAt||0;
      if(remoteAt>=localAt){
        /* 클라우드가 같거나 최신 → 항상 클라우드 우선 */
        db=remote;
        if(!db.recipes)db.recipes=[];
        if(!db.brewlogs)db.brewlogs=[];
        if(!db.wishlist)db.wishlist=[];
        if(!db.cuppings)db.cuppings=[];
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
}

function genId(){return Date.now().toString(36)+Math.random().toString(36).slice(2,5);}
function toSec(t){const p=t.split(':');return+p[0]*60+ +p[1];}

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
  document.querySelectorAll('.sec').forEach(s=>s.classList.remove('on'));
  document.querySelectorAll('.tb').forEach(t=>t.classList.remove('on'));
  document.getElementById('tab-'+name).classList.add('on');
  el.classList.add('on');
  if(name==='timer'){
    const fr=document.getElementById('timerFrame');
    if(!fr.getAttribute('src')){
      fr.src='binbon_timer.html';
      fr.addEventListener('load',function(){
        fr.contentWindow.postMessage({type:'beans_list',beans:db.beans},'*');
      },{once:true});
    } else {
      fr.contentWindow.postMessage({type:'beans_list',beans:db.beans},'*');
    }
  }
  const fn={dash:renderDash,beans:renderBeans,roasts:renderRoasts,brewing:renderBrewing,wishlist:renderWishlist,cupping:renderCupping};
  if(fn[name]) fn[name]();
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

function today(){return new Date().toISOString().slice(0,10);}
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

// rest.js — 배전 수치 · 디개싱 3시점(시작/최적기/끝) · 숙성 점수 곡선 · 내 평가로 최적기 학습 · 냉동 안내 (2026-11-15)
// 규칙·공식·이유는 COFFEE_LOG_CHANGELOG_20261115.md 에 있음. 저장 데이터는 건드리지 않고, 계산은 저장된 기록에서 그때그때 다시 함.
// 불러오는 쪽: restWindow(x)(옛 호출 호환: 배치 없이 기본 규칙만) · restForRoast(r) · restForRb(b) · restForSel(sel) · restStage(age,w) · restScore(age,w)

/* ═══ 1. 배전 수치 (0.0~10.0, 작을수록 라이트) ═══
   기준: 케냐·에티오피아 워시드 2번 모드 DTR 12% · 손실 11.5% 안팎 = 3.0 (라이트의 한가운데)
   DTR 성분 = 3.0 + 0.35 × (DTR − 12)      → DTR 1%p ≈ 0.35 (이름 한 단계 ≈ DTR 3~4%p ≈ 1.05)
   손실 성분 = 3.0 + 0.8  × (손실% − 11.5)  → 손실 1%p ≈ 0.8
   같은 생두끼리 비교('same'): 손실 70% + DTR 30% / 다른 생두끼리('cross', 기본): 손실 45% + DTR 55%
   손실은 weight_unreliable 아닌 기록만. 그 전 배치는 DTR만, DTR도 없으면 모드의 흔한 DTR로 추정 */
const RL_REF=3.0;
const RL_TYP_DTR={1:11,2:12,3:12,4:15,5:17,6:19,7:21,8:23};
const RL_CUTS=[[2.475,'울트라 라이트'],[3.525,'라이트'],[4.575,'라이트-미디엄'],[5.975,'미디엄'],[7.725,'미디엄-다크']];
function rlLoss(r){
  if(!r||r.weight_unreliable)return null;
  let l=parseFloat(r.loss_pct);
  if(!(l>0)){const i=parseFloat(r.input_g),o=parseFloat(r.output_g);if(i>0&&o>0)l=(1-o/i)*100;}
  return l>0&&l<30?l:null;
}
function rlDtr(r){
  const d=typeof roastDTRValue==='function'?roastDTRValue(r):parseFloat(r.dtr_pct);
  return d>0?d:(RL_TYP_DTR[+r.mode]||null);
}
function roastLevelNum(r,kind){
  if(!r)return null;
  const D=rlDtr(r),L=rlLoss(r);
  const dv=D==null?null:RL_REF+0.35*(D-12),lv=L==null?null:RL_REF+0.8*(L-11.5);
  let v;
  if(dv!=null&&lv!=null){const wl=kind==='same'?0.7:0.45;v=wl*lv+(1-wl)*dv;}
  else v=lv!=null?lv:dv;
  return v==null?null:Math.max(0,Math.min(10,Math.round(v*10)/10));
}
function rlNameOf(v){if(v==null)return '';for(const [m,n] of RL_CUTS)if(v<m)return n;return '다크';}
function roastLevelName(r){return (r&&r.roast_level)||rlNameOf(roastLevelNum(r,'cross'));}   // 화면에는 이름만 (저장된 이름이 있으면 그대로)

/* ═══ 2. 기본값 ═══ (일)
   내 로스팅: 시작 7 · 최적기 10~12(케냐·에티오피아 워시드) 또는 10~14(그 외) · 끝 28
   배전 수치가 기준(3.0)보다 라이트하면: 한 단계(1.05)당 시작 +1일 · 최적기 +1.5일 (최대 3단계), 진하면 같은 비율로 당김. 0.5단계 미만이면 그대로
   끝은 28일 그대로, 수치 5.5 넘는 강배전만 0.5 올라갈 때마다 1일씩 당김(최대 6일)
   구매 원두: 시작 = 입력한 시작일(rest_min, 없으면 7) · 끝 = 입력한 끝(rest_max, 없으면 28) · 최적기 = 시작+5~7 (입력 없으면 12~14) */
const REST_DEF={start:7,oMinWash:10,oMaxWash:12,oMax:14,end:28};
function restNorm(w){
  w.start=Math.max(2,Math.round(w.start));
  w.optMin=Math.max(w.start+2,Math.round(w.optMin));
  w.optMax=Math.max(w.optMin+2,Math.round(w.optMax));   // 최적기는 최소 3일 폭
  w.end=Math.max(w.optMax+7,Math.round(w.end));
  w.min=w.optMin;w.max=w.optMax;   // 옛 코드 호환 (최적기 구간)
  return w;
}
function restIsWash(x){
  const o=(x.origin||'')+' '+(x.name||x.bean_name||''),p=(x.process||'')+' '+(x.name||x.bean_name||'');
  return /케냐|에티오피아|kenya|ethiopia/i.test(o)&&/wash|워시드/i.test(p);
}
function restDefaultOwn(x,level){
  const wash=restIsWash(x);
  let start=REST_DEF.start,oMin=REST_DEF.oMinWash,oMax=wash?REST_DEF.oMaxWash:REST_DEF.oMax,end=REST_DEF.end,label=wash?'케냐·에티오피아 워시드':'기본';
  if(level!=null){
    const dl=Math.max(-3,Math.min(3,(RL_REF-level)/1.05));
    if(Math.abs(dl)>=0.5){start+=1.0*dl;oMin+=1.5*dl;oMax+=1.5*dl;}
    if(level>5.5)end-=Math.min(6,Math.round((level-5.5)*2));
  }
  return restNorm({start,optMin:oMin,optMax:oMax,end,label,level});
}
function restDefaultRb(b,delta){
  const mn=parseInt(b.rest_min),mx=parseInt(b.rest_max),hasStart=mn>0;
  const start=hasStart?mn:REST_DEF.start,end=mx>0?mx:REST_DEF.end,d=delta==null?6:delta;
  return restNorm({start,optMin:start+d-1,optMax:start+d+1,end,label:hasStart?'입력한 시작일':'기본',own:hasStart||mx>0});
}

/* ═══ 3. 점수 곡선 (0~100) ═══
   시작 전: 시작일 60점에서 하루 멀수록 9점씩 낮게(최저 5) · 시작→최적기 시작: 60→100 부드럽게(S자)
   최적기: 100 · 최적기 끝→끝: 100→40 부드럽게 · 끝 이후: 하루 6점씩 크게 낮게(최저 5) */
function restSmooth(t){t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);}
function restScore(age,w){
  if(age==null||!w)return 0;
  if(age<w.start)return Math.max(5,60-9*(w.start-age));
  if(age<w.optMin)return 60+40*restSmooth((age-w.start)/Math.max(1,w.optMin-w.start));
  if(age<=w.optMax)return 100;
  if(age<=w.end)return 100-60*restSmooth((age-w.optMax)/Math.max(1,w.end-w.optMax));
  return Math.max(5,40-6*(age-w.end));
}
/* 단계: 숙성 중(n일 남음) / 마셔도 됨 / 최적기 / 끝나감(끝 5일 전부터) / 지남. o: 0 최적기 · 1 숙성 중·마셔도 됨(곧 최적기) · 2 최적기 후 · 3 지남 */
function restStage(days,w){
  if(days==null||!w)return {l:'',short:'',c:'var(--muted)',o:9,score:0};
  const score=Math.round(restScore(days,w));
  if(days<w.start)return {l:`숙성 중 · ${w.start-days}일 남음`,short:`숙성 중(${w.start-days}일)`,c:'var(--amber)',o:1,wait:w.optMin-days,score};
  if(days<w.optMin)return {l:'마셔도 됨',short:'마셔도 됨',c:'#b8d98a',o:1,wait:w.optMin-days,score};
  if(days<=w.optMax)return {l:'최적기',short:'최적기',c:'#7ed6a5',o:0,score};
  if(days>w.end)return {l:'지남',short:'지남',c:'var(--coral)',o:3,score};
  if(days>=Math.max(w.optMax+1,w.end-5))return {l:'끝나감',short:'끝나감',c:'#e8a05a',o:2,score};
  return {l:'마셔도 됨',short:'마셔도 됨',c:'var(--muted2)',o:2,score};
}

/* ═══ 4. 평가 기록 모으기 (같은 원두 안 비교용) ═══
   한 잔: 별점 + 단맛 보정(±0.5) · 커핑: 총점 → 1~5 환산 · 쉬운 커핑: 이긴 쪽 4.0, 진 쪽 3.0(비김 3.5), 비중 0.6
   디개싱 일수는 저장된 값 대신 로스팅 날짜와 마신 날짜로 다시 계산 (냉동한 배치는 냉동한 날에서 멈춤) */
let _restCache=null;
function restDaysBetween(a,b){
  if(!a||!b)return null;const p=s=>{const [y,m,d]=String(s).split('-').map(Number);return Date.UTC(y,m-1,d);};
  const v=Math.round((p(b)-p(a))/86400000);return isNaN(v)?null:v;
}
function restSig(){
  const L=k=>((db&&db[k])||[]);
  return [L('dailycups').map(c=>c.id+(c.stars||'')+(c.sweet||'')+((c.bean_info||{}).frozen||'')).join(','),L('cuppings').length,L('easycups').length,
    L('roasts').map(r=>r.id+(r.loss_pct||'')+(r.dtr_pct||'')+(r.weight_unreliable?1:0)).join(','),L('roasted_beans').map(b=>b.id+(b.rest_min||'')+'-'+(b.rest_max||'')+(b.roast_date||'')).join(','),L('beans').length].join('|');
}
function restData(){
  if(typeof db==='undefined'||!db)return {ev:[],roastById:{},beanById:{},rbById:{},delta:null};
  const sig=restSig();if(_restCache&&_restCache.sig===sig)return _restCache;
  const roastById={},beanById={},rbById={};
  (db.roasts||[]).forEach(r=>roastById[r.id]=r);(db.beans||[]).forEach(b=>beanById[b.id]=b);(db.roasted_beans||[]).forEach(b=>rbById[b.id]=b);
  const ev=[];
  const push=(rid,rbid,age,q,w)=>{
    if(age==null||age<0||age>120||!(q>0))return;
    const r=rid?roastById[rid]:null;
    ev.push({rid:rid||'',rbid:rbid||'',bid:r?(r.bean_id||('n:'+r.bean_name)):(rbid?'rb:'+rbid:''),age,q,w:w||1});
  };
  (db.dailycups||[]).forEach(c=>{
    const s=c.bean_info||{};if(!(+c.stars>0))return;
    const rd=s.rb_id?(rbById[s.rb_id]||{}).roast_date:(s.roast_id&&roastById[s.roast_id]?roastById[s.roast_id].date:s.roast_date);
    const end=(s.frozen&&s.frozen<c.date)?s.frozen:c.date;
    const q=+c.stars+(+c.sweet>0?0.25*(+c.sweet-3):0);
    push(s.roast_id,s.rb_id,restDaysBetween(rd,end),q,1);
  });
  (db.cuppings||[]).forEach(cp=>(cp.cups||[]).forEach(cu=>{
    const r=roastById[cu.roast_id];if(!r||!(+cu.total>0))return;
    push(r.id,'',restDaysBetween(r.date,cp.date),Math.max(1,Math.min(5,1+(+cu.total-60)/7.5)),1);
  }));
  (db.easycups||[]).forEach(e=>{
    const f=(e.picks||{}).final;if(!f)return;
    ['A','B'].forEach(k=>{const s=e[k]||{};if(!s.roast_id)return;const r=roastById[s.roast_id];
      push(s.roast_id,'',s.degas_days!=null&&s.degas_days!==''?+s.degas_days:restDaysBetween(r&&r.date,e.date),f===k?4.0:(f==='same'?3.5:3.0),0.6);});
  });
  const o={sig,ev,roastById,beanById,rbById,delta:null,memo:{}};
  _restCache=o;
  o.delta=restRbDelta(o);
  return o;
}

/* ═══ 5. 학습: 평가가 가장 좋았던 디게싱 일수 찾기 ═══
   날짜별 평가를 가까운 날끼리 부드럽게 섞은 곡선(폭 ±1.6일)에서 가장 높은 곳과 그 근처(0.3점 이내)를 최적기로 본다.
   시작: 그보다 이른 평가가 확실히 낮을 때(최고 −1.2점 미만) 그 지점 · 끝: 그 뒤에 평가가 확실히 떨어질 때(최고 −1.0점 미만)만 학습
   최고와 최저 차이가 0.5점 미만이면(구분 신호 없음) 학습 안 함. 최소 3잔(비슷한 원두 그룹은 4잔) + 서로 3일 이상 떨어진 날짜 2개 이상 */
function restLearn(evs,minN){
  const n=evs.reduce((s,e)=>s+e.w,0);
  if(n<(minN||3))return null;
  const ages=evs.map(e=>Math.round(e.age)),mn=Math.min(...ages),mx=Math.max(...ages);
  if(mx-mn<3)return null;
  const f=a=>{let sw=0,sq=0;evs.forEach(e=>{const k=e.w*Math.exp(-Math.pow(a-e.age,2)/(2*1.6*1.6));sw+=k;sq+=k*e.q;});return sw>0.25?sq/sw:null;};
  const grid=[];for(let a=mn;a<=mx;a++){const v=f(a);if(v!=null)grid.push([a,v]);}
  if(grid.length<3)return null;
  let bi=0;grid.forEach((g,i)=>{if(g[1]>grid[bi][1])bi=i;});
  const best=grid[bi][1],low=Math.min(...grid.map(g=>g[1]));
  if(best-low<0.5)return null;
  let i0=bi,i1=bi;while(i0>0&&grid[i0-1][1]>=best-0.3)i0--;while(i1<grid.length-1&&grid[i1+1][1]>=best-0.3)i1++;
  let lo=grid[i0][0],hi=grid[i1][0];
  if(hi-lo<2){const c=Math.round((lo+hi)/2);lo=c-1;hi=c+1;}   // 최소 3일 폭
  let start=null,end=null;
  if(mn<lo-1&&grid[0][1]<best-1.2){const g=grid.find(x=>x[1]>=best-1.2);if(g)start=g[0];}
  if(mx>hi+3&&grid[grid.length-1][1]<best-1.0){const g=grid.find(x=>x[0]>hi&&x[1]<best-0.8);if(g)end=g[0];}
  return {n,lo,hi,start,end};
}
/* 섞는 비율: 학습 비중 = n/(n+8) (최대 85%). 3잔 27% · 6잔 43% · 12잔 60% · 24잔 75%. 시작은 ×0.8, 끝은 ×0.6 */
function restBlend(def,L){
  if(!L)return {...def,src:'기본값',n:0};
  const w=Math.min(0.85,L.n/(L.n+8));
  const o={...def,optMin:def.optMin*(1-w)+L.lo*w,optMax:def.optMax*(1-w)+L.hi*w};
  if(L.start!=null)o.start=def.start*(1-w*0.8)+L.start*w*0.8;
  if(L.end!=null)o.end=def.end*(1-w*0.6)+L.end*w*0.6;
  restNorm(o);
  o.src=`내 기록 ${Math.round(L.n)}잔 기준`;o.n=Math.round(L.n);o.learn=L;
  return o;
}
/* 구매 원두: 입력한 시작일 대비 가장 좋았던 날이 며칠 뒤였는지를 구매 원두 전체에서 모아 +5~7을 조금씩 맞춤 (기본 +6, 비중 N/(N+10)) */
function restRbDelta(D){
  let sum=0,N=0;
  (Object.values(D.rbById)).forEach(b=>{
    const evs=D.ev.filter(e=>e.rbid===b.id),L=restLearn(evs,3);if(!L)return;
    const st=restDefaultRb(b).start;sum+=((L.lo+L.hi)/2-st)*L.n;N+=L.n;
  });
  if(!N)return null;
  const mean=sum/N,w=N/(N+10);
  return {d:Math.max(3,Math.min(12,6+(mean-6)*w)),n:Math.round(N),raw:mean};
}

/* ═══ 6. 배치별 창 ═══ 데이터 찾는 순서: 같은 배치 → 같은 생두 → 비슷한 그룹(산지+가공+배전 수치) → 기본값 */
function restForRoast(r){
  if(!r)return restNorm({...restDefaultOwn({},null),src:'기본값',n:0});
  const D=restData(),key='r:'+r.id;if(D.memo[key])return D.memo[key];
  const bean=D.beanById[r.bean_id]||(db.beans||[]).find(b=>b.name===r.bean_name)||{};
  const x={name:r.bean_name,origin:bean.origin,process:bean.process};
  const lvC=roastLevelNum(r,'cross');
  let def=restDefaultOwn(x,lvC);
  const mn=parseInt(bean.rest_min),mx=parseInt(bean.rest_max);   // 생두에 직접 넣은 값은 기본값 대신 (옛 방식: 최적기 구간)
  if(mn>0||mx>0){def=restNorm({start:Math.max(3,(mn>0?mn:def.optMin)-3),optMin:mn>0?mn:def.optMin,optMax:mx>0?mx:def.optMax,end:def.end,label:'직접 지정',own:true,level:lvC});}
  const beanKey=r.bean_id||('n:'+r.bean_name),lvS=roastLevelNum(r,'same');
  let L=null,scope='';
  const own=D.ev.filter(e=>e.rid===r.id);
  if((L=restLearn(own,3)))scope='batch';
  else{
    const sb=D.ev.filter(e=>e.bid===beanKey&&e.rid).map(e=>{
      const o=D.roastById[e.rid],ls=roastLevelNum(o,'same');
      const wl=(lvS!=null&&ls!=null)?Math.exp(-Math.pow(lvS-ls,2)/(2*0.8*0.8)):1;
      return {...e,w:e.w*wl};});
    if((L=restLearn(sb,3)))scope='bean';
    else{   // 비슷한 그룹: 같은 산지·가공·배전 수치(±1.0), 생두마다 평균을 빼서 "원두가 맛있는 것"과 "시점이 좋은 것"을 분리
      const byBean={};
      D.ev.forEach(e=>{if(!e.rid||e.bid===beanKey)return;const o=D.roastById[e.rid],b=D.beanById[o.bean_id];
        if(!b||b.origin!==bean.origin||(b.process||'')!==(bean.process||''))return;
        const lc=roastLevelNum(o,'cross');if(lvC!=null&&lc!=null&&Math.abs(lc-lvC)>1.0)return;
        (byBean[e.bid]=byBean[e.bid]||[]).push(e);});
      const pool=[];Object.values(byBean).forEach(a=>{const m=a.reduce((s,e)=>s+e.q,0)/a.length;a.forEach(e=>pool.push({...e,q:e.q-m+3}));});
      if((L=restLearn(pool,4)))scope='group';
    }
  }
  const w=restBlend(def,L);w.scope=scope;w.level=lvC;w.levelName=roastLevelName(r);w.kind='own';
  return (D.memo[key]=w);
}
function restForRb(b){
  if(!b)return restNorm({...restDefaultRb({}),src:'기본값',n:0});
  const D=restData(),key='b:'+b.id;if(D.memo[key])return D.memo[key];
  const def=restDefaultRb(b,D.delta?D.delta.d:null);
  const L=restLearn(D.ev.filter(e=>e.rbid===b.id),3);
  const w=restBlend(def,L);
  if(L){w.start=def.start;w.end=def.end;restNorm(w);}   // 구매 원두: 시작·끝은 입력값 그대로, 최적기만 학습
  w.scope=L?'rb':(D.delta?'rball':'');w.kind='rb';w.levelName='';
  if(!L&&D.delta){w.src=`구매 원두 ${D.delta.n}잔 기준`;w.n=D.delta.n;}
  return (D.memo[key]=w);
}
/* 커피 한 잔 화면의 선택(sel: roast_id / rb_id / 직접 입력) → 창 */
function restForSel(sel){
  if(!sel)return null;
  const D=restData();
  if(sel.rb_id){const b=D.rbById[sel.rb_id];return b?restForRb(b):null;}
  if(sel.roast_id&&D.roastById[sel.roast_id])return restForRoast(D.roastById[sel.roast_id]);
  const bean=(db.beans||[]).find(b=>b.id===sel.bean_id||b.name===sel.bean)||{};
  return restNorm({...restDefaultOwn({name:sel.bean,origin:bean.origin,process:bean.process},null),src:'기본값',n:0});
}
/* 옛 호출 호환: 배치 없이 생두/원두 정보만 있을 때 (생두 정보창 안내, 원두 입력창 안내 등) */
function restWindow(x){
  if(!x)return {...restDefaultOwn({},null),src:'기본값',n:0};
  if(x.roastery!==undefined||(x.id&&String(x.id).startsWith('rb_'))){const D=restData();return D.rbById[x.id]?restForRb(D.rbById[x.id]):{...restDefaultRb(x,D.delta?D.delta.d:null),src:'기본값',n:0};}
  const w=restDefaultOwn(x,null);
  const mn=parseInt(x.rest_min),mx=parseInt(x.rest_max);
  if(mn>0||mx>0)return {...restNorm({start:Math.max(3,(mn>0?mn:w.optMin)-3),optMin:mn>0?mn:w.optMin,optMax:mx>0?mx:w.optMax,end:w.end,label:'직접 지정',own:true}),src:'직접 지정',n:0};
  return {...w,src:'기본값',n:0};
}
function restText(w){return w?`${w.start} · ${w.optMin}~${w.optMax} · ${w.end}일`:'';}   // "7 · 10~12 · 28일"

/* ═══ 7. 홈 안내: 소분 냉동 / 끝나감 ═══ */
function restCupsOfRoast(id){return (db.dailycups||[]).filter(c=>(c.bean_info||{}).roast_id===id);}
function restAdvice(t){
  const out=[];if(typeof db==='undefined'||!db)return out;
  const D=restData(),held=typeof roastHeld==='function'?roastHeld:()=>true;
  const grp={};
  const add=(kind,key,item)=>{const k=kind+'|'+key;(grp[k]=grp[k]||{kind,...item,n:0}).n++;};
  (db.roasts||[]).forEach(r=>{
    if(!held(r)||r.frozen||r.stock_state==='gift'||!r.date)return;
    const age=restDaysBetween(r.date,t);if(age==null||age<0)return;
    const w=restForRoast(r),bean=D.beanById[r.bean_id]||{},name=typeof dashFullName==='function'?dashFullName(r.bean_name,bean.id?bean:null):r.bean_name;
    const beanKey=r.bean_id||('n:'+r.bean_name),mine=restCupsOfRoast(r.id);
    const item={label:name,date:r.date,age,w,tab:'roasted'};
    if(w.end-age<=5&&age<=w.end+14){add('ending',r.date+'|'+beanKey,item);return;}
    if(age>=w.optMin&&age<=w.optMax){
      const good=mine.some(c=>+c.stars>=4)||D.ev.some(e=>e.bid===beanKey&&e.rid&&e.rid!==r.id&&e.q>=4&&e.age>=w.optMin-2&&e.age<=w.optMax+2);
      const tasted=mine.length>0||D.ev.some(e=>e.bid===beanKey&&e.rid);
      if(good)add('freeze',r.date+'|'+beanKey,item);else if(!tasted)add('try',r.date+'|'+beanKey,item);
    }
  });
  (db.roasted_beans||[]).forEach(b=>{
    if(b.status==='다 마심'||b.frozen||!b.roast_date)return;
    const age=restDaysBetween(b.roast_date,t);if(age==null||age<0)return;
    const w=restForRb(b),mine=(db.dailycups||[]).filter(c=>(c.bean_info||{}).rb_id===b.id);
    const item={label:b.name,date:b.roast_date,age,w,tab:'roasted'};
    if(w.end-age<=5&&age<=w.end+14){add('ending','rb'+b.id,item);return;}
    if(age>=w.optMin&&age<=w.optMax){
      if(mine.some(c=>+c.stars>=4))add('freeze','rb'+b.id,item);else if(!mine.length)add('try','rb'+b.id,item);
    }
  });
  return Object.values(grp).sort((a,b)=>({freeze:0,ending:1,try:2})[a.kind]-({freeze:0,ending:1,try:2})[b.kind]||a.date.localeCompare(b.date));
}

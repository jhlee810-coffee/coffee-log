// labels.js — 님봇(NIIMBOT) B1 라벨 출력 · 2026-11-11
// 라벨 4종: bean(생두 정보 50×90) · roast(로스팅 정보 50×30) · vac(진공, 직접 볶은 원두) · vacb(진공, 구매 원두)
// 디자인 원본: design/labels/*.dc.html (1px = 프린터 1점, 1mm = 8점) — 아래 lbHtml*() 가 그 마크업을 그대로 따름
// 흐름: 실제 데이터로 HTML 라벨 → 글자 맞춤(넘치면 줄바꿈·글자 줄임) → 줄 단위로 캔버스에 그림(lbPaintRoot) → 흑백 1비트 → (필요하면 회전·가운데 384점) → niimbluelib로 출력
// 프린터 연결: 웹 블루투스(아이폰 Bluefy, PC 크롬) / 웹 시리얼(PC USB). 사파리처럼 안 되면 [라벨 이미지 저장]
// 라이브러리: lib/niimbluelib.min.js (MIT, 0.49.1) — 프린터 쪽을 처음 쓸 때 불러옴
// 글꼴 Noto Sans KR 은 Google Fonts 에서 (인터넷 필요)

const LB_LIBS={nb:'lib/niimbluelib.min.js?v=0.49.1'};
const LB_FONT_CSS='https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@500;700;900&display=swap';
const LB_HEAD=384;      // B1 프린트헤드 가로 점수(48mm). 50mm 롤(400점)은 양끝 8점씩 안 닿음 → 가운데 384점만 찍힘
const LB_TH=150;        // 흑백 변환 기준 (0~255, 클수록 굵게)
// text-autospace / text-spacing-trim 끄기: 최신 크롬·사파리가 한글과 영문·기호 사이에 자동으로 넣는 간격·다듬기를 꺼서, 화면(DOM) 배치와 캔버스에 그린 결과가 브라우저와 상관없이 같게 함
const LB_FONT='font-family:\'Noto Sans KR\',\'Apple SD Gothic Neo\',\'Malgun Gothic\',sans-serif;text-autospace:no-autospace;text-spacing-trim:space-all;';
const LB_WRAP='word-break:keep-all;overflow-wrap:anywhere;';
const LB_TYPES={
  bean :{name:'생두 정보',        w:720,h:400,rollW:50,rollH:90,rotate:true},
  roast:{name:'로스팅 정보',      w:400,h:240,rollW:50,rollH:30,rotate:false},
  vac  :{name:'진공(직접 볶은)',  w:400,h:240,rollW:50,rollH:30,rotate:false},
  vacb :{name:'진공(구매 원두)',  w:400,h:240,rollW:50,rollH:30,rotate:false},
};
const LB={client:null,kind:'',name:'',connecting:false,printing:false,fontOk:null,lastFail:null};

/* ── 설정 (이 기기 localStorage) ── */
const LB_CFG_KEY='coffee_label_cfg';
function lbCfg(){
  const d={density:3,rot:'cw',auto:true,vacG:20};
  try{return {...d,...JSON.parse(localStorage.getItem(LB_CFG_KEY)||'{}')};}catch(e){return d;}
}
function lbCfgSet(p){const c={...lbCfg(),...p};try{localStorage.setItem(LB_CFG_KEY,JSON.stringify(c));}catch(e){}return c;}

/* ── 글자 다듬기 ── */
const lbEsc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function lbDate(s){const m=String(s||'').match(/^(\d{4})-(\d{2})-(\d{2})/);return m?`${m[1]}.${m[2]}.${m[3]}`:String(s||'');}
function lbList(s,sep){s=String(s||'').trim();if(!s)return '';return /[,，、]/.test(s)?s.split(/[,，、]/).map(x=>x.trim()).filter(Boolean).join(sep||' · '):s;}
/* 컵노트: 쉼표로 구분된 것은 그대로, 예전 데이터처럼 공백으로만 구분된 것은 단어마다 · 로 (고르기 목록의 두 단어 노트 "말린 살구" 등은 한 덩어리로 유지) */
function lbNotes(s){
  s=String(s||'').trim();if(!s)return '';
  if(/[,，、]/.test(s))return lbList(s);
  const multi=(typeof BEAN_CUPNOTES!=='undefined'?BEAN_CUPNOTES:[]).filter(n=>n.includes(' ')).sort((a,b)=>b.length-a.length);
  let t=s;multi.forEach(n=>{t=t.split(n).join(n.replace(/ /g,' '));});
  return t.split(/\s+/).filter(Boolean).map(x=>x.replace(/ /g,' ')).join(' · ');
}
function lbAlt(s){
  const n=(String(s||'').match(/\d{3,4}/g)||[]).map(Number).slice(0,2);
  if(!n.length)return String(s||'').trim();
  const f=v=>v.toLocaleString('en-US');
  return (n.length===2&&n[0]!==n[1]?`${f(Math.min(...n))}–${f(Math.max(...n))}`:f(n[0]))+'m';
}
function lbProc(s){s=String(s||'').trim();return ({'Washed':'워시드','Natural':'내추럴','Honey':'허니'})[s]||s;}
function lbNum(v){const n=parseFloat(v);return isNaN(n)?'':String(+n.toFixed(2));}

/* ── 라벨에 넣을 데이터 ── */
function lbBeanData(b){
  return {name:b.name||'',shop:b.shop||'',regionFarm:String(b.region||'').replace(/\s*\/\s*/g,' · '),altitude:lbAlt(b.altitude),
    variety:lbList(b.variety),process:lbProc(b.process),notes:lbNotes(b.cup_notes),price:lbNum(b.price)};
}
function lbRoastData(r){
  let dtr=r.dtr_pct;
  if(!dtr){try{const v=typeof roastDTRValue==='function'?roastDTRValue(r):null;if(v!=null)dtr=v.toFixed(1);}catch(e){}}
  const md=r.mode?`${r.mode}${dtr?'-'+dtr+'%':''}`:(dtr?dtr+'%':'—');
  let loss=r.loss_pct;
  if(!loss&&+r.input_g>0&&+r.output_g>0)loss=((+r.input_g-+r.output_g)/+r.input_g*100).toFixed(1);
  let lvl='';try{lvl=r.roast_level||(typeof dtrToLevel==='function'&&dtr?dtrToLevel(dtr):'');}catch(e){}
  return {date:lbDate(r.date),batch:r.batch_no?'#'+r.batch_no:'',md,level:lbLevel3(lvl),pop:r.pop_elapsed||'—',total:r.total_time||'—',
    loss:loss?loss+'%':'—',out:r.output_g?r.output_g+'g':'—'};
}
/* 로스팅 단계를 라벨에는 세 가지로만: 울트라 라이트·라이트 → 라이트 / 라이트-미디엄·미디엄·미디엄-다크 → 미디엄 / 다크 → 다크 */
function lbLevel3(name){
  name=String(name||'').replace(/\s+/g,'');if(!name)return '';
  if(name==='울트라라이트'||name==='라이트')return '라이트';
  if(/미디엄|미디움/.test(name))return '미디엄';
  if(/다크/.test(name))return '다크';
  if(/라이트/.test(name))return '라이트';
  return '';
}
function lbVacRoastData(r,g){
  const b=(typeof beanOfRoast==='function'?beanOfRoast(r):null)||{};
  return {name:b.name||r.bean_name||'',date:lbDate(r.date),g:g+'g',notes:lbNotes(b.cup_notes)};
}
function lbVacRbData(b,g){
  return {roastery:b.roastery||'',name:b.name||'',date:lbDate(b.roast_date),g:g+'g',notes:lbNotes(b.cup_notes)};
}

/* ── 디자인 마크업 (design/labels 의 인라인 스타일 그대로) ── */
const lbFit=(cap,val)=>`<div style="display:flex;flex-direction:column"><div style="font-size:24px;font-weight:700;line-height:1.2">${cap}</div><div data-fit="2" data-min="24" style="${LB_WRAP}font-size:28px;font-weight:700;line-height:1.25">${lbEsc(val)||'&nbsp;'}</div></div>`;
function lbHtmlBean(d){
  return `<div class="lb-root" style="width:720px;height:400px;box-sizing:border-box;background:#ffffff;color:#000000;${LB_FONT}display:flex;flex-direction:column;overflow:hidden">
<div style="background:#000000;color:#ffffff;padding:18px 32px 16px;display:flex;justify-content:space-between;align-items:flex-end;gap:16px">
<div data-fit="2" data-min="30" style="${LB_WRAP}font-size:44px;font-weight:900;line-height:1.1;letter-spacing:-0.5px">${lbEsc(d.name)}</div>
<div style="display:flex;gap:14px;font-size:26px;font-weight:700;line-height:1.1;white-space:nowrap;margin-bottom:2px"><span>${lbEsc(d.shop)}</span>${d.price?`<span>${lbEsc(d.price)}</span>`:''}</div>
</div>
<div style="flex-grow:1;padding:16px 32px 0;display:grid;grid-template-columns:minmax(0,1fr) fit-content(300px);column-gap:28px;row-gap:20px;align-content:start">
${lbFit('지역 · 농장',d.regionFarm)}${lbFit('고도',d.altitude)}${lbFit('품종',d.variety)}${lbFit('가공',d.process)}
</div>
<div style="margin:0 32px 20px;padding-top:10px;border-top:3px solid #000000">
<div data-fit="1" data-min="20" style="font-size:28px;font-weight:700;line-height:1.25;white-space:nowrap">${lbEsc(d.notes)||'&nbsp;'}</div>
</div>
</div>`;
}
function lbHtmlRoast(d){
  // 항목 이름은 고정 폭(62점)이라 값이 줄마다 같은 자리에서 시작함 (1팝/총/손실/최종 어느 줄이든 왼쪽 맞춤)
  const row=(k,v)=>`<div style="display:flex;gap:6px"><span style="flex:none;width:62px;font-weight:500">${k}</span><span style="font-weight:700;white-space:nowrap">${lbEsc(v)}</span></div>`;
  return `<div class="lb-root" style="width:400px;height:240px;box-sizing:border-box;background:#ffffff;color:#000000;${LB_FONT}padding:18px 24px 20px;display:flex;flex-direction:column;overflow:hidden">
<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">
<div style="font-size:42px;font-weight:900;line-height:1.05;letter-spacing:-1px;white-space:nowrap">${lbEsc(d.date)}</div>
<div style="font-size:24px;font-weight:700;white-space:nowrap">${lbEsc(d.batch)}</div>
</div>
<div style="margin-top:12px;display:flex;justify-content:space-between;align-items:baseline;gap:10px;border-bottom:3px solid #000000;padding-bottom:6px">
<div data-fit="1" data-min="24" style="font-size:32px;font-weight:900;line-height:1.1;white-space:nowrap">${lbEsc(d.md)}</div>
${d.level?`<div style="font-size:28px;font-weight:900;line-height:1.1;white-space:nowrap">${lbEsc(d.level)}</div>`:''}
</div>
<div style="margin-top:auto;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:16px;row-gap:6px;font-size:26px;line-height:1.2">
${row('1팝',d.pop)}${row('총',d.total)}${row('손실',d.loss)}${row('최종',d.out)}
</div>
</div>`;
}
function lbHtmlVac(d){
  return `<div class="lb-root" style="width:400px;height:240px;box-sizing:border-box;background:#ffffff;color:#000000;${LB_FONT}padding:16px 24px 16px;display:flex;flex-direction:column;gap:6px;overflow:hidden">
<div data-fit="2" data-min="24" style="${LB_WRAP}font-size:28px;font-weight:900;line-height:1.15;letter-spacing:-0.5px">${lbEsc(d.name)}</div>
<div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;border-bottom:3px solid #000000;padding-bottom:5px">
<div style="font-size:26px;font-weight:700;line-height:1.2;white-space:nowrap">${lbEsc(d.date)}</div>
<div style="font-size:24px;font-weight:700;white-space:nowrap">${lbEsc(d.g)}</div>
</div>
<div data-fit="2" data-min="24" style="${LB_WRAP}font-size:24px;font-weight:500;line-height:1.3">${lbEsc(d.notes)}</div>
</div>`;
}
function lbHtmlVacb(d){
  return `<div class="lb-root" style="width:400px;height:240px;box-sizing:border-box;background:#ffffff;color:#000000;${LB_FONT}padding:14px 24px 14px;display:flex;flex-direction:column;gap:5px;overflow:hidden">
<div data-fit="1" data-min="24" style="font-size:24px;font-weight:700;line-height:1.2;white-space:nowrap">${lbEsc(d.roastery)}</div>
<div data-fit="2" data-min="24" style="${LB_WRAP}font-size:28px;font-weight:900;line-height:1.15;letter-spacing:-0.5px">${lbEsc(d.name)}</div>
<div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;border-bottom:3px solid #000000;padding-bottom:5px">
<div style="font-size:26px;font-weight:700;line-height:1.2;white-space:nowrap">${lbEsc(d.date)}</div>
<div style="font-size:24px;font-weight:700;white-space:nowrap">${lbEsc(d.g)}</div>
</div>
<div data-fit="2" data-min="24" style="${LB_WRAP}font-size:24px;font-weight:500;line-height:1.3">${lbEsc(d.notes)}</div>
</div>`;
}
const LB_HTML={bean:lbHtmlBean,roast:lbHtmlRoast,vac:lbHtmlVac,vacb:lbHtmlVacb};

/* ── 라이브러리·글꼴 불러오기 ── */
const _lbScripts={};
function lbLoadScript(src){
  if(_lbScripts[src])return _lbScripts[src];
  return _lbScripts[src]=new Promise((ok,bad)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>{delete _lbScripts[src];bad(new Error('라이브러리를 불러오지 못했어요: '+src));};document.head.appendChild(s);});
}
const lbEnsureNb=()=>window.niimbluelib?Promise.resolve():lbLoadScript(LB_LIBS.nb);
let _lbFontCss=null;
function lbFonts(text){
  if(!_lbFontCss)_lbFontCss=new Promise(ok=>{
    const l=document.createElement('link');l.id='lbFontCss';l.rel='stylesheet';l.href=LB_FONT_CSS;l.onload=()=>ok(true);l.onerror=()=>ok(false);document.head.appendChild(l);
    setTimeout(()=>ok(false),10000);
  });
  return _lbFontCss.then(async okCss=>{
    if(!okCss){LB.fontOk=false;return;}
    const t=text||'가나다';
    const res=await Promise.race([Promise.all(['500','700','900'].map(w=>document.fonts.load(`${w} 28px "Noto Sans KR"`,t))),new Promise(r=>setTimeout(()=>r(null),10000))]);
    LB.fontOk=!!res&&res.every(a=>a&&a.length);
  }).catch(()=>{LB.fontOk=false;});
}

/* ── 글자 맞춤: 줄 수 제한 → 글자 줄임(최소 24점=3mm) → 그래도 넘치면 … 로 줄임 ── */
function lbLines(el){const lh=parseFloat(getComputedStyle(el).lineHeight);return lh>0?Math.round(el.getBoundingClientRect().height/lh):1;}
function lbFs(el){return parseFloat(getComputedStyle(el).fontSize);}
// 칸이 넘치는지: 줄 수가 max 줄을 넘거나, 한 줄 고정(nowrap) 칸이 옆으로 삐져나감
const lbTooLong=(el,max)=>lbLines(el)>(max||+el.dataset.fit||1)||(getComputedStyle(el).whiteSpace==='nowrap'&&el.scrollWidth>el.clientWidth+1);
function lbEllipsize(el,max){
  const full=el.dataset.full||el.textContent;el.dataset.full=full;
  let lo=0,hi=full.length;
  while(lo<hi){const mid=Math.ceil((lo+hi)/2);el.textContent=full.slice(0,mid).trimEnd()+'…';if(!lbTooLong(el,max))lo=mid;else hi=mid-1;}
  el.textContent=full.slice(0,lo).trimEnd()+'…';
}
function lbFitRoot(root,notes){
  const els=[...root.querySelectorAll('[data-fit]')];
  // 넘침 = 내용의 맨 아래가 라벨 바닥에서 4점 안쪽보다 더 내려가거나 옆으로 삐져나감 (시안도 아래 여백을 조금 쓰는 구조라 padding은 넘침으로 안 침)
  const bottom=()=>{const top=root.getBoundingClientRect().top;let m=0;root.querySelectorAll('*').forEach(e=>{m=Math.max(m,e.getBoundingClientRect().bottom-top);});return m;};
  const over=()=>bottom()>root.clientHeight-4||root.scrollWidth>root.clientWidth+0.5;
  const tooLong=el=>lbTooLong(el);
  const shrink=(el,min)=>{let fs=lbFs(el),n=0;while(tooLong(el)&&fs>min){fs-=1;el.style.fontSize=fs+'px';n++;}return n;};
  const shrunk=new Set(),cut=new Set();
  // 1) 각 칸: 줄 수 안에 들어오게 글자 줄임
  els.forEach(el=>{
    if(shrink(el,+el.dataset.min||24))shrunk.add(el);
    if(tooLong(el)){lbEllipsize(el,+el.dataset.fit||1);cut.add(el);}
  });
  // 2) 라벨 전체가 넘치면 줄일 수 있는 칸부터 1점씩 더 줄임
  let guard=0;
  while(over()&&guard++<120){
    const cand=els.filter(el=>lbFs(el)>(+el.dataset.min||24)).sort((a,b)=>(lbFs(b)-(+b.dataset.min||24))-(lbFs(a)-(+a.dataset.min||24)));
    if(!cand.length)break;
    cand[0].style.fontSize=(lbFs(cand[0])-1)+'px';shrunk.add(cand[0]);
  }
  // 3) 그래도 넘치면 줄 수를 하나씩 줄여 … 처리
  guard=0;
  while(over()&&guard++<20){
    const el=els.filter(e=>(+e.dataset.fit||1)>1).pop();
    if(!el)break;
    el.dataset.fit=(+el.dataset.fit)-1;lbEllipsize(el,+el.dataset.fit);cut.add(el);
  }
  if(shrunk.size)notes.push('긴 글이라 글자를 조금 줄였어요');
  if(cut.size)notes.push('너무 길어서 일부를 … 로 줄였어요');
  if(over())notes.push('내용이 라벨보다 길어요');
}

/* ── DOM 라벨 → 캔버스 ──
   배경색·위아래 테두리는 칸 위치대로 칠하고, 글자는 "줄 단위"로 통째로 그림 (글자를 따로 그리면 한글 사이 가운뎃점(·)처럼
   앞뒤 글자와 함께 모양이 잡히는 것들이 화면과 어긋남). 줄 위치는 브라우저가 계산한 값(Range)을 그대로 씀 */
function lbPaintRoot(root,scale){
  const rr=root.getBoundingClientRect(),W=Math.round(rr.width),H=Math.round(rr.height);
  const c=document.createElement('canvas');c.width=W*scale;c.height=H*scale;
  const x=c.getContext('2d');x.scale(scale,scale);x.fillStyle='#ffffff';x.fillRect(0,0,W,H);
  const rg=document.createRange();
  const paintText=(tn,cs)=>{
    const s=tn.nodeValue;if(!s||!s.trim())return;
    x.font=`${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    x.fillStyle=cs.color;x.textBaseline='alphabetic';x.textAlign='left';
    const m=x.measureText('가');
    const asc=m.fontBoundingBoxAscent!=null?m.fontBoundingBoxAscent:parseFloat(cs.fontSize)*1.16;
    const ls=parseFloat(cs.letterSpacing)||0;
    const lines=[];let cur=null;
    for(let i=0;i<s.length;i++){
      rg.setStart(tn,i);rg.setEnd(tn,i+1);
      const rs=rg.getClientRects();if(!rs.length)continue;          // 접혀서 안 보이는 공백
      const b=rs[0];
      if(!cur||Math.abs(cur.top-b.top)>3||b.left<cur.last-1){cur={top:b.top,left:b.left,text:'',last:b.left};lines.push(cur);}
      cur.text+=s[i];cur.last=b.left;
    }
    lines.forEach(l=>{
      const t=l.text.replace(/\s+$/,'');if(!t)return;
      const px=l.left-rr.left,py=l.top-rr.top+asc;
      if(!ls){x.fillText(t,px,py);return;}
      if('letterSpacing' in x){x.letterSpacing=cs.letterSpacing;x.fillText(t,px,py);x.letterSpacing='0px';return;}
      let cx=px;for(const ch of t){x.fillText(ch,cx,py);cx+=x.measureText(ch).width+ls;}   // letterSpacing 미지원 브라우저용
    });
  };
  const walk=el=>{
    const cs=getComputedStyle(el),r=el.getBoundingClientRect(),ox=r.left-rr.left,oy=r.top-rr.top;
    const bg=cs.backgroundColor;
    if(bg&&bg!=='transparent'&&!/rgba\(.*,\s*0\)$/.test(bg)){x.fillStyle=bg;x.fillRect(ox,oy,r.width,r.height);}
    [['Top',[0,0,1,0]],['Bottom',[0,1,1,0]],['Left',[0,0,0,1]],['Right',[1,0,0,1]]].forEach(([side,f])=>{
      const bw=parseFloat(cs['border'+side+'Width']);
      if(bw>0&&cs['border'+side+'Style']!=='none'){
        x.fillStyle=cs['border'+side+'Color'];
        if(side==='Top')x.fillRect(ox,oy,r.width,bw);
        else if(side==='Bottom')x.fillRect(ox,oy+r.height-bw,r.width,bw);
        else if(side==='Left')x.fillRect(ox,oy,bw,r.height);
        else x.fillRect(ox+r.width-bw,oy,bw,r.height);
      }
    });
    el.childNodes.forEach(n=>{if(n.nodeType===3)paintText(n,cs);else if(n.nodeType===1)walk(n);});
  };
  walk(root);
  return c;
}

/* ── 그리기 → 흑백 1비트 ── */
async function lbRender(type,d){
  const spec=LB_TYPES[type];
  const html=LB_HTML[type](d);
  await lbFonts(html.replace(/<[^>]*>/g,' '));
  const host=document.createElement('div');
  host.style.cssText='position:fixed;left:-20000px;top:0;pointer-events:none;';
  host.innerHTML=html;document.body.appendChild(host);
  const root=host.firstElementChild,notes=[];
  try{
    lbFitRoot(root,notes);
    const c2=lbPaintRoot(root,2);
    // 2배로 그린 것을 평균내서 1배로 줄이고 흑백으로
    const w=spec.w,h=spec.h,c1=document.createElement('canvas');c1.width=w;c1.height=h;
    const src=c2.getContext('2d').getImageData(0,0,c2.width,c2.height),sw=c2.width;
    const ctx=c1.getContext('2d'),out=ctx.createImageData(w,h);
    const sc=sw/w;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      let s=0,n=0;
      for(let dy=0;dy<sc;dy++)for(let dx=0;dx<sc;dx++){const i=(((y*sc+dy)|0)*sw+((x*sc+dx)|0))*4;s+=src.data[i]*0.299+src.data[i+1]*0.587+src.data[i+2]*0.114;n++;}
      const v=(s/n)<LB_TH?0:255,o=(y*w+x)*4;
      out.data[o]=out.data[o+1]=out.data[o+2]=v;out.data[o+3]=255;
    }
    ctx.putImageData(out,0,0);
    if(LB.fontOk===false)notes.push('Noto Sans KR 글꼴을 못 불러와서 다른 글꼴로 그렸어요 (인터넷 확인)');
    return {type,w,h,canvas:c1,notes};
  }finally{host.remove();}
}
/* 프린터로 보낼 그림: 50×90은 회전, 가로는 가운데 384점(B1 프린트헤드)만 */
function lbPrintCanvas(res,cfg){
  cfg=cfg||lbCfg();
  const spec=LB_TYPES[res.type];let src=res.canvas;
  if(spec.rotate){
    const r=document.createElement('canvas');r.width=src.height;r.height=src.width;
    const x=r.getContext('2d');x.imageSmoothingEnabled=false;x.fillStyle='#fff';x.fillRect(0,0,r.width,r.height);
    if(cfg.rot==='ccw'){x.translate(0,src.width);x.rotate(-Math.PI/2);}else{x.translate(src.height,0);x.rotate(Math.PI/2);}
    x.drawImage(src,0,0);src=r;
  }
  const o=document.createElement('canvas');o.width=LB_HEAD;o.height=src.height;
  const c=o.getContext('2d');c.imageSmoothingEnabled=false;c.fillStyle='#fff';c.fillRect(0,0,o.width,o.height);
  c.drawImage(src,-Math.floor((src.width-LB_HEAD)/2),0);
  const id=c.getImageData(0,0,o.width,o.height);   // 완전 흑백으로 다시 고정
  for(let i=0;i<id.data.length;i+=4){const v=id.data[i]<128?0:255;id.data[i]=id.data[i+1]=id.data[i+2]=v;id.data[i+3]=255;}
  c.putImageData(id,0,0);
  return o;
}

/* ── 프린터 연결 ── */
function lbCan(){return {ble:!!navigator.bluetooth,serial:!!navigator.serial,any:!!(navigator.bluetooth||navigator.serial)};}
const lbConnected=()=>!!(LB.client&&LB.client.isConnected&&LB.client.isConnected());
/* 연결 종류: 'ble'(프린터 이름·서비스로 찾기 — 라이브러리 기본) / 'ble-all'(필터 없이 주변 모든 블루투스 기기 중에서 고르기) / 'serial'(PC USB)
   아이폰 Bluefy는 'ble'의 필터에 프린터가 안 잡히는 일이 있어서, 아이폰은 처음부터 'ble-all'을 기본으로 씀 */
const LB_BLE_SERVICES=['e7810a71-73ae-499d-8c15-faa9aef0c3f2'];   // 님봇 서비스 (필터 없이 고를 때도 이 서비스는 쓸 수 있게 허용해 둠)
const lbIsIOS=()=>/iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
function lbBleKind(){const m=lbCfg().bleMode;return (m==='all'||(!m&&lbIsIOS()))?'ble-all':'ble';}
async function lbConnect(kind){
  if(LB.connecting)return;
  LB.connecting=true;LB.lastErr='';LB.lastKind=kind;lbChip();lbPrState();
  try{
    const f=window.__lbClientFactory;
    let dev=null;
    // 기기 고르기 창은 버튼을 누른 바로 그 순간에 띄워야 해서(브라우저 규칙) 라이브러리 불러오기보다 먼저
    if(kind==='ble-all'&&!f)dev=await navigator.bluetooth.requestDevice({acceptAllDevices:true,optionalServices:LB_BLE_SERVICES});
    if(!window.niimbluelib)await lbEnsureNb();
    const client=f?f(kind):(kind==='serial'?new niimbluelib.NiimbotSerialClient():new niimbluelib.NiimbotBluetoothClient());
    client.on('disconnect',()=>{if(LB.client===client){LB.client=null;LB.name='';lbChip();lbPrState();lbPreviewState();}});
    const info=await client.connect(dev?{authorizedDevice:dev}:undefined);
    if(info&&info.result===0)throw new Error('프린터와 연결하지 못했어요 (프린터가 응답하지 않아요)');
    LB.client=client;LB.kind=kind==='serial'?'serial':'ble';LB.name=(info&&info.deviceName)||'B1';
    if(kind!=='serial')lbCfgSet({bleMode:kind==='ble-all'?'all':'default'});   // 되는 방식을 기억
  }catch(e){
    // 기기 선택 창에서 아무것도 못 골랐거나 닫은 경우(NotFoundError)도 "안 보임"일 수 있어서 안내를 띄움
    LB.lastErr=(e&&e.name&&e.name!=='Error'?e.name+': ':'')+(e&&e.message||e);
    setTimeout(lbOpenPr,0);
  }finally{LB.connecting=false;lbChip();lbPrState();lbPreviewState();lbRollRefresh();}
}
async function lbRollRefresh(){   // 미리보기가 열려 있으면 끼운 롤 확인을 다시
  if(!lbConnected()||!_lb||!_lb.res||!_lb.res.length)return;
  try{_lb.roll=await lbRollCheck([...new Set(_lb.jobs.map(j=>j.type))]);}catch(e){}
  lbPreviewState();
}
async function lbDisconnect(){try{if(LB.client)await LB.client.disconnect();}catch(e){}LB.client=null;LB.name='';lbChip();lbPrState();lbPreviewState();}
/* 끼운 롤 확인 */
async function lbRollCheck(types){
  const c=LB.client;if(!c)return {level:'none',msg:''};
  const exp=LB_TYPES[types[0]],need=`${exp.rollW}×${exp.rollH}`;
  try{await c.fetchRfidInfo();}catch(e){}
  let hb={};try{hb=(c.getHeartbeatData&&c.getHeartbeatData())||{};}catch(e){}
  if(hb.lidClosed===false)return {level:'bad',msg:'프린터 뚜껑이 열려 있어요. 닫아 주세요'};
  if(hb.paperInserted===false)return {level:'bad',msg:`롤이 없어요. ${need} 롤을 끼워 주세요`};
  let pi;try{pi=(c.getRfidInfo()||{}).paperInfo;}catch(e){}
  if(pi&&pi.valid&&pi.paperWidth&&pi.paperHeight){
    const ok=Math.abs(pi.paperWidth-exp.rollW)<=2.5&&Math.abs(pi.paperHeight-exp.rollH)<=3.5;
    return ok?{level:'ok',msg:`${need} 롤 확인됨`}:{level:'bad',msg:`${need} 롤을 끼워 주세요 (지금 끼워진 롤: ${+pi.paperWidth.toFixed(1)}×${+pi.paperHeight.toFixed(1)}mm)`};
  }
  return {level:'unknown',msg:`끼운 롤 크기를 프린터에서 읽지 못했어요. ${need} 롤인지 확인해 주세요`};
}
/* 출력: items = [{res, qty}] */
async function lbPrintItems(items){
  const c=LB.client;
  if(!lbConnected())throw new Error('프린터가 연결돼 있지 않아요');
  if(LB.printing)throw new Error('다른 출력이 진행 중이에요');
  LB.printing=true;lbPreviewState();
  try{
    await lbEnsureNb();
    const nb=window.niimbluelib,cfg=lbCfg(),total=items.reduce((s,i)=>s+i.qty,0);
    const task=c.protocol.newPrintTask((c.getPrintTaskType&&c.getPrintTaskType())||'B1',
      {totalPages:total,density:cfg.density,labelType:nb.LabelType.WithGaps,statusPollIntervalMs:300,statusTimeoutMs:10000,pageTimeoutMs:30000});
    try{
      await task.printInit();
      for(const it of items){
        const enc=nb.ImageEncoder.encodeCanvas(lbPrintCanvas(it.res,cfg),nb.PageColorType.SingleColor,'top');
        await task.printPage(enc,it.qty);
        await task.waitForPageFinished();
      }
      await task.waitForFinished();
    }finally{try{await c.protocol.printEnd();}catch(e){}}
  }finally{LB.printing=false;lbPreviewState();}
}

/* ── 화면 맨 위 [프린터 연결] 칩 ── */
function lbChip(){
  const b=document.getElementById('lbChip');if(!b)return;
  const can=lbCan();
  b.className='lb-chip'+(lbConnected()?' on':'')+(!can.any?' off':'');
  b.textContent=LB.connecting?'🏷 연결중':lbConnected()?'🏷 연결됨':can.any?'🏷 연결':'🏷 연결불가';
  b.title=lbConnected()?`연결됨: ${LB.name}`:can.any?'님봇 프린터 연결':'이 브라우저는 프린터 연결을 지원하지 않아요 (라벨 이미지 저장은 가능)';
}
function lbChipClick(){
  const can=lbCan();
  if(!can.any||lbConnected()){lbOpenPr();return;}
  if(can.ble&&can.serial){lbOpenPr();return;}   // 둘 다 되면 고르게
  lbConnect(can.ble?lbBleKind():'serial');
}
function lbOpenMo(id){const m=document.getElementById(id);if(m){document.body.appendChild(m);openMo(id);}}   // 맨 위로
function lbOpenPr(){
  let mo=document.getElementById('moLbPr');
  if(!mo){mo=document.createElement('div');mo.className='mo';mo.id='moLbPr';mo.innerHTML='<div class="mbox" id="lbPrBody"></div>';document.body.appendChild(mo);}
  lbPrState();lbOpenMo('moLbPr');
}
function lbPrState(){
  const el=document.getElementById('lbPrBody');if(!el)return;
  const can=lbCan(),cfg=lbCfg(),on=lbConnected();
  const seg=(items,cur,fn)=>`<div class="lb-seg">${items.map(([v,l])=>`<button class="${String(cur)===String(v)?'on':''}" onclick="${fn}('${v}')">${l}</button>`).join('')}</div>`;
  el.innerHTML=`<div class="mtitle">🏷 라벨 프린터</div>
    <div class="lb-st ${on?'ok':''}">${on?`✓ 연결됨 · ${lbEsc(LB.name)} (${LB.kind==='serial'?'USB':'블루투스'})`:LB.connecting?'연결 중…':'연결 안 됨'}</div>
    ${can.any?`<div class="lb-conn">${on?`<button class="btn2" onclick="lbDisconnect()">연결 끊기</button>`:
      `${can.ble?(()=>{const all=lbBleKind()==='ble-all'||(!!LB.lastErr&&LB.lastKind==='ble');   // 이름 찾기가 실패한 직후엔 "모든 기기"를 강조
        return `<button class="${all?'btn':'btn2'} btn-sm" ${LB.connecting?'disabled':''} onclick="lbConnect('ble-all')">블루투스 · 모든 기기에서 고르기</button><button class="${all?'btn2':'btn'} btn-sm" ${LB.connecting?'disabled':''} onclick="lbConnect('ble')">블루투스 · 프린터 이름으로 찾기</button>`;})():''}${can.serial?`<button class="btn btn-sm" ${LB.connecting?'disabled':''} onclick="lbConnect('serial')">USB로 연결 (PC)</button>`:''}`}</div>`
    :`<div class="lb-warn">이 브라우저는 프린터 연결을 지원하지 않아요.<br>아이폰은 <b>Bluefy</b> 브라우저, PC는 <b>크롬</b>에서 열어 주세요. 라벨 이미지 저장은 지금도 돼요.</div>`}
    ${!on&&LB.lastErr?`<div class="lb-warn">연결하지 못했어요<br><span class="lb-errtxt">${lbEsc(LB.lastErr)}</span></div>`:''}
    ${!on&&can.any?`<details class="lb-help" ${LB.lastErr?'open':''}><summary>프린터가 목록에 안 보이거나 연결이 안 될 때</summary>
      <ol>
        <li>프린터 전원을 켜고 폰 가까이(1m 안)에 두세요.</li>
        <li><b>님봇 공식 앱이나 다른 폰·PC가 프린터에 연결돼 있으면 목록에 안 떠요.</b> 그 앱을 완전히 끄고(앱 종료), 다른 기기의 연결도 끊으세요. 블루투스는 한 번에 한 기기만 연결돼요.</li>
        <li>아이폰은 설정 → <b>Bluefy</b> → 블루투스(근처 기기) 허용이 켜져 있어야 해요.</li>
        <li><b>[블루투스 · 모든 기기에서 고르기]</b>로 다시 해 보세요. 목록에서 <b>B1</b>로 시작하는 이름을 고르면 돼요. 이름 없는 기기만 보이면 프린터를 껐다 켠 뒤 다시 시도하세요.</li>
        <li>그래도 안 되면 프린터가 목록에 아예 안 잡히는 거예요. 같은 폰의 Bluefy에서 <b>niim.blue</b>로도 연결이 되는지 확인해서 알려 주세요.</li>
      </ol>
      <div class="lb-diag">웹 블루투스 ${navigator.bluetooth?'가능':'불가'} · 보안 연결(https) ${window.isSecureContext?'예':'아니오'} · ${lbEsc(navigator.userAgent.replace(/\(.*?\)/g,'').trim().slice(0,70))}</div>
    </details>`:''}
    <div class="lb-set"><div class="lb-l">출력 농도 (1 연함 ~ 5 진함)</div>${seg([1,2,3,4,5].map(n=>[n,n]),cfg.density,'lbSetDensity')}</div>
    <div class="lb-set"><div class="lb-l">50×90 라벨 방향 <span>글자가 거꾸로 나오면 바꾸세요</span></div>${seg([['cw','시계 방향'],['ccw','반시계 방향']],cfg.rot,'lbSetRot')}</div>
    <div class="fa"><button class="btn btn-sm" onclick="closeMo('moLbPr')">닫기</button></div>`;
}
function lbSetDensity(v){lbCfgSet({density:+v});lbPrState();}
function lbSetRot(v){lbCfgSet({rot:v});lbPrState();}

/* ── 작은 알림 (저장을 막지 않음) ── */
let _lbToastT=null,_lbToastAct=null;
function lbToast(msg,act,ms){
  let t=document.getElementById('lbToast');
  if(!t){t=document.createElement('div');t.id='lbToast';t.className='lb-toast';document.body.appendChild(t);}
  _lbToastAct=act&&act.fn||null;
  t.innerHTML=`<span>${lbEsc(msg)}</span>${act?`<button onclick="lbToastDo()">${lbEsc(act.label)}</button>`:''}<button class="x" onclick="lbToastHide()">✕</button>`;
  t.classList.add('show');clearTimeout(_lbToastT);_lbToastT=setTimeout(lbToastHide,ms||(act?15000:4000));
}
function lbToastHide(){const t=document.getElementById('lbToast');if(t)t.classList.remove('show');}
function lbToastDo(){const f=_lbToastAct;lbToastHide();if(f)f();}

/* ── 미리보기 (출력 전) ── */
let _lb={title:'',mk:null,vac:null,res:[],jobs:[],roll:null,force:false,token:0,rendering:false};
function lbSum(){return _lb.jobs.reduce((s,j)=>s+j.qty,0);}
async function lbOpenPreview(title,mk,vac){
  _lb={title,mk,vac:vac||null,res:[],jobs:[],roll:null,force:false,token:0,rendering:false};
  let mo=document.getElementById('moLabel');
  if(!mo){mo=document.createElement('div');mo.className='mo';mo.id='moLabel';mo.innerHTML='<div class="mbox" id="lbBody"></div>';document.body.appendChild(mo);}
  lbPaint();lbOpenMo('moLabel');
  await lbRenderAll();
}
function lbPaint(){
  const el=document.getElementById('lbBody');if(!el)return;
  const v=_lb.vac;
  el.innerHTML=`<div class="mtitle">🏷 ${lbEsc(_lb.title)}</div>
    ${v?`<div class="lb-opts"><div><div class="lb-l">한 봉지 g</div><div class="lb-seg">${[15,20].map(g=>`<button class="${v.g===g?'on':''}" onclick="lbVacSet('g',${g})">${g}g</button>`).join('')}</div></div>
      <div><div class="lb-l">장수</div><div class="lb-step"><button onclick="lbVacSet('qty',${v.qty-1})">−</button><input id="lbQty" type="number" inputmode="numeric" min="1" max="99" value="${v.qty}" onchange="lbVacSet('qty',this.value)"><button onclick="lbVacSet('qty',${v.qty+1})">+</button></div></div></div>`:''}
    <div id="lbPrev" class="lb-prev"><div class="lb-wait">라벨 만드는 중…</div></div>
    <div id="lbState" class="lb-state"></div>
    <div class="fa" id="lbAct"></div>`;
  lbPreviewState();
}
async function lbRenderAll(){
  const tok=++_lb.token;_lb.rendering=true;lbPreviewState();
  try{
    _lb.jobs=_lb.mk(_lb.vac);
    const res=[];
    for(const j of _lb.jobs){res.push(await lbRender(j.type,j.d));if(tok!==_lb.token)return;}
    _lb.res=res;
    const box=document.getElementById('lbPrev');
    if(box)box.innerHTML=res.map((r,i)=>`<div class="lb-card"><img class="lb-img" alt="" src="${r.canvas.toDataURL('image/png')}" style="max-width:${r.w}px">
      <div class="lb-cap">${res.length>1?`${i+1}/${res.length} · `:''}${LB_TYPES[r.type].name} ${LB_TYPES[r.type].rollW}×${LB_TYPES[r.type].rollH}${_lb.jobs[i].qty>1?` · <b>${_lb.jobs[i].qty}장</b>`:''}</div>
      ${r.notes.map(n=>`<div class="lb-note">⚠ ${lbEsc(n)}</div>`).join('')}</div>`).join('')||'<div class="lb-wait">만들 라벨이 없어요</div>';
  }catch(e){
    const box=document.getElementById('lbPrev');if(box)box.innerHTML=`<div class="lb-warn">라벨을 만들지 못했어요: ${lbEsc(e&&e.message||e)}</div>`;
    _lb.res=[];
  }finally{if(tok===_lb.token){_lb.rendering=false;lbPreviewState();}}
  // 끼운 롤 확인 (연결돼 있으면)
  if(lbConnected()&&_lb.res.length){_lb.roll=await lbRollCheck([...new Set(_lb.jobs.map(j=>j.type))]);lbPreviewState();}
}
function lbVacSet(k,v){
  const o=_lb.vac;if(!o)return;
  if(k==='qty'){o.qty=Math.max(1,Math.min(99,parseInt(v)||1));const q=document.getElementById('lbQty');if(q)q.value=o.qty;_lb.jobs.forEach(j=>j.qty=o.qty);lbPaintQty();lbPreviewState();return;}
  o.g=+v;lbCfgSet({vacG:o.g});
  const bar=document.querySelector('#lbBody .lb-opts .lb-seg');if(bar)bar.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.textContent===o.g+'g'));
  lbRenderAll();
}
function lbPaintQty(){   // 장수만 바뀌면 그림은 그대로, 캡션만 갱신
  document.querySelectorAll('#lbPrev .lb-card').forEach((c,i)=>{const cap=c.querySelector('.lb-cap');const j=_lb.jobs[i],r=_lb.res[i];if(!cap||!j||!r)return;
    cap.innerHTML=`${_lb.res.length>1?`${i+1}/${_lb.res.length} · `:''}${LB_TYPES[r.type].name} ${LB_TYPES[r.type].rollW}×${LB_TYPES[r.type].rollH}${j.qty>1?` · <b>${j.qty}장</b>`:''}`;});
}
/* 프린터 상태 줄 + 버튼 (연결·끊김·출력 중에 다시 그림) */
function lbPreviewState(){
  const st=document.getElementById('lbState'),act=document.getElementById('lbAct');if(!st||!act)return;
  const can=lbCan(),on=lbConnected(),n=lbSum(),ready=_lb.res.length&&!_lb.rendering;
  let msg='',cls='';
  if(!can.any){msg='이 브라우저에서는 프린터에 연결할 수 없어요. 아래 [라벨 이미지 저장]으로 그림을 저장하세요.';cls='info';}
  else if(!on){msg=LB.connecting?'프린터 연결 중…':'프린터가 연결돼 있지 않아요.';cls='info';}
  else if(LB.printing){msg='출력 중… 프린터에서 라벨이 나올 때까지 기다려 주세요';cls='info';}
  else if(_lb.roll&&_lb.roll.msg){msg=_lb.roll.msg;cls=_lb.roll.level==='bad'?'bad':_lb.roll.level==='ok'?'ok':'info';}
  else if(_lb.res.length){const t=LB_TYPES[_lb.res[0].type];msg=`${t.rollW}×${t.rollH} 롤이 끼워져 있어야 해요`;cls='info';}
  st.className='lb-state '+cls;st.innerHTML=`${on?`<span class="lb-dot"></span>${lbEsc(LB.name)} 연결됨 · `:''}${lbEsc(msg)}${_lb.err?`<div class="lb-err">${lbEsc(_lb.err)}</div>`:''}`;
  const force=_lb.roll&&_lb.roll.level==='bad';
  act.innerHTML=`<button class="btn2" onclick="closeMo('moLabel')">닫기</button>`+
    (!can.any?`<button class="btn btn-sm" ${ready?'':'disabled'} onclick="lbSaveImage()">라벨 이미지 저장</button>`
      :!on?`<button class="btn btn-sm" ${LB.connecting?'disabled':''} onclick="lbChipClick2()">프린터 연결</button>`
      :`<button class="btn btn-sm" ${ready&&!LB.printing?'':'disabled'} onclick="lbDoPrint()">${force?'그래도 출력':'출력'} (${n}장)</button>`);
}
function lbChipClick2(){const can=lbCan();if(can.ble&&can.serial)lbOpenPr();else lbConnect(can.ble?lbBleKind():'serial');}
async function lbDoPrint(){
  if(LB.printing||!_lb.res.length)return;
  _lb.err='';
  try{
    const roll=await lbRollCheck([...new Set(_lb.jobs.map(j=>j.type))]);_lb.roll=roll;
    if(roll.level==='bad'&&!_lb.force){_lb.force=true;lbPreviewState();return;}   // 알려 주고, 한 번 더 누르면 "그래도 출력"
    await lbPrintItems(_lb.res.map((res,i)=>({res,qty:_lb.jobs[i].qty})));
    closeMo('moLabel');lbToast(`🏷 라벨 ${lbSum()}장 출력했어요`);
  }catch(e){_lb.err='출력 실패: '+(e&&e.message||e);lbPreviewState();}
}
/* 라벨 이미지 저장 (프린터를 못 쓰는 브라우저용) — 설계 방향(가로) 그대로, 여러 장이면 세로로 이어 한 장 */
function lbSaveImage(){
  if(!_lb.res.length)return;
  const rs=_lb.res,gap=24,W=Math.max(...rs.map(r=>r.w)),H=rs.reduce((s,r)=>s+r.h,0)+gap*(rs.length-1);
  const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,W,H);
  let y=0;rs.forEach(r=>{x.drawImage(r.canvas,0,y);y+=r.h+gap;});
  const a=document.createElement('a');a.download=`라벨_${rs.length>1?rs.length+'장_':''}${(typeof today==='function'?today():'').replace(/-/g,'')}.png`;
  a.href=c.toDataURL('image/png');document.body.appendChild(a);a.click();a.remove();
}

/* ── 버튼에서 부르는 진입점 ── */
function lbBeanLabel(id){
  const b=(db.beans||[]).find(x=>x.id===id);if(!b)return;
  lbOpenPreview(`생두 라벨 · ${b.name}`,()=>[{type:'bean',d:lbBeanData(b),qty:1}]);
}
function lbPlanItems(){return (typeof _planEdit!=='undefined'&&_planEdit&&_planEdit.items)||((typeof planGet==='function'&&planGet())||{items:[]}).items;}
function lbPlanLabel(i){
  const it=lbPlanItems()[i];if(!it)return;
  const b=typeof planBean==='function'?planBean(it):null;
  if(!b){alert('이 배치의 생두를 목록에서 먼저 골라 주세요.');return;}
  lbOpenPreview(`생두 라벨 · ${i+1}번 배치 · ${b.name}`,()=>[{type:'bean',d:lbBeanData(b),qty:1}]);
}
function lbPlanAll(){
  const items=lbPlanItems().filter(it=>it.status!=='skip');
  const ok=items.map(it=>(typeof planBean==='function'?planBean(it):null)).filter(Boolean);
  if(!ok.length){alert('출력할 배치가 없어요.');return;}
  const miss=items.length-ok.length;
  if(miss&&!confirm(`생두를 못 찾은 배치 ${miss}개는 빼고 ${ok.length}장을 출력할까요?`))return;
  lbOpenPreview(`생두 라벨 ${ok.length}장 (배치 순서대로)`,()=>ok.map(b=>({type:'bean',d:lbBeanData(b),qty:1})));
}
function lbRoastLabel(id){
  const r=(db.roasts||[]).find(x=>x.id===id);if(!r)return;
  lbOpenPreview(`로스팅 라벨 · ${r.date}${r.batch_no?' #'+r.batch_no:''}`,()=>[{type:'roast',d:lbRoastData(r),qty:1}]);
}
function lbVacOpts(){return {g:+lbCfg().vacG===15?15:20,qty:1};}   // g는 마지막에 쓴 값을 기억, 장수는 매번 1부터 (실수로 많이 뽑는 것 방지)
function lbVacRoast(id){
  const r=(db.roasts||[]).find(x=>x.id===id);if(!r)return;
  if(r.stock_state==='gift'){alert('지인에게 나눈 배치라 진공 라벨은 필요 없어요.');return;}
  lbOpenPreview(`진공 라벨 · ${r.bean_name||''}`,v=>[{type:'vac',d:lbVacRoastData(r,v.g),qty:v.qty}],lbVacOpts());
}
function lbVacRb(id){
  const b=(typeof rbList==='function'?rbList():[]).find(x=>x.id===id);if(!b)return;
  lbOpenPreview(`진공 라벨 · ${b.name}`,v=>[{type:'vacb',d:lbVacRbData(b,v.g),qty:v.qty}],lbVacOpts());
}

/* ── 로스팅 저장하면 자동 출력 (roasts.js saveRoast 에서 부름) ── */
const lbAutoOn=()=>lbCfg().auto!==false;
function lbSetAuto(on){lbCfgSet({auto:!!on});const c=document.getElementById('lbAuto');if(c)c.checked=!!on;}
async function lbAutoPrintRoast(id,manual){
  const r=(db.roasts||[]).find(x=>x.id===id);if(!r)return;
  if(!manual){
    if(!lbAutoOn()||!lbCan().any)return;                     // 꺼져 있거나 이 브라우저는 출력 불가 → 조용히 넘어감
    if(!lbConnected()){lbToast('🏷 프린터가 연결돼 있지 않아 라벨을 못 뽑았어요',{label:'연결하고 출력',fn:()=>{lbConnectThenPrint(id);}},12000);return;}
  }
  try{
    const res=await lbRender('roast',lbRoastData(r));
    const roll=await lbRollCheck(['roast']);
    if(roll.level==='bad')throw new Error(roll.msg);
    await lbPrintItems([{res,qty:1}]);
    lbToast('🏷 로스팅 라벨 출력했어요');
  }catch(e){
    lbToast('라벨 출력 실패 — '+(e&&e.message||e),{label:'다시 출력',fn:()=>lbAutoPrintRoast(id,true)},20000);
  }
}
async function lbConnectThenPrint(id){const can=lbCan();if(can.ble&&can.serial){lbOpenPr();return;}await lbConnect(can.ble?lbBleKind():'serial');if(lbConnected())lbAutoPrintRoast(id,true);}
function lbAfterRoastSave(id){
  // 저장은 이미 끝난 뒤. 어떤 일이 생겨도 저장·화면 이동에 영향 없게 따로 돌림
  setTimeout(()=>{try{lbAutoPrintRoast(id,false).catch(()=>{});}catch(e){}},0);
}

/* 빈본 타이머(iframe) 시작 화면의 [🏷 라벨] 버튼 → 선택한 생두의 생두 정보 라벨 미리보기 */
window.addEventListener('message',e=>{
  if(e.origin!==location.origin||!e.data||e.data.type!=='label_bean')return;
  const b=(db.beans||[]).find(x=>x.name===e.data.bean_name);
  if(b)lbBeanLabel(b.id);
});

/* ── 시작 ── */
function lbInit(){
  lbChip();
  const c=document.getElementById('lbAuto');if(c)c.checked=lbAutoOn();
  // 웹 블루투스 버튼 누르기 전에 미리 불러둠 (누른 직후 await 하면 브라우저가 "누른 동작"으로 안 칠 수 있음)
  if(lbCan().any)setTimeout(()=>{lbEnsureNb().catch(()=>{});},1500);
}
lbInit();

// cupping.js

const CUP_STEPS = [
  {key:'fragrance', label:'향 (건식)', guide:'분쇄 직후 물 붓기 전. 컵에 코를 대고 건식 향의 강도와 질감 평가'},
  {key:'aroma',     label:'향 (습식)', guide:'물 붓고 3~4분 후 크러스트 깨기 직전·직후 올라오는 습식 향 평가'},
  {key:'flavor',    label:'맛',       guide:'70°C 내외, 스푼으로 빠르게 슬러핑. 전체적인 맛의 첫인상'},
  {key:'aftertaste',label:'여운',     guide:'삼킨 후 입안에 남는 향미의 지속 시간과 질감 평가'},
  {key:'acidity',   label:'산미',     guide:'강도보다 질(밝은지·와인같은지·시트러스인지) 위주로 평가'},
  {key:'body',      label:'바디',     guide:'입안 무게감·질감. 크리미/실키/묵직/가벼움 등을 느껴보세요'},
  {key:'balance',   label:'균형',     guide:'산미·단맛·바디·맛 모든 요소가 어우러지는 정도'},
  {key:'overall',   label:'종합',     guide:'전반적인 인상과 선호도를 반영한 최종 점수'},
];

const CUP_POS_TAGS = {
  '🌸 플로럴': ['자스민','장미향','라벤더','오렌지꽃','인동꽃','꽃향기전반','허브향','민트'],
  '🍑 과일(밝은)': ['복숭아','살구','자두','체리','블루베리','딸기','라즈베리','크랜베리'],
  '🍋 시트러스/열대': ['레몬','라임','오렌지','자몽','파인애플','망고','패션프루트','멜론'],
  '🍷 숙성/건조과일': ['포도','사과','배','무화과','말린과일향','건포도','말린자두','말린체리','말린살구','잼같은','과일사탕','발효과일','와인같은','포트와인향'],
  '🍯 단맛/캐러멜': ['캐러멜','꿀','황설탕','시럽','메이플','바닐라','버터스카치','밀크초콜릿','다크초콜릿','코코아','모카','누가','마지팬'],
  '🌰 견과류': ['아몬드','헤이즐넛','땅콩','호두','피칸','마카다미아'],
  '🌾 곡물/스파이시': ['곡물향','빵향','토스트향','시리얼향','맥아향','보리향','쌀향','계피','정향','카다몬','생강','흑후추'],
  '🪵 우드/어스시': ['타바코향','우드향','삼나무','가죽향','흑차향','얼그레이','버섯향','달콤한흙향'],
  '✨ 질감/산미/여운': ['밝은산미','부드러운산미','산뜻한산미','레몬산미','사과산미','복숭아산미','와인산미','시트러스산미','달콤한산미','크리미','벨벳같은','실키','쥬시','묵직한바디','가벼운바디','수분감있는','둥근느낌','매끄러운','진한느낌','뽀얀질감','긴여운','달콤한여운','과일여운','초콜릿여운','꽃향여운','깔끔한여운','균형잡힌','복합적인','깔끔한','투명한','고급스러운'],
};

const CUP_NEG_TAGS = {
  '🔥 로스팅 결함': ['탄맛','연기맛','오버로스트','언더로스트','굽내','그을린맛','빵같은(열부족)','불균일로스팅','쓴여운'],
  '🌿 생두/발효 결함': ['풀냄새','채소맛','완두콩향','과발효','식초맛','발효취','리오이(요오드맛)','퀴퀴함','곰팡이','흙냄새','습한흙'],
  '😣 떫음/쓴맛': ['강한쓴맛','떫음','타닌느낌','건조한수렴성','텁텁함','역함'],
  '⚗️ 오염/이취': ['고무냄새','약품맛','금속맛','화학약품향','기름맛','종이맛','염소맛','비누향','양파냄새','마늘냄새','땀냄새'],
  '📉 밸런스 결함': ['밋밋함','너무묽음','너무진함','바디없음','밸런스깨짐','짧은여운','텅빈느낌','단조로운'],
};

const SCORE_VALS = [6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0, 9.5, 10.0];

let _cups = [];
let _cEditId = null;

/* ── 렌더 (세션 목록) ── */
function renderCupping(){
  const sessions = [...(db.cuppings||[])].sort((a,b)=>b.date.localeCompare(a.date));
  document.getElementById('cuppingList').innerHTML = sessions.length
    ? sessions.map(cuppingCard).join('')
    : '<div class="empty"><div class="empty-icon">☕</div><div class="empty-text">커핑 기록이 없습니다</div></div>';
}

function cuppingCard(s){
  const cupCount = s.cups.length;
  const totals = s.cups.map(c => c.total || calcCupTotal(c.scores||{})).filter(v=>v>0);
  const avgTotal = totals.length ? (totals.reduce((a,b)=>a+b,0)/totals.length).toFixed(1) : '';
  const beanNames = s.cups.map(c=>c.bean_name).filter(Boolean).join('  ·  ');
  const topPos = s.cups.flatMap(c=>c.positives||[]).slice(0,5).join(' · ');
  const topNeg = s.cups.flatMap(c=>c.negatives||[]).slice(0,3).join(' · ');
  return `<div class="ccard" onclick="openCuppingDetail('${s.id}')">
    <div class="ccard-head">
      <span class="ccard-date">${s.date}</span>
      <span class="ccard-cnt">${cupCount}종 비교</span>
      ${avgTotal ? `<span class="ccard-score">${avgTotal}</span>` : ''}
    </div>
    <div class="ccard-beans">${beanNames||'—'}</div>
    ${topPos ? `<div class="ccard-tags pos">${topPos}</div>` : ''}
    ${topNeg ? `<div class="ccard-tags neg">⚠ ${topNeg}</div>` : ''}
    ${s.session_notes ? `<div class="ccard-note">${s.session_notes}</div>` : ''}
  </div>`;
}

function calcCupTotal(scores){
  const vals = Object.values(scores||{}).filter(v=>v>0);
  return vals.length ? vals.reduce((a,b)=>a+b,0) : 0;
}

/* ── 폼 열기 ── */
function openCuppingForm(id){
  _cEditId = id||null;
  if(id){
    const s = db.cuppings.find(x=>x.id===id);
    if(s){
      document.getElementById('cf_date').value = s.date;
      document.getElementById('cf_notes').value = s.session_notes||'';
      _cups = s.cups.map(c=>JSON.parse(JSON.stringify(c)));
    }
  } else {
    document.getElementById('cf_date').value = today();
    document.getElementById('cf_notes').value = '';
    _cups = [{cup_id:genId(),bean_name:'',roast_id:'',positives:[],negatives:[],notes:'',scores:{}}];
  }
  renderCuppingFormCups();
  openMo('moCuppingForm');
}

function renderCuppingFormCups(){
  document.getElementById('cf_cups').innerHTML = _cups.map((cup,i)=>cupFormBlock(cup,i)).join('');
}

function cupFormBlock(cup, idx){
  const beanOpts = db.beans.map(b=>`<option value="${escQ(b.name)}" ${cup.bean_name===b.name?'selected':''}>${b.name}</option>`).join('');
  const roastOpts = cup.bean_name
    ? db.roasts.filter(r=>r.bean_name===cup.bean_name)
        .sort((a,b)=>b.date.localeCompare(a.date))
        .map(r=>`<option value="${r.id}" ${cup.roast_id===r.id?'selected':''}>${r.date}${r.roast_level?' ['+r.roast_level+']':''}</option>`)
        .join('')
    : '';

  const stepsHtml = CUP_STEPS.map(step=>{
    const curVal = (cup.scores||{})[step.key]||0;
    const chips = SCORE_VALS.map(v=>`<span class="sc-chip ${curVal===v?'on':''}" onclick="setCupScore(${idx},'${step.key}',${v},this)">${v}</span>`).join('');
    return `<div class="cup-step">
      <div class="cup-step-top"><span class="cup-step-label">${step.label}</span><span class="cup-step-guide">${step.guide}</span></div>
      <div class="cup-score-chips">${chips}</div>
    </div>`;
  }).join('');

  const posHtml = Object.entries(CUP_POS_TAGS).map(([cat,tags])=>`
    <div class="ctag-cat">
      <div class="ctag-cat-label">${cat}</div>
      <div class="ctag-list">${tags.map(t=>`<span class="ctag cpos ${(cup.positives||[]).includes(t)?'on':''}" onclick="toggleCupTag(${idx},'pos','${t}',this)">${t}</span>`).join('')}</div>
    </div>`).join('');

  const negHtml = Object.entries(CUP_NEG_TAGS).map(([cat,tags])=>`
    <div class="ctag-cat">
      <div class="ctag-cat-label">${cat}</div>
      <div class="ctag-list">${tags.map(t=>`<span class="ctag cneg ${(cup.negatives||[]).includes(t)?'on':''}" onclick="toggleCupTag(${idx},'neg','${t}',this)">${t}</span>`).join('')}</div>
    </div>`).join('');

  const total = calcCupTotal(cup.scores||{});

  return `<div class="cup-block" id="cup_block_${idx}">
    <div class="cup-block-head">
      <span class="cup-num">Cup ${idx+1}</span>
      <span class="cup-total" id="cup_total_${idx}">${total>0?total.toFixed(1)+'점':''}</span>
      ${_cups.length>1?`<button class="btnd" style="padding:3px 8px;font-size:10px;margin-left:auto" onclick="removeCup(${idx})">제거</button>`:''}
    </div>
    <div class="fg">
      <label class="fl">생두 *</label>
      <select class="sel" onchange="setCupBean(${idx},this.value)">
        <option value="">선택...</option>
        ${beanOpts}
      </select>
    </div>
    ${cup.bean_name ? `<div class="fg">
      <label class="fl">로스팅 배치 <span style="font-size:9px;text-transform:none;letter-spacing:0;color:var(--muted)">선택 안 해도 됨</span></label>
      <select class="sel" onchange="setCupRoast(${idx},this.value)">
        <option value="">미지정</option>
        ${roastOpts}
      </select>
    </div>` : ''}
    <div class="fg">
      <label class="fl">점수 평가 <span style="font-size:9px;text-transform:none;letter-spacing:0;color:var(--muted)">6.0~10.0 · 0.5 단위</span></label>
      <div class="cup-steps">${stepsHtml}</div>
    </div>
    <div class="fg">
      <label class="fl">긍정 태그</label>
      <div class="ctag-section">${posHtml}</div>
    </div>
    <div class="fg">
      <label class="fl">부정 태그</label>
      <div class="ctag-section">${negHtml}</div>
    </div>
    <div class="fg">
      <label class="fl">메모</label>
      <textarea class="ta" style="min-height:52px" placeholder="이 컵에 대한 메모" oninput="setCupNote(${idx},this.value)">${cup.notes||''}</textarea>
    </div>
  </div>`;
}

function escQ(s){ return (s||'').replace(/'/g,"\\'"); }

function setCupBean(idx, beanName){
  _cups[idx].bean_name = beanName;
  _cups[idx].roast_id = '';
  renderCuppingFormCups();
}

function setCupRoast(idx, roastId){
  _cups[idx].roast_id = roastId;
}

function setCupScore(idx, stepKey, val, chip){
  if(!_cups[idx].scores) _cups[idx].scores = {};
  _cups[idx].scores[stepKey] = val;
  chip.closest('.cup-score-chips').querySelectorAll('.sc-chip').forEach(c=>c.classList.remove('on'));
  chip.classList.add('on');
  const total = calcCupTotal(_cups[idx].scores);
  const el = document.getElementById(`cup_total_${idx}`);
  if(el) el.textContent = total.toFixed(1)+'점';
}

function toggleCupTag(idx, type, tag, chip){
  const arr = type==='pos' ? (_cups[idx].positives||(_cups[idx].positives=[])) : (_cups[idx].negatives||(_cups[idx].negatives=[]));
  const i = arr.indexOf(tag);
  if(i>=0){ arr.splice(i,1); chip.classList.remove('on'); }
  else { arr.push(tag); chip.classList.add('on'); }
}

function setCupNote(idx, val){
  if(_cups[idx]) _cups[idx].notes = val;
}

function addCup(){
  if(_cups.length>=5){ alert('최대 5개까지 비교할 수 있습니다'); return; }
  _cups.push({cup_id:genId(),bean_name:'',roast_id:'',positives:[],negatives:[],notes:'',scores:{}});
  renderCuppingFormCups();
  setTimeout(()=>{
    const last = document.getElementById(`cup_block_${_cups.length-1}`);
    if(last) last.scrollIntoView({behavior:'smooth',block:'start'});
  }, 50);
}

function removeCup(idx){
  _cups.splice(idx,1);
  renderCuppingFormCups();
}

function saveCupping(){
  const date = document.getElementById('cf_date').value;
  if(!date){ alert('날짜를 입력하세요'); return; }
  const validCups = _cups.filter(c=>c.bean_name);
  if(!validCups.length){ alert('생두를 하나 이상 선택하세요'); return; }

  const cups = validCups.map(c=>({
    ...c,
    total: calcCupTotal(c.scores||{}),
  }));

  const data = {
    id: _cEditId||genId(),
    date,
    cups,
    session_notes: document.getElementById('cf_notes').value.trim(),
  };

  if(_cEditId){
    const i = db.cuppings.findIndex(x=>x.id===_cEditId);
    if(i>=0) db.cuppings[i] = data; else db.cuppings.push(data);
  } else {
    db.cuppings.push(data);
  }
  saveDB();
  closeMo('moCuppingForm');
  renderCupping();
}

/* ── 세션 상세 ── */
function openCuppingDetail(id){
  const s = db.cuppings.find(x=>x.id===id);
  if(!s) return;

  const cupsHtml = s.cups.map((c,i)=>{
    const total = c.total||calcCupTotal(c.scores||{});
    const roast = c.roast_id ? db.roasts.find(r=>r.id===c.roast_id) : null;
    const bean = db.beans.find(b=>b.name===c.bean_name)||{};

    const stepsHtml = CUP_STEPS.map(step=>{
      const v = (c.scores||{})[step.key];
      const bar = v ? (v-6)/4*100 : 0;
      const col = !v ? 'var(--muted)' : v>=8.5 ? 'var(--teal)' : v>=7.5 ? 'var(--amber)' : 'var(--coral)';
      return `<div class="cdet-step">
        <div class="cdet-step-lbl">${step.label}</div>
        <div class="cdet-bar-wrap"><div class="cdet-bar" style="width:${bar}%;background:${col}"></div></div>
        <div class="cdet-step-val" style="color:${col}">${v||'—'}</div>
      </div>`;
    }).join('');

    const pos = (c.positives||[]).map(t=>`<span class="ctag-sm cpos">${t}</span>`).join('');
    const neg = (c.negatives||[]).map(t=>`<span class="ctag-sm cneg">${t}</span>`).join('');

    return `<div class="cdet-cup">
      <div class="cdet-cup-head">
        <span class="cdet-cup-name">${c.bean_name}</span>
        ${roast ? `<span class="cdet-cup-roast">${roast.date}${roast.roast_level?' ['+roast.roast_level+']':''}</span>` : ''}
        ${total>0 ? `<span class="cdet-cup-total">${total.toFixed(1)}</span>` : ''}
      </div>
      ${bean.origin ? `<div style="font-size:11px;color:var(--muted2);margin-bottom:8px">${bean.origin}${bean.process?' · '+bean.process:''}</div>` : ''}
      <div class="cdet-steps">${stepsHtml}</div>
      ${pos ? `<div class="ctag-row" style="margin-top:8px">${pos}</div>` : ''}
      ${neg ? `<div class="ctag-row" style="margin-top:4px">${neg}</div>` : ''}
      ${c.notes ? `<div class="cdet-note">"${c.notes}"</div>` : ''}
    </div>`;
  }).join('');

  document.getElementById('cdTitle').textContent = `${s.date} 커핑`;
  document.getElementById('cdContent').innerHTML = `
    ${cupsHtml}
    ${s.session_notes ? `<div class="ds" style="margin-top:14px"><div class="dstitle">세션 메모</div><div style="font-size:13px;color:var(--text2);font-style:italic;line-height:1.6">${s.session_notes}</div></div>` : ''}
  `;
  document.getElementById('cdEditBtn').onclick = ()=>{ closeMo('moCuppingDetail'); openCuppingForm(id); };
  document.getElementById('cdDeleteBtn').onclick = ()=>{
    if(confirm('이 커핑 세션을 삭제하시겠습니까?')){
      db.cuppings = db.cuppings.filter(x=>x.id!==id);
      saveDB(); closeMo('moCuppingDetail'); renderCupping();
    }
  };
  openMo('moCuppingDetail');
}

/* ── 다른 모듈에서 사용 ── */
function getCuppingsForBean(beanName){
  return (db.cuppings||[])
    .filter(s=>s.cups.some(c=>c.bean_name===beanName))
    .sort((a,b)=>b.date.localeCompare(a.date));
}

function getCuppingsForRoast(roastId, beanName){
  return (db.cuppings||[])
    .filter(s=>s.cups.some(c=>c.roast_id===roastId||(c.bean_name===beanName&&!c.roast_id)))
    .sort((a,b)=>b.date.localeCompare(a.date));
}

function cuppingMiniHtml(sessions, beanName){
  if(!sessions.length) return '';
  const items = sessions.slice(0,3).map(s=>{
    const cup = s.cups.find(c=>c.bean_name===beanName)||s.cups[0];
    const total = cup ? (cup.total||calcCupTotal(cup.scores||{})) : 0;
    const pos = (cup?.positives||[]).slice(0,3).join(' · ');
    const neg = (cup?.negatives||[]).slice(0,2).join(' · ');
    return `<div class="ccup-mini">
      <span class="ccup-mini-date">${s.date}</span>
      ${total>0 ? `<span class="ccup-mini-score">${total.toFixed(1)}</span>` : ''}
      ${pos ? `<span class="ccup-mini-pos">${pos}</span>` : ''}
      ${neg ? `<span class="ccup-mini-neg">⚠ ${neg}</span>` : ''}
    </div>`;
  }).join('');
  return `<div class="ccup-section">
    <div class="ccup-lbl">커핑 ${sessions.length}회</div>
    ${items}
  </div>`;
}

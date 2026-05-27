// cupping.js — 단계별 커핑 위저드

// ──────────────────────────────────────────────────────────────
// 상수
// ──────────────────────────────────────────────────────────────
const CUP_STEPS = [
  {key:'fragrance',  label:'건식 향'},
  {key:'aroma',      label:'습식 향'},
  {key:'flavor',     label:'풍미'},
  {key:'aftertaste', label:'여운'},
  {key:'acidity',    label:'산미'},
  {key:'body',       label:'바디'},
  {key:'balance',    label:'균형'},
  {key:'clean_cup',  label:'클린컵'},
  {key:'sweetness',  label:'단맛'},
  {key:'overall',    label:'종합'},
];

const WIZ_SCREENS = [
  {
    id:'setup', label:'준비', num:0,
    hasCupCards:false,
  },
  {
    id:'fragrance', label:'건식 향', num:1,
    hasCupCards:true, scoreKeys:['fragrance'], hasTags:true,
    guide:'분쇄 직후, 물 붓기 전. 컵에 코를 대고 건식 향의 강도와 질감을 평가하세요.',
  },
  {
    id:'pour_timer', label:'물 붓기', num:2,
    hasCupCards:false, hasTimer:true, timerSec:240,
    guide:'모든 컵에 93°C 물을 고르게 부은 뒤 타이머를 시작하고 4분 대기합니다.',
  },
  {
    id:'aroma', label:'습식 향', num:3,
    hasCupCards:true, scoreKeys:['aroma'], hasTags:true,
    guide:'스푼으로 크러스트를 부수며 올라오는 향을 맡으세요. 브레이킹 직전·직후를 평가합니다.',
  },
  {
    id:'flavor_group', label:'풍미·여운·산미', num:4,
    hasCupCards:true, scoreKeys:['flavor','aftertaste','acidity'], hasTags:true,
    guide:'70°C 내외에서 스푼으로 빠르게 슬러핑. 풍미·여운·산미를 차례로 평가하세요.',
  },
  {
    id:'body_group', label:'바디·밸런스', num:5,
    hasCupCards:true, scoreKeys:['body','balance'], hasTags:true,
    guide:'커피가 식어가면서 입안 무게감(바디)과 전체 균형감을 평가하세요.',
  },
  {
    id:'clean_sweet', label:'클린컵·단맛', num:6,
    hasCupCards:true, scoreKeys:['clean_cup','sweetness'], hasTags:false,
    guide:'완전히 식어가면서 클린함(잡미 없음)과 자연스러운 단맛을 평가하세요.',
  },
  {
    id:'overall', label:'종합·마무리', num:7,
    hasCupCards:true, scoreKeys:['overall'], hasTags:false, isLast:true,
    guide:'전반적인 인상과 선호도를 종합 평가하고 세션 메모를 남겨 저장합니다.',
  },
];

const STEP_LABELS = {
  fragrance:'건식 향', aroma:'습식 향', flavor:'풍미', aftertaste:'여운',
  acidity:'산미', body:'바디', balance:'균형', clean_cup:'클린컵',
  sweetness:'단맛', overall:'종합'
};

// 위저드용 간략 태그 (커핑 특화)
const WIZ_POS = [
  '플로럴','자스민','장미향','베리류','복숭아','살구','체리','블루베리',
  '시트러스','레몬','오렌지','자몽','파인애플','망고',
  '꿀','캐러멜','밀크초콜릿','다크초콜릿','견과류','아몬드','바닐라',
  '토스트향','밝은산미','부드러운산미','달콤한산미','와인산미',
  '크리미','실키','묵직한바디','가벼운바디',
  '균형잡힌','깔끔한','복합적인','긴여운','달달한여운','과일향','와인같은',
];

const WIZ_NEG = [
  '강한쓴맛','떫음','타닌','풀냄새','채소맛','흙냄새','곰팡이','과발효',
  '식초맛','발효취','잡미','금속맛','약품냄새','연기맛','탄맛',
  '오버로스트','언더로스트','건조함','짧은여운','밋밋함','바디없음','밸런스깨짐',
];

// 상세뷰/구버전 호환용 전체 태그 세트
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

const SCORE_VALS = [6.0,6.5,7.0,7.5,8.0,8.5,9.0,9.5,10.0];

// ──────────────────────────────────────────────────────────────
// 위저드 상태
// ──────────────────────────────────────────────────────────────
let _wiz = { phase:0, editId:null, date:'', cups:[], sessionNotes:'' };
let _wizTmrId      = null;
let _wizTmrSec     = 240;
let _wizTmrRunning = false;

// ──────────────────────────────────────────────────────────────
// 헬퍼
// ──────────────────────────────────────────────────────────────
function escQ(s){ return (s||'').replace(/'/g,"\\'"); }

function calcCupTotal(cupOrScores){
  // cup 객체(step_scores 포함) 또는 점수 평면 객체 모두 허용
  const scores = (cupOrScores && cupOrScores.step_scores)
    ? cupOrScores.step_scores
    : (cupOrScores || {});
  const vals = Object.values(scores).filter(v => v > 0);
  return vals.length ? vals.reduce((a,b) => a+b, 0) : 0;
}

function newCup(){
  return { cup_id:genId(), bean_name:'', roast_id:'', step_scores:{}, step_notes:{}, positives:[], negatives:[], total:0 };
}

function getSerialMap(){
  const sorted = [...(db.roasts||[])].sort((a,b) => a.date > b.date ? 1 : -1);
  const m = {};
  sorted.forEach((r,i) => { m[r.id] = i+1; });
  return m;
}

function roastLabel(r, serialMap){
  const sn    = serialMap[r.id] ? `#${String(serialMap[r.id]).padStart(2,'0')} ` : '';
  const level = r.roast_level   ? ` [${r.roast_level}]`  : '';
  const input = r.input_g       ? ` ${r.input_g}g`        : '';
  const dtr   = r.dtr_pct       ? ` DTR${r.dtr_pct}%`    : '';
  return `${sn}${r.date}${level}${input}${dtr}`;
}

function clearWizTimer(){
  if(_wizTmrId) clearInterval(_wizTmrId);
  _wizTmrId      = null;
  _wizTmrRunning = false;
}

// ──────────────────────────────────────────────────────────────
// 위저드 진입
// ──────────────────────────────────────────────────────────────
function openCuppingWizard(id){
  clearWizTimer();
  _wiz.editId      = id || null;
  _wiz.phase       = 0;
  _wiz.sessionNotes = '';
  _wizTmrSec       = 240;

  if(id){
    const s = db.cuppings.find(x => x.id === id);
    if(s){
      _wiz.date         = s.date;
      _wiz.sessionNotes = s.session_notes || '';
      _wiz.cups = s.cups.map(c => {
        const cup = JSON.parse(JSON.stringify(c));
        if(!cup.step_scores) cup.step_scores = cup.scores || {};
        if(!cup.step_notes)  cup.step_notes  = {};
        if(!cup.positives)   cup.positives   = [];
        if(!cup.negatives)   cup.negatives   = [];
        return cup;
      });
    }
  } else {
    _wiz.date = today();
    _wiz.cups = [newCup()];
  }

  renderWiz();
  openMo('moCuppingWizard');
}

function openCuppingForm(id){ openCuppingWizard(id); }

// ──────────────────────────────────────────────────────────────
// 렌더 — 메인 디스패처
// ──────────────────────────────────────────────────────────────
function renderWiz(){
  const el = document.getElementById('wizContent');
  if(!el) return;
  const scr    = WIZ_SCREENS[_wiz.phase];
  const isFirst = _wiz.phase === 0;
  const isLast  = !!scr.isLast;
  const total   = WIZ_SCREENS.length;
  const pct     = (_wiz.phase / (total-1)) * 100;
  const dots    = WIZ_SCREENS.map((s,i) =>
    `<span class="wpd ${i===_wiz.phase?'cur':''} ${i<_wiz.phase?'done':''}"></span>`
  ).join('');

  let body = '';
  if(scr.id === 'setup')   body = _renderWizSetup();
  else if(scr.hasTimer)    body = _renderWizTimer();
  else                     body = _renderWizScoring(scr);

  el.innerHTML = `
    <div class="wiz-top">
      <div class="wiz-prog-bar"><div class="wiz-prog-fill" style="width:${pct}%"></div></div>
      <div class="wiz-prog-dots">${dots}</div>
      <div class="wiz-prog-lbl">${_wiz.phase+1} / ${total} &nbsp;—&nbsp; ${scr.label}</div>
    </div>
    ${body}
    <div class="wiz-nav">
      <button class="btn2" onclick="closeCuppingWizard()">취소</button>
      <div style="display:flex;gap:8px;align-items:center">
        ${!isFirst ? `<button class="btn2 wiz-back" onclick="wizPrev()">← 이전</button>` : ''}
        ${isLast
          ? `<button class="btn wiz-go" onclick="saveWizardCupping()">✓ 저장 완료</button>`
          : `<button class="btn wiz-go" onclick="wizNext()">다음 →</button>`
        }
      </div>
    </div>
  `;
}

// ──────────────────────────────────────────────────────────────
// 렌더 — 준비 화면
// ──────────────────────────────────────────────────────────────
function _renderWizSetup(){
  const serialMap = getSerialMap();

  const cupsHtml = _wiz.cups.map((cup, i) => {
    const beanOpts = db.beans
      .map(b => `<option value="${escQ(b.name)}" ${cup.bean_name===b.name?'selected':''}>${b.name}</option>`)
      .join('');
    const roastOpts = cup.bean_name
      ? db.roasts
          .filter(r => r.bean_name === cup.bean_name)
          .sort((a,b) => b.date.localeCompare(a.date))
          .map(r => `<option value="${r.id}" ${cup.roast_id===r.id?'selected':''}>${roastLabel(r,serialMap)}</option>`)
          .join('')
      : '';
    return `
      <div class="wiz-setup-cup">
        <div class="wiz-scu-head">
          <span class="wiz-scu-num">Cup ${i+1}</span>
          ${_wiz.cups.length > 1
            ? `<button class="btnd" style="padding:2px 8px;font-size:10px" onclick="wizRemoveCup(${i})">제거</button>`
            : ''}
        </div>
        <div class="fg" style="margin-bottom:8px">
          <label class="fl">생두 *</label>
          <select class="sel" onchange="wizSetBean(${i},this.value)">
            <option value="">선택...</option>${beanOpts}
          </select>
        </div>
        ${cup.bean_name ? `
          <div class="fg" style="margin-bottom:0">
            <label class="fl">로스팅 배치
              <span style="font-size:9px;text-transform:none;letter-spacing:0;color:var(--muted)"> 선택 안 해도 됨</span>
            </label>
            <select class="sel" onchange="wizSetRoast(${i},this.value)">
              <option value="">미지정</option>${roastOpts}
            </select>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  return `
    <div class="wiz-screen-hd">
      <div class="wiz-screen-title">커핑 준비</div>
      <div class="wiz-screen-guide">평가할 날짜와 원두(로스팅 배치)를 설정하세요.</div>
    </div>
    <div class="fg">
      <label class="fl">날짜 *</label>
      <input class="inp" type="date" id="wiz_date" value="${_wiz.date}"
        onchange="_wiz.date=this.value">
    </div>
    <div class="wiz-setup-cups">${cupsHtml}</div>
    ${_wiz.cups.length < 5
      ? `<button class="btn2" style="width:100%;margin-top:8px;margin-bottom:4px"
           onclick="wizAddCup()">+ 컵 추가 (최대 5)</button>`
      : ''}
  `;
}

// ──────────────────────────────────────────────────────────────
// 렌더 — 물 붓기 타이머 화면
// ──────────────────────────────────────────────────────────────
function _renderWizTimer(){
  const scr  = WIZ_SCREENS[_wiz.phase];
  const m    = Math.floor(_wizTmrSec / 60);
  const s    = _wizTmrSec % 60;
  const disp = `${m}:${String(s).padStart(2,'0')}`;
  const pct  = (1 - _wizTmrSec / scr.timerSec) * 100;
  const done = _wizTmrSec <= 0;

  const cupsRow = _wiz.cups.filter(c => c.bean_name).map(c => {
    const roast = c.roast_id ? db.roasts.find(r => r.id===c.roast_id) : null;
    return `<div class="wiz-tmr-cup">
      <span class="wiz-tmr-cup-name">${c.bean_name}</span>
      ${roast ? `<span class="wiz-tmr-cup-roast">${roast.date}</span>` : ''}
    </div>`;
  }).join('');

  return `
    <div class="wiz-screen-hd">
      <div class="wiz-screen-title">물 붓기 · 4분 대기</div>
      <div class="wiz-screen-guide">${scr.guide}</div>
    </div>
    <div class="wiz-timer-wrap">
      <div class="wiz-timer-disp${done?' done':''}" id="wizTmrDisp">${done?'완료 ✓':disp}</div>
      <div class="wiz-timer-bar">
        <div class="wiz-timer-bar-fill" id="wizTmrFill" style="width:${pct}%"></div>
      </div>
      <div class="wiz-timer-btns">
        ${done ? '' : (_wizTmrRunning
          ? `<button class="btn2" onclick="wizTmrPause()">일시정지</button>`
          : `<button class="btn btn-sm" onclick="wizTmrStart()">▶ 시작</button>`
        )}
        <button class="btn2" onclick="wizTmrReset()">초기화</button>
      </div>
    </div>
    <div class="wiz-tmr-cups">${cupsRow}</div>
  `;
}

// ──────────────────────────────────────────────────────────────
// 렌더 — 채점 화면 (공통)
// ──────────────────────────────────────────────────────────────
function _renderWizScoring(scr){
  const serialMap = getSerialMap();
  const validCups = _wiz.cups
    .map((cup, i) => ({cup, i}))
    .filter(({cup}) => cup.bean_name);

  if(!validCups.length){
    return `
      <div class="wiz-screen-hd">
        <div class="wiz-screen-title">${scr.label}</div>
        <div class="wiz-screen-guide">${scr.guide||''}</div>
      </div>
      <div class="empty" style="margin-top:20px">
        <div class="empty-icon">☕</div>
        <div class="empty-text">준비 화면으로 돌아가 생두를 선택하세요</div>
      </div>
    `;
  }

  const cardsHtml = validCups.map(({cup, i}) => {
    const roast    = cup.roast_id ? db.roasts.find(r => r.id===cup.roast_id) : null;
    const bean     = db.beans.find(b => b.name===cup.bean_name) || {};
    const stepNote = (cup.step_notes||{})[scr.id] || '';

    const scoresHtml = (scr.scoreKeys||[]).map(key => {
      const cur  = (cup.step_scores||{})[key] || 0;
      const chips = SCORE_VALS.map(v =>
        `<span class="sc-chip ${cur===v?'on':''}" onclick="wizSetScore(${i},'${key}',${v},this)">${v}</span>`
      ).join('');
      return `
        <div class="wiz-score-grp">
          <div class="wiz-score-lbl">${STEP_LABELS[key]||key}</div>
          <div class="cup-score-chips">${chips}</div>
        </div>
      `;
    }).join('');

    let tagsHtml = '';
    if(scr.hasTags){
      const pos = WIZ_POS.map(t =>
        `<span class="ctag cpos ${(cup.positives||[]).includes(t)?'on':''}"
          onclick="wizToggleTag(${i},'pos','${escQ(t)}',this)">${t}</span>`
      ).join('');
      const neg = WIZ_NEG.map(t =>
        `<span class="ctag cneg ${(cup.negatives||[]).includes(t)?'on':''}"
          onclick="wizToggleTag(${i},'neg','${escQ(t)}',this)">${t}</span>`
      ).join('');
      tagsHtml = `
        <div class="wiz-tags">
          <div class="wiz-tags-hd">긍정</div>
          <div class="wiz-tags-list">${pos}</div>
          <div class="wiz-tags-hd neg">부정</div>
          <div class="wiz-tags-list">${neg}</div>
        </div>
      `;
    }

    let summaryHtml = '';
    if(scr.isLast){
      const ss     = cup.step_scores || {};
      const ttl    = calcCupTotal(cup);
      const scored = Object.values(ss).filter(v => v>0).length;
      const bars   = CUP_STEPS.map(step => {
        const v   = ss[step.key];
        const bar = v ? (v-6)/4*100 : 0;
        const col = !v ? 'var(--muted)' : v>=8.5 ? 'var(--teal)' : v>=7.5 ? 'var(--amber)' : 'var(--coral)';
        return `<div class="cdet-step">
          <div class="cdet-step-lbl">${step.label}</div>
          <div class="cdet-bar-wrap"><div class="cdet-bar" style="width:${bar}%;background:${col}"></div></div>
          <div class="cdet-step-val" style="color:${col}">${v||'—'}</div>
        </div>`;
      }).join('');
      summaryHtml = `
        <div class="wiz-sum">
          <div class="wiz-sum-total">${ttl>0?ttl.toFixed(1):''}</div>
          ${scored<10
            ? `<div class="wiz-sum-sub">${scored}/10 항목 입력</div>`
            : `<div class="wiz-sum-sub" style="color:var(--teal)">SCA 10항목 완성 ✓</div>`
          }
          <div class="cdet-steps">${bars}</div>
        </div>
      `;
    }

    return `
      <div class="wiz-cup-card">
        <div class="wiz-cup-hd">
          <span class="wiz-cup-name">${cup.bean_name}</span>
          ${roast ? `<span class="wiz-cup-roast">${roastLabel(roast,serialMap)}</span>` : ''}
          ${bean.origin ? `<span class="wiz-cup-origin">${bean.origin}${bean.process?' · '+bean.process:''}</span>` : ''}
        </div>
        ${scoresHtml}
        ${tagsHtml}
        ${summaryHtml}
        <div class="wiz-cup-note-wrap">
          <textarea class="ta wiz-cup-note" placeholder="메모 (선택)" rows="2"
            oninput="wizSetStepNote(${i},'${scr.id}',this.value)">${stepNote}</textarea>
        </div>
      </div>
    `;
  }).join('');

  const sessionNotesHtml = scr.isLast ? `
    <div class="fg wiz-session-notes">
      <label class="fl">세션 전체 메모</label>
      <textarea class="ta" style="min-height:56px"
        placeholder="오늘 커핑 전반적인 메모"
        oninput="_wiz.sessionNotes=this.value">${_wiz.sessionNotes||''}</textarea>
    </div>
  ` : '';

  return `
    <div class="wiz-screen-hd">
      <div class="wiz-screen-title">${scr.label}</div>
      <div class="wiz-screen-guide">${scr.guide||''}</div>
    </div>
    <div class="wiz-cups-row">${cardsHtml}</div>
    ${sessionNotesHtml}
  `;
}

// ──────────────────────────────────────────────────────────────
// 네비게이션
// ──────────────────────────────────────────────────────────────
function wizNext(){
  if(_wiz.phase >= WIZ_SCREENS.length - 1) return;
  if(_wiz.phase === 0){
    if(!document.getElementById('wiz_date')?.value && !_wiz.date){
      alert('날짜를 입력하세요'); return;
    }
    _wiz.date = document.getElementById('wiz_date')?.value || _wiz.date;
    if(!_wiz.cups.some(c => c.bean_name)){
      alert('생두를 하나 이상 선택하세요'); return;
    }
  }
  clearWizTimer();
  _wiz.phase++;
  if(WIZ_SCREENS[_wiz.phase].hasTimer) _wizTmrSec = WIZ_SCREENS[_wiz.phase].timerSec;
  renderWiz();
}

function wizPrev(){
  if(_wiz.phase <= 0) return;
  clearWizTimer();
  _wiz.phase--;
  if(WIZ_SCREENS[_wiz.phase].hasTimer) _wizTmrSec = WIZ_SCREENS[_wiz.phase].timerSec;
  renderWiz();
}

function closeCuppingWizard(){
  clearWizTimer();
  closeMo('moCuppingWizard');
}

// ──────────────────────────────────────────────────────────────
// 컵 관리
// ──────────────────────────────────────────────────────────────
function wizAddCup(){
  if(_wiz.cups.length >= 5){ alert('최대 5개까지 비교할 수 있습니다'); return; }
  _wiz.cups.push(newCup());
  renderWiz();
}

function wizRemoveCup(idx){
  _wiz.cups.splice(idx, 1);
  renderWiz();
}

function wizSetBean(idx, beanName){
  _wiz.cups[idx].bean_name = beanName;
  _wiz.cups[idx].roast_id  = '';
  renderWiz();
}

function wizSetRoast(idx, roastId){
  _wiz.cups[idx].roast_id = roastId;
}

// ──────────────────────────────────────────────────────────────
// 점수 / 태그 / 노트
// ──────────────────────────────────────────────────────────────
function wizSetScore(idx, key, val, chip){
  if(!_wiz.cups[idx].step_scores) _wiz.cups[idx].step_scores = {};
  _wiz.cups[idx].step_scores[key] = val;
  chip.closest('.cup-score-chips').querySelectorAll('.sc-chip').forEach(c => c.classList.remove('on'));
  chip.classList.add('on');
}

function wizToggleTag(idx, type, tag, chip){
  const cup = _wiz.cups[idx];
  const arr = type === 'pos'
    ? (cup.positives || (cup.positives = []))
    : (cup.negatives || (cup.negatives = []));
  const i = arr.indexOf(tag);
  if(i >= 0){ arr.splice(i, 1); chip.classList.remove('on'); }
  else       { arr.push(tag);   chip.classList.add('on'); }
}

function wizSetStepNote(idx, screenId, val){
  if(!_wiz.cups[idx].step_notes) _wiz.cups[idx].step_notes = {};
  _wiz.cups[idx].step_notes[screenId] = val;
}

// ──────────────────────────────────────────────────────────────
// 타이머
// ──────────────────────────────────────────────────────────────
function wizTmrStart(){
  if(_wizTmrRunning || _wizTmrSec <= 0) return;
  _wizTmrRunning = true;
  _wizTmrId = setInterval(() => {
    _wizTmrSec = Math.max(0, _wizTmrSec - 1);
    const dispEl = document.getElementById('wizTmrDisp');
    const fillEl = document.getElementById('wizTmrFill');
    const scr    = WIZ_SCREENS[_wiz.phase];
    if(dispEl){
      if(_wizTmrSec <= 0){
        dispEl.textContent = '완료 ✓';
        dispEl.classList.add('done');
      } else {
        const m = Math.floor(_wizTmrSec/60);
        dispEl.textContent = `${m}:${String(_wizTmrSec%60).padStart(2,'0')}`;
      }
    }
    if(fillEl && scr) fillEl.style.width = `${(1 - _wizTmrSec/scr.timerSec)*100}%`;
    if(_wizTmrSec <= 0){
      clearWizTimer();
      renderWiz();
    }
  }, 1000);
  renderWiz();
}

function wizTmrPause(){
  clearWizTimer();
  renderWiz();
}

function wizTmrReset(){
  clearWizTimer();
  const scr = WIZ_SCREENS[_wiz.phase];
  _wizTmrSec = scr ? scr.timerSec || 240 : 240;
  renderWiz();
}

// ──────────────────────────────────────────────────────────────
// 저장
// ──────────────────────────────────────────────────────────────
function saveWizardCupping(){
  if(!_wiz.date){ alert('날짜를 입력하세요'); return; }
  const validCups = _wiz.cups.filter(c => c.bean_name);
  if(!validCups.length){ alert('생두를 하나 이상 선택하세요'); return; }

  const cups = validCups.map(c => ({ ...c, total: calcCupTotal(c) }));
  const data = {
    id: _wiz.editId || genId(),
    date: _wiz.date,
    cups,
    session_notes: (_wiz.sessionNotes||'').trim(),
  };

  if(!db.cuppings) db.cuppings = [];
  if(_wiz.editId){
    const idx = db.cuppings.findIndex(x => x.id === _wiz.editId);
    if(idx >= 0) db.cuppings[idx] = data; else db.cuppings.push(data);
  } else {
    db.cuppings.push(data);
  }
  saveDB();
  clearWizTimer();
  closeMo('moCuppingWizard');
  renderCupping();
}

function saveCupping(){ saveWizardCupping(); }

// ──────────────────────────────────────────────────────────────
// 세션 목록
// ──────────────────────────────────────────────────────────────
function renderCupping(){
  const sessions = [...(db.cuppings||[])].sort((a,b) => b.date.localeCompare(a.date));
  document.getElementById('cuppingList').innerHTML = sessions.length
    ? sessions.map(cuppingCard).join('')
    : '<div class="empty"><div class="empty-icon">☕</div><div class="empty-text">커핑 기록이 없습니다</div></div>';
}

function cuppingCard(s){
  const beanNames = s.cups.map(c => c.bean_name).filter(Boolean).join('  ·  ');
  const topPos    = [...new Set(s.cups.flatMap(c => c.positives||[]))].slice(0,5).join(' · ');
  const topNeg    = [...new Set(s.cups.flatMap(c => c.negatives||[]))].slice(0,3).join(' · ');
  return `<div class="ccard" onclick="openCuppingDetail('${s.id}')">
    <div class="ccard-head">
      <span class="ccard-date">${s.date}</span>
      <span class="ccard-cnt">${s.cups.length}종 비교</span>
    </div>
    <div class="ccard-beans">${beanNames||'—'}</div>
    ${topPos ? `<div class="ccard-tags pos">${topPos}</div>` : ''}
    ${topNeg ? `<div class="ccard-tags neg">⚠ ${topNeg}</div>` : ''}
    ${s.session_notes ? `<div class="ccard-note">${s.session_notes}</div>` : ''}
  </div>`;
}

// ──────────────────────────────────────────────────────────────
// 세션 상세
// ──────────────────────────────────────────────────────────────
function openCuppingDetail(id){
  const s = db.cuppings.find(x => x.id === id);
  if(!s) return;
  const serialMap = getSerialMap();

  const cupsHtml = s.cups.map(c => {
    const scores = c.step_scores || c.scores || {};
    const total  = c.total || calcCupTotal(c);
    const roast  = c.roast_id ? db.roasts.find(r => r.id===c.roast_id) : null;
    const bean   = db.beans.find(b => b.name===c.bean_name) || {};

    const stepsHtml = CUP_STEPS.map(step => {
      const v   = scores[step.key];
      const bar = v ? (v-6)/4*100 : 0;
      const col = !v ? 'var(--muted)' : v>=8.5 ? 'var(--teal)' : v>=7.5 ? 'var(--amber)' : 'var(--coral)';
      return `<div class="cdet-step">
        <div class="cdet-step-lbl">${step.label}</div>
        <div class="cdet-bar-wrap"><div class="cdet-bar" style="width:${bar}%;background:${col}"></div></div>
        <div class="cdet-step-val" style="color:${col}">${v||'—'}</div>
      </div>`;
    }).join('');

    const pos = (c.positives||[]).map(t => `<span class="ctag-sm cpos">${t}</span>`).join('');
    const neg = (c.negatives||[]).map(t => `<span class="ctag-sm cneg">${t}</span>`).join('');
    const stepNotes = Object.entries(c.step_notes||{})
      .filter(([,v]) => v)
      .map(([k,v]) => `<div style="font-size:11px;color:var(--muted2);margin-bottom:3px">
        <span style="color:var(--muted)">${STEP_LABELS[k]||k}:</span> ${v}
      </div>`).join('');

    return `<div class="cdet-cup">
      <div class="cdet-cup-head">
        <span class="cdet-cup-name">${c.bean_name}</span>
        ${roast ? `<span class="cdet-cup-roast">${roastLabel(roast,serialMap)}</span>` : ''}
        ${total>0 ? `<span class="cdet-cup-total">${total.toFixed(1)}</span>` : ''}
      </div>
      ${bean.origin ? `<div style="font-size:11px;color:var(--muted2);margin-bottom:8px">${bean.origin}${bean.process?' · '+bean.process:''}</div>` : ''}
      <div class="cdet-steps">${stepsHtml}</div>
      ${pos ? `<div class="ctag-row" style="margin-top:8px">${pos}</div>` : ''}
      ${neg ? `<div class="ctag-row" style="margin-top:4px">${neg}</div>` : ''}
      ${stepNotes ? `<div style="margin-top:8px">${stepNotes}</div>` : ''}
      ${c.notes ? `<div class="cdet-note">"${c.notes}"</div>` : ''}
    </div>`;
  }).join('');

  document.getElementById('cdTitle').textContent = `${s.date} 커핑`;
  document.getElementById('cdContent').innerHTML = `
    ${cupsHtml}
    ${s.session_notes
      ? `<div class="ds" style="margin-top:14px">
           <div class="dstitle">세션 메모</div>
           <div style="font-size:13px;color:var(--text2);font-style:italic;line-height:1.6">${s.session_notes}</div>
         </div>`
      : ''}
  `;
  document.getElementById('cdEditBtn').onclick = () => {
    closeMo('moCuppingDetail'); openCuppingWizard(id);
  };
  document.getElementById('cdDeleteBtn').onclick = () => {
    if(confirm('이 커핑 세션을 삭제하시겠습니까?')){
      db.cuppings = db.cuppings.filter(x => x.id !== id);
      saveDB(); closeMo('moCuppingDetail'); renderCupping();
    }
  };
  openMo('moCuppingDetail');
}

// ──────────────────────────────────────────────────────────────
// 연계 함수 (roasts.js / beans.js)
// ──────────────────────────────────────────────────────────────
function getCuppingsForBean(beanName){
  return (db.cuppings||[])
    .filter(s => s.cups.some(c => c.bean_name===beanName))
    .sort((a,b) => b.date.localeCompare(a.date));
}

function getCuppingsForRoast(roastId, beanName){
  return (db.cuppings||[])
    .filter(s => s.cups.some(c =>
      c.roast_id===roastId || (c.bean_name===beanName && !c.roast_id)
    ))
    .sort((a,b) => b.date.localeCompare(a.date));
}

function cuppingMiniHtml(sessions, beanName){
  if(!sessions.length) return '';
  const items = sessions.slice(0,3).map(s => {
    const cup   = s.cups.find(c => c.bean_name===beanName) || s.cups[0];
    const total = cup ? (cup.total||calcCupTotal(cup)) : 0;
    const pos   = (cup?.positives||[]).slice(0,3).join(' · ');
    const neg   = (cup?.negatives||[]).slice(0,2).join(' · ');
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

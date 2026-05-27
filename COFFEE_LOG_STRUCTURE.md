# Coffee Log 웹앱 프로젝트 구조

## 접속 주소

| 용도 | URL |
|------|-----|
| **실제 사용 (PC + 모바일)** | `https://jhlee810-coffee.github.io/coffee-log/` |
| 개발/로컬 (집 내부 전용) | `http://192.168.0.5:8899/` |

> 두 주소는 localStorage가 **완전히 분리**되어 있음. 실사용은 GitHub Pages로 통일.

---

## 인프라

| 항목 | 정보 |
|------|------|
| GitHub 레포 | `jhlee810-coffee/coffee-log` |
| GitHub PAT | `ghp_****` (jhlee810@gmail.com → GitHub Settings → Developer Settings에서 재발급) |
| Mac Mini SSH | `JHLee@192.168.0.5` |
| Mac Mini 프로젝트 경로 | `~/coffee-log/` |
| Mac Mini HTTP 서버 | `python3 -m http.server 8899` (백그라운드 실행) |
| Google Sheets ID | `1VclS_5T-vCXr4fnfGGJY3-DyY3oUf11PmThT9bVrmlo` |
| GAS 배포 URL | `https://script.google.com/macros/s/AKfycbz2vHupdUOhyN7Tj4Pjm92X4rkVkyjUC0VFJ-46gk2UM8Da_u2WJRzUjDYjYbgtA3eJ/exec` |

---

## 배포 절차

```bash
# 1. Windows에서 파일 수정 (D:\BI_T1m\coffee-log\)

# 2. index.html 캐시버스팅 버전 올리기 (모든 ?v= 일괄 변경)
#    예: ?v=20260528d → ?v=20260529a

# 3. Mac Mini에 SCP 전송
scp 파일.js 파일.css JHLee@192.168.0.5:~/coffee-log/

# 4. Mac Mini에서 git commit & push (SSH로)
ssh JHLee@192.168.0.5 "cd ~/coffee-log && git add 파일명 && git commit -m '커밋메시지' && git push https://[PAT]@github.com/jhlee810-coffee/coffee-log.git main"
# PAT는 GitHub → Settings → Developer Settings → Personal Access Tokens에서 확인/재발급
```

> Git 저장소는 Mac Mini에만 있음. Windows 로컬은 git repo 아님.

---

## 파일 구조

```
coffee-log/
├── index.html          — 전체 HTML 구조, 탭/모달 정의, 스크립트 로딩 순서
├── style.css           — 전체 스타일 (다크테마, 모달, 커핑 카드 등)
├── data.js             — INITIAL_DATA (하드코딩된 초기 생두/로스팅 데이터, 953줄)
├── app.js              — 핵심: loadDB, saveDB, Google Sheets 동기화, 공통 유틸
├── dashboard.js        — 대시보드 탭 렌더링 (renderDash)
├── beans.js            — 생두 탭 (renderBeans, openBeanForm 등)
├── roasts.js           — 로스팅 탭 (renderRoasts, BINBON_MODES 상수 포함)
├── brewing.js          — 브루잉 탭 (renderBrewing, 레시피/로그)
├── wishlist.js         — 구매검토 탭 (renderWishlist)
├── cupping.js          — 커핑 탭 (위저드, 드래프트/완료 워크플로우)
├── binbon_timer.html   — 빈본 로스팅 타이머 (iframe으로 탑재)
├── COFFEE_LOG_STRUCTURE.md     — 이 파일 (프로젝트 구조 참조)
└── COFFEE_LOG_CHANGELOG_*.md   — 날짜별 작업 로그
```

### 스크립트 로딩 순서 (index.html 하단)
```html
<script src="data.js?v=..."></script>      <!-- INITIAL_DATA 정의 -->
<script src="app.js?v=..."></script>        <!-- db 초기화, 동기화 -->
<script src="dashboard.js?v=..."></script>  <!-- renderDash 정의 -->
<script src="beans.js?v=..."></script>
<script src="roasts.js?v=..."></script>
<script src="brewing.js?v=..."></script>
<script src="wishlist.js?v=..."></script>
<script src="cupping.js?v=..."></script>
```

> **주의**: `app.js` 마지막에서 `renderDash()`를 호출하지만 `dashboard.js`보다 먼저 로딩됨.
> 이 때문에 `try{renderDash();}catch(e){}` 로 감싸서 에러 무시.
> `syncFromSheets()` 완료 후 다시 `renderDash()` 호출하여 정상 표시.

---

## 데이터 구조 (localStorage key: `coffee_v3`)

```javascript
db = {
  beans: [
    {
      id, name, origin, farm, variety, process, altitude,
      purchase_date, purchase_from, price_per_100g,
      roast_profile, notes, stock_g, target_roast
    }
  ],
  roasts: [
    {
      id, bean_name, date, input_g, output_g,
      mode,           // 빈본 모드 번호 (2~7)
      roast_level,    // 로스팅 레벨
      pop_time,       // 1차 팝 시간 "MM:SS"
      eject_time,     // 배출 시간 "MM:SS"
      dtr_pct,        // DTR % (직접 입력 시)
      loss_pct,       // 손실율 % (직접 입력 시)
      notes
    }
  ],
  recipes: [
    { id, name, coffee_g, water_g, temp, grind, ratio, notes }
  ],
  brewlogs: [
    {
      id, date, bean_name, roast_id, recipe_id,
      rating, notes, water_temp, grind_setting, total_time
    }
  ],
  wishlist: [
    { id, name, origin, farm, process, price, url, notes, priority }
  ],
  cuppings: [
    {
      id, date,
      status,         // 'draft' | 'done'  (없으면 점수로 판별)
      session_notes,
      cups: [
        {
          cup_id, bean_name, roast_id,
          step_scores: {  // SCA 10항목
            fragrance, aroma, flavor, aftertaste,
            acidity, body, balance, clean_cup, sweetness, overall
          },
          step_notes: { fragrance, aroma, flavor_group, ... },
          positives: [],  // 긍정 태그
          negatives: [],  // 부정 태그
          total,          // 합산 점수
          notes           // 구버전 호환용
        }
      ]
    }
  ],
  _savedAt: 1779896595316  // Unix timestamp (ms), 동기화 기준
}
```

> **구버전 호환**: 오래된 커핑 데이터는 `step_scores` 대신 `scores` 필드 사용.
> `calcCupTotal(c)` 함수가 두 포맷 모두 처리.

---

## Google Sheets 동기화 (app.js)

### 상수
```javascript
const GAS_URL = 'https://script.google.com/macros/s/.../exec';
const SK = 'coffee_v3';  // localStorage key
```

### 동기화 로직 (`syncFromSheets`)
```
페이지 로드 시:
  GET /exec → Sheets에서 data 읽기
  if Sheets가 비어있음 → 현재 db를 Sheets에 업로드
  if remoteAt >= localAt → Sheets 데이터를 로컬에 덮어씀  ← Sheets 우선
  if localAt > remoteAt → 로컬 데이터를 Sheets에 업로드

저장 시 (saveDB):
  localStorage 저장 → Sheets에 비동기 푸시 (pushToSheets)
```

### GAS 코드 (Google Sheets Apps Script)
```javascript
const SHEET_ID = '1VclS_5T-vCXr4fnfGGJY3-DyY3oUf11PmThT9bVrmlo';

function doGet(e) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
  const val = sheet.getRange('A1').getValue();
  const data = val ? JSON.parse(val) : null;
  return ContentService.createTextOutput(JSON.stringify({ ok: true, data }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
  sheet.getRange('A1').setValue(JSON.stringify(body));
  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

> A1 셀 하나에 전체 JSON 저장. 가독성은 없지만 동기화 용도로는 충분.
> POST는 `Content-Type: text/plain`으로 CORS preflight 우회.

### PowerShell로 Sheets에 직접 업로드 (비상용)
```powershell
$json = Get-Content "백업파일.json" -Raw -Encoding UTF8
$data = $json | ConvertFrom-Json
$ts = [int64](([datetime]::UtcNow - [datetime]'1970-01-01').TotalMilliseconds)
$data | Add-Member -NotePropertyName "_savedAt" -NotePropertyValue $ts -Force
$body = $data | ConvertTo-Json -Depth 50 -Compress
$bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($body)  # 한글 깨짐 방지!
$url = "https://script.google.com/macros/s/.../exec"
Invoke-WebRequest -Uri $url -Method POST -Body $bodyBytes -ContentType "text/plain; charset=utf-8" -UseBasicParsing -MaximumRedirection 10
```
> **반드시 UTF-8 바이트 배열로 전송해야 한글 안 깨짐.**

---

## 주요 상수 / 전역 변수

| 위치 | 이름 | 설명 |
|------|------|------|
| `app.js` | `SK = 'coffee_v3'` | localStorage 키 |
| `app.js` | `GAS_URL` | Google Apps Script 배포 URL |
| `app.js` | `OFFICIAL_RECIPES[]` | 484 레시피, 4:6, Switch, Hoffmann |
| `app.js` | `ORIGIN_COLORS{}` | 원산지별 색상 맵 |
| `app.js` | `db` | 전역 데이터 객체 |
| `roasts.js` | `BINBON_MODES{}` | `{2:445, 3:399, 4:406, 5:470, 6:362, 7:405}` — 모드별 에어종료시간(초) |
| `cupping.js` | `WIZ_SCREENS[]` | 커핑 위저드 8단계 정의 |
| `cupping.js` | `CUP_STEPS[]` | SCA 10개 항목 키/레이블 |

---

## 커핑 워크플로우 (cupping.js)

```
+ 새 세션 버튼
  └─ openCuppingWizard() → 위저드 phase 0 (날짜 + 원두 선택)
       ├─ 💾 저장만 → saveDraftCupping() → status:'draft' 로 저장
       └─ ▶ 시작   → wizNext() → phase 1부터 순차 진행 → saveWizardCupping() → status:'done'

커핑 목록 카드:
  - status:'draft' 또는 점수 없음 → 준비중 카드 (황색)
       ├─ ▶ 커핑 시작 → startCuppingFromDraft(id) → phase 1부터 위저드
       ├─ 설정 수정   → openCuppingWizard(id) → phase 0 (원두 변경 가능)
       └─ 삭제        → deleteCuppingSession(id)
  - status:'done' 또는 점수 있음 → 완료 카드 (보라)
       └─ 클릭        → openCuppingDetail(id) → 상세 결과 보기
```

---

## 알려진 주의사항

1. **data.js 절대 비우지 말 것** — 953줄의 INITIAL_DATA. 모바일 첫 로드시 폴백 데이터.
2. **renderDash ReferenceError** — app.js가 dashboard.js보다 먼저 로드되어 발생. `try-catch`로 처리 중. 콘솔 에러는 무해.
3. **구버전 커핑 데이터** — `step_scores` 없이 `scores`만 있거나 `status` 없는 데이터. `calcCupTotal`과 `isDraft` 로직이 처리.
4. **Sheets 동기화 충돌** — 마지막 저장이 항상 이김 (last-write-wins). 두 기기에서 동시 편집 시 한쪽 변경 유실 가능.
5. **Sheets 셀 한도** — Google Sheets 셀 최대 50,000자. 현재 데이터 약 19,000자. 데이터 대폭 늘면 재설계 필요.

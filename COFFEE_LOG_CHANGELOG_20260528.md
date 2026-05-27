# 작업 로그 — 2026-05-28

## 세션 요약

이 세션에서 완료한 작업 목록. 다음 세션에서 이어받을 때 참고.

---

## 완료된 작업

### 1. 커핑 위저드 개선
**파일**: `cupping.js`

- **최대 컵 수 5→6** 변경
- **로스팅 선택 레이블** 개선: 용량 제거, 모드/DTR/손실율 추가
  ```javascript
  // roastLabel(r, serialMap) 함수
  // 출력 예: "#05 2026-05-20 [미디엄] 모드3 DTR28.5% 손실14.2%"
  ```
- **생두 선택 원산지별 그룹핑** — `<optgroup>` 으로 원산지별 묶음, 한글 정렬

### 2. 데이터 복구 (긴급)
**파일**: `data.js`

- 커핑 작업 중 data.js를 5줄짜리 빈 스텁으로 교체하는 사고 발생
- 모바일에서 모든 기록이 사라지는 현상 발생
- Mac Mini git에서 커밋 `544cab1`로 원본 복구:
  ```bash
  ssh JHLee@192.168.0.5 "cd ~/coffee-log && git show 544cab1:data.js > data.js"
  ```

### 3. 데이터 내보내기/가져오기
**파일**: `app.js`, `index.html`

- 헤더에 ⬇(내보내기) / ⬆(가져오기) 버튼 추가
- `exportData()` — `JSON.stringify(db)` 로 현재 메모리 데이터 내보내기 (localStorage가 아닌 db 직접 참조)
- `importData(input)` — JSON 파일 가져오기 + `_savedAt = Date.now()` 설정 (Sheets보다 항상 최신으로 인식)

### 4. Google Sheets 실시간 동기화 구현
**파일**: `app.js`

#### 배경
- 초기 설계: 구글 시트에 저장 → 어디서나 동일 데이터
- 이전 세션에서 service account 발급했으나 코드가 localStorage 방식으로 변경되어 있었음
- GAS (Google Apps Script) 방식으로 재구현

#### GAS 구조
- Sheet의 A1 셀에 전체 JSON 저장 (단순 key-value 저장소로 사용)
- `doGet` → A1 읽기, `doPost` → A1 쓰기
- CORS 우회: `Content-Type: text/plain` (simple request, preflight 없음)

#### app.js 추가 내용
```javascript
const GAS_URL = 'https://...exec';

function saveDB(){
  db._savedAt = Date.now();
  localStorage.setItem(SK, JSON.stringify(db));
  // ... 상태 표시 ...
  pushToSheets();  // 비동기 백그라운드
}

async function pushToSheets(){ /* fetch POST */ }

async function syncFromSheets(){
  // GET → 타임스탬프 비교
  // remoteAt >= localAt → Sheets 다운로드 (Sheets 우선)
  // localAt > remoteAt → Sheets 업로드
  // Sheets 비어있음 → 첫 업로드
  try{ renderDash(); }catch(e){}  // 항상 대시보드 갱신
}
```

#### 동기화 전략
- `_savedAt` (Unix ms timestamp) 비교
- **Sheets 우선** (`>=`): 동일 타임스탬프에도 Sheets 데이터 사용 → 첫 접속 기기 자동 다운로드 보장
- last-write-wins 방식 (단일 사용자이므로 충분)

### 5. renderDash ReferenceError 버그 수정
**파일**: `app.js`

**문제**: app.js 마지막에서 `renderDash()` 호출 → dashboard.js 아직 미로딩 → ReferenceError → 그 아래 `syncFromSheets()` 실행 안 됨 → 모바일 동기화 불가

**수정**:
```javascript
// Before
renderDash();
syncFromSheets();

// After
try{renderDash();}catch(e){}  // 에러 무시하고 계속
syncFromSheets();
```
+ `syncFromSheets()` 마지막에도 `try{renderDash();}catch(e){}` 추가

### 6. 한글 깨짐 수정 (PowerShell UTF-8 인코딩)

**문제**: PowerShell `Invoke-WebRequest`가 한글을 ASCII로 전송 → Sheets에 `?????` 저장 → 모바일에서 원두명 등 모두 깨짐

**원인**: PowerShell의 기본 HTTP body 인코딩이 UTF-8이 아님

**수정**: byte array로 명시적 UTF-8 인코딩
```powershell
$bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($body)
Invoke-WebRequest -Body $bodyBytes -ContentType "text/plain; charset=utf-8"
```

### 7. 커핑 상세보기 클릭 안 되는 버그 수정
**파일**: `cupping.js`

**원인**: `calcCupTotal(cup객체)` 호출 시
- `cup.step_scores` 없음 → cup 전체 객체를 scores로 사용
- `cup.roast_id = '23'` (숫자 문자열) → `'23' > 0` → JavaScript가 `true`로 평가
- `vals.reduce((a,b) => a+b, 0)` → `0 + '23'` = `'023'` (문자열)
- `'023'.toFixed(1)` → **TypeError** → `openCuppingDetail` 실패 → 모달 안 열림

**수정**:
```javascript
function calcCupTotal(cupOrScores){
  const scores = (cupOrScores && cupOrScores.step_scores)
    ? cupOrScores.step_scores
    : (cupOrScores && cupOrScores.scores)  // 구버전 호환
    ? cupOrScores.scores
    : (cupOrScores || {});
  const vals = Object.values(scores)
    .filter(v => typeof v === 'number' && v > 0);  // 타입 체크 추가
  return vals.length ? vals.reduce((a,b) => a+b, 0) : 0;
}
```

### 8. 커핑 드래프트/완료 워크플로우 신설
**파일**: `cupping.js`, `style.css`

#### 새 흐름
```
+ 새 세션
  → 날짜 + 원두 선택
  → [💾 저장만] status:'draft'로 저장
  → [▶ 시작]   커핑 위저드 진행 → status:'done'으로 저장

목록 카드:
  - 준비중 (draft): 황색 테두리 + [▶ 커핑 시작] [설정 수정] [삭제]
  - 완료 (done): 보라 테두리 + 총점 → 클릭 시 상세보기
```

#### 추가된 함수
- `saveDraftCupping()` — draft 저장
- `startCuppingFromDraft(id)` — draft 로드 후 phase 1(건식향)부터 시작
- `deleteCuppingSession(id)` — 카드에서 직접 삭제

#### isDraft 판별 로직
```javascript
const isDraft = s.status === 'draft' ||
  (!s.status && !s.cups.some(c => calcCupTotal(c) > 0));
// status 없는 구버전 데이터도 점수 없으면 draft로 처리
```

---

## 현재 데이터 상태

| 항목 | 수량 |
|------|------|
| 생두 | 25개 |
| 로스팅 배치 | 30개 |
| 브루잉 기록 | 4건 |
| 커핑 세션 | 1건 (테스트용, draft 상태) |
| 위시리스트 | 0개 |

**구글 시트 `_savedAt`**: `1779896595316` (2026-05-28 기준)

백업 파일: `C:\Users\HOME\Desktop\coffee-full-backup.json`

---

## 최종 배포 버전

`index.html` 캐시버스팅: `?v=20260528d`

GitHub 최신 커밋: `9829eb0` — "Cupping: draft/done workflow, fix calcCupTotal crash, start-from-draft"

---

## 다음 세션에서 가능한 작업

- [ ] 구글 시트 표 형태 보기 (GAS에 formatSheet 함수 추가, 커스텀 메뉴)
- [ ] 커핑 결과 비교 차트 (레이더 차트)
- [ ] 로스팅 프로파일 그래프
- [ ] 브루잉 기록 필터/검색
- [ ] 생두 재고 관리 강화

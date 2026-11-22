# 2026-11-22 작업 로그

## 세이 → SEY 변경 + 라벨 SEY 글꼴
- **이름 변경**: 구매처·로스터리 `세이`(`세이 커피`, `sey`, `Sey` 포함) → **SEY** (shops.js `SHOP_ALIASES`, 앱 열 때 `normalizeShopNames`가 저장된 이름을 자동으로 바꿈). 레시피 `세이 더블블룸` → **`SEY 더블블룸`** (app.js `OFFICIAL_RECIPES` 이름·type, dailycup.js `DC_PRESETS`·`DC_MAIN_RECIPES`). 저장된 기록의 옛 레시피 이름은 `dcFixRecipeNames()`(dailycup.js, `DC_RECIPE_RENAMED`)가 앱 열 때 바꿈 — 오늘의 한 잔 기록·브루잉 비교 기록·브루잉 로그 대상.
- 실제 데이터에 반영된 것: 산 원두(roasted_beans) 로스터리 4건, 오늘의 한 잔 기록의 레시피 이름 9건. (메모 글 속의 "세이"는 안 바꿈 — 로스터리 카드 내용을 붙여 넣은 글이라서.)
- **라벨 글꼴**: SEY 홈페이지의 실제 로고(SVG 경로)와 후보 글꼴 24종×굵기 5종을 글자 모양 겹침(IoU)으로 비교해 **Outfit**(굵기 500, 흰 글씨 헤더는 600) + 자간 0.15em 선택. 로고는 얇고 자간이 넓은 대문자 기하학 산세리프. 라벨에서 구매처가 SEY면 이 글꼴로 크게(30점) 찍힘: 진공(구매 원두) 라벨의 로스터리 줄, 생두 정보 라벨의 구매처. labels.js `lbShopStyle`, Google Fonts 요청에 `Outfit:wght@500;600` 추가(기존 Noto Sans KR과 같은 요청, 인터넷 필요). 글꼴 로딩 실패 시 기존 경고 문구에 Outfit도 표시.
- 버전: app.js · dailycup.js · shops.js `20261122a`, labels.js `20261122b`.

## 정렬 추가 (2026-11-23, 버전 roasted.js · beans.js `20261123a`)
- 원두 탭: `로스팅 최신순 | 오래된 순 | 숙성 단계순`(기본, 예전 방식) — 원두 고르기 창과 같은 규칙 (`_rbSort`).
- 생두 탭: 필터 칩 아래 줄에 `구매 최신순 | 구매 오래된 순 | 잔량 많은 순 | 잔량 적은 순` (`_bsSort`, 다시 누르면 기본 순서로). 구매일(`stock_date`)·잔량(`beanUsage`)을 모르는 생두는 맨 뒤, 소진 생두는 항상 맨 아래.

# Coffee Log 작업 로그 — 2026-11-11

## 님봇 B1 라벨 출력 (labels.js)
- 새 파일: `labels.js`, `lib/niimbluelib.min.js`(+LICENSE). 시안: `design/labels/*.dc.html`. 자세한 내용은 `COFFEE_LOG_FOR_CLAUDE.md` 맨 아래 "라벨 출력".
- 손댄 곳(버튼·스위치만): index.html(메뉴 맨 끝 [🏷 연결] 칩, 로스팅 화면 "🏷 자동 출력" 스위치, 스크립트), plan.js(계획 화면 [생두 라벨 전체 출력]·배치별 [생두 라벨] — 동작 그대로), beans.js(생두 카드·상세 [생두 라벨]), roasts.js(목록 [로스팅 라벨 다시 출력]·[진공 라벨], 저장 뒤 자동 출력 호출 한 줄), roasted.js(원두 카드 [진공 라벨]), style.css(.lb-*, 넓은 화면 메뉴 칸 10개로).
- 만든 방식: html2canvas로 먼저 만들었다가, 한글 사이 가운뎃점(·)처럼 글자 모양이 앞뒤 글자에 따라 달라지는 것이 어긋나서(화면은 폭 13.8px, 글자를 따로 그리면 7px) 줄 단위로 그리는 자체 그리기(`lbPaintRoot`)로 바꿈 — 라이브러리 200KB가 빠지고 라벨 한 장 약 10ms.
- 테스트(8790 복사본, POST 차단 + 가짜 프린터): 시안 4종과 나란히 비교, 긴 데이터·빈칸, 계획 3장(🎁 포함·건너뜀 제외), 진공 15g×5장, 자동 출력(성공·꺼짐·프린터 오류+다시 출력·롤 불일치·연결 안 됨·수정은 안 뽑음), 사파리형 이미지 저장, 폰 폭 레이아웃. 실제 프린터는 미확인.
- 버전: style.css·app.js·beans.js·roasts.js·roasted.js·plan.js·labels.js `20261111a`.

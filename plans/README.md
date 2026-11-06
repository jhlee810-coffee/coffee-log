# 로스팅 계획 파일 (빈본 탭 "Claude 계획 불러오기")

- 파일 이름: `YYYY-MM-DD.json` — 그 날짜에 빈본 탭을 열면 "Claude 계획 불러오기" 버튼이 뜸
- 이 폴더는 GitHub Pages로 공개됨 (생두 이름·모드·DTR 정도만 넣을 것)
- 만들기: `python tools/make_plan.py <날짜> <계획 글 파일> <GAS GET json>` → 생두 ID를 찾아 이 폴더에 씀 → SCP·커밋·푸시

```json
{"date":"2026-11-08","version":1,"items":[
  {"bean_id":"mv1wir3tnhd","bean":"케냐 카구모 AA","mode":3,"dtr":13,"input_g":120,"gift":false,"note":"첫 배치"}
]}
```
- `version`: 같은 날 계획을 고쳐 다시 올리면 숫자를 올림 → 앱에 다시 "불러오기"가 뜸

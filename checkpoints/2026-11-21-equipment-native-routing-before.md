# v0.6.1 장비 UI 교체 전 기준본

- `index.html` blob SHA: `87cc31c88fe5c484f76f14bfeb5843d14107725e`
- 기존 백과·배경·상단 항산/전투 탭은 보호
- 산부진 APK v22 웹UI 원본 확인: equip-quick, equip-auto, equip, equip-orange, jianwang-manual, jianwang-auto 각각 독립 HTML
- 검왕각 중복 화면 원인: equip?tab=jianwang 리다이렉트와 누락된 jianwang-manual 경로
- 수정 방향: iframe 내부 앱 중첩을 없애고 동일 사이트의 직접 페이지/라우트에서 산부진 원본 장비 화면과 JS 계산을 실행
- 원본 API/세이브 연결은 검증 후 활성화, 기존 장비 엔진 가짜 미리보기 제거

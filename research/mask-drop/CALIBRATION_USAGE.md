# 수라가면 7209 · 전투별 난수 공유 교차검증

연구 전용 코드: `calibrate-level70.cjs`. 공개 사이트 코드가 아니라 연구 브랜치에서만 실행한다.

## 필요한 관측

- 만호강 **30681** 한 번 처치하기 전과 직후의 세이브
- 70레벨 산적 **32950** 한 번 처치하기 전과 직후의 세이브
- 필요하면 여러 쌍을 추가해 재현성 확인
- 같은 이름의 **35125**는 드랍 설정이 없는 다른 NPC이므로 제외

각 전후 구간에는 다른 필드 전투, 관문, 암시장 갱신 등을 넣지 않는다. 관측된 보상은 `mask`, `other`, `none`, `unknown` 중 하나로 선택한다.

로컬 머신의 **연구 브랜치 작업 디렉터리 밖**에 아래 형식으로 `manifest.json`을 만든다. 실제 세이브 파일이나 manifest를 절대 Git에 추가하지 않는다.

```json
{
  "bounds": [100, 101, 1000],
  "maxCalls": 3,
  "events": [
    {"npc": 30681, "before": "/LOCAL_ONLY/pre-mask.json", "after": "/LOCAL_ONLY/post-mask.json", "outcome": "none"},
    {"npc": 32950, "before": "/LOCAL_ONLY/pre-bandit.json", "after": "/LOCAL_ONLY/post-bandit.json", "outcome": "other"}
  ]
}
```

`node research/mask-drop/calibrate-level70.cjs /LOCAL_ONLY/manifest.json`

이 명령은 원시 난수, 계정/세이브 정보, 파일 경로를 출력하지 않고 **관측별 난수 전이와 부합하는 호출 횟수**, NPC별 변화 건수, 후보 난수 경로 공유에 대한 정성 평가만 반환한다.

**주의:** `bounds` 값은 아직 원본에서 복구된 가중치 범위가 아니라 서로 비교할 수 있는 가설이다. `aidrop70`가 두 NPC 전투 후 모두 변해도 다른 RNG 소비 가능성 때문에 원본 직접 드랍 소비가 증명되지는 않는다. 이 도구는 드랍 회차를 확정하는 기능이 아니다.

## 다음 정확도 단계

1. 원본 `JHAIClient.getDropByID`의 PC74/PC96 분기, `weightRand` 인수를 LuaJIT로 복원
2. `JHBaseAI.addStoryDrop` 선행·후행 난수 호출 확인
3. 만호강 30681 및 산적 32950의 단독 전투 세이브로 호출 횟수 검증
4. 해당 분기를 고정한 뒤에야 장기 회차 예측 및 실제 첫 획득 회차 산출

테스트: `node research/mask-drop/test-calibrate-level70.cjs` (인공 상태만 사용).

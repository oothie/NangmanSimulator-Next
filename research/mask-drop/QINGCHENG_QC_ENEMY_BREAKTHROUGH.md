# 60014 청성산 일반 전투: 확정 원본 편성

원본: `src/app/story/event/qc_enemy.lua`, Whale index 41, BKDR `0x07a074e2`, SBv3 SHA256 `219da77083766eda04962dfe804c990c36b0681c3da6ad070c7c85c75ae72984`.

1. 1번 적 `{32950 산적, 32951 대도, 32952 유적}[JHRandom(1,3)]`.
2. 2번 적 `{32951 대도, 32952 유적, 32953 탈영병}[JHRandom(1,3)]`.
3. 3번 적 `JHRandom(32951,32953)`; 두목 32954는 `GetP(3007)>=6` 시 `SeedRandom('rollenemy_qc',1,1000)-GetP('eat_2659')*10<=GetP('rollenemy_qc2')` 조건에 의해 대체될 수 있다.
4. 원본 전투 배열은 `enemy1..enemy5`를 참조하지만 4·5번 임시값은 본 스크립트에서 설정하지 않는다.

명시된 3개 슬롯에서는 32950 산적은 **첫 슬롯만**, 균등 추첨 가정으로 **전투당 1/3 확률**, **0 또는 1명**이다.

`src/app/core/JHExtern.lua` proto8 `JHRandom`은 `math.jhrandom`이 존재하면 이를, 아니면 `math.random`을 호출하며 초기화 proto79는 `math.randomseed(os.time())`을 사용한다. 실전 native RNG 내부 상태를 세이브에서 복구했는지는 아직 확인되지 않았다. 보상 난수 `aidrop70`과 별도이다. `rollenemy_qc`는 산적이 아닌 두목 분기용 named seed다.

연구 엔진은 `qingcheng-enemy-formation.cjs`(NPC 편성 원본 룰), `qingcheng-mask-planner.cjs`(실측 기반 aidrop70), `qingcheng-mask-cli.cjs`로 연결. 현재 4서버 최신 세이브의 1% 첫 당첨 후보는 만호강 전 **산적 등 70급 드랍 113회 소비** 후 만호강 1회. 산적 113명을 얻기 위한 청성산 사냥 추정 **평균 339회, 중앙값 338회, 90% 범위 298~383회** (독립균등 가정). 정확한 미래 사냥 회차/실제 아이템 지급은 미검증.

공개 사이트/버전 변경 없음. 개인 세이브와 원시 난수 GitHub 미포함.

# 60014 JHConfig original alias proof

Original SB3: JHConfig_1.sb3 SHA256 52a94fa94f3ee0f28911610c352c8ee3db76f7eaec0c47127459b4e8197dadb8, 21 prototypes, parent proto20.

Bytecode PC865-870 copies `math.randomseed` to `math.jhrandomseed`. PC871-876 copies `math.random` to `math.jhrandom`. PC877-884 installs new `math.randomseed` and `math.random` closures. Their recovered child prototypes 18 and 19 use `jh.JHCommonUtils.setWhaleSeed` and `jh.JHCommonUtils.getWhaleRand`, respectively. PC885-900 seeds both PRNGs with separate `os.time()` calls.

Original JHExtern_15.sb3 proto8 calls `math.jhrandom` if present; else `math.random`. Original qc_enemy.lua uses JHRandom(1,3) for its first enemy position with choices 32950/32951/32952. Therefore, after JHConfig installation, the Qingcheng enemy formation uses the pre-override Lua math RNG (the jhrandom alias), not the overridden Whale math.random or named `aidrop70` directly.

Original native library's missing literal jhrandom string is explained by Lua creating the alias. Actual native RNG state serialization and intervening call history remain unverified. Thus the code provides 1/3 bandit chance (assuming uniform native math.random), not a guaranteed future encounter schedule.

No personal save, account information or actual seed values contained here.

#!/usr/bin/env python3
"""Released-gate special award vs material weighted-pool state comparison.
Uses source-extracted JSON and a save locally; never infers a complete unclaimed save.
Unclaimed scenario affects payout and material weights, not an independently verified
true historical reward state or direct player ownership in inventory.
"""
from __future__ import annotations
import argparse,json
from pathlib import Path
from special_award_consumer import whatif
from material_weight_counterfactual import audit as material_audit,summary as material_summary
GATES=('연왕부','창옥','벽유교','유씨별원')

def compare(save,award_db,material_db):
 payout=whatif(award_db,save)
 weights=material_audit(material_db,save)
 bygate={}
 for gate in GATES:
  awards=[r for r in payout if r['gate']==gate]
  weights_gate=[r for r in weights if r['gate']==gate]
  mat=material_summary(weights)[gate]
  bygate[gate]={
   'awardConditions':len(awards),
   'awardCountLimitCurrentlyBlockedIfRollSucceeds':sum(r['claimCountCurrentEligible'] is False for r in awards),
   'unclaimedCountCouldChangePayout':sum(r['doesChangingClaimCountAffectConsumer'] for r in awards),
   'unknownTempScope':sum(r['claimCountCurrentEligible'] is None for r in awards),
   'materialWeightEntries':len(weights_gate),
   'materialWeightCurrent':mat['actualDynamicSum'],
   'materialWeightUnclaimedSameInitialization':mat['zeroCountSameInitializationSum'],
   'materialWeightUnclaimedFreshInitialization':mat['freshUnclaimedSum'],
   'changedWeightsOnCountOnlyReset':mat['changedCountOnly'],
   'changedWeightsOnFreshInitialization':mat['changedFresh'],
  }
 return {
  'status':'source-grounded counterfactual / NOT an observed unclaimed player',
  'scope':list(GATES),
  'assumptions':{
   'counterfactual':'reset only get_* payout counters and num_* material counters',
   'freshInitialization':'add BYJ first_rdward=0 reinitialization; other state held constant',
   'payout':'only indicates eligibility IF original special-roll flag is true',
   'temporaryScope':'unresolved properties such as get_8801 temp are not equated to global counters',
   'sourceLimits':'does not replay consumer rollback/re-entry or stage-specific inventory additions',
   'numericGuard':'GetP(8915) is separate from get_8915; do not infer or reset it',
   'otherState':'win counters, branches and actual item ownership unchanged; not a true fresh-account simulation',
   'noPredictedDrops':'condition tables and reward guards only; no novel RNG sampled in this comparison'
  },
  'gates':bygate,
  'totals':{
   'payoutRules':len(payout),'materialEntries':len(weights),
   'payoutBlockCount':sum(g['awardCountLimitCurrentlyBlockedIfRollSucceeds'] for g in bygate.values()),
   'changedMaterialCountOnly':sum(g['changedWeightsOnCountOnlyReset'] for g in bygate.values()),
   'changedMaterialFresh':sum(g['changedWeightsOnFreshInitialization'] for g in bygate.values())}}

def main():
 p=argparse.ArgumentParser()
 p.add_argument('--save',type=Path,required=True)
 p.add_argument('--award-registry',type=Path,required=True)
 p.add_argument('--material-registry',type=Path,required=True)
 p.add_argument('--output',type=Path,help='Local JSON report. Do not post saved player values publicly.')
 args=p.parse_args()
 output=compare(json.loads(args.save.read_text()),json.loads(args.award_registry.read_text()),json.loads(args.material_registry.read_text()))
 payload=json.dumps(output,ensure_ascii=False,indent=2)+'\n'
 if args.output:args.output.write_text(payload)
 else:print(payload)
if __name__=='__main__':main()
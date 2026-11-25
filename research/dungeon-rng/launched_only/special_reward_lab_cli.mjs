#!/usr/bin/env node
/* Offline original producer + original consumer experiment. Research only.
 * Reads a local save file; never embeds, uploads or writes its contents.
 * Does not modify any website, production engine or version.
 */
import {readFileSync} from 'node:fs';
import {replayYanwangfu} from './replay_original_yan.mjs';
import {replayChangok} from './replay_original_dcy.mjs';
import {replayByeokyu} from './replay_original_byj.mjs';
import {replayLiuManor} from './replay_original_liu.mjs';
import {forecastInterleavedSpecials} from './special_reward_source_engine.mjs';

const producer={'연왕부':replayYanwangfu,'창옥':replayChangok,
 '벽유교':replayByeokyu,'유씨별원':replayLiuManor};
function option(args,key,fallback){
 const index=args.indexOf(key);return index>=0?args[index+1]:fallback;
}
function main(args){
 const saveFile=option(args,'--save',null);
 const gate=option(args,'--gate','창옥');
 const clears=Number(option(args,'--clears','10'));
 const mode=option(args,'--mode','current');
 const keyMode=option(args,'--key-mode',null);
 const firstItemText=option(args,'--first-item',null);
 const firstItemId=firstItemText==null?null:Number(firstItemText);
 if(!saveFile)throw Error('--save 로 로컬 세이브 경로를 지정하세요.');
 if(!producer[gate])throw Error('출시된 4관문만 지원합니다.');
 if(!Number.isInteger(clears)||clears<1||clears>2000)
  throw Error('원본 관문 재생 범위: 1~2000회');
 const save=JSON.parse(readFileSync(saveFile,'utf8'));
 const result=forecastInterleavedSpecials(save,gate,producer[gate],clears,{mode,keyMode,firstItemId});
 console.log('관문:',gate,'· 시나리오:',mode,'· 탐색 범위:',clears+'회');
 for(let i=0;i<result.rows.length;i++){
  const clear=result.rows[i].producer,grants=result.rows[i].grants;
  console.log(clear.clear+'회차');
  for(const row of clear.results){
   const relevant=grants.filter(event=>event.name&&event.predicted&&
     (event.npc===({연왕부:{이총관:33654,하상:33653,엽내관:33652,연왕:33650},
      창옥:{무준신:40372,이장:40373,장정:40374},
      벽유교:{독선생:35219,미:35214,불로선인:35221},
      유씨별원:{윤무:35260,고리:35264,이뢰운:35268}}[gate]?.[row.boss])));
   console.log(' ',row.boss,'·',row.name||'미드랍',row.grade||'',
    '· 특수:',relevant.length?relevant.map(x=>x.name+'×'+x.quantity).join(', '):'—');
  }
 }
 console.log('실제 재생 횟수:',result.searchedClears+'회');
 console.log('예상 최초 획득 회차:');
 for(const event of result.firstPredicted)
  console.log(' ',event.name+' · '+event.clear+'회차');
 if(!result.firstPredicted.length)console.log(' 범위 내 없음');
 if(result.unresolved)console.log('미해결 임시 변수 범위:',result.unresolved+'건');
 if(result.questHistoryAssumedUnchanged)
  console.log('주의: 임무 해금 상태는 세이브 당시 상태로 유지한 가상 지급 시나리오입니다.');
}
try{main(process.argv.slice(2))}catch(e){console.error('예측 중단:',e.message);process.exitCode=1}

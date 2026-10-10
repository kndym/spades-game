import fs from 'node:fs';
import {createGame,applyBid,playCard,nextHand,publicObservation} from '../../spades-web/engine.js';
import {learnedBid,heuristicPlay} from '../../spades-web/ai.js';
import {valueBidFeatures,valueBidOptions} from '../../spades-web/value-bid.js';
const arg=(k,v)=>{let i=process.argv.indexOf(k);return i<0?v:Number(process.argv[i+1])};
const hands=arg('--hands',6000),seed=arg('--seed',81200000),rows=[];
let s=createGame({seed}),done=0;
const started=performance.now();
while(done<hands) {
  if(s.phase==='gameOver'){done++;if(done%1000===0)console.log(`Generated ${done}/${hands} hands`);if(done<hands)s=createGame({seed:seed+done});continue;}
  if(s.phase==='handEnd'){done++;if(done%1000===0)console.log(`Generated ${done}/${hands} hands`); if(done<hands)nextHand(s);continue;}
  if(s.phase==='playing'){playCard(s,heuristicPlay(publicObservation(s)));continue;}
  const o=publicObservation(s),team=o.player%2,outcomes=[];
  for(const bid of valueBidOptions(o)) {
    const c=structuredClone(s);applyBid(c,bid);
    while(c.phase==='bidding')applyBid(c,learnedBid(publicObservation(c)));
    while(c.phase==='playing')playCard(c,heuristicPlay(publicObservation(c)));
    outcomes.push({bid,x:valueBidFeatures(o,bid),value:(c.lastHand.delta[team]-c.lastHand.delta[1-team])/100});
  }
  const baseline=outcomes.find(a=>a.bid===learnedBid(o)).value;
  for(const a of outcomes)rows.push({x:a.x,y:a.value-baseline});
  applyBid(s,learnedBid(o));
}
fs.writeFileSync(new URL('./value-data.json',import.meta.url),JSON.stringify({seed,hands,features:rows[0].x.length,rows,seconds:(performance.now()-started)/1000}));
console.log(JSON.stringify({hands,rows:rows.length,features:rows[0].x.length,seconds:(performance.now()-started)/1000}));

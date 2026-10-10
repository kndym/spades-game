import fs from 'node:fs';
import crypto from 'node:crypto';
import {createGame,applyBid,playCard,nextHand,publicObservation} from '../../spades-web/engine.js';
import {learnedBid,heuristicPlay} from '../../spades-web/ai.js';
import {valueBid} from '../../spades-web/value-bid.js';
const arg=(k,v)=>{let i=process.argv.indexOf(k);return i<0?v:Number(process.argv[i+1])};
const modelPath=new URL('../../spades-web/value-bid-model.json',import.meta.url),model=JSON.parse(fs.readFileSync(modelPath));
const modelSha256=crypto.createHash('sha256').update(fs.readFileSync(modelPath)).digest('hex');
const calibration=process.argv.includes('--calibrate'),pairs=arg('--pairs',calibration?300:1500),seed=arg('--seed',calibration?82200000:83200000);
function game(dealSeed,candidateTeam,penalty) {
  const s=createGame({seed:dealSeed}), decisions={changed:0,total:0};
  while(s.phase!=='gameOver'&&s.handNumber<=150){
    if(s.phase==='handEnd'){nextHand(s);continue;}
    const o=publicObservation(s);
    if(s.phase==='bidding'){
      const base=learnedBid(o),candidate=o.player%2===candidateTeam,bid=candidate?valueBid(o,model,penalty):base;
      if(candidate){decisions.total++;decisions.changed+=Number(bid!==base);}
      applyBid(s,bid);
    } else playCard(s,heuristicPlay(o));
  }
  if(s.phase!=='gameOver') throw new Error('Censored match: refusing calibration or publication');
  return {won:s.winner===candidateTeam?1:0,diff:s.scores[candidateTeam]-s.scores[1-candidateTeam],hands:s.handNumber,completed:true,...decisions};
}
function stats(a){let mean=a.reduce((x,y)=>x+y,0)/a.length,se=Math.sqrt(a.reduce((x,y)=>x+(y-mean)**2,0)/(a.length-1)/a.length);return{mean,confidence95:[mean-1.96*se,mean+1.96*se]};}
function run(penalty){const wins=[],diffs=[];let changed=0,total=0,incomplete=0,maxHands=0;const started=performance.now();for(let i=0;i<pairs;i++){
  const a=game(seed+i,0,penalty),b=game(seed+i,1,penalty);wins.push((a.won+b.won)/2);diffs.push((a.diff+b.diff)/2);changed+=a.changed+b.changed;total+=a.total+b.total;incomplete+=Number(!a.completed)+Number(!b.completed);maxHands=Math.max(maxHands,a.hands,b.hands);
}return{seed,pairs,games:pairs*2,unit:'500-point matches',penalty,modelSha256,winRate:stats(wins),scoreDifference:stats(diffs),changedBids:changed,totalCandidateBids:total,changeRate:changed/total,incompleteMatches:incomplete,maximumHandsPlayed:maxHands,elapsedSeconds:(performance.now()-started)/1000,pairedSeatSwap:true,baseline:'Frozen learned bidder; identical heuristic card play',trainingSeedDisjoint:true};}
if(calibration){const results=[];for(const penalty of [0,.025,.05,.1,.2,.4]){const r=run(penalty);results.push(r);console.log(JSON.stringify(r));}results.sort((a,b)=>b.winRate.mean-a.winRate.mean||b.scoreDifference.mean-a.scoreDifference.mean);model.penalty=results[0].penalty;fs.writeFileSync(modelPath,JSON.stringify(model));fs.writeFileSync(new URL('./value-calibration.json',import.meta.url),JSON.stringify({selection:'highest calibration full-match winrate then scoremargin',selectedPenalty:model.penalty,results},null,2));}
else {const r=run(model.penalty);fs.writeFileSync(new URL('./value-evaluation.json',import.meta.url),JSON.stringify(r,null,2));console.log(JSON.stringify(r,null,2));}

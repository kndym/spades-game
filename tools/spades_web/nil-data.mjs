import fs from 'node:fs';
import {createGame,applyBid,playCard,nextHand,publicObservation,seededRandom,shuffle} from '../../spades-web/engine.js';
import {learnedBid,heuristicPlay} from '../../spades-web/ai.js';
import {nilBidFeatures} from '../../spades-web/nil-bid.js';
const arg=(k,v)=>{let i=process.argv.indexOf(k);return i<0?v:Number(process.argv[i+1])};
const hands=arg('--hands',4000),worlds=arg('--worlds',8),proposals=arg('--proposals',32),seed=arg('--seed',86200000),rows=[];
let s=createGame({seed}),done=0,essTotal=0,contextCount=0;const started=performance.now();
function hiddenWorlds(state,o,rng){const unseen=Array.from({length:52},(_,c)=>c).filter(c=>!o.hand.includes(c)),others=[0,1,2,3].filter(q=>q!==o.player),pool=[];
  for(let i=0;i<proposals;i++){const deck=shuffle([...unseen],rng),hs=Array.from({length:4},()=>[]);hs[o.player]=[...o.hand];others.forEach((q,k)=>hs[q]=deck.slice(k*13,(k+1)*13).sort((a,b)=>a-b));let logWeight=0;
    for(const q of others)if(o.bids[q]!==null){const guess=learnedBid({...o,player:q,hand:hs[q]});logWeight-=.5*((guess-o.bids[q])/.85)**2;}
    pool.push({hands:hs,logWeight});
  }
  const top=Math.max(...pool.map(w=>w.logWeight)),weights=pool.map(w=>Math.exp(w.logWeight-top)),total=weights.reduce((a,b)=>a+b,0);
  essTotal+=total*total/weights.reduce((a,b)=>a+b*b,0);contextCount++;
  const selected=[];for(let i=0;i<worlds;i++){let draw=rng()*total,j=0;while(draw>=weights[j])draw-=weights[j++];const c=structuredClone(state);c.hands=pool[j].hands.map(h=>[...h]);selected.push(c);}return selected;
}
function finish(state,bid,team,p){applyBid(state,bid);while(state.phase==='bidding')applyBid(state,learnedBid(publicObservation(state)));while(state.phase==='playing')playCard(state,heuristicPlay(publicObservation(state)));return{value:(state.lastHand.delta[team]-state.lastHand.delta[1-team])/100,success:state.tricks[p]===0?1:0};}
while(done<hands){
  if(s.phase==='gameOver'||s.phase==='handEnd'){done++;if(done%500===0)console.log(`Generated ${done}/${hands} hands`);if(done<hands){if(s.phase==='gameOver')s=createGame({seed:seed+done});else nextHand(s);}continue;}
  if(s.phase==='playing'){playCard(s,heuristicPlay(publicObservation(s)));continue;}
  const o=publicObservation(s),normal=learnedBid(o),team=o.player%2;let advantage=0,success=0;
  const worldsHere=hiddenWorlds(s,o,seededRandom(seed+done*11+o.player));
  for(const w of worldsHere){const n=finish(structuredClone(w),normal,team,o.player),z=finish(w,0,team,o.player);advantage+=(z.value-n.value)/worlds;success+=z.success/worlds;}
  rows.push({x:nilBidFeatures(o),advantage,success});applyBid(s,normal);
}
const metadata={seed,hands,worlds,proposals,contexts:rows.length,features:rows[0].x.length,meanEffectiveProposalCount:essTotal/contextCount,proposalFallbackCount:0,seconds:(performance.now()-started)/1000,conditioning:'Soft Gaussian likelihood of observed normal bids under frozen learned bidder, sigma0.85; approximate model, not calibrated human posterior. No rejection sampler; finite proposals always weighted. Candidate disables nil when any prior nil was observed, an unsupported training context.',target:'Actual nil-minus-normal hand score differential with accumulated bags',rows};
fs.writeFileSync(new URL('./nil-data.json',import.meta.url),JSON.stringify(metadata));console.log(JSON.stringify({...metadata,rows:undefined}));

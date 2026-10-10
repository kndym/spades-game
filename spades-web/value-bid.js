// Experimental normal-bid value policy. Not wired into the deployed game.
import { bidFeatures, learnedBid } from './ai.js';
export function valueBidFeatures(o, bid) {
  const p=o.player, team=p%2, base=learnedBid(o);
  const relative=[1,2,3].map(d=>(p+d)%4);
  return [...bidFeatures(o), ...Array.from({length:52},(_,c)=>Number(o.hand.includes(c))),
    ...relative.flatMap(q=>[o.bids[q]===null?-1:o.bids[q]/13,Number(o.bids[q]!==null)]),
    o.scores[team]/500,o.scores[1-team]/500,o.bags[team]/10,o.bags[1-team]/10,
    o.target/500,((p-o.dealer+3)%4)/3,base/13,bid/13,(bid-base)/3,
    ...Array.from({length:5},(_,i)=>Number(bid-base===i-2))];
}
export function valueBidOptions(o) {
  const base=learnedBid(o);
  return [...new Set([-2,-1,0,1,2].map(d=>Math.max(1,Math.min(13,base+d))))];
}
function forward(x, model) {
  for(let i=0;i<model.layers.length;i++) {
    const {weight,bias}=model.layers[i];
    x=bias.map((b,j)=>{let y=b; for(let k=0;k<x.length;k++)y+=weight[j][k]*x[k]; return i===model.layers.length-1?y:Math.max(0,y)});
  }
  return x[0];
}
export function valueBid(o,model,penalty=model.penalty||0) {
  const base=learnedBid(o), actions=valueBidOptions(o);
  let best=base,bestQ=forward(valueBidFeatures(o,base),model);
  for(const bid of actions) {
    const q=forward(valueBidFeatures(o,bid),model)-penalty*Math.abs(bid-base);
    if(q>bestQ+1e-10){bestQ=q;best=bid;}
  }
  return best;
}

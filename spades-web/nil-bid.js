// Research candidate only; not connected to the shipped AI.
import {bidFeatures,learnedBid} from './ai.js';
export function nilBidFeatures(o){const p=o.player,team=p%2,relative=[1,2,3].map(d=>(p+d)%4);
  return [...bidFeatures(o),...Array.from({length:52},(_,c)=>Number(o.hand.includes(c))),
    ...relative.flatMap(q=>[o.bids[q]===null?-1:o.bids[q]/13,Number(o.bids[q]!==null)]),
    o.scores[team]/500,o.scores[1-team]/500,o.bags[team]/10,o.bags[1-team]/10,o.target/500,((p-o.dealer+3)%4)/3,learnedBid(o)/13,
    ...[0,1,2,3].flatMap(s=>{const ranks=o.hand.filter(c=>Math.floor(c/13)===s).map(c=>c%13+2);return[ranks.length?Math.min(...ranks)/14:0,ranks.length?Math.max(...ranks)/14:0,ranks.filter(r=>r<=6).length/13,ranks.filter(r=>r>=11).length/13]})];
}
export function nilPrediction(o,model){let x=nilBidFeatures(o);for(let i=0;i<model.layers.length;i++){const {weight,bias}=model.layers[i];x=bias.map((b,j)=>{let z=b;for(let k=0;k<x.length;k++)z+=weight[j][k]*x[k];return i===model.layers.length-1?z:Math.max(0,z)});}return{advantage:x[0]*100,successProbability:1/(1+Math.exp(-x[1]))};}
export function nilBid(o,model,threshold=model.threshold||0){const normal=learnedBid(o);if(o.hand.includes(51)||o.bids.some(b=>b===0))return normal;return nilPrediction(o,model).advantage>threshold?0:normal;}

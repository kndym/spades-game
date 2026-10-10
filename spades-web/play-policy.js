// Experimental public-observation action ranker, kept separate from deployed AI.
import {legalCards,trickWinner} from './engine.js';
export function playOptions(o){return legalCards({phase:o.phase,hands:Array.from({length:4},(_,p)=>p===o.player?o.hand:[]),currentPlayer:o.player,currentTrick:o.currentTrick,spadesBroken:o.spadesBroken});}
export function playFeatures(o,card){const p=o.player,team=p%2,partner=(p+2)%4,legal=playOptions(o),seen=new Set([...o.currentTrick.map(x=>x.card),...o.completedTricks.flatMap(t=>t.cards.map(x=>x.card))]),hand=new Set(o.hand),relative=[0,1,2,3].map(d=>(p+d)%4),suit=Math.floor(card/13),rank=card%13+2,win=o.currentTrick.length?trickWinner([...o.currentTrick,{player:p,card}])===p:false,current=o.currentTrick.length?trickWinner(o.currentTrick):null;
  const counts=[0,1,2,3].map(s=>o.hand.filter(c=>Math.floor(c/13)===s).length),higher=Array.from({length:14-rank},(_,i)=>suit*13+rank-1+i),cost=c=>c%13+2+(c>=39?18:0),wins=legal.filter(c=>o.currentTrick.length&&trickWinner([...o.currentTrick,{player:p,card:c}])===p),highLeft=higher.filter(c=>!seen.has(c)&&!hand.has(c)).length;
  const bid=t=>o.bids[t]+o.bids[t+2],tricks=t=>(o.bids[t]===0?0:o.tricks[t])+(o.bids[t+2]===0?0:o.tricks[t+2]);
  return [...Array.from({length:52},(_,c)=>Number(hand.has(c))),...Array.from({length:52},(_,c)=>Number(seen.has(c))),
    ...relative.flatMap(q=>o.voids[q].map(Number)),...relative.map(q=>o.bids[q]/13),...relative.map(q=>o.tricks[q]/13),
    o.scores[team]/500,o.scores[1-team]/500,o.bags[team]/10,o.bags[1-team]/10,o.target/500,Number(o.spadesBroken),o.currentTrick.length/3,o.completedTricks.length/13,
    ...relative.flatMap(q=>{const c=o.currentTrick.find(x=>x.player===q)?.card;return c===undefined?[0,0,0,0,0]:[(c%13+2)/14,...[0,1,2,3].map(s=>Number(Math.floor(c/13)===s))]}),
    ...counts.map(n=>n/13),(bid(team)-tricks(team))/13,(bid(1-team)-tricks(1-team))/13,
    rank/14,...[0,1,2,3].map(s=>Number(s===suit)),Number(win),Number(current===partner),Number(current!==null&&current%2!==team),Number(o.bids[p]===0&&o.tricks[p]===0),Number(o.bids[partner]===0&&o.tricks[partner]===0),Number(!o.currentTrick.length),Number(highLeft===0),highLeft/13,higher.filter(c=>hand.has(c)).length/13,counts[suit]/13,
    Number(card===legal.reduce((a,b)=>cost(a)<=cost(b)?a:b)),Number(card===legal.reduce((a,b)=>cost(a)>=cost(b)?a:b)),Number(wins.length&&card===wins.reduce((a,b)=>cost(a)<=cost(b)?a:b)),cost(card)/32,
    Number(o.currentTrick.length&&suit===Math.floor(o.currentTrick[0].card/13)),legal.length/13];
}
function score(x,model){for(let i=0;i<model.layers.length;i++){const{weight,bias}=model.layers[i];x=bias.map((b,j)=>{let y=b;for(let k=0;k<x.length;k++)y+=weight[j][k]*x[k];return i===model.layers.length-1?y:Math.max(0,y)});}return x[0];}
export function policyPlay(o,model){const legal=playOptions(o);if(legal.length===1)return legal[0];let best=legal[0],bestScore=-Infinity;for(const c of legal){const q=score(playFeatures(o,c),model);if(q>bestScore){bestScore=q;best=c;}}return best;}

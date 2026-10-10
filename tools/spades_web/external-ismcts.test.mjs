import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import readline from 'node:readline';
import {fileURLToPath} from 'node:url';
import {createGame,publicObservation,legalCards,applyBid,playCard,seededRandom} from '../../spades-web/engine.js';
test('Adapted ISMCTS state exactly matches engine scoring including nil, failed nil bags, and bag rollover',async()=>{
 const runner=spawn('python',['-B','-u',fileURLToPath(new URL('./external-ismcts.py',import.meta.url)),'128']);
 const lines=readline.createInterface({input:runner.stdout}),iterator=lines[Symbol.asyncIterator]();
 try{
  for(let i=0;i<100;i++){
   const s=createGame({seed:91000000+i,target:500}),rng=seededRandom(i+7230);s.bags=[i%10,(i+3)%10];s.scores=[120+s.bags[0],-30+s.bags[1]];
   while(s.phase==='bidding')applyBid(s,Math.floor(rng()*7));
   while(!(s.completedTricks.length===12&&s.currentTrick.length===3)){const legal=legalCards(s);playCard(s,legal[Math.floor(rng()*legal.length)]);}
   const o=publicObservation(s);runner.stdin.write(JSON.stringify({scoreProbe:o})+'\n');const {value,done}=await iterator.next();assert.equal(done,false);const r=JSON.parse(value);assert.equal(r.error,undefined,r.error);
   playCard(s,legalCards(s)[0]);assert.deepEqual(r,{delta:s.lastHand.delta,bags:s.bags,scores:s.scores});
  }
 }finally{runner.stdin.end();lines.close();runner.kill();}
});

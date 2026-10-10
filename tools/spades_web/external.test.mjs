import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import readline from 'node:readline';
import {fileURLToPath} from 'node:url';
import {createGame,publicObservation,legalCards,applyBid,playCard} from '../../spades-web/engine.js';

test('Real Trickster adapter: metadata, upstream tactical fixture, complete legal public-information hand',async()=>{
 const runner=spawn('dotnet',[fileURLToPath(new URL('./external-runner/bin/Release/net10.0/ExternalRunner.dll',import.meta.url))]);
 const lines=readline.createInterface({input:runner.stdout}),iterator=lines[Symbol.asyncIterator]();
 async function ask(o){runner.stdin.write(JSON.stringify(o)+'\n'); const {value,done}=await iterator.next(); assert.equal(done,false);const r=JSON.parse(value);assert.equal(r.error,undefined,r.error);return r;}
 try{
  const meta=await ask({meta:true});assert.equal(meta.deckSize,52);assert.equal(meta.scoreRoundTrip.totalPoints,123);assert.equal(meta.scoreRoundTrip.bags,3);assert.equal(meta.nilEncoded,0);assert.deepEqual(meta.historyProbe,{cardPlayed:'3H',highInTrick:'TH'});assert.deepEqual(meta.playedCardConstructorParameters,['trickHigh','myPlay']);
  // Exact TestSpadesBot.PlayHighFrom3rdSeat fixture: TH9H with QH7H -> QH.
  const fixture={phase:'playing',player:0,currentPlayer:0,dealer:3,target:500,handNumber:1,hand:[36,31],handSizes:[2,2,2,2],bids:[1,5,1,5],tricks:[0,0,0,0],scores:[0,0],bags:[0,0],currentTrick:[{player:2,card:34},{player:3,card:33}],completedTricks:[],voids:Array.from({length:4},()=>[false,false,false,false]),spadesBroken:false,legal:[36,31]};
  assert.equal((await ask(fixture)).card,36);
  // Public nil-partner inference regression. The old adapter reversed
  // PlayedCard(trickHigh,myPlay), erasing evidence that partner's 3H was protected.
  const nilHistory={phase:'playing',player:0,currentPlayer:0,dealer:3,target:500,handNumber:1,hand:[30,28,11,5,4,3,2,1,0,24,50],handSizes:[11,11,11,11],bids:[4,4,0,4],tricks:[2,0,0,0],scores:[0,0],bags:[0,0],currentTrick:[],completedTricks:[{winner:0,cards:[38,37,36,35].map((card,player)=>({player,card}))},{winner:0,cards:[34,32,27,31].map((card,player)=>({player,card}))}],voids:Array.from({length:4},()=>[false,false,false,false]),spadesBroken:false,legal:[30,28,11,5,4,3,2,1,0,24]};
  assert.equal((await ask(nilHistory)).card,28,'Correct history should lead 4H to protect the nil partner');
  const s=createGame({seed:80030000,target:500});let moves=0;
  while(s.phase==='bidding'||s.phase==='playing'){
   const o=publicObservation(s);assert.equal(Object.hasOwn(o,'hands'),false);assert.equal(Object.hasOwn(o,'seed'),false);
   const r=await ask({...o,legal:legalCards(s)});
   if(s.phase==='bidding'){assert.ok(Number.isInteger(r.bid)&&r.bid>=0&&r.bid<=13);applyBid(s,r.bid)}
   else{assert.ok(legalCards(s).includes(r.card));playCard(s,r.card);moves++;}
  }
  assert.equal(moves,52);assert.equal(s.completedTricks.length,13);
 }finally{runner.stdin.end();lines.close();runner.kill();}
});

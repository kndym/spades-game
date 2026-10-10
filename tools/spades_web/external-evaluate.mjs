import fs from 'node:fs';
import {spawn,execFileSync} from 'node:child_process';
import readline from 'node:readline';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createGame,applyBid,playCard,nextHand,publicObservation,legalCards} from '../../spades-web/engine.js';
import {learnedBid,heuristicPlay,searchPlay} from '../../spades-web/ai.js';
const base=path.dirname(fileURLToPath(import.meta.url));
const arg=(n,d)=>{const i=process.argv.indexOf(n);return i<0?d:process.argv[i+1]};
const pairs=Number(arg('--pairs',500)),seed=Number(arg('--seed',81000000)),difficulty=arg('--difficulty','standard'),candidatePolicy=arg('--candidate','incumbent'),output=arg('--out',path.join(base,`external-${difficulty}.json`));
if(!['incumbent','trickster-bid','trickster-play','value','nil','play'].includes(candidatePolicy))throw new Error('Unknown candidate');
let valueBid,valueModel,nilBid,nilModel,policyPlay,playModel;
if(candidatePolicy==='value'){({valueBid}=await import('../../spades-web/value-bid.js'));valueModel=JSON.parse(fs.readFileSync(path.join(base,'../../spades-web/value-bid-model.json')));}
if(candidatePolicy==='nil'){({nilBid}=await import('../../spades-web/nil-bid.js'));nilModel=JSON.parse(fs.readFileSync(path.join(base,'../../spades-web/nil-bid-model.json')));}
if(candidatePolicy==='play'){({policyPlay}=await import('../../spades-web/play-policy.js'));playModel=JSON.parse(fs.readFileSync(path.join(base,'../../spades-web/play-policy-model.json')));}
const candidateSourceHashes=Object.fromEntries(['ai.js','bid-model.js',...(candidatePolicy==='value'?['value-bid.js','value-bid-model.json']:[]),...(candidatePolicy==='nil'?['nil-bid.js','nil-bid-model.json']:[]),...(candidatePolicy==='play'?['play-policy.js','play-policy-model.json']:[])].map(f=>[f,createHash('sha256').update(fs.readFileSync(path.join(base,'../../spades-web',f))).digest('hex')]));
const baselinePolicy=arg('--baseline','trickster');
if(!['trickster','ismcts'].includes(baselinePolicy))throw new Error('Unknown baseline');
if(baselinePolicy!=='trickster'&&candidatePolicy.startsWith('trickster-'))throw new Error('Trickster ablations require Trickster baseline');
const runner=baselinePolicy==='ismcts'?spawn('python',['-B','-u',path.join(base,'external-ismcts.py'),arg('--iterations','128')],{stdio:['pipe','pipe','inherit']}):spawn('dotnet',[path.join(base,'external-runner/bin/Release/net10.0/ExternalRunner.dll')],{stdio:['pipe','pipe','inherit']});
const pending=[]; let errors=0,invalid=0,decisions=0,opponentDecisions=0,externalMs=0,candidateMs=0,candidateMoves=0;
const opponentLatencies=[],candidateLatencies=[];
readline.createInterface({input:runner.stdout}).on('line',line=>{const job=pending.shift(); if(!job)throw new Error('Unsolicited runner output'); try{const result=JSON.parse(line);if(result.error){errors++;job.reject(new Error(result.error));}else job.resolve(result);}catch(e){job.reject(e)}});
runner.on('exit',code=>{for(const job of pending.splice(0))job.reject(new Error(`External runner exited ${code}`))});
function request(o){return new Promise((resolve,reject)=>{pending.push({resolve,reject});runner.stdin.write(JSON.stringify(o)+'\n')})}
async function game(dealSeed,candidateTeam){
 const s=createGame({seed:dealSeed,target:500}); let nilBids=0,opponentNilBids=0,candidateNilBids=0;
 while(s.phase!=='gameOver'&&s.handNumber<=150){
  if(s.phase==='handEnd'){nextHand(s);continue;}
  const o=publicObservation(s),candidate=o.player%2===candidateTeam; let move;
  if(candidate){const start=performance.now();
   if((s.phase==='bidding'&&candidatePolicy==='trickster-bid')||(s.phase==='playing'&&candidatePolicy==='trickster-play')) {const r=await request({...o,legal:legalCards(s)});decisions++;move=s.phase==='bidding'?r.bid:r.card;}
   else move=s.phase==='bidding'?(candidatePolicy==='value'?valueBid(o,valueModel):candidatePolicy==='nil'?nilBid(o,nilModel):learnedBid(o)):candidatePolicy==='play'?policyPlay(o,playModel):difficulty==='expert'?searchPlay(o):heuristicPlay(o);
   const ms=performance.now()-start;candidateMs+=ms;candidateLatencies.push(ms);candidateMoves++;}
  else {const start=performance.now();const r=await request({...o,legal:legalCards(s)});const ms=performance.now()-start;externalMs+=ms;opponentLatencies.push(ms);decisions++;opponentDecisions++;move=s.phase==='bidding'?r.bid:r.card;}
  if(s.phase==='bidding'){if(!Number.isInteger(move)||move<0||move>13){invalid++;throw new Error(`Illegal bid ${move}`)}if(move===0){nilBids++;if(candidate)candidateNilBids++;else opponentNilBids++;}applyBid(s,move);}
  else {if(!legalCards(s).includes(move)){invalid++;throw new Error(`Illegal card ${move}`)}playCard(s,move);}
 }
 if(s.phase!=='gameOver')throw new Error('Censored match: refusing to publish a win rate');
 return {win:s.winner===candidateTeam?1:0,diff:s.scores[candidateTeam]-s.scores[1-candidateTeam],hands:s.handNumber,nilBids,opponentNilBids,candidateNilBids};
}
function stats(x){const mean=x.reduce((a,b)=>a+b,0)/x.length,sd=Math.sqrt(x.reduce((a,b)=>a+(b-mean)**2,0)/Math.max(1,x.length-1));return {mean,confidence95:[mean-1.96*sd/Math.sqrt(x.length),mean+1.96*sd/Math.sqrt(x.length)]};}
const started=performance.now(),raw=[];
try{
 const meta=await request({meta:true}); if(meta.deckSize!==52||meta.scoreRoundTrip.totalPoints!==123||meta.variation!=='None'||(baselinePolicy==='trickster'&&(meta.historyProbe.cardPlayed!=='3H'||meta.historyProbe.highInTrick!=='TH')))throw new Error(`Rule metadata mismatch: ${JSON.stringify(meta)}`);
 for(let i=0;i<pairs;i++){const a=await game(seed+i,0),b=await game(seed+i,1);raw.push({seed:seed+i,a,b});if((i+1)%25===0)console.log(`${difficulty}: ${i+1}/${pairs} pairs, ${(performance.now()-started)/1000|0}s`);}
 const result={version:1,date:new Date().toISOString(),candidate:difficulty==='expert'?'Learned bidding plus public-information search (12 determinizations)':'Learned bidding plus heuristic play',baseline:'Actual TricksterCards/TricksterBots SpadesBot',baselineSource:'https://github.com/TricksterCards/TricksterBots',baselineCommit:execFileSync('git',['-C',path.join(base,'external-vendor/TricksterBots'),'rev-parse','HEAD'],{encoding:'utf8'}).trim(),baselineSubmoduleCommit:execFileSync('git',['-C',path.join(base,'external-vendor/TricksterBots/Bridgit'),'rev-parse','HEAD'],{encoding:'utf8'}).trim(),adapter:'Persistent .NET JSONL; own hand and public history only; no fallback',rules:{deck:52,players:4,partners:'Opposite seats',target:500,nil:100,failedNil:'Tricks do not help partner contract, count as bags',bags:'Overtrick +1; ten bags -100',spadesLead:'Once broken or only spades remaining',specialBonuses:false,blindNil:false},pairs,games:pairs*2,seed,unit:'Full 500-point matches',pairedSeatSwap:true,winRate:stats(raw.map(r=>(r.a.win+r.b.win)/2)),scoreAdvantage:stats(raw.map(r=>(r.a.diff+r.b.diff)/2)),completedMatches:raw.length*2,censoredMatches:0,errors,invalidDecisions:invalid,fallbackDecisions:0,externalDecisions:decisions,externalDecisionMeanMs:externalMs/decisions,candidateDecisionMeanMs:candidateMs/candidateMoves,externalNilBids:raw.reduce((n,r)=>n+r.a.nilBids+r.b.nilBids,0),maximumHands:Math.max(...raw.flatMap(r=>[r.a.hands,r.b.hands])),seconds:(performance.now()-started)/1000,metadata:meta,limits:['Released Trickster bot is a credible production-derived baseline, not a verified world champion.','Same engine and rules for both teams. A model-selection suite must use different seeds from this holdout.']};
 const latency=x=>{x.sort((a,b)=>a-b);return {medianMs:x[Math.floor(x.length*.5)],p95Ms:x[Math.floor(x.length*.95)],unit:'All bid/card decisions; subprocess timings include JSON IPC'};};
 Object.assign(result,{adapterVersion:2,adapterSourceSha256:createHash('sha256').update(fs.readFileSync(path.join(base,baselinePolicy==='trickster'?'external-runner/Program.cs':'external-ismcts.py'))).digest('hex'),candidatePolicy,candidateSourceHashes,externalDecisionMeanMs:externalMs/opponentDecisions,opponentDecisions,tricksterDecisions:decisions,externalNilBids:raw.reduce((n,r)=>n+r.a.opponentNilBids+r.b.opponentNilBids,0),candidateNilBids:raw.reduce((n,r)=>n+r.a.candidateNilBids+r.b.candidateNilBids,0),totalNilBids:raw.reduce((n,r)=>n+r.a.nilBids+r.b.nilBids,0),opponentLatency:latency(opponentLatencies),candidateLatency:latency(candidateLatencies)});
 if(candidatePolicy==='trickster-bid')result.candidate='Actual Trickster bidding plus our heuristic card play (playing ablation)';
 if(candidatePolicy==='trickster-play')result.candidate='Our learned bidding plus actual Trickster card play (bidding ablation)';
 if(candidatePolicy==='value')result.candidate='Experimental action-value bidding plus our heuristic card play';
 if(candidatePolicy==='nil')result.candidate=difficulty==='expert'?'Learned nil-utility bidding plus public-information search (12 determinizations)':'Learned nil-utility bidding plus our heuristic card play';
 if(candidatePolicy==='play')result.candidate='Learned normal bidding plus public-information Trickster-imitation card ranker';
 if(baselinePolicy==='ismcts')Object.assign(result,{baseline:'Released ISMCTS tree algorithm with corrected public-information partnership state and upstream bidder',baselineSource:'https://github.com/jdfreden/Spades',baselineCommit:execFileSync('git',['-C',path.join(base,'external-vendor/ISMCTS-Spades'),'rev-parse','HEAD'],{encoding:'utf8'}).trim(),baselineSubmoduleCommit:null,adapter:'Python JSONL; published tree algorithm unchanged, state/rules adapted; no actual hidden hands or fallback',iterations:Number(arg('--iterations','128')),limits:['Research algorithm baseline at the stated search budget, not a verified strongest commercial bot.','Original state scores individual contracts and samples played cards; our replacement uses common partnership rules and public void constraints.','No published claim that this work-in-progress engine is a championship opponent.']});
 fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n'); fs.writeFileSync(output.replace(/\.json$/,'.raw.json'),JSON.stringify(raw)+'\n');console.log(JSON.stringify(result,null,2));
}finally{runner.stdin.end();}

const report=document.getElementById('report');
const pct=x=>(100*x).toFixed(1)+'%';
const interval=x=>x.map(v=>v.toFixed(2)).join(' to ');
try {
 const r=await (await fetch('./ai-report.json')).json();
 report.replaceChildren();
 const add=(tag,text)=>{const e=document.createElement(tag);e.textContent=text;report.append(e);return e;};
 add('h2','Training');add('p',`${r.training.hands.toLocaleString()} self-play hands produced ${r.training.playerSamples.toLocaleString()} own-hand examples. A regularized regression learns expected tricks from ${r.training.featureCount} hand features. Its bid adjustment was selected on ${r.training.calibrationPairedHands.toLocaleString()} separate paired calibration hands using actual partnership scores.`);
 for(const [name,e] of [['Bidding improvement',r.standardEvaluation],['Search improvement',r.expertAblation]]){
  add('h2',name);add('p',`${e.games.toLocaleString()} ${e.unit}, using ${e.pairs.toLocaleString()} paired seeds and seat swaps.`);
  add('p',`${pct(e.winRate.mean)} win rate`).className='metric';
  add('p',`Paired 95% interval: ${e.winRate.confidence95.map(pct).join(' to ')}. Mean score advantage: ${e.scoreDifference.mean.toFixed(2)} (95% interval ${interval(e.scoreDifference.confidence95)}).`);
  add('p',`Candidate: ${e.candidate}. Baseline: ${e.baseline}.`);
 }
 add('h2','Reproduce');add('pre',r.reproduce.join('\n'));add('small',`Report date: ${r.date}. CPU training and evaluation; no server inference required.`);
}catch{report.textContent='The report could not load. Download the JSON report below for the full results.';}

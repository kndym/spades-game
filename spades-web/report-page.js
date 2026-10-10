const report = document.getElementById('report');
const pct = x => (100 * x).toFixed(1) + '%';
const ci = x => x.map(pct).join('–');
const points = x => x.toFixed(2);
try {
 const response = await fetch('./ai-report.json');
 if (!response.ok) throw new Error('Report request failed');
 const r = await response.json();
 report.replaceChildren();
 const add = (tag,text,parent=report) => {const e=document.createElement(tag);e.textContent=text;parent.append(e);return e;};
 if (r.externalBenchmarks?.length) {
  add('h2','Against the released Trickster bot');
  add('p','Full 500-point partnership matches, identical scoring, matched deals and swapped teams. Every reported match completed with zero illegal moves, errors or fallback actions.');
  const table=add('table','');const row=add('tr','',add('thead','',table));
  for(const text of ['Policy','Matches','Win rate · 95% interval']) add('th',text,row);
  const body=add('tbody','',table);
  const names={standard:'Original Standard',expert:'Original search mode',play:'Teacher-trained card play','play-control':'Original Standard on same deals',nil:'Nil utility experiment', 'expert-nil':'Nil + search experiment', 'incumbent-nil-holdout':'Original Standard on nil deals', 'playing-ablation':'Trickster bidding + our play','bidding-ablation':'Our bidding + Trickster play'};
  for(const e of r.externalBenchmarks){const row=add('tr','',body);add('td',names[e.name]||e.candidate,row);add('td',e.games.toLocaleString(),row);add('td',`${pct(e.winRate.mean)} · ${ci(e.winRate.confidence95)}`,row);}
  add('small',`Source: TricksterCards/TricksterBots, revision ${r.externalBenchmarks[0].baselineCommit.slice(0,8)}. The public-history adapter is independently checked against upstream tactical fixtures.`);
 }
 if(r.cardPlayExperiment){const e=r.cardPlayExperiment,v=e.evaluation;
  add('h2','Learning card play from a public teacher');
  add('p','A compact action-ranking network learns the released Trickster bot’s choices from the acting player’s own hand and public history. Normal bidding stays fixed. Entire deal seeds are separated between training, calibration and evaluation. Training imitation accuracy alone is not a strength measure.');
  add('p',`${pct(v.winRate.mean)} against frozen Standard in ${v.games.toLocaleString()} full held-out matches (${ci(v.winRate.confidence95)}).`);
  add('p',`Release status: ${e.status}.`);
  if(e.pairedExternal){const p=e.pairedExternal;add('p',`On the same external deals, the win rate changed by ${points(100*p.winRateChange.mean)} percentage points (95% interval ${p.winRateChange.confidence95.map(x=>points(100*x)).join('–')}); final score advantage changed by ${points(p.scoreMarginChange.mean)} points (${p.scoreMarginChange.confidence95.map(points).join('–')}).`);}
 }
 if(r.secondaryBenchmarks?.length){
  add('h2','A second, adapted search opponent');
  add('p','Published ISMCTS tree search at 128 iterations per decision, with a corrected public-state and partnership-scoring adapter. This is an adapted research baseline, not an untouched commercial bot or a ranking of the strongest players.');
  const table=add('table',''),row=add('tr','',add('thead','',table));
  for(const text of ['Policy','Matches','Win rate · 95% interval'])add('th',text,row);
  const body=add('tbody','',table),names={'ismcts':'Rejected nil pilot','ismcts-play':'Current Standard','ismcts-play-control':'Original Standard on same deals'};
  for(const e of r.secondaryBenchmarks){const row=add('tr','',body);add('td',names[e.name],row);add('td',e.games.toLocaleString(),row);add('td',`${pct(e.winRate.mean)} · ${ci(e.winRate.confidence95)}`,row);}
  if(r.secondaryPairedComparison){const p=r.secondaryPairedComparison;add('p',`The trained player’s matched win-rate change was ${points(100*p.winRateChange.mean)} percentage points (95% interval ${p.winRateChange.confidence95.map(x=>points(100*x)).join('–')}); final score advantage changed by ${points(p.scoreMarginChange.mean)} points (${p.scoreMarginChange.confidence95.map(points).join('–')}).`);}
  add('p','This smaller comparison is inconclusive: it establishes neither a gain nor a regression against the second opponent.');
 }
 if(r.nilUtilityExperiment){const e=r.nilUtilityExperiment,t=e.training,v=e.evaluation;
  add('h2','Learning when to bid nil');
  add('p',`${t.contexts.toLocaleString()} bidding positions, with ${t.worlds} matched possible hidden deals per position, train a small network to predict nil’s scoring advantage and success risk. Inputs contain only the acting player’s cards, previous bids, scores and bags. Threshold selection uses a separate calibration set.`);
  add('p',`${pct(v.winRate.mean)} against frozen Standard (before nil)`).className='metric';
  add('p',`${v.games.toLocaleString()} full matches; paired 95% interval ${ci(v.winRate.confidence95)}. Nil succeeded on ${pct(v.nilSuccessRate)} of ${v.nilBids.toLocaleString()} bids. This internal result is separate from the external comparison above.`);
  add('p',`Release status: ${e.status}. Success predictions are measured against bots; they are not calibrated for human play.`);
  if(e.pairedExternal){const p=e.pairedExternal;add('p',`The same-deal external comparison changed win rate by ${points(100*p.winRateChange.mean)} percentage points and worsened final score advantage by ${points(-p.scoreMarginChange.mean)} points (95% interval ${p.scoreMarginChange.confidence95.map(points).join('–')}). The internal gain did not transfer.`);}
 }
 if(r.normalBidValueExperiment){const e=r.normalBidValueExperiment.evaluation;
  add('h2','An experiment that failed');
  add('p',`A more complex normal-bid value network won ${pct(e.winRate.mean)} against the incumbent over ${e.games.toLocaleString()} full matches (${ci(e.winRate.confidence95)}). It did not improve the independently held-out result and was rejected.`);
 }
 add('h2','Earlier isolated tests');
 for(const [name,e] of [['Original learned bidding',r.standardEvaluation],['Original search ablation',r.expertAblation]]){
  add('p',`${name}: ${pct(e.winRate.mean)} over ${e.games.toLocaleString()} ${e.unit} (${ci(e.winRate.confidence95)}). Candidate: ${e.candidate}. Baseline: ${e.baseline}.`);
 }
 if(r.research){
  add('h2','Training direction');add('p',r.research.recommendation);add('p',r.research.unbenchmarked);
  const list=add('ul','');for(const source of r.research.sources){const item=add('li','',list);const link=add('a',source.title,item);link.href=source.url;}
  const notes=add('p','');const link=add('a','Detailed research, experiments and limitations',notes);link.href='./training-notes.md';
 }
 add('h2','Reproduce');add('pre',r.reproduce.join('\n'));add('small',`Report date: ${r.date}. CPU training and evaluation; game inference runs locally in a browser worker.`);
} catch {report.textContent='The report could not load. Download the JSON report below for the recorded results.';}


import fs from 'node:fs';
import assert from 'node:assert/strict';
const [baselineFile,candidateFile,outputFile]=process.argv.slice(2);
if(!outputFile)throw new Error('Usage: node external-paired.mjs BASELINE.json CANDIDATE.json OUTPUT.json');
const b=JSON.parse(fs.readFileSync(baselineFile)),c=JSON.parse(fs.readFileSync(candidateFile));
assert.ok(b.adapterVersion>=2&&c.adapterVersion>=2);assert.equal(b.adapterSourceSha256,c.adapterSourceSha256);assert.equal(b.baselineCommit,c.baselineCommit);assert.deepEqual(b.rules,c.rules);assert.equal(b.seed,c.seed);assert.equal(b.pairs,c.pairs);
assert.equal(b.games,c.games);assert.equal(b.baselineSource,c.baselineSource);
for(const report of [b,c]){for(const field of ['errors','invalidDecisions','fallbackDecisions','censoredMatches'])assert.equal(report[field],0,field);assert.equal(report.completedMatches,report.games);assert.equal(report.games,report.pairs*2);}
const br=JSON.parse(fs.readFileSync(baselineFile.replace(/\.json$/,'.raw.json'))),cr=JSON.parse(fs.readFileSync(candidateFile.replace(/\.json$/,'.raw.json')));
assert.equal(br.length,b.pairs);assert.equal(cr.length,c.pairs);assert.equal(new Set(br.map(r=>r.seed)).size,br.length);assert.equal(new Set(cr.map(r=>r.seed)).size,cr.length);
const lookup=new Map(br.map(r=>[r.seed,r]));
const x=cr.map(r=>{const a=lookup.get(r.seed);assert.ok(a);return {seed:r.seed,win:((r.a.win+r.b.win)-(a.a.win+a.b.win))/2,score:((r.a.diff+r.b.diff)-(a.a.diff+a.b.diff))/2}});
const stats=values=>{const mean=values.reduce((a,b)=>a+b,0)/values.length,sd=Math.sqrt(values.reduce((a,b)=>a+(b-mean)**2,0)/(values.length-1));return {mean,confidence95:[mean-1.96*sd/Math.sqrt(values.length),mean+1.96*sd/Math.sqrt(values.length)]};};
const result={version:1,baseline:baselineFile,candidate:candidateFile,seed:b.seed,pairs:b.pairs,gamesPerCandidate:b.games,adapterVersion:b.adapterVersion,adapterSourceSha256:b.adapterSourceSha256,winRateChange:stats(x.map(r=>r.win)),scoreMarginChange:stats(x.map(r=>r.score)),interpretation:'Candidate minus incumbent on the exact same deal-seed and partnership-seat clusters. Positive means improvement.'};
fs.writeFileSync(outputFile,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));

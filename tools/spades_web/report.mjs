import fs from "node:fs";
import { createHash } from "node:crypto";
const read = (p) =>
  JSON.parse(fs.readFileSync(new URL(p, import.meta.url), "utf8"));
const training = read("./training-report.json"),
  standard = read("./evaluation.json"),
  expert = read("./evaluation-search.json");
const optional = p => fs.existsSync(new URL(p, import.meta.url)) ? read(p) : null;
const adapterPath = new URL('./external-runner/Program.cs', import.meta.url);
const adapterHash = fs.existsSync(adapterPath) ? createHash('sha256').update(fs.readFileSync(adapterPath)).digest('hex') : null;
const externalBenchmarks = ['standard', 'expert', 'play', 'play-control', 'nil', 'expert-nil', 'playing-ablation', 'bidding-ablation', 'incumbent-nil-holdout'].flatMap(name => {
  const result = optional(`./external-${name}.json`);
  if (!result) return [];
  if (result.adapterVersion < 2 || !result.adapterVersion || result.adapterSourceSha256 !== adapterHash)
    throw new Error(`Refusing external-${name}: unverified or obsolete adapter`);
  if (result.errors || result.invalidDecisions || result.fallbackDecisions || result.censoredMatches)
    throw new Error(`Refusing external-${name}: unsuccessful external evaluation`);
  return [{ name, ...result }];
});
const nilTraining = optional('./nil-training.json'), nilEvaluation = optional('./nil-evaluation.json');
const valueEvaluation = optional('./value-evaluation.json');
const playEvaluation = optional('./play-evaluation.json');
const playRelease = optional('./play-release.json');
if (playEvaluation && (playEvaluation.incompleteMatches || playEvaluation.modelSha256 !== createHash('sha256').update(fs.readFileSync(new URL('../../spades-web/play-policy-model.json', import.meta.url))).digest('hex')))
  throw new Error('Refusing incomplete or changed-model card-play confirmation');
const playPaired = optional('./external-play-paired.json');
if (playRelease?.deployed && (!playEvaluation || playEvaluation.winRate.confidence95[0] <= .5 || !playPaired || playPaired.winRateChange.confidence95[0] <= 0 || playPaired.scoreMarginChange.confidence95[0] <= 0 || playRelease.modelSha256 !== playEvaluation.modelSha256))
  throw new Error('Refusing a card-play release without a confirmed matched external gain');
const secondaryBenchmarks = ['ismcts', 'ismcts-play', 'ismcts-play-control'].flatMap(name=>{
  const secondary = optional(`./external-${name}.json`);
  if (!secondary) return [];
  const source = createHash('sha256').update(fs.readFileSync(new URL('./external-ismcts.py', import.meta.url))).digest('hex');
  if (secondary.adapterSourceSha256 !== source || secondary.errors || secondary.invalidDecisions || secondary.fallbackDecisions || secondary.censoredMatches)
    throw new Error('Refusing unverified secondary search benchmark');
  return [{name,...secondary}];
});
const report = {
  version: 2,
  date: "2026-10-10",
  informationPolicy:
    "AI receives only its own hand and public observations; hidden actual hands and deck seed excluded.",
  training: {
    method: training.model.method,
    hands: training.model.trainingHands,
    playerSamples: training.model.trainingHands * 4,
    seed: training.model.seed,
    calibrationPairedHands: training.model.calibrationHands,
    calibrationSeed: training.model.calibrationSeed,
    calibrationSeatSwap: training.model.calibrationSeatSwap,
    selectedOffset: training.model.offset,
    featureCount: training.model.weights.length,
  },
  standardEvaluation: standard,
  expertAblation: expert,
  externalBenchmarks,
  secondaryBenchmarks,
  secondaryPairedComparison: optional('./external-ismcts-play-paired.json'),
  cardPlayExperiment: playEvaluation ? {training: optional('./play-training.json'), evaluation: playEvaluation, pairedExternal: playPaired, status: playRelease?.status || 'experimental; release requires the matched external gate'} : null,
  nilUtilityExperiment: nilTraining && nilEvaluation ? {
    training: nilTraining, evaluation: nilEvaluation,
    pairedExternal: optional('./external-nil-paired.json'),
    status: externalBenchmarks.some(e => e.name === 'nil') ? 'rejected for Standard: internal improvement failed to transfer; external score deficit worsened' : 'awaiting external release gate',
  } : null,
  normalBidValueExperiment: valueEvaluation ? { status: 'rejected; no independently confirmed improvement', evaluation: valueEvaluation } : null,
  research: {
    recommendation: 'Warm-start card play from strong public-information teachers, then train score-aware action values against a frozen league of strong and varied opponents, with budgeted information-set search. Weak-only self-play produced a nil bidder that failed the external test. This is a project-specific direction, not a universal best-method claim.',
    sources: [
      { title: 'Bidding in Spades', url: 'https://arxiv.org/abs/1912.11323' },
      { title: 'Knowledge-biased ISMCTS in commercial Spades', url: 'https://edpowley.com/academic/papers/aiide13.pdf' },
      { title: 'Learning hidden-card distributions for trick-taking search', url: 'https://arxiv.org/abs/1903.09604' },
      { title: 'DouZero: action-conditioned Monte Carlo learning', url: 'https://proceedings.mlr.press/v139/zha21a.html' },
    ],
    unbenchmarked: 'AI Factory and NeuralPlay expose no public batch-evaluation interface found. Loddyluo Spades-AI uses materially different scoring. Released TricksterBots is a credible external baseline; no world-champion ranking is established.',
  },
  limitations: [
    "No calibrated Elo rating, human-strength estimate, or verified world-champion claim.",
    "The baseline is a modest documented heuristic; bidding and search tests answer separate questions.",
    "Nil utility is learned against a frozen play policy; its success predictions are not calibrated for human opponents.",
    "Determinization assumes heuristic rollout opponents and can suffer strategy fusion.",
    "Node measurements are not phone latency guarantees.",
  ],
  reproduce: [
    "node --test tools/spades_web/engine.test.mjs",
    "node tools/spades_web/train.mjs --hands 12000 --seed 20261010",
    "node tools/spades_web/evaluate.mjs --pairs 3000 --seed 70400000",
    "node tools/spades_web/evaluate.mjs --pairs 1000 --seed 70500000 --search --one-hand",
    "node tools/spades_web/nil-data.mjs --hands 4000 --worlds 8 --proposals 32 --seed 86200000",
    "python tools/spades_web/nil-train.py",
    "node tools/spades_web/nil-evaluate.mjs --calibrate --pairs 300 --seed 87200000",
    "node tools/spades_web/nil-evaluate.mjs --pairs 1500 --seed 88200000",
    "node tools/spades_web/play-data.mjs --hands 4000 --seed 92200000",
    "python tools/spades_web/play-train.py",
    "node tools/spades_web/export-play-model.mjs",
    "node tools/spades_web/play-evaluate.mjs --pairs 1500 --seed 94200000",
    "powershell -ExecutionPolicy Bypass -File tools/spades_web/external-setup.ps1",
    "node tools/spades_web/external-evaluate.mjs --pairs 1000 --seed 89200000 --candidate nil --out tools/spades_web/external-nil.json",
    "node tools/spades_web/external-evaluate.mjs --pairs 1000 --seed 95200000 --candidate play --out tools/spades_web/external-play.json",
  ],
};
fs.writeFileSync(
  new URL("../../spades-web/ai-report.json", import.meta.url),
  JSON.stringify(report, null, 2) + "\n",
);
fs.copyFileSync(new URL('./research.md', import.meta.url), new URL('../../spades-web/training-notes.md', import.meta.url));

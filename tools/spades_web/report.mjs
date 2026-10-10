import fs from "node:fs";
const read = (p) =>
  JSON.parse(fs.readFileSync(new URL(p, import.meta.url), "utf8"));
const training = read("./training-report.json"),
  standard = read("./evaluation.json"),
  expert = read("./evaluation-search.json");
const report = {
  version: 1,
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
  limitations: [
    "Not an Elo rating, human-strength estimate, or comparison with strong external bots.",
    "The baseline is a modest documented heuristic; bidding and search tests answer separate questions.",
    "AI currently avoids nil bids; humans may bid nil.",
    "Determinization assumes heuristic rollout opponents and can suffer strategy fusion.",
    "Node measurements are not phone latency guarantees.",
  ],
  reproduce: [
    "node --test tools/spades_web/engine.test.mjs",
    "node tools/spades_web/train.mjs --hands 12000 --seed 20261010",
    "node tools/spades_web/evaluate.mjs --pairs 3000 --seed 70400000",
    "node tools/spades_web/evaluate.mjs --pairs 1000 --seed 70500000 --search --one-hand",
  ],
};
fs.writeFileSync(
  new URL("../../spades-web/ai-report.json", import.meta.url),
  JSON.stringify(report, null, 2) + "\n",
);

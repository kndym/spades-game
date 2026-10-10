import fs from "node:fs";
import {
  createGame,
  applyBid,
  playCard,
  publicObservation,
} from "../../spades-web/engine.js";
import {
  bidFeatures,
  heuristicBid,
  heuristicPlay,
  learnedBid,
} from "../../spades-web/ai.js";
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i < 0 ? fallback : Number(process.argv[i + 1]);
};
const hands = arg("--hands", 12000),
  seed = arg("--seed", 20261010),
  out = new URL("../../spades-web/bid-model.js", import.meta.url);
function hand(dealSeed, model = null, candidateTeam = 0) {
  const s = createGame({ seed: dealSeed });
  const observations = [];
  while (s.phase === "bidding") {
    const o = publicObservation(s);
    observations.push({ player: o.player, x: bidFeatures(o) });
    applyBid(
      s,
      model && o.player % 2 === candidateTeam
        ? learnedBid(o, model)
        : heuristicBid(o),
    );
  }
  while (s.phase === "playing")
    playCard(s, heuristicPlay(publicObservation(s)));
  return { s, observations };
}
const n = 21,
  A = Array.from({ length: n }, () => Array(n).fill(0)),
  b = Array(n).fill(0);
const start = performance.now();
for (let i = 0; i < hands; i++) {
  const { s, observations } = hand(seed + i);
  for (const { player, x } of observations) {
    for (let j = 0; j < n; j++) {
      b[j] += x[j] * s.tricks[player];
      for (let k = 0; k < n; k++) A[j][k] += x[j] * x[k];
    }
  }
  if ((i + 1) % 2000 === 0) console.log(`Generated ${i + 1}/${hands} hands`);
}
for (let j = 1; j < n; j++) A[j][j] += 10;
// Pivoted ridge least squares, no external runtime or GPU dependency.
for (let j = 0; j < n; j++) {
  let pivot = j;
  for (let k = j + 1; k < n; k++)
    if (Math.abs(A[k][j]) > Math.abs(A[pivot][j])) pivot = k;
  [A[j], A[pivot]] = [A[pivot], A[j]];
  [b[j], b[pivot]] = [b[pivot], b[j]];
  const div = A[j][j];
  for (let k = j; k < n; k++) A[j][k] /= div;
  b[j] /= div;
  for (let row = 0; row < n; row++)
    if (row !== j) {
      const v = A[row][j];
      for (let k = j; k < n; k++) A[row][k] -= v * A[j][k];
      b[row] -= v * b[j];
    }
}
const model = {
  version: 1,
  method:
    "Ridge regression of tricks from public own-hand features; score-calibrated offset",
  weights: b.map((x) => Number(x.toFixed(9))),
  offset: 0,
  seed,
  trainingHands: hands,
  calibrationSeed: seed + 100000,
  calibrationHands: 1200,
  calibrationSeatSwap: true,
};
const calibrations = [];
for (const offset of [-0.8, -0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6, 0.8]) {
  model.offset = offset;
  let score = 0;
  for (let i = 0; i < model.calibrationHands; i++) {
    for (const team of [0, 1]) {
      const { s } = hand(model.calibrationSeed + i, model, team);
      score += (s.lastHand.delta[team] - s.lastHand.delta[1 - team]) / 2;
    }
  }
  calibrations.push({
    offset,
    scoreDifference: score / model.calibrationHands,
  });
  console.log(
    `Calibration offset ${offset}: ${(score / model.calibrationHands).toFixed(2)}`,
  );
}
calibrations.sort((a, b) => b.scoreDifference - a.scoreDifference);
model.offset = calibrations[0].offset;
fs.writeFileSync(
  out,
  "export const BID_MODEL = " + JSON.stringify(model, null, 2) + ";\n",
);
fs.writeFileSync(
  new URL("./training-report.json", import.meta.url),
  JSON.stringify(
    {
      model,
      calibrations,
      trainingSeconds: (performance.now() - start) / 1000,
    },
    null,
    2,
  ),
);
console.log(`Saved model; ${(performance.now() - start) / 1000}s`);

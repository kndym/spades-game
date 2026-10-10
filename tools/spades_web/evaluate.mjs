import fs from "node:fs";
import {
  createGame,
  applyBid,
  playCard,
  nextHand,
  publicObservation,
} from "../../spades-web/engine.js";
import {
  heuristicBid,
  heuristicPlay,
  learnedBid,
  searchPlay,
} from "../../spades-web/ai.js";
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i < 0 ? fallback : Number(process.argv[i + 1]);
};
const pairs = arg("--pairs", 3000),
  seed = arg("--seed", 70400000),
  search = process.argv.includes("--search"),
  oneHand = process.argv.includes("--one-hand");
function game(dealSeed, candidateTeam) {
  const s = createGame({ seed: dealSeed, target: 500 });
  let moves = 0,
    time = 0;
  while (s.phase !== "gameOver" && s.handNumber <= 150) {
    if (s.phase === "handEnd") {
      if (oneHand) break;
      nextHand(s);
      continue;
    }
    const o = publicObservation(s),
      candidate = o.player % 2 === candidateTeam;
    if (s.phase === "bidding")
      applyBid(s, candidate || search ? learnedBid(o) : heuristicBid(o));
    else {
      const start = performance.now();
      const c = candidate && search ? searchPlay(o) : heuristicPlay(o);
      time += performance.now() - start;
      moves++;
      playCard(s, c);
    }
  }
  return {
    won:
      s.scores[candidateTeam] > s.scores[1 - candidateTeam]
        ? 1
        : s.scores[candidateTeam] === s.scores[1 - candidateTeam]
          ? 0.5
          : 0,
    diff: s.scores[candidateTeam] - s.scores[1 - candidateTeam],
    hands: s.handNumber,
    completed: oneHand || s.phase === "gameOver",
    moves,
    time,
  };
}
const clusters = [],
  diffs = [],
  raw = [];
let totalMoves = 0,
  totalTime = 0;
const started = performance.now();
for (let i = 0; i < pairs; i++) {
  const a = game(seed + i, 0),
    b = game(seed + i, 1);
  clusters.push((a.won + b.won) / 2);
  diffs.push((a.diff + b.diff) / 2);
  raw.push({ seed: seed + i, a, b });
  totalMoves += a.moves + b.moves;
  totalTime += a.time + b.time;
  if ((i + 1) % 500 === 0)
    console.log(`Evaluated ${i + 1}/${pairs} paired deals`);
}
function stats(x) {
  const mean = x.reduce((a, b) => a + b, 0) / x.length,
    sd = Math.sqrt(x.reduce((a, b) => a + (b - mean) ** 2, 0) / (x.length - 1)),
    se = sd / Math.sqrt(x.length);
  return { mean, confidence95: [mean - 1.96 * se, mean + 1.96 * se] };
}
const result = {
  version: 1,
  seed,
  pairs,
  games: pairs * 2,
  unit: oneHand ? "single hands" : "500-point matches",
  candidate: search
    ? "learned bidding plus public-information search"
    : "learned bidding with shared heuristic play",
  baseline: search
    ? "learned bidding with shared heuristic play"
    : "hand-strength heuristic bidding with same heuristic play",
  pairedSeatSwap: true,
  maximumHandsPlayed: Math.max(...raw.flatMap((x) => [x.a.hands, x.b.hands])),
  incompleteMatches: raw.reduce(
    (sum, x) => sum + Number(!x.a.completed) + Number(!x.b.completed),
    0,
  ),
  winRate: stats(clusters),
  scoreDifference: stats(diffs),
  averageMoveMilliseconds: totalTime / totalMoves,
  elapsedSeconds: (performance.now() - started) / 1000,
  trainingSeedDisjoint: true,
};
fs.writeFileSync(
  new URL(
    search ? "./evaluation-search.json" : "./evaluation.json",
    import.meta.url,
  ),
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result, null, 2));

import {
  cardInfo,
  legalCards,
  trickWinner,
  seededRandom,
  shuffle,
  playCard,
  publicObservation,
} from "./engine.js";
import { BID_MODEL } from "./bid-model.js";
import { PLAY_MODEL } from "./play-model.js";
import { policyPlay } from "./play-policy.js";
export function bidFeatures(o) {
  const counts = [0, 0, 0, 0],
    aces = [0, 0, 0, 0],
    kings = [0, 0, 0, 0],
    queens = [0, 0, 0, 0];
  for (const c of o.hand) {
    const { suit, rank } = cardInfo(c);
    counts[suit]++;
    if (rank === 14) aces[suit]++;
    if (rank === 13) kings[suit]++;
    if (rank === 12) queens[suit]++;
  }
  return [
    1,
    ...counts.map((x) => x / 13),
    ...aces,
    ...kings,
    ...queens,
    counts.slice(0, 3).filter((x) => x === 0).length,
    counts.slice(0, 3).filter((x) => x === 1).length,
    Math.max(0, counts[3] - 3),
    (counts[3] * counts[3]) / 13,
  ];
}
export function heuristicBid(o) {
  let n = 0;
  const counts = [0, 0, 0, 0];
  for (const c of o.hand) counts[Math.floor(c / 13)]++;
  for (const c of o.hand) {
    const { suit, rank } = cardInfo(c);
    if (rank === 14) n += 1;
    else if (rank === 13) n += suit === 3 ? 0.9 : counts[suit] < 5 ? 0.5 : 0.3;
    else if (suit === 3 && rank === 12) n += 0.7;
  }
  n += Math.max(0, counts[3] - 3) * 0.65;
  return Math.max(1, Math.min(9, Math.round(n)));
}
export function learnedBid(o, model = BID_MODEL) {
  const f = bidFeatures(o);
  const estimate = f.reduce((a, x, i) => a + x * (model.weights[i] || 0), 0);
  return Math.max(1, Math.min(10, Math.round(estimate + model.offset)));
}
function legalObservation(o) {
  return legalCards({
    phase: o.phase,
    hands: Array.from({ length: 4 }, (_, p) => (p === o.player ? o.hand : [])),
    currentPlayer: o.player,
    currentTrick: o.currentTrick,
    spadesBroken: o.spadesBroken,
  });
}
export function heuristicPlay(o) {
  const legal = legalObservation(o),
    p = o.player,
    partner = (p + 2) % 4,
    team = p % 2;
  const rank = (c) => (c % 13) + 2,
    cost = (c) => rank(c) + (c >= 39 ? 18 : 0);
  const low = [...legal].sort((a, b) => cost(a) - cost(b));
  if (legal.length === 1) return legal[0];
  const teamBid = o.bids[team] + o.bids[team + 2],
    teamTricks =
      (o.bids[team] === 0 ? 0 : o.tricks[team]) +
      (o.bids[team + 2] === 0 ? 0 : o.tricks[team + 2]),
    need = teamTricks < teamBid;
  const winning = (c) =>
    trickWinner([...o.currentTrick, { player: p, card: c }]) === p;
  if (o.bids[p] === 0 && o.tricks[p] === 0) {
    if (!o.currentTrick.length) return low[0];
    const losing = legal.filter((c) => !winning(c));
    return (losing.length ? losing : legal).sort(
      (a, b) => rank(b) - rank(a),
    )[0];
  }
  if (!o.currentTrick.length) {
    const seen = new Set(
      o.completedTricks.flatMap((t) => t.cards.map((c) => c.card)),
    );
    const masters = legal.filter((c) =>
      Array.from(
        { length: 14 - rank(c) },
        (_, i) => Math.floor(c / 13) * 13 + rank(c) - 1 + i,
      ).every((h) => seen.has(h) || o.hand.includes(h)),
    );
    if (need && masters.length)
      return masters.sort((a, b) => cost(a) - cost(b))[0];
    return low[0];
  }
  const current = trickWinner(o.currentTrick);
  if (
    current === partner &&
    !(o.bids[partner] === 0 && o.tricks[partner] === 0)
  )
    return low[0];
  const wins = legal.filter(winning);
  if (
    wins.length &&
    (need ||
      (o.bids[partner] === 0 && o.tricks[partner] === 0 && current === partner))
  )
    return wins.sort((a, b) => cost(a) - cost(b))[0];
  const losers = legal.filter((c) => !winning(c));
  if (!need && losers.length)
    return losers.sort((a, b) => cost(b) - cost(a))[0];
  return low[0];
}
function sampleWorld(o, rng) {
  const known = new Set([
    ...o.hand,
    ...o.currentTrick.map((c) => c.card),
    ...o.completedTricks.flatMap((t) => t.cards.map((c) => c.card)),
  ]);
  const unseen = Array.from({ length: 52 }, (_, i) => i).filter(
      (c) => !known.has(c),
    ),
    others = [0, 1, 2, 3].filter((p) => p !== o.player);
  for (let attempt = 0; attempt < 150; attempt++) {
    const hands = Array.from({ length: 4 }, () => []);
    hands[o.player] = [...o.hand];
    const cards = shuffle([...unseen], rng).sort(
      (a, b) =>
        others.filter((p) => !o.voids[p][Math.floor(a / 13)]).length -
        others.filter((p) => !o.voids[p][Math.floor(b / 13)]).length,
    );
    let failed = false;
    for (const c of cards) {
      const eligible = others.filter(
        (p) =>
          hands[p].length < o.handSizes[p] && !o.voids[p][Math.floor(c / 13)],
      );
      if (!eligible.length) {
        failed = true;
        break;
      }
      const weight = eligible.map((p) => o.handSizes[p] - hands[p].length),
        total = weight.reduce((a, b) => a + b, 0);
      let draw = rng() * total,
        index = 0;
      while (draw >= weight[index]) draw -= weight[index++];
      hands[eligible[index]].push(c);
    }
    if (!failed)
      return {
        seed: 0,
        target: 1e9,
        dealer: o.dealer,
        handNumber: o.handNumber,
        hands,
        bids: [...o.bids],
        tricks: [...o.tricks],
        scores: [...o.scores],
        bags: [...o.bags],
        phase: "playing",
        currentPlayer: o.player,
        currentTrick: o.currentTrick.map((c) => ({ ...c })),
        completedTricks: structuredClone(o.completedTricks),
        voids: structuredClone(o.voids),
        spadesBroken: o.spadesBroken,
        history: [],
      };
  }
  return null;
}
export function searchPlay(o, { samples = 12 } = {}) {
  const legal = legalObservation(o);
  if (legal.length === 1) return legal[0];
  const team = o.player % 2;
  const hash =
    o.hand.reduce((a, c) => Math.imul(a ^ c, 16777619), 2166136261) ^
    o.completedTricks.length ^
    o.currentTrick.length;
  const rng = seededRandom(hash),
    sums = new Map(legal.map((c) => [c, 0]));
  let accepted = 0;
  for (let i = 0; i < samples; i++) {
    const world = sampleWorld(o, rng);
    if (!world) continue;
    accepted++;
    for (const card of legal) {
      const s = structuredClone(world);
      playCard(s, card);
      while (s.phase === "playing")
        playCard(s, heuristicPlay(publicObservation(s)));
      sums.set(
        card,
        sums.get(card) + s.lastHand.delta[team] - s.lastHand.delta[1 - team],
      );
    }
  }
  if (!accepted) return heuristicPlay(o);
  const preferred = heuristicPlay(o);
  return legal.sort(
    (a, b) =>
      sums.get(b) - sums.get(a) || (b === preferred) - (a === preferred),
  )[0];
}
export function chooseAction(o, { difficulty = "standard" } = {}) {
  const start = performance.now();
  const type = o.phase === "bidding" ? "bid" : "play";
  const value =
    type === "bid"
      ? difficulty === "easy"
        ? heuristicBid(o)
        : learnedBid(o)
      : difficulty === "expert"
        ? searchPlay(o)
        : difficulty === "easy"
          ? heuristicPlay(o)
          : policyPlay(o, PLAY_MODEL);
  return {
    type,
    value,
    diagnostics: {
      milliseconds: performance.now() - start,
      policy:
        difficulty === "expert"
          ? "public-information determinization"
          : difficulty === "easy"
            ? "heuristic"
            : "learned bidding and public-information teacher-trained card play",
    },
  };
}

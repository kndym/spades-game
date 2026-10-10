export const SUITS = ["Clubs", "Diamonds", "Hearts", "Spades"];
export function cardInfo(card) {
  const suit = Math.floor(card / 13),
    rank = (card % 13) + 2;
  return {
    suit,
    rank,
    symbol: ["♣", "♦", "♥", "♠"][suit],
    suitName: SUITS[suit],
    red: suit === 1 || suit === 2,
    label: { 11: "J", 12: "Q", 13: "K", 14: "A" }[rank] || String(rank),
  };
}
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffle(cards, rng) {
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}
export function cloneState(s) {
  return structuredClone(s);
}
export function createGame({ seed = Date.now() >>> 0, target = 500 } = {}) {
  const s = {
    seed: seed >>> 0,
    target,
    dealer: 3,
    handNumber: 0,
    scores: [0, 0],
    bags: [0, 0],
    winner: null,
    history: [],
  };
  return deal(s);
}
function deal(s) {
  s.handNumber++;
  const rng = seededRandom(
      (s.seed + Math.imul(s.handNumber, 2654435761)) >>> 0,
    ),
    deck = shuffle(
      Array.from({ length: 52 }, (_, i) => i),
      rng,
    );
  s.hands = Array.from({ length: 4 }, (_, p) =>
    deck.filter((_, i) => i % 4 === p).sort((a, b) => a - b),
  );
  s.bids = [null, null, null, null];
  s.tricks = [0, 0, 0, 0];
  s.currentTrick = [];
  s.completedTricks = [];
  s.lastTrick = [];
  s.lastTrickWinner = null;
  s.voids = Array.from({ length: 4 }, () => [false, false, false, false]);
  s.spadesBroken = false;
  s.currentPlayer = (s.dealer + 1) % 4;
  s.phase = "bidding";
  return s;
}
export function nextHand(s) {
  if (s.phase !== "handEnd") throw new Error("The hand is still in progress.");
  s.dealer = (s.dealer + 1) % 4;
  return deal(s);
}
export function applyBid(s, bid) {
  if (s.phase !== "bidding" || !Number.isInteger(bid) || bid < 0 || bid > 13)
    throw new Error("Choose a bid from 0 to 13.");
  s.bids[s.currentPlayer] = bid;
  s.currentPlayer = (s.currentPlayer + 1) % 4;
  if (s.bids.every((b) => b !== null)) {
    s.phase = "playing";
    s.currentPlayer = (s.dealer + 1) % 4;
  }
  return s;
}
export function legalCards(s, player = s.currentPlayer) {
  if (s.phase !== "playing") return [];
  const h = s.hands[player];
  if (s.currentTrick.length) {
    const lead = Math.floor(s.currentTrick[0].card / 13),
      follow = h.filter((c) => Math.floor(c / 13) === lead);
    return follow.length ? follow : [...h];
  }
  return s.spadesBroken || h.every((c) => c >= 39)
    ? [...h]
    : h.filter((c) => c < 39);
}
export function trickWinner(cards) {
  if (!cards.length) return null;
  let w = cards[0];
  const lead = Math.floor(w.card / 13);
  for (const c of cards.slice(1)) {
    const a = Math.floor(c.card / 13),
      b = Math.floor(w.card / 13);
    if (
      (a === b && c.card % 13 > w.card % 13) ||
      (a === 3 && b !== 3) ||
      (a === lead && b !== 3 && b !== lead)
    )
      w = c;
  }
  return w.player;
}
export function playCard(s, card) {
  if (!legalCards(s).includes(card))
    throw new Error("Follow suit and lead spades only after they are broken.");
  const p = s.currentPlayer;
  if (
    s.currentTrick.length &&
    Math.floor(card / 13) !== Math.floor(s.currentTrick[0].card / 13)
  )
    s.voids[p][Math.floor(s.currentTrick[0].card / 13)] = true;
  s.hands[p].splice(s.hands[p].indexOf(card), 1);
  s.currentTrick.push({ player: p, card });
  if (card >= 39) s.spadesBroken = true;
  if (s.currentTrick.length === 4) {
    const winner = trickWinner(s.currentTrick);
    s.tricks[winner]++;
    s.lastTrick = s.currentTrick.map((c) => ({ ...c }));
    s.lastTrickWinner = winner;
    s.completedTricks.push({ cards: s.lastTrick, winner });
    s.currentTrick = [];
    s.currentPlayer = winner;
    if (s.completedTricks.length === 13) scoreHand(s);
  } else s.currentPlayer = (p + 1) % 4;
  return s;
}
export function scoreHand(s) {
  if (s.phase !== "playing" || s.completedTricks.length !== 13)
    throw new Error("Only completed hands can be scored.");
  const delta = [0, 0],
    nil = [null, null, null, null];
  for (let team = 0; team < 2; team++) {
    let bid = 0,
      tricks = 0;
    for (const p of [team, team + 2]) {
      if (s.bids[p] === 0) {
        nil[p] = s.tricks[p] === 0;
        delta[team] += nil[p] ? 100 : -100;
      } else {
        bid += s.bids[p];
        tricks += s.tricks[p];
      }
    }
    // Failed-nil tricks do not help the partnership contract; they do count as bags.
    let over = 0;
    if (bid > 0) {
      if (tricks >= bid) {
        delta[team] += bid * 10;
        over = tricks - bid;
      } else delta[team] -= bid * 10;
    }
    for (const p of [team, team + 2]) if (s.bids[p] === 0) over += s.tricks[p];
    delta[team] += over;
    s.bags[team] += over;
    while (s.bags[team] >= 10) {
      s.bags[team] -= 10;
      delta[team] -= 100;
    }
    s.scores[team] += delta[team];
  }
  s.lastHand = {
    handNumber: s.handNumber,
    bids: [...s.bids],
    tricks: [...s.tricks],
    delta,
    scores: [...s.scores],
    bags: [...s.bags],
    nil,
  };
  s.history.push(s.lastHand);
  if (Math.max(...s.scores) >= s.target && s.scores[0] !== s.scores[1]) {
    s.phase = "gameOver";
    s.winner = s.scores[0] > s.scores[1] ? 0 : 1;
  } else s.phase = "handEnd";
  return s;
}
export function publicObservation(s, player = s.currentPlayer) {
  return {
    player,
    phase: s.phase,
    hand: [...s.hands[player]],
    handSizes: s.hands.map((h) => h.length),
    bids: [...s.bids],
    tricks: [...s.tricks],
    scores: [...s.scores],
    bags: [...s.bags],
    target: s.target,
    currentPlayer: s.currentPlayer,
    dealer: s.dealer,
    handNumber: s.handNumber,
    currentTrick: s.currentTrick.map((c) => ({ ...c })),
    completedTricks: s.completedTricks.map((t) => ({
      winner: t.winner,
      cards: t.cards.map((c) => ({ ...c })),
    })),
    voids: s.voids.map((v) => [...v]),
    spadesBroken: s.spadesBroken,
  };
}

import test from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  applyBid,
  playCard,
  legalCards,
  trickWinner,
  publicObservation,
  scoreHand,
  nextHand,
  cloneState,
} from "../../spades-web/engine.js";
import { chooseAction, heuristicPlay } from "../../spades-web/ai.js";
test("deterministic shuffled unique complete deck", () => {
  const a = createGame({ seed: 17 }),
    b = createGame({ seed: 17 });
  assert.deepEqual(a, b);
  assert.equal(new Set(a.hands.flat()).size, 52);
  assert(a.hands.every((h) => h.length === 13));
});
test("bids and turns are validated", () => {
  const s = createGame({ seed: 3 });
  assert.throws(() => applyBid(s, -1));
  assert.throws(() => applyBid(s, 1.5));
  for (let i = 0; i < 4; i++) applyBid(s, 3);
  assert.equal(s.currentPlayer, 0);
  assert.equal(s.phase, "playing");
  assert.throws(() => applyBid(s, 3));
});
test("must follow suit; unbroken spades cannot be led unless only spades", () => {
  const s = createGame();
  s.phase = "playing";
  s.hands[0] = [0, 13, 39];
  assert.deepEqual(legalCards(s), [0, 13]);
  s.currentTrick = [{ player: 3, card: 12 }];
  assert.deepEqual(legalCards(s), [0]);
  assert.throws(() => playCard(s, 39));
  s.currentTrick = [];
  s.hands[0] = [39, 45];
  assert.deepEqual(legalCards(s), [39, 45]);
});
test("off-suit aces do not beat led suit; spades trump, high trump wins", () => {
  assert.equal(
    trickWinner([
      { player: 0, card: 4 },
      { player: 1, card: 25 },
      { player: 2, card: 3 },
      { player: 3, card: 38 },
    ]),
    0,
  );
  assert.equal(
    trickWinner([
      { player: 0, card: 12 },
      { player: 1, card: 39 },
      { player: 2, card: 51 },
      { player: 3, card: 25 },
    ]),
    2,
  );
});
function scoring(bids, tricks, bags = [0, 0]) {
  const s = createGame();
  s.phase = "playing";
  s.bids = bids;
  s.tricks = tricks;
  s.bags = bags;
  s.completedTricks = Array(13).fill({});
  scoreHand(s);
  return s;
}
test("contract, set, nil, failed nil, cumulative bags and penalty", () => {
  assert.deepEqual(
    scoring([3, 3, 3, 3], [3, 3, 4, 3]).lastHand.delta,
    [61, 60],
  );
  assert.equal(scoring([4, 3, 4, 2], [3, 3, 4, 3]).lastHand.delta[0], -80);
  assert.equal(scoring([0, 3, 4, 3], [0, 4, 5, 4]).lastHand.delta[0], 141);
  const failed = scoring([0, 3, 4, 3], [2, 3, 3, 5]);
  assert.equal(failed.lastHand.delta[0], -138);
  assert.equal(failed.bags[0], 2);
  assert.equal(
    scoring([3, 3, 3, 3], [4, 3, 3, 3], [9, 0]).lastHand.delta[0],
    -39,
  );
});
test("scoring only once and next hand only after completed hand", () => {
  const s = scoring([3, 3, 3, 3], [3, 3, 4, 3]);
  assert.throws(() => scoreHand(s));
  nextHand(s);
  assert.equal(s.handNumber, 2);
  assert.equal(s.dealer, 0);
  assert.throws(() => nextHand(s));
});
test("public observations and choices are invariant to actual hidden hands", () => {
  const a = createGame({ seed: 71 }),
    b = cloneState(a);
  [b.hands[1], b.hands[3]] = [b.hands[3], b.hands[1]];
  const x = publicObservation(a, 0),
    y = publicObservation(b, 0);
  assert.deepEqual(x, y);
  assert(!Object.keys(x).some((k) => k === "hands" || k === "seed"));
  assert.equal(chooseAction(x).value, chooseAction(y).value);
  for (let i = 0; i < 4; i++) {
    applyBid(a, 3);
    applyBid(b, 3);
  }
  const p = publicObservation(a),
    q = publicObservation(b);
  assert.deepEqual(p, q);
  assert.equal(
    chooseAction(p, { difficulty: "expert" }).value,
    chooseAction(q, { difficulty: "expert" }).value,
  );
});
test("nil player leads low, not high", () => {
  const s = createGame();
  for (let i = 0; i < 4; i++) applyBid(s, i === 0 ? 0 : 3);
  s.hands[0] = [0, 12, 39];
  assert.equal(heuristicPlay(publicObservation(s)), 0);
});
test("100 full hands preserve legal play, count all tricks and public voids", () => {
  for (let seed = 0; seed < 100; seed++) {
    const s = createGame({ seed });
    while (s.phase === "bidding")
      applyBid(s, chooseAction(publicObservation(s)).value);
    while (s.phase === "playing") {
      const o = publicObservation(s),
        c = chooseAction(o).value;
      assert(legalCards(s).includes(c));
      playCard(s, c);
    }
    assert.equal(s.completedTricks.length, 13);
    assert.equal(
      s.tricks.reduce((a, b) => a + b, 0),
      13,
    );
    assert(s.hands.every((h) => h.length === 0));
    for (const t of s.completedTricks)
      assert.equal(new Set(t.cards.map((c) => c.player)).size, 4);
  }
});
test("observations are copied; public void detection and broken trump are maintained", () => {
  const s = createGame();
  s.phase = "playing";
  s.hands[0] = [13, 39];
  s.currentTrick = [{ player: 3, card: 0 }];
  const o = publicObservation(s);
  o.hand.pop();
  o.voids[0][0] = true;
  assert.equal(s.hands[0].length, 2);
  assert.equal(s.voids[0][0], false);
  playCard(s, 39);
  assert.equal(s.voids[0][0], true);
  assert.equal(s.spadesBroken, true);
});
test("search choices remain legal after public history and voids accumulate", () => {
  for (let seed = 10; seed < 20; seed++) {
    const s = createGame({ seed });
    while (s.phase === "bidding") applyBid(s, 3);
    for (let t = 0; t < 33; t++)
      playCard(s, heuristicPlay(publicObservation(s)));
    const action = chooseAction(publicObservation(s), { difficulty: "expert" });
    assert(legalCards(s).includes(action.value));
  }
});
test("failed-nil tricks do not mislead partner contract strategy", () => {
  const s = createGame();
  for (const bid of [4, 3, 0, 3]) applyBid(s, bid);
  s.tricks = [1, 0, 3, 0];
  s.hands[0] = [0, 12];
  s.currentTrick = [{ player: 3, card: 6 }];
  assert.equal(heuristicPlay(publicObservation(s)), 12);
});

# Actual external Spades benchmark

This adapter executes the released [Trickster Cards Spades bot](https://github.com/TricksterCards/TricksterBots) directly. It does **not** use the old repository's `bot_evaluation/trickster_wrapper.py`, which returns a fixed bid of 3 and the first legal card. That old placeholder cannot establish strength against Trickster.

## Reproduce

Requires Node.js and .NET 10 SDK; neither the browser game nor deployed site requires .NET.

```powershell
powershell -ExecutionPolicy Bypass -File tools/spades_web/external-setup.ps1
node tools/spades_web/external-evaluate.mjs --pairs 1000 --seed 81000000 --out tools/spades_web/external-standard.json
node tools/spades_web/external-evaluate.mjs --difficulty expert --pairs 300 --seed 82000000 --out tools/spades_web/external-expert.json
node --test tools/spades_web/external.test.mjs tools/spades_web/external-ismcts.test.mjs
```

The vendor checkout is ignored, pinned to `3abca057bff801eca00d2d20839c3407db96ebb2`, with Bridgit submodule `ee9ade9ea2eb159b3959f227d2ac0db22aa710f3`. The C# project references the actual bot, not a port or rewritten approximation. Sources retain their original upstream licenses.

## Fairness and scoring

Both teams play the browser engine's same 500-point partnership rules. Each seed is played twice, swapping candidate and external teams between opposite-seat partnerships. Games use deterministic independent deals and rotate the dealer. Confidence intervals use seed-pair clusters, avoiding treatment of the two correlated seat-swap games as independent samples. These intervals describe this opponent/configuration only, not an Elo or universal strength claim.

The JSONL subprocess receives `publicObservation` plus the legal cards: one player's hand, public bids, scores, bags, played cards, observed void suits, and trick history. No opponent hands or engine deal seed are sent. Opponent `PlayerBase.Hand` fields are empty. The adapter reconstructs public `PlayedCards` with the trick winner for each completed trick, nil encodings using `SpadesBid`, and packed scores using `SpadesScore`'s implicit conversion. Metadata checks assert 52 cards, standard (Trickster `None`) variation, and a score/bag encoding round trip.

Adapter version 2 also verifies the actual `PlayedCard(trickHigh, myPlay)` constructor order through a runtime metadata probe and a complete public nil-partner history regression. Initial development reports with reversed constructor arguments were invalidated and moved to ignored `external-invalid/`; no version-1 adapter result is acceptable for publication. Corrected reports pin the C# adapter SHA256 and policy/model hashes.

Nil is ±100; failed nil tricks count as bags but do not help the partner's contract (`FailedNilBags.TakesBags`). Overtricks score +1 and ten bags cost 100. No blind nil, passing, jokers, ten-bid bonuses, mercy termination, or first-hand forced bidding. Spades may be led after broken or when the hand contains only spades. The external bot may bid nil; the current deployed browser AI does not. This is a real capability difference, not disabled to favor our AI.

Errors and illegal moves abort evaluation rather than choosing fallback actions. Any unfinished 150-hand match also aborts; it cannot silently contribute a guessed win. Reports include error/invalid/fallback/censored counts, matched source commits, seed block, match counts, and paired win and final-score intervals. Raw per-seed outcomes are saved alongside each report.

The zero-fallback count refers to adapter replacement actions. Internal policy behavior, including the incumbent search's planned heuristic action when it cannot sample a consistent world, is not separately instrumented. This benchmark does not claim that every internal search attempt succeeded.

## What “strongest” means here

The authors describe this repository as the suggestion methods used in Trickster Cards. It is therefore a useful production-derived opponent. It has no published universal Spades ranking. Proprietary AI Factory, NeuralPlay, and other commercial bots cannot be labeled weaker without an executable fair benchmark. Research engines for other games, or perfect-information double-dummy solvers, are not interchangeable with a deployable Spades opponent.

## Independent ISMCTS algorithm baseline

`--baseline ismcts --iterations 128` imports the released tree algorithm from [jdfreden/Spades](https://github.com/jdfreden/Spades) at `8b924def0fde39fdde23b85b4d4ace7ca0ca20fe`. Python and NumPy are required. That repository is explicitly a work in progress. Its original Spades state scores separate individual contracts and resamples already-played cards, so this benchmark replaces the state/rules interface with `external-ismcts.py`. The ISMCTS tree selection/expansion/rollout/backpropagation implementation and its own-hand-only bidding heuristic remain upstream code. Sampling respects public played cards, current trick, own hand, hand sizes, and observed voids. A differential test checks terminal score, bag rollover and nil handling against the browser engine on 100 independent random hands.

This is a comparison against a published search **algorithm with a corrected rule adapter**, not an untouched original opponent or strongest-bot claim. The 128-iteration budget is recorded explicitly. To run independent shards and recompute paired confidence intervals from their combined raw outcomes:

```powershell
node tools/spades_web/external-evaluate.mjs --baseline ismcts --candidate nil --pairs 50 --iterations 128 --seed 90010000 --out tools/spades_web/external-ismcts-part1.json
node tools/spades_web/external-evaluate.mjs --baseline ismcts --candidate nil --pairs 50 --iterations 128 --seed 90010050 --out tools/spades_web/external-ismcts-part2.json
node tools/spades_web/external-aggregate.mjs tools/spades_web/external-ismcts.json tools/spades_web/external-ismcts-part1.json tools/spades_web/external-ismcts-part2.json
```

The two frozen 50-pair runs can execute concurrently. Aggregation checks non-overlapping seed clusters, identical adapter/source/model hashes, and zero errors, invalid decisions, fallbacks, and censored games. It preserves per-shard latency percentiles rather than incorrectly averaging percentiles.

## Teacher policy and matched control

`--candidate play` evaluates the frozen public-observation card-ranking model, keeping normal learned bidding unchanged. `--candidate incumbent` explicitly selects the earlier heuristic card play, even after the deployed `chooseAction` has switched to the teacher policy. This distinction keeps an honest control available. The model checkpoint is `cd175bd4cb4fbb768ac003bed8d5c9c3da80a0b64e336c6bb06a1aed6d57e649`.

```powershell
node tools/spades_web/external-evaluate.mjs --candidate play --pairs 1000 --seed 95200000 --out tools/spades_web/external-play.json
node tools/spades_web/external-evaluate.mjs --candidate incumbent --pairs 1000 --seed 95200000 --out tools/spades_web/external-play-control.json
node tools/spades_web/external-paired.mjs tools/spades_web/external-play-control.json tools/spades_web/external-play.json tools/spades_web/external-play-paired.json
node tools/spades_web/external-evaluate.mjs --baseline ismcts --candidate play --pairs 100 --iterations 128 --seed 96200000 --out tools/spades_web/external-ismcts-play.json
node tools/spades_web/external-evaluate.mjs --baseline ismcts --candidate incumbent --pairs 100 --iterations 128 --seed 96200000 --out tools/spades_web/external-ismcts-play-control.json
node tools/spades_web/external-paired.mjs tools/spades_web/external-ismcts-play-control.json tools/spades_web/external-ismcts-play.json tools/spades_web/external-ismcts-play-paired.json
```

Keep the engine, adapter and checkpoints frozen while either side of a matched comparison runs. The pairing script rejects missing or duplicate seed clusters, different opponents/rules, incomplete games and nonzero adapter error counts. Individual report source hashes establish the exact tested code; a later integration change may alter the encompassing `ai.js` hash without changing the explicit legacy selectors.

The external teacher gate measured 38.10% wins against the released Trickster bot, versus 28.70% for the old policy on the same 2,000 matches. The paired improvement was +9.40 percentage points (95% interval +7.04 to +11.76), with final-score improvement +43.58 (interval +34.43 to +52.73). This supports replacing the earlier policy; it does not establish superiority over Trickster. The experimental nil bidder was rejected despite strong internal results because its matched external final-score margin regressed by 58.82 points. These are evidence for this project and test distribution, not a proof that imitation is the best training method for all trick-taking games.

The secondary 128-iteration adapted ISMCTS comparison completed 200 full matches per policy. The teacher won 50.0%, versus 47.5% for the matched control. Their paired difference was +2.5 percentage points (95% interval −5.43 to +10.43), with score change +9.96 (interval −19.71 to +39.63). This smaller independent-opponent sample is inconclusive; it does not establish a general strength gain beyond the Trickster benchmark. All completed external runs report zero illegal decisions, adapter replacement fallbacks, errors or censored matches.

The additional released [Loddyluo Spades-AI](https://github.com/loddyluo/Spades-AI) engine was inspected but not presented as a directly comparable strength result: its neural models and exact search optimize immediate −9 overtricks and ±50 nil, which differ from this game's cumulative bag penalty and ±100 nil. Changing the outer scorer does not fix the trained policy's objective. A fair comparison requires either retraining that system under common rules or explicitly reporting a cross-variant transfer experiment.

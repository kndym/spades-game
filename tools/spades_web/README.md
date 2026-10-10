# Browser-native Spades engine and reproducible AI

This is a new static browser implementation. The old C++/TypeScript code, ONNX files and checkpoints are preserved. No model downloads, Python service, GPU or paid API are required to play. The main thread renders cards; a module Web Worker chooses AI actions.

## Rules

Four players, opposite-seat partnerships, clockwise bidding/play, 52-card deck and 13 tricks. Follow suit when possible. Spades are trump and cannot be led before being broken unless the leader holds only spades. Contracts score +10 per bid trick when made, or -10 per bid trick when set; surplus tricks add one point and a bag. Every ten cumulative bags costs 100 points. Nil scores +100/-100. In this house variant, failed-nil tricks do not help the partnership contract but count as bags. No blind nil or card exchange. A higher-scoring partnership wins after reaching 500; a tie continues. Human players may bid nil; the current AI bids at least one.

## Architecture and information boundary

`engine.js` is authoritative deterministic state and rules. Card IDs are `suit * 13 + rank - 2`, with clubs, diamonds, hearts, spades in that order. `publicObservation` copies only the acting player's own hand, public scores/bids/tricks/card history, inferred void suits and opponent hand sizes. It never copies another hand or the deck seed. `ai-worker.js` accepts only this observation. Rule tests include action invariance when the actual hidden hands are exchanged.

Easy uses a documented hand-strength heuristic. Standard adds a learned hand-aware bidder. Expert uses the same bidder and 12 constrained hidden-deal samples per play. All candidate cards are compared on the same sampled worlds, followed by public-observation heuristic rollouts to hand end. Samples respect known played cards, hand sizes and public voids. This is determinization with a rollout policy, not equilibrium solving or an omniscient bot. It can suffer strategy fusion and the assumptions of its rollout opponent.

## Training

The 21-feature bidder uses intercept, suit counts, aces/kings/queens by suit, nontrump voids/singletons, excess trump length and quadratic trump length. It predicts tricks from 12,000 seeded heuristic self-play hands (48,000 player samples), using pivoted ridge least squares. An independent 1,200 paired-seed calibration set chooses one of nine bid offsets by partnership score difference. This small model intentionally replaces the old hand-blind neural bidding input; complexity is not evidence of strength.

All commands use one Node process and the same modules shipped to the browser:

```powershell
node --test tools/spades_web/engine.test.mjs
node tools/spades_web/train.mjs --hands 12000 --seed 20261010
node tools/spades_web/evaluate.mjs --pairs 3000 --seed 70400000
node tools/spades_web/evaluate.mjs --pairs 1000 --seed 70500000 --search --one-hand
```

Training and calibration seeds are disjoint from held-out evaluation seeds. Each evaluation seed is replayed with candidate and baseline teams swapped. Confidence intervals treat the pair as one cluster. `evaluation.json` tests learned bidding with shared heuristic play against heuristic bidding in complete 500-point matches. `evaluation-search.json` isolates search against Standard with the same learned bidding in single hands. Neither result is an Elo rating, human-strength estimate, comparison with the old app, or evidence against strong external Spades engines. The baseline is intentionally modest. Search timings measured in local Node are not phone latency guarantees.

The learned weights and calibration parameters are in `spades-web/bid-model.js`; raw compact reports are in this directory. `spades-web/ai-report.json` exposes the honest summary to users. Retraining deterministically overwrites only this new small bidder and its report, not any archived model.

## Old implementation audit

The original neural bidder's eight inputs contain scores, bags and previous bids but no own-hand cards. Old MCTS copies full state including opponents' hands into simulations; it does not establish an information boundary or sample possible hidden deals. The playing policy maps unordered hand features onto changing hand-position actions rather than fixed card IDs. The C++ expansion stores a child after an action while its rollout starts from the prior simulation state. The previous evaluation does not pair deals/seat assignments and its chained Elo is not externally calibrated. These issues motivated a clean implementation and observable tests, rather than importing old weights as evidence of a strong policy.


## Recorded results (2026-10-10)

Standard's learned bidder won 89.68% of 6,000 held-out 500-point matches against the documented heuristic bidder (3,000 paired seeds, pair-cluster 95% interval 88.94–90.42%). Both teams used identical heuristic play. Mean final score advantage was 140.76 points (interval 138.48–143.04). Every match finished; the longest took 21 hands. This measures the improvement over this modest bidding baseline, not general Spades strength.

Expert's public-information search won 53.80% of 2,000 held-out single hands against Standard (1,000 paired seeds, independent confirmation block 70500000, interval 52.58–55.02%). Both teams used the same learned bidder. Mean hand score advantage was 4.62 points (interval 2.51–6.73). This ablation starts hands from zero scores/bags; it does not establish a 500-point-match win rate for Expert. The earlier 200-pair pilot used a separate block and was not used for model calibration.

The recorded Expert evaluation took 302.46 seconds on one local Node process. Mean decision time over both teams' card plays was 2.90 milliseconds, including Standard's much cheaper turns; this is not an Expert-only or mobile latency claim. Training and the final Standard test took about 5.58 and 17.84 seconds respectively on this run, sharing the host with other tasks. Runtime measurements are informational, not a fixed performance guarantee.

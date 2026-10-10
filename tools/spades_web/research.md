# Stronger Spades AI: evidence and experiment plan

Research checked 2026-10-10. These are primary papers, released implementations, and the developers' own technical descriptions. A method working well in another card game does not establish that it is the best Spades training method.

## What strong opponents can actually be evaluated?

| Opponent / source | Evidence and availability | Comparison caveat |
| --- | --- | --- |
| [TricksterBots](https://github.com/TricksterCards/TricksterBots) | Released commercial-game bot implementation; the separate external-benchmark adapter owns the executable compatibility checks. | Pin source revision and rules. Released code is not proof of the strength of the current hosted service. |
| [AI Factory Spades](https://edpowley.com/academic/papers/aiide13.pdf) | Published Spades-specific work combines information-set MCTS with domain knowledge, including nil handling and search bias. Its comparison was against its own knowledge-based agents. | No public inference API or checkpoint was located. Do not claim to have tested this engine or beaten the strongest commercial bots. |
| [NeuralPlay Spades](https://www.neuralplay.com/spades_help.html) | Official help describes six levels; levels 4–6 evaluate legal plays over sampled unknown deals and rollouts. Level 6 uses the largest simulation budget. | Commercial app, no released batch-evaluation interface found. An automated paired-match result is not presently available. |
| [Loddyluo Spades-AI](https://github.com/loddyluo/Spades-AI) | Released research code and checkpoints: an early-game neural policy, a sampled exact endgame solver, and a learned bidder. A plausible stronger external research opponent, subject to a working adapter. | Its scoring immediately subtracts 9 per overtrick and uses nil ±50. Our game awards +1 overtrick, accumulates a 100-point penalty at 10 bags, and uses nil ±100. A pretrained policy transferred unchanged is a cross-rule baseline, not a fair same-task championship. |
| [Trickster's Table](https://playagame.app/tricksters-table/tech/) | Public technical description and linked Rust ISMCTS code. | Its listed games do **not** include Spades. Useful implementation reference, not an existing Spades opponent. |

Loddyluo's [accompanying paper](https://github.com/loddyluo/Spades-AI/blob/main/Towards%20Lightweight%20Human%20Level%20AI%20in%20Spades.pdf), sections 7.4 and 8, limits its human comparison to 23 manual games involving two experienced players. It explicitly does not establish statistically conclusive human-level strength. Its training recipe uses 30–32 CPU workers, and its reward shaping and scoring differ from ours. The README's “20 minutes” is not a runtime estimate for this PC. Its perfect-information DDS opponents are diagnostics, not deployable fair opponents; some published baseline comparisons expose hidden cards to those baselines. Its abandoned observation-generating Transformer branch is also a useful negative result: additional model complexity and search did not reliably beat its simpler heuristic.

## Methods with relevant evidence

[Bidding in Spades (ECAI 2020)](https://arxiv.org/abs/1912.11323) is unusually relevant to our immediate weakness. It evaluates bid utility, explicitly models nil risk, uses the player's hand and previous bids, and calibrates nil success with real gameplay. Its deployed scoring includes accumulated bags and nil ±100. The paper's recreational-human comparison is not a comparison with all commercial engines. This supports testing score-aware, context-aware bidding rather than merely rounding an expected trick count.

[Improving Search with Supervised Learning in Trick-Based Card Games (AAAI 2019)](https://arxiv.org/abs/1903.09604) improves Skat PIMC by learning likely card locations from human histories. It supports testing a better hidden-hand sampling distribution, rather than spending every additional millisecond on more uniformly sampled rollouts. Hard legality and public void constraints still have to hold. Its result does not establish the same improvement in Spades without a new experiment.

[DouZero (ICML 2021)](https://proceedings.mlr.press/v139/zha21a.html) demonstrates action-conditioned deep Monte Carlo value learning and parallel self-play in an imperfect-information game involving cooperation. Its reported leaderboard result used four GPUs over days. DouDizhu is a shedding game, not trick-taking: neither its weights nor its performance numbers transfer to Spades. Its simple observation/action/terminal-return recipe is nevertheless a useful engineering starting point.

[GO-MCTS (2024)](https://arxiv.org/abs/2404.13150) searches sequences of observations using a learned generative model and population self-play; experiments concern Hearts, Skat and The Crew. It addresses the information boundary more directly than pretending the sampled hidden world is the actual observed state. Model errors and invalid generated histories require careful validation; this is a research candidate rather than the first CPU prototype to ship.

[Neural Fictitious Self-Play](https://arxiv.org/abs/1603.01121) and [ReBeL](https://arxiv.org/abs/2007.13544) provide important imperfect-information foundations. Their equilibrium results and poker demonstrations do not automatically establish a scalable solution for four players with separate private observations, fixed partnerships, and finite-match score objectives. Treat the entire partnership as one omniscient player and the resulting policy cheats. A practical policy league can be useful without claiming those convergence guarantees.

## Recommended practical experiment sequence

These are project-specific recommendations, not claims from the papers.

1. Freeze the present bidder and play policy. Benchmark complete 500-point matches against a pinned external bot on identical rules, paired deals and swapped teams. Separately isolate bidding and play using a common partner/play policy. Include nil-containing hands, bag counts near 10, and end-of-match scores.
2. Train a small action-value bidder on **own hand, observed previous bids, bidding position, scores, bags and proposed bid**. Labels are the actual partnership score advantage from public-information rollouts. Counterfactual bids replay the identical deal and starting context so differences have much less deal noise. Hidden hands are allowed inside the training simulator to generate outcomes, but never as model inputs or bot observations. Begin with normal bids near the existing bid; do not introduce uncalibrated nil risk.
3. Extend the same observation/action value approach to card play. Use fixed card IDs and an explicit legal mask. Encode own hand, played cards with relative seats/trick order, current trick, inferred voids, bids, team tricks, bags and scores. Share the team reward; train against a mixture of archived policies and external/public baselines, not only the newest self-play opponent. Compare a compact MLP with a recurrent history encoder at the same actor budget before buying model complexity.
4. Add calibrated nil bidding after collecting examples under a nil-aware partner policy. Measure success probability and reliability by hand/score context, rather than assuming the current normal-bid training teaches nil. Select by actual match utility.
5. Distill a stronger public-information search into a fast policy for phone play, then retain search as an optional higher-latency mode. Late-game exact solving should optimize the real Spades score including bags and nil, not simply maximize tricks. A sampled exact solver remains determinization with strategy-fusion limitations, not an information-set equilibrium solver.
6. Fit a card-location belief model only after the training-data and held-out evaluation boundary is secure. Compare uniform/void-constrained samples with learned bidding/history likelihoods at a fixed total decision-time budget. Report illegal sample rate, effective sample size and fallback count.

## Evaluation and release gates

Use separate training, calibration/model-selection and untouched confirmation seeds. Evaluate every deal twice with the candidate partnership swapped; group uncertainty estimates by deal pair. Freeze each candidate before confirmation. A full-match win rate is the primary deployment outcome; per-hand point margin and nil success are diagnostic outcomes. Disclose truncated matches, all fallback actions, illegal actions, source/checkpoint hashes and search budgets. Report latency for candidate decisions alone, including median and 95th percentile, rather than an average diluted by a cheaper opponent.

Select a candidate only on calibration data. Require a positive independently confirmed match result against the frozen incumbent and no unexplained external-bot regression. If multiple checkpoints are screened on the confirmation set, that set is no longer untouched; use a fresh block. Keep failed experiments and their results. A perfect-information oracle is useful for debugging tactical mistakes but cannot serve as evidence of fair playing strength.

## Local compute boundary

Read-only hardware inspection found an Intel i5-12400 (6 physical cores, 12 logical), an AMD Radeon RX 6700 XT and Intel UHD 730. Installed PyTorch is `2.10.0+cpu`, and `torch.cuda.is_available()` is false. No `nvidia-smi` is installed. The WMI AdapterRAM value is truncated/inaccurate, so it is not a verified VRAM measurement.

For a compact bidder, start with CPU PyTorch and two compute threads; data generation and neural updates can be timed independently. Do not assume NVIDIA CUDA code runs on the AMD GPU. [Microsoft's DirectML guidance](https://learn.microsoft.com/en-us/windows/ai/directml/pytorch-windows) offers an alternative Windows GPU route, but compatibility and speed for this workload must be measured before changing this environment. The tiny deployed linear bidder cannot justify GPU overhead by itself. Larger recurrent self-play training may justify a supported GPU after actor throughput and learner time are measured.

## Completed action-value pilot: rejected for deployment

The isolated experimental bidder implements step 2 above with a 93-feature input and a 64/32-unit ReLU MLP. Features contain only own hand, public prior bids, relative bidding position, scores, bags, target, incumbent bid and proposed normal bid. Candidate actions are incumbent bid ±2, clipped to 1–13. It cannot bid nil. Training generates complete baseline matches and saves 6,000 correctly counted completed-hand contexts (including terminal match hands), with 105,491 counterfactual examples. Every alternative bid is replayed on the identical deal/context using the same frozen learned bidder for remaining bids and the same public-observation heuristic play. The target is hand-end team-minus-opponent score difference relative to the incumbent action, divided by 100. This includes the actual accumulated bag penalty, but is **one-hand value, not expected final-match victory**. Each context has only one sampled hidden world; no claim of a calibrated bid-conditional posterior is made.

Data generation took 25.39 seconds and training 6.87 seconds on this host with two PyTorch CPU threads. Calibration screened six conservatism penalties on 300 paired full matches each, starting at seed 82200000. The best selected penalty was 0.4; the unpenalized policy was much worse, winning only 36.67% of calibration matches. The checkpoint was frozen before the independent confirmation block at 83200000.

Confirmation used 1,500 paired seeds / **3,000 complete 500-point matches**, with the incumbent learned bidder on the other team and identical heuristic play. The candidate won **49.23%**, pair-cluster 95% interval **48.46–50.00%**. Final score advantage was **−2.20 points**, interval **−4.19 to −0.21**. It changed 1,436 of 60,168 candidate bids (2.39%); there were no incomplete matches and the longest match took 18 hands. Two dedicated tests pass for hidden-hand invariance and legal normal bids in all bidding positions.

**Release decision: reject.** Additional network complexity did not produce an independently confirmed improvement. The existing deployed bidder remains unchanged. The result supports improving the training signal (multiple conditional worlds, a policy league and actual match-return objectives) before assuming a larger network solves the problem. It does not falsify deep Monte Carlo learning generally, and it does not compare this rejected pilot with a commercial engine.

Frozen checkpoint SHA-256: `8526a14c67a34bb3ff6f89adf56c4da01643a9f4437ae53740955934d22352d9`. Scripts and compact reports are retained; the 41 MB generated intermediate dataset is disposable and regenerated deterministically:

```powershell
node tools/spades_web/value-data.mjs --hands 6000 --seed 81200000
python tools/spades_web/value-train.py
node tools/spades_web/value-evaluate.mjs --calibrate --pairs 300 --seed 82200000
node tools/spades_web/value-evaluate.mjs --pairs 1500 --seed 83200000
node --test tools/spades_web/value.test.mjs
```

Exact floating-point weights may differ across PyTorch/platform versions; the stored checkpoint is the evaluated artifact. Calibration does not silently promote this policy into `ai.js`.

## Completed conditional-world nil utility experiment

A second experiment addressed a missing action, rather than making the incumbent's existing normal bids more complex. It retains the frozen normal bidder and considers replacing its bid with nil. Training covers 4,000 complete-hand contexts / 16,000 bidding observations. For each observation, 32 possible deals preserve the acting player's own hand. Prior public normal bids receive a soft Gaussian likelihood under the frozen bidder (sigma 0.85); eight weighted worlds are resampled. The mean effective proposal count was 17.42. This is an approximate model-based belief distribution, **not** a calibrated human posterior or an exact rejection sampler. There are no rejection fallbacks.

On every matched world, normal and nil bids are separately rolled to hand end using the same remaining normal bidder and public-information heuristic play. Actual nil ±100, failed-nil contract treatment, accumulated bags and 100-point penalties are scored by the authoritative engine. The two targets are nil-minus-normal partnership score advantage and nil success frequency. A 102-feature, 64/32-hidden-unit CPU MLP uses only own cards, previous public bids, bidding position, current scores/bags/target and hand-derived rank/suit features. It does not receive sampled or actual opponent cards. Generation took 65.81 seconds; training took 3.69 seconds with two CPU threads.

The candidate declines nil when holding the ace of spades, and when any previous player has already bid nil, because those prior-nil contexts were absent from this training distribution. Its normal bid is unchanged. Six advantage thresholds were screened on a separate calibration block, selecting **20 points** before confirmation.

Independent confirmation at seed 88200000 used 1,500 paired deals / **3,000 full 500-point matches** against the frozen incumbent with the same heuristic card play. The nil candidate won **82.30%**, pair-cluster 95% interval **81.02–83.58%**. Final score advantage was **+135.83**, interval **+130.68 to +140.97**. It made 6,646 nil bids, succeeding in 5,552 (**83.54%**); its average predicted success was 84.66%. This aggregate proximity does not establish calibration in every subgroup or against different opponents. No matches were incomplete; the longest took 19 hands. Dedicated privacy and legal/unsupported-context masking tests both pass.

Frozen checkpoint SHA-256: `b65355f9757691e5eb9120ca39904902fa73113cbd44f458dba55b8ab9ca006e`. These results identify omission of nil as a major weakness against the previous internal opponent. They do not demonstrate that this training method is best across trick-taking games, nor that the candidate is stronger than commercial Spades engines.

**External release gate failed: do not deploy.** Both nil candidate and incumbent were independently evaluated against the actual released Trickster bot on the exact same 1,000 paired deal seeds at 89200000 (2,000 matches per candidate). The paired candidate-minus-incumbent win-rate change was −0.05 percentage points, interval −2.35 to +2.25; its score-margin change was **−58.82 points**, interval **−68.88 to −48.76**. Internal self-play improvement did not generalize to the stronger opponent. This is direct evidence that the weak-rollout training distribution produced an unsafe promotion candidate. Retain the experiment, strengthen the opponent/teacher league, and keep the nil experiment out of the deployed AI.

```powershell
node tools/spades_web/nil-data.mjs --hands 4000 --worlds 8 --proposals 32 --seed 86200000
python tools/spades_web/nil-train.py
node tools/spades_web/nil-evaluate.mjs --calibrate --pairs 300 --seed 87200000
node tools/spades_web/nil-evaluate.mjs --pairs 1500 --seed 88200000
node --test tools/spades_web/nil.test.mjs
```

## Strong-teacher card-play distillation

The nil experiment's failure motivated a stronger training distribution. A third candidate learns to rank **legal card actions** from the actual released Trickster Spades bot, rather than learning returns only against our weak heuristic. The pinned teacher source is `3abca057bff801eca00d2d20839c3407db96ebb2`; adapter version 2 has SHA-256 `532af39ff4f80417949b070c67cf914bc7870749b1b9b6f2ab5b06c66659915c`. The MIT-licensed teacher remains an external training/evaluation tool, and its source is not copied into the browser policy.

Collection uses 4,000 completed hands and 163,551 decisions having multiple legal choices. One third of hands are teacher self-play; the others combine our frozen normal bidding and a teacher/heuristic card-play mixture against the teacher. The teacher is also queried at the heuristic's off-policy states, so the student sees mistakes outside ideal teacher trajectories. All requests contain only the acting player's own hand, public history and legal cards. Actual other hands never cross the subprocess boundary.

Each training group consists of the teacher's chosen legal card and up to three sampled legal alternatives. A shared scalar action ranker has 183 inputs: own-card and publicly played-card bitmaps, relative public voids/bids/trick counts/current trick, scores/bags, and candidate rank/suit/winner/master/contract-related features. It has 64/32 ReLU hidden units. Illegal cards are excluded at inference. Cross entropy trains the chosen action above its sampled alternatives. The 90.37% final training agreement refers to these sampled training groups, **not** agreement over all legal actions on held-out games.

Collection took 59.63 seconds; 12 fixed training epochs took 23.36 seconds on two CPU threads. A 479 MB intermediate binary matrix was read sequentially in memory-mapped 512-group batches, without constructing a full dataset tensor; the generated dataset was removed after its hash was saved. The frozen model is 301 KB of JSON and runs locally in JavaScript. Two tests verify hidden-hand invariance and legal finite-feature play across normal and nil hands.

On the separate calibration block at 93200000, the student won 56.0% of 600 complete matches against incumbent heuristic play with identical learned normal bidding (pair-cluster interval 52.73–59.27%). Score advantage was +24.42 (13.22–35.62). Candidate-only card latency in Node averaged 0.128 ms, with 0.343 ms at the 95th percentile. This is a local runtime observation, not a phone latency guarantee.

Independent confirmation at 94200000 used 1,500 paired seeds / **3,000 full 500-point matches**. The frozen student won **54.00%**, interval **52.51–55.49%**, with final score advantage **+19.03**, interval **+13.93 to +24.12**. There were no incomplete matches; the longest took 20 hands. Candidate-only card latency averaged 0.225 ms, median 0.172 ms, and 95th percentile 0.686 ms. Total evaluation took 188.39 seconds while other work shared the host, so this timing is not a fixed performance promise.

Checkpoint SHA-256: `cd175bd4cb4fbb768ac003bed8d5c9c3da80a0b64e336c6bb06a1aed6d57e649`. **The incumbent release gate passes; the external gate is pending.** The experiment is supervised distillation from a stronger teacher, not self-play reinforcement learning or a new equilibrium solver.

```powershell
node tools/spades_web/play-data.mjs --hands 4000 --seed 92200000
python tools/spades_web/play-train.py
node tools/spades_web/play-evaluate.mjs --pairs 300 --seed 93200000
node tools/spades_web/play-evaluate.mjs --pairs 1500 --seed 94200000
node --test tools/spades_web/play-policy.test.mjs
```


The frozen teacher student passed its matched external release gate: 38.10% wins against the actual Trickster bot over 2,000 full matches, compared with 28.70% for original Standard on the exact same deals. Paired gain +9.40 percentage points (95% interval +7.04 to +11.76); final score margin improvement +43.58 (34.43 to 52.73). The teacher remains stronger. This measured gain supports using the student in Standard, while the learned nil and normal-bid pilots remain rejected. A second adapted search comparison is reported separately in the evaluation report.


The independent adapted ISMCTS128 comparison used 100 paired deals / 200 full matches per policy on fresh seed 96200000. Current Standard won 50.0% (43.62–56.38%), original Standard 47.5% (41.53–53.47%). Paired win-rate change +2.5 percentage points (−5.43 to +10.43); score-margin change +9.96 (−19.71 to +39.63). This is inconclusive, so no generalization gain is claimed. All matches completed with zero errors, illegal decisions, adapter replacement fallbacks or censorship. Source/model hashes remained frozen; raw per-seed outcomes and the paired calculation are saved.

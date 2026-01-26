# Spades Bot Two-Agent Workflow (Browser-Only)

This doc implements the two-agent plan for an in-browser, self-play spades bot
that can run on a GitHub Pages Jekyll al-folio site. It includes the idea
template, metrics schema, wasm API mapping to the current C++ codebase, Jekyll
integration notes, and final prompts for both agents.

## 1) Idea Agent Template (3 ideas per round)

Each proposal must be detailed and self-contained. Provide exactly 3 ideas,
clearly labeled with stable IDs so the test agent can reference them.

Use this structure for each idea:

- IdeaID: `IDEA_A` / `IDEA_B` / `IDEA_C`
- Name:
- ApproachType: (rule-based, search, imitation, RL, hybrid)
- CoreAlgorithm:
- StateRepresentation:
  - Required: teams scores/bags, bids/tricks, hand/trick, spadesBroken
  - Optional: trick history encoding, inferred void suits
- ActionSpace:
  - Bidding: 0-13
  - Play: hand-index of valid moves (see `GameLogic::getValidMoves`)
- SelfPlayLoop:
  - How rollouts or policy improvement happens
  - Exploration strategy
  - Any curriculum or phased training
- EvaluationPlan:
  - Baseline bot (RandomBot or current heuristic bot)
  - Number of games, fixed seeds
  - Metrics to report (see schema below)
- ExpectedStrengths:
- ExpectedWeaknesses:
- wasmNotes:
  - Complexity and browser feasibility
  - Any precomputation needed

## 2) Metrics Report Schema (test agent output)

All results should be machine-readable and compact. Use this exact block:

RESULT
idea_id: IDEA_A
build: wasm
eval:
  games: 200
  seed: 12345
  baseline: RandomBot
metrics:
  win_rate: 0.57
  avg_score_diff: 18.4
  avg_tricks: 7.1
  avg_move_ms: 1.6
notes:
  issues: none
  next_steps: increase sims from 50 to 200

## 3) wasm-Friendly API Mapping

The current C++ core already exposes clean entry points:

- `GameLogic::initializeDeck`
- `GameLogic::shuffleDeck`
- `GameLogic::dealCards`
- `GameLogic::getValidMoves`
- `GameLogic::applyMove`
- `GameLogic::applyBid`
- `GameLogic::isRoundOver`
- `GameLogic::resetForNewRound`

Suggested wasm bridge (C++ wrapper layer):

- `init_game(seed)`:
  - Calls `resetForNewRound`, `initializeDeck`, `shuffleDeck`, `dealCards`
  - Sets a deterministic RNG seed for browser reproducibility
- `get_state(out_ptr)`:
  - Serializes `GameState` into a flat buffer for JS
  - Include:
    - scores/bags
    - currentPlayerIndex, trickLeaderIndex, bidsMade
    - spadesBroken
    - per-player bids/tricks
    - currentTrick cards
    - current player hand cards
- `get_valid_moves(out_ptr)`:
  - Calls `GameLogic::getValidMoves` (hand indices)
- `apply_bid(bid)`:
  - Calls `GameLogic::applyBid`
- `apply_move(hand_index)`:
  - Calls `GameLogic::applyMove`
- `is_round_over()` and `is_game_over()`

Card encoding for serialization:

- Suit: 0..3, Rank: 0..12 (matches `SpadesTypes.hpp`)
- Card -> int: `suit * 13 + rank`

Notes:

- `getValidMoves` uses indices in the current player's hand. That means JS must
  render and select by hand index, not by card id, unless the hand is mirrored.
- For deterministic evaluation in the browser, replace `std::random_device`
  with a seeded `std::mt19937` or make a `set_seed(uint32_t)` bridge.

## 4) Jekyll al-folio integration (browser-only)

Expected artifact layout in repo (example):

- `assets/spades/`:
  - `spades.js`
  - `spades.wasm`
  - `spades.data` (if needed by Emscripten)
- `pages/spades-bot.md` (or `_pages/spades-bot.md` depending on site layout)

Minimal Jekyll page content (conceptual):

- Load wasm JS bundle
- Provide UI controls:
  - Start game
  - Step/bot move
  - Auto-play N tricks
  - Reset with seed
- Render state summary:
  - Current trick, scores/bags, bids, hand

If this repo does not yet have al-folio structure:

- Add a simple Jekyll page and link it from the site navigation.
- Keep wasm assets under `assets/` so GitHub Pages serves them.

## 5) Free backend options (if you later decide to allow it)

No backend is required, but if you later want server-side training or
evaluation, these are free/no-subscription options:

- Cloudflare Workers (free tier):
  - Lightweight API endpoints, no server maintenance
  - Great for small evaluation jobs or storing metrics
- Netlify Functions / Vercel Functions (free tiers):
  - Simple REST endpoints, good for metrics collection
  - Easy GitHub integration
- Fly.io / Render free tier:
  - Small containerized service if you need a persistent process
  - Use for heavier evaluation jobs

All of these can be triggered from the Jekyll front-end with fetch() if needed.

## 6) Final prompts for both agents

### Prompt for Idea Agent

You are the **Idea Agent** for a spades self-play bot. Provide **exactly 3**
distinct algorithm ideas per round. Each idea must be detailed and follow this
template:

IdeaID:
Name:
ApproachType:
CoreAlgorithm:
StateRepresentation:
ActionSpace:
SelfPlayLoop:
EvaluationPlan:
ExpectedStrengths:
ExpectedWeaknesses:
wasmNotes:

Constraints:
- Browser-only deployment (no backend).
- Must run on a GitHub Pages Jekyll al-folio site.
- Use the existing C++ game core (GameLogic/GameState/IBot).
- Use deterministic seeds for evaluation.
- Ideas should be meaningfully different from each other.

Output only the 3 ideas in order (IDEA_A, IDEA_B, IDEA_C).

### Prompt for Test Agent

You are the **Test Agent**. For each round, implement one of the idea proposals
in C++ and wire it to a wasm-friendly API. Use minimal changes required for
evaluation. Then run a fixed evaluation harness in-browser and report metrics
in the exact schema below.

Constraints:
- Browser-only deployment (no backend).
- Prefer deterministic behavior with fixed RNG seed.
- Use `GameLogic::getValidMoves` and hand indices.
- Evaluate vs the baseline bot (RandomBot or current heuristic).
- Report metrics only, no narrative.

Use this output format:

RESULT
idea_id: IDEA_X
build: wasm
eval:
  games: N
  seed: SEED
  baseline: RandomBot
metrics:
  win_rate: W
  avg_score_diff: D
  avg_tricks: T
  avg_move_ms: M
notes:
  issues: ...
  next_steps: ...

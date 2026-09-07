# Spades AI: A Deep Dive into the Mathematics

This document explains the mathematical and statistical foundations behind the Spades AI bot, designed for readers interested in game theory, machine learning, and decision-making algorithms.

---

## Overview

The Spades bot combines two powerful AI techniques:

1. **Monte Carlo Tree Search (MCTS)** - A probabilistic search algorithm for decision-making
2. **Neural Networks** - Deep learning models that guide the search and evaluate positions

This hybrid approach, popularized by DeepMind's AlphaGo and AlphaZero, allows the bot to play strategically without hand-coded rules.

---

## 1. Monte Carlo Tree Search (MCTS)

### The Core Idea

MCTS addresses the fundamental challenge in game AI: the game tree is too large to search exhaustively. With 52 cards, 4 players, and complex bidding/playing phases, Spades has approximately 10^20 possible game states.

Instead of exploring everything, MCTS uses **random sampling** to focus computational effort on the most promising moves.

### The Four Phases

Each MCTS iteration consists of four phases:

```
┌─────────────────────────────────────────────────────────────────┐
│  1. SELECTION    →  2. EXPANSION  →  3. SIMULATION  →  4. BACKPROP  │
│                                                                 │
│  Navigate tree      Add new         Random          Update       │
│  using UCB1         child node      rollout         statistics   │
└─────────────────────────────────────────────────────────────────┘
```

#### Phase 1: Selection

Starting from the root (current game state), we traverse the tree by selecting child nodes that maximize the **Upper Confidence Bound (UCB1)** formula:

$$
\text{UCB1}(s, a) = \underbrace{\frac{Q(s, a)}{N(s, a)}}_{\text{exploitation}} + \underbrace{c \cdot \sqrt{\frac{\ln N(s)}{N(s, a)}}}_{\text{exploration}}
$$

Where:
- $Q(s, a)$ = Total value accumulated for action $a$ in state $s$
- $N(s, a)$ = Number of times action $a$ was selected in state $s$
- $N(s)$ = Total visits to state $s$
- $c$ = Exploration constant (we use $c = \sqrt{2} \approx 1.41$)

**Intuition**: The first term favors moves that have worked well (exploitation). The second term favors moves that haven't been tried much (exploration). The balance ensures we don't miss good moves.

#### Phase 2: Expansion

When we reach a node that hasn't been fully explored, we add a new child node representing an untried action.

#### Phase 3: Simulation (Rollout)

From the new node, we simulate the rest of the game using a fast heuristic policy:

- **Bidding**: Count high spades (Q, K, A) and off-suit aces
- **Playing**: Play the lowest valid card (conservative strategy)

This gives us a game outcome without expensive computation.

#### Phase 4: Backpropagation

The simulation result propagates back up the tree:

$$
Q(s, a) \leftarrow Q(s, a) + v
$$
$$
N(s, a) \leftarrow N(s, a) + 1
$$

Where $v$ is the value from the simulation (win probability).

### Convergence Properties

A key theorem of MCTS: as iterations $\to \infty$, the algorithm converges to the **minimax optimal strategy**. In practice, even 30-150 iterations per move produce strong play.

---

## 2. Neural Network Guidance (PUCT)

Pure MCTS treats all unexplored moves equally. We enhance it with neural networks using **Predictor Upper Confidence Trees (PUCT)**:

$$
\text{PUCT}(s, a) = \frac{Q(s, a)}{N(s, a)} + c \cdot P(a|s) \cdot \frac{\sqrt{N(s)}}{1 + N(s, a)}
$$

Where $P(a|s)$ is the **prior probability** from a neural network, representing how likely a strong player would choose action $a$.

This focuses search on moves the neural network considers promising, dramatically improving efficiency.

---

## 3. The Three Neural Networks

### NN1: Bidding Policy Network

**Purpose**: Predict the optimal bid (0-13) given the current game state.

**Architecture**:
```
Input Layer:  8 features
Hidden:       64 → 64 → 64 (ReLU activation)
Output:       14 probabilities (softmax)
```

**Input Features**:
| Feature | Description |
|---------|-------------|
| team1_score | Your team's current score |
| team2_score | Opponent's current score |
| team1_bags | Your team's bag count |
| team2_bags | Opponent's bag count |
| bid_0..bid_3 | Previous bids (-1 if not yet made) |

**Training Objective**: Cross-entropy loss against the bid that led to winning games.

### NN2: Playing Policy Network

**Purpose**: Predict which card to play from the current hand.

**Architecture**:
```
Input Layer:  326 features
Hidden:       384 → 384 → 256 (ReLU activation)
Output:       52 probabilities (one per possible card)
```

**Input Features (326 total)**:

| Category | Count | Description |
|----------|-------|-------------|
| Game state | 4 | Scores and bags |
| Bids | 4 | Each player's bid |
| Hand encoding | 52 | One-hot: which cards you hold |
| Current trick | 52 | One-hot: cards played this trick |
| Tricks won | 4 | Count per player |
| Spades broken | 1 | Boolean flag |
| Current player | 1 | Player index (0-3) |
| **Card memory** | **208** | **Which cards each player has played** |

The **card memory** (4 players × 52 cards = 208 features) enables **card counting** - the network learns to track what cards are still in play.

### NN3: Value Network

**Purpose**: Estimate the probability of winning from the current game state.

**Architecture**:
```
Input Layer:  4 features
Hidden:       4 (Softplus activation)
Output:       1 (Sigmoid → probability)
```

**Input Features**:
| Feature | Description |
|---------|-------------|
| total_points | Sum of both team's scores |
| point_differential | Your score - opponent's score |
| team_bags | Your bag count |
| other_bags | Opponent's bag count |

**Input Normalization**: Features are scaled by [1000, 100, 10, 10] respectively.

**Training Objective**: Binary cross-entropy against actual game outcomes.

---

## 4. Self-Play Reinforcement Learning

### The Training Loop

```
┌─────────────────────────────────────────────────────────────────┐
│                     Self-Play Training Loop                     │
│                                                                 │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌────────┐ │
│  │ Self-Play│ --> │ Collect  │ --> │  Train   │ --> │Evaluate│ │
│  │  Games   │     │  Data    │     │ Networks │     │vs Base │ │
│  └──────────┘     └──────────┘     └──────────┘     └────────┘ │
│       ↑                                                  │      │
│       └──────────── If win_rate ≥ 55%, promote ─────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

1. **Self-Play**: The current best model plays games against itself
2. **Data Collection**: Record (state, action, outcome) tuples
3. **Training**: Update neural networks via supervised learning
4. **Evaluation**: Compare candidate model vs baseline
5. **Promotion**: If candidate wins ≥55% of games, it becomes the new baseline

### Why Self-Play Works

Self-play creates a **curriculum**: as the bot improves, it faces stronger opponents (itself), continuously pushing the difficulty level. This avoids:
- The need for human expert data
- Getting stuck exploiting weak opponent patterns
- Manual difficulty tuning

---

## 5. ELO Rating System

We measure bot strength using the **ELO rating system** (from chess):

$$
E_A = \frac{1}{1 + 10^{(R_B - R_A)/400}}
$$

Where:
- $E_A$ = Expected win probability for player A
- $R_A, R_B$ = Ratings of players A and B

After a game, ratings update:

$$
R'_A = R_A + K(S_A - E_A)
$$

Where:
- $K$ = Update factor (typically 32)
- $S_A$ = Actual score (1 for win, 0 for loss, 0.5 for draw)

### Observed Training Progression

| Training Time | Approximate ELO | Skill Level |
|---------------|-----------------|-------------|
| 0 min (start) | 1000 | Random play |
| 30 min | 1400-1600 | Beats random consistently |
| 60 min | 1700-1900 | Strategic bidding |
| 90 min | 1800-2100 | Card counting, team play |
| Ceiling | ~2200-2500 | Near-optimal with 150 sims |

---

## 6. The Exploration-Exploitation Tradeoff

A central theme in this AI is balancing:

- **Exploration**: Try new moves to discover better strategies
- **Exploitation**: Use known good moves to maximize wins

This tradeoff appears at multiple levels:

| Level | Exploration | Exploitation |
|-------|-------------|--------------|
| MCTS Search | UCB1 exploration term | UCB1 mean value term |
| Training | New candidate models | Keep proven baseline |
| Bidding | Try risky nil bids | Stick to safe bids |
| Playing | Trump with spades | Follow suit conservatively |

---

## 7. Computational Complexity

### Per-Move Analysis

| Component | Operations | Browser Feasibility |
|-----------|------------|---------------------|
| MCTS (30 sims) | ~30 × (game simulation) | ✓ Fast |
| MCTS (150 sims) | ~150 × (game simulation) | ✓ Acceptable |
| NN1 inference | ~8K multiply-adds | ✓ Instant |
| NN2 inference | ~300K multiply-adds | ✓ Fast |
| NN3 inference | ~32 multiply-adds | ✓ Instant |

### State Space Analysis

- **Cards in deck**: 52
- **Players**: 4
- **Cards per hand**: 13
- **Possible deals**: $\binom{52}{13} \times \binom{39}{13} \times \binom{26}{13} \approx 5 \times 10^{28}$
- **Game tree depth**: 13 tricks × 4 plays = 52 plies

This enormous state space is why we need MCTS rather than exhaustive search.

---

## 8. Key Mathematical Insights

### Why MCTS + Neural Networks Works

1. **Dimensionality Reduction**: Neural networks compress the 326-dimensional state into meaningful policy/value estimates
2. **Generalization**: Networks learn patterns that transfer across similar positions
3. **Anytime Property**: MCTS can be stopped at any time and return the current best move
4. **Self-Correction**: Backpropagation fixes initially wrong value estimates

### The Power of Card Memory

Adding the 208 card-tracking features improved win rate by ~15%:

- **Before**: Bot couldn't remember what cards were played
- **After**: Bot can deduce what cards opponents might hold
- **Example**: If all clubs except the Ace are played, the bot knows someone has the Ace

---

## 9. Limitations and Future Directions

### Current Limitations

- **No bluffing model**: Can't represent opponent psychology
- **Imperfect information**: Doesn't explicitly model opponent hands
- **Fixed partners**: Assumes cooperative play with partner

### Potential Improvements

1. **Information Set MCTS**: Model uncertainty about opponent hands
2. **Opponent Modeling**: Predict opponent tendencies
3. **Deeper Networks**: More capacity for complex patterns
4. **Attention Mechanisms**: Focus on relevant cards/players

---

## References

1. Browne, C., et al. (2012). "A Survey of Monte Carlo Tree Search Methods"
2. Silver, D., et al. (2016). "Mastering the Game of Go with Deep Neural Networks and Tree Search"
3. Rosin, C. D. (2011). "Multi-armed Bandits with Episode Context"
4. ELO, A. (1978). "The Rating of Chessplayers, Past and Present"

---

*This AI was built as a personal project exploring the intersection of classical game theory and modern deep learning. Play against it at [spades-game-v2.vercel.app](https://spades-game-v2.vercel.app).*

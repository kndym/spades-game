import { GameState, Card, Player, Suit, Rank, cardToIndex } from './types';
import { GameLogic } from './GameLogic';
import { ModelManager } from './ONNXModel';

/**
 * MCTS Node for tree search
 */
class MCTSNode {
  state: GameState;
  parent: MCTSNode | null;
  children: MCTSNode[];
  visitCount: number;
  valueSum: number;
  actionIdx: number;
  isBiddingNode: boolean;
  priorProbabilities: number[];

  constructor(
    state: GameState,
    parent: MCTSNode | null,
    action: number,
    isBidding: boolean,
    priors: number[] = []
  ) {
    this.state = state;
    this.parent = parent;
    this.children = [];
    this.visitCount = 0;
    this.valueSum = 0;
    this.actionIdx = action;
    this.isBiddingNode = isBidding;
    this.priorProbabilities = priors;
  }

  isFullyExpanded(currentState: GameState): boolean {
    if (this.isBiddingNode) {
      return this.children.length === 14; // 0-13 bids
    } else {
      return this.children.length === GameLogic.getValidMoves(currentState).length;
    }
  }

  getUCB1Score(explorationConstant: number): number {
    if (this.visitCount === 0) {
      // Prioritize unvisited nodes, biased by prior
      if (this.priorProbabilities.length > 0 && this.actionIdx >= 0 && this.actionIdx < this.priorProbabilities.length) {
        return Number.MAX_VALUE * (this.priorProbabilities[this.actionIdx] + 1e-6);
      }
      return Number.MAX_VALUE;
    }

    const exploitationTerm = this.valueSum / this.visitCount;
    let explorationTerm = explorationConstant * Math.sqrt(Math.log(this.parent!.visitCount) / this.visitCount);

    // PUCT: scale by prior probability
    if (this.priorProbabilities.length > 0 && this.actionIdx >= 0 && this.actionIdx < this.priorProbabilities.length) {
      explorationTerm *= this.priorProbabilities[this.actionIdx];
    }

    return exploitationTerm + explorationTerm;
  }

  selectBestChild(explorationConstant: number): MCTSNode {
    if (this.children.length === 0) {
      throw new Error('Attempted to select child from node with no children');
    }

    let bestChild = this.children[0];
    let bestScore = bestChild.getUCB1Score(explorationConstant);

    for (let i = 1; i < this.children.length; i++) {
      const score = this.children[i].getUCB1Score(explorationConstant);
      if (score > bestScore) {
        bestScore = score;
        bestChild = this.children[i];
      }
    }

    return bestChild;
  }
}

/**
 * Convert game state to NN3 features (win probability)
 */
function stateToNN3Features(state: GameState, perspectivePlayerIdx: number): Float32Array {
  const perspectiveTeamId = perspectivePlayerIdx % 2;
  const teamScore = perspectiveTeamId === 0 ? state.team1Score : state.team2Score;
  const otherTeamScore = perspectiveTeamId === 1 ? state.team1Score : state.team2Score;
  const teamBags = perspectiveTeamId === 0 ? state.team1Bags : state.team2Bags;
  const otherTeamBags = perspectiveTeamId === 1 ? state.team1Bags : state.team2Bags;

  return new Float32Array([teamScore + otherTeamScore, teamScore - otherTeamScore, teamBags, otherTeamBags]);
}

/**
 * Convert game state to NN1 features (bidding)
 */
function stateToNN1Features(state: GameState): Float32Array {
  const features: number[] = [];
  
  features.push(state.team1Score);
  features.push(state.team2Score);
  features.push(state.team1Bags);
  features.push(state.team2Bags);
  
  for (let i = 0; i < 4; i++) {
    features.push(i < state.bidsMade ? state.players[i].bid : -1);
  }

  return new Float32Array(features);
}

/**
 * Convert game state to NN2 features (playing) - 326 features
 */
function stateToNN2Features(state: GameState): Float32Array {
  const features: number[] = [];

  // Team scores and bags (4)
  features.push(state.team1Score);
  features.push(state.team2Score);
  features.push(state.team1Bags);
  features.push(state.team2Bags);

  // Player bids (4)
  for (let i = 0; i < 4; i++) {
    features.push(state.players[i].bid);
  }

  // Cards in hand - 52-bit one-hot (52)
  const handEncoding = new Array(52).fill(0);
  for (const card of state.players[state.currentPlayerIndex].hand) {
    handEncoding[cardToIndex(card)] = 1;
  }
  features.push(...handEncoding);

  // Cards in current trick - 52-bit one-hot (52)
  const trickEncoding = new Array(52).fill(0);
  for (const card of state.currentTrick) {
    trickEncoding[cardToIndex(card)] = 1;
  }
  features.push(...trickEncoding);

  // Tricks won by each player (4)
  for (let i = 0; i < 4; i++) {
    features.push(state.players[i].tricksWon);
  }

  // Spades broken flag (1)
  features.push(state.spadesBroken ? 1 : 0);

  // Current player index (1)
  features.push(state.currentPlayerIndex);

  // Card tracking: which cards each player has played (4 * 52 = 208)
  for (let player = 0; player < 4; player++) {
    for (let card = 0; card < 52; card++) {
      features.push(state.playedCards[player][card] ? 1 : 0);
    }
  }

  return new Float32Array(features);
}

/**
 * Simple heuristic bot for rollouts (faster than full MCTS)
 */
class RolloutBot {
  getBid(player: Player, state: GameState): number {
    let potentialTricks = 0;
    for (const card of player.hand) {
      if (card.suit === Suit.SPADES && card.rank >= Rank.QUEEN) potentialTricks++;
      else if (card.suit !== Suit.SPADES && card.rank === Rank.ACE) potentialTricks++;
      else if (card.suit !== Suit.SPADES && card.rank === Rank.KING && player.hand.length < 5) potentialTricks++;
    }
    return Math.max(1, potentialTricks);
  }

  getMove(state: GameState, validMoves: number[]): number {
    if (validMoves.length === 0) return 0;
    if (validMoves.length === 1) return validMoves[0];

    const hand = state.players[state.currentPlayerIndex].hand;

    // Simple heuristic: play lowest valid card when following, highest when leading if we need tricks
    if (state.currentTrick.length === 0) {
      // Leading - play lowest non-spade if possible
      let lowestNonSpade = -1;
      let lowestNonSpadeRank = Rank.ACE + 1;
      
      for (const moveIdx of validMoves) {
        const card = hand[moveIdx];
        if (card.suit !== Suit.SPADES && card.rank < lowestNonSpadeRank) {
          lowestNonSpadeRank = card.rank;
          lowestNonSpade = moveIdx;
        }
      }
      
      if (lowestNonSpade !== -1) return lowestNonSpade;
    }

    // Default: play the lowest valid card
    let lowestMove = validMoves[0];
    let lowestRank = hand[lowestMove].rank;
    
    for (const moveIdx of validMoves) {
      if (hand[moveIdx].rank < lowestRank) {
        lowestRank = hand[moveIdx].rank;
        lowestMove = moveIdx;
      }
    }
    
    return lowestMove;
  }
}

/**
 * MCTS Bot with neural network guidance
 */
export class MCTSBot {
  private simulationsPerMove: number;
  private modelManager: ModelManager | null;
  private rolloutBot: RolloutBot;

  constructor(simulationsPerMove: number = 30, modelManager: ModelManager | null = null) {
    this.simulationsPerMove = simulationsPerMove;
    this.modelManager = modelManager;
    this.rolloutBot = new RolloutBot();
  }

  /**
   * Run MCTS and return the root node
   */
  private async runMCTS(rootState: GameState, isBidding: boolean): Promise<MCTSNode> {
    const root = new MCTSNode(GameLogic.cloneState(rootState), null, -1, isBidding);

    // Get policy priors from neural networks
    if (isBidding && this.modelManager?.nn1.loaded) {
      const nn1Features = stateToNN1Features(rootState);
      root.priorProbabilities = Array.from(
        await this.modelManager.nn1.predict(nn1Features, [1, nn1Features.length])
      );
    } else if (!isBidding && this.modelManager?.nn2.loaded) {
      const nn2Features = stateToNN2Features(rootState);
      const rawOutput = await this.modelManager.nn2.predict(nn2Features, [1, nn2Features.length]);
      
      // Mask and normalize for valid moves
      const validMoves = GameLogic.getValidMoves(rootState);
      const priors = new Array(rawOutput.length).fill(0);
      let sumValidProbs = 0;

      for (const moveIdx of validMoves) {
        if (moveIdx < rawOutput.length) {
          priors[moveIdx] = rawOutput[moveIdx];
          sumValidProbs += rawOutput[moveIdx];
        }
      }

      // Normalize
      if (sumValidProbs > 0) {
        for (const moveIdx of validMoves) {
          if (moveIdx < priors.length) {
            priors[moveIdx] /= sumValidProbs;
          }
        }
      } else {
        // Uniform fallback
        for (const moveIdx of validMoves) {
          if (moveIdx < priors.length) {
            priors[moveIdx] = 1 / validMoves.length;
          }
        }
      }

      root.priorProbabilities = priors;
    }

    // Run simulations
    for (let i = 0; i < this.simulationsPerMove; i++) {
      let currentNode = root;
      let simState = GameLogic.cloneState(rootState);

      // 1. SELECTION
      while (!GameLogic.isRoundOver(simState) && currentNode.isFullyExpanded(simState)) {
        currentNode = currentNode.selectBestChild(1.41);
        if (currentNode.isBiddingNode) {
          GameLogic.applyBid(simState, currentNode.actionIdx);
        } else {
          GameLogic.applyMove(simState, currentNode.actionIdx);
        }
      }

      // 2. EXPANSION
      if (!GameLogic.isRoundOver(simState) && !currentNode.isFullyExpanded(simState)) {
        let moveToExpand = -1;

        if (currentNode.isBiddingNode) {
          for (let bid = 0; bid <= 13; bid++) {
            const alreadyExpanded = currentNode.children.some(c => c.actionIdx === bid);
            if (!alreadyExpanded) {
              moveToExpand = bid;
              break;
            }
          }
        } else {
          const validMoves = GameLogic.getValidMoves(simState);
          for (const moveIdx of validMoves) {
            const alreadyExpanded = currentNode.children.some(c => c.actionIdx === moveIdx);
            if (!alreadyExpanded) {
              moveToExpand = moveIdx;
              break;
            }
          }
        }

        if (moveToExpand !== -1) {
          const nextState = GameLogic.cloneState(simState);
          if (currentNode.isBiddingNode) {
            GameLogic.applyBid(nextState, moveToExpand);
          } else {
            GameLogic.applyMove(nextState, moveToExpand);
          }

          const childNode = new MCTSNode(nextState, currentNode, moveToExpand, isBidding);
          currentNode.children.push(childNode);
          currentNode = childNode;
          simState = GameLogic.cloneState(nextState);
        }
      }

      // 3. ROLLOUT (with simple heuristic bot)
      while (!GameLogic.isGameOver(simState) && !GameLogic.isRoundOver(simState)) {
        if (simState.bidsMade < 4) {
          const bid = this.rolloutBot.getBid(simState.players[simState.currentPlayerIndex], simState);
          GameLogic.applyBid(simState, bid);
        } else {
          const validMoves = GameLogic.getValidMoves(simState);
          if (validMoves.length === 0) break;
          const moveIdx = this.rolloutBot.getMove(simState, validMoves);
          GameLogic.applyMove(simState, moveIdx);
        }
      }

      // Calculate score
      GameLogic.updateScores(simState);

      // Get value from NN3 or use simple heuristic
      let value = 0.5;
      const perspectiveTeamId = rootState.currentPlayerIndex % 2;

      if (this.modelManager?.nn3.loaded) {
        const nn3Features = stateToNN3Features(simState, perspectiveTeamId);
        const result = await this.modelManager.nn3.predict(nn3Features, [1, 4]);
        if (result.length > 0) {
          value = result[0];
        }
      } else {
        // Simple heuristic: compare scores
        const ourScore = perspectiveTeamId === 0 ? simState.team1Score : simState.team2Score;
        const theirScore = perspectiveTeamId === 0 ? simState.team2Score : simState.team1Score;
        value = ourScore > theirScore ? 0.7 : ourScore < theirScore ? 0.3 : 0.5;
      }

      // 4. BACKPROPAGATION
      let node: MCTSNode | null = currentNode;
      while (node !== null) {
        node.visitCount++;
        node.valueSum += value;
        node = node.parent;
      }
    }

    return root;
  }

  /**
   * Get a bid using MCTS
   */
  async getBid(player: Player, state: GameState): Promise<number> {
    const root = await this.runMCTS(state, true);

    // Choose bid with most visits
    let bestBid = 1;
    let maxVisits = -1;

    for (const child of root.children) {
      if (child.visitCount > maxVisits) {
        maxVisits = child.visitCount;
        bestBid = child.actionIdx;
      }
    }

    return bestBid;
  }

  /**
   * Get a move using MCTS
   */
  async getMove(state: GameState, validMoves: number[]): Promise<number> {
    if (validMoves.length === 0) {
      throw new Error('No valid moves available');
    }
    if (validMoves.length === 1) {
      return validMoves[0];
    }

    const root = await this.runMCTS(state, false);

    // Choose move with most visits
    let bestMove = validMoves[0];
    let maxVisits = -1;

    for (const child of root.children) {
      if (child.visitCount > maxVisits) {
        maxVisits = child.visitCount;
        bestMove = child.actionIdx;
      }
    }

    return bestMove;
  }
}

/**
 * Create a bot instance with model manager
 */
export function createMCTSBot(modelManager: ModelManager | null, simulations: number = 30): MCTSBot {
  return new MCTSBot(simulations, modelManager);
}

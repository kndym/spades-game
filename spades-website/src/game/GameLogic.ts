import {
  Card,
  Suit,
  Rank,
  GameState,
  Player,
  compareCards,
  cardToIndex,
} from './types';

export class GameLogic {
  /**
   * Initialize a standard 52-card deck
   */
  static initializeDeck(): Card[] {
    const deck: Card[] = [];
    for (let s = 0; s < 4; s++) {
      for (let r = 0; r < 13; r++) {
        deck.push({ suit: s as Suit, rank: r as Rank });
      }
    }
    return deck;
  }

  /**
   * Shuffle the deck using Fisher-Yates algorithm
   */
  static shuffleDeck(deck: Card[]): Card[] {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Deal cards to all 4 players (13 cards each)
   */
  static dealCards(state: GameState): void {
    // Clear hands first
    for (const player of state.players) {
      player.hand = [];
    }
    
    // Deal cards round-robin
    for (let i = 0; i < 52; i++) {
      state.players[i % 4].hand.push(state.deck[i]);
    }
    
    // Sort each player's hand by suit then rank
    for (const player of state.players) {
      player.hand.sort(compareCards);
    }
  }

  /**
   * Get valid moves (card indices) for the current player
   */
  static getValidMoves(state: GameState): number[] {
    const validMoves: number[] = [];
    const hand = state.players[state.currentPlayerIndex].hand;
    
    if (hand.length === 0) return validMoves;
    
    const ledSuit = state.currentTrick.length === 0 
      ? Suit.CLUBS 
      : state.currentTrick[0].suit;

    if (state.currentTrick.length === 0) {
      // Leading a trick
      const canPlayNonSpade = hand.some(c => c.suit !== Suit.SPADES);
      
      for (let i = 0; i < hand.length; i++) {
        // Cannot lead spades unless:
        // - Spades are broken, OR
        // - Player has only spades
        if (state.spadesBroken || !canPlayNonSpade || hand[i].suit !== Suit.SPADES) {
          validMoves.push(i);
        }
      }
    } else {
      // Following suit
      const canFollowSuit = hand.some(c => c.suit === ledSuit);
      
      if (canFollowSuit) {
        // Must follow suit
        for (let i = 0; i < hand.length; i++) {
          if (hand[i].suit === ledSuit) {
            validMoves.push(i);
          }
        }
      } else {
        // Cannot follow suit, can play anything
        for (let i = 0; i < hand.length; i++) {
          validMoves.push(i);
        }
      }
    }
    
    return validMoves;
  }

  /**
   * Determine the winner of the current trick
   */
  static determineTrickWinner(state: GameState): number {
    let winnerIndex = state.trickLeaderIndex;
    let winningCard = state.currentTrick[0];

    for (let i = 1; i < state.currentTrick.length; i++) {
      const playerIndex = (state.trickLeaderIndex + i) % 4;
      const card = state.currentTrick[i];

      if (card.suit === winningCard.suit) {
        // Same suit as current winning card
        if (card.rank > winningCard.rank) {
          winningCard = card;
          winnerIndex = playerIndex;
        }
      } else if (card.suit === Suit.SPADES) {
        // Trump card
        if (winningCard.suit !== Suit.SPADES || card.rank > winningCard.rank) {
          winningCard = card;
          winnerIndex = playerIndex;
        }
      }
    }

    return winnerIndex;
  }

  /**
   * Update scores at the end of a round
   */
  static updateScores(state: GameState): { team1RoundPoints: number; team2RoundPoints: number } {
    let team1RoundPoints = 0;
    let team2RoundPoints = 0;

    // Team 1 (players 0 and 2)
    let team1Bid = 0;
    let team1Tricks = 0;
    const player0Nil = state.players[0].bid === 0;
    const player2Nil = state.players[2].bid === 0;

    if (player0Nil) {
      team1RoundPoints += state.players[0].tricksWon === 0 ? 100 : -100;
    } else {
      team1Bid += state.players[0].bid;
      team1Tricks += state.players[0].tricksWon;
    }

    if (player2Nil) {
      team1RoundPoints += state.players[2].tricksWon === 0 ? 100 : -100;
    } else {
      team1Bid += state.players[2].bid;
      team1Tricks += state.players[2].tricksWon;
    }

    if (team1Bid > 0) {
      if (team1Tricks >= team1Bid) {
        team1RoundPoints += team1Bid * 10;
        const overtricks = team1Tricks - team1Bid;
        team1RoundPoints += overtricks;
        state.team1Bags += overtricks;
        if (state.team1Bags >= 10) {
          team1RoundPoints -= 100;
          state.team1Bags -= 10;
        }
      } else {
        team1RoundPoints -= team1Bid * 10;
      }
    }

    // Team 2 (players 1 and 3)
    let team2Bid = 0;
    let team2Tricks = 0;
    const player1Nil = state.players[1].bid === 0;
    const player3Nil = state.players[3].bid === 0;

    if (player1Nil) {
      team2RoundPoints += state.players[1].tricksWon === 0 ? 100 : -100;
    } else {
      team2Bid += state.players[1].bid;
      team2Tricks += state.players[1].tricksWon;
    }

    if (player3Nil) {
      team2RoundPoints += state.players[3].tricksWon === 0 ? 100 : -100;
    } else {
      team2Bid += state.players[3].bid;
      team2Tricks += state.players[3].tricksWon;
    }

    if (team2Bid > 0) {
      if (team2Tricks >= team2Bid) {
        team2RoundPoints += team2Bid * 10;
        const overtricks = team2Tricks - team2Bid;
        team2RoundPoints += overtricks;
        state.team2Bags += overtricks;
        if (state.team2Bags >= 10) {
          team2RoundPoints -= 100;
          state.team2Bags -= 10;
        }
      } else {
        team2RoundPoints -= team2Bid * 10;
      }
    }

    state.team1Score += team1RoundPoints;
    state.team2Score += team2RoundPoints;

    return { team1RoundPoints, team2RoundPoints };
  }

  /**
   * Check if the game is over (someone reached 500 or went below -200)
   */
  static isGameOver(state: GameState): boolean {
    return (
      state.team1Score >= 500 ||
      state.team2Score >= 500 ||
      state.team1Score <= -200 ||
      state.team2Score <= -200
    );
  }

  /**
   * Apply a card play move to the game state
   */
  static applyMove(state: GameState, moveIndex: number): void {
    const currentPlayer = state.players[state.currentPlayerIndex];
    
    if (currentPlayer.hand.length === 0 || moveIndex < 0 || moveIndex >= currentPlayer.hand.length) {
      return;
    }

    const playedCard = currentPlayer.hand[moveIndex];

    // Check if spades are broken
    if (playedCard.suit === Suit.SPADES && !state.spadesBroken) {
      state.spadesBroken = true;
    }

    // Add card to current trick
    state.currentTrick.push(playedCard);

    // Track which card was played
    const cardIndex = cardToIndex(playedCard);
    state.playedCards[state.currentPlayerIndex][cardIndex] = true;

    // Remove the card from player's hand
    currentPlayer.hand.splice(moveIndex, 1);

    // Check if trick is complete (4 cards played)
    if (state.currentTrick.length === 4) {
      const trickWinner = this.determineTrickWinner(state);
      state.players[trickWinner].tricksWon++;

      // Reset for next trick
      state.currentPlayerIndex = trickWinner;
      state.trickLeaderIndex = trickWinner;
      state.currentTrick = [];
    } else {
      // Move to next player
      state.currentPlayerIndex = (state.currentPlayerIndex + 1) % 4;
    }
  }

  /**
   * Apply a bid to the game state
   */
  static applyBid(state: GameState, bid: number): void {
    if (state.bidsMade < 4) {
      state.players[state.currentPlayerIndex].bid = bid;
      state.bidsMade++;
      state.currentPlayerIndex = (state.currentPlayerIndex + 1) % 4;
    }
  }

  /**
   * Check if the current round is over (all 13 tricks played)
   */
  static isRoundOver(state: GameState): boolean {
    let totalTricksWon = 0;
    for (const player of state.players) {
      totalTricksWon += player.tricksWon;
    }
    return totalTricksWon >= 13;
  }

  /**
   * Reset the game state for a new round
   */
  static resetForNewRound(state: GameState, dealerIndex: number): void {
    state.deck = [];
    state.spadesBroken = false;
    state.trickLeaderIndex = (dealerIndex + 1) % 4;
    state.currentPlayerIndex = (dealerIndex + 1) % 4;
    state.currentTrick = [];
    state.bidsMade = 0;

    for (const player of state.players) {
      player.hand = [];
      player.bid = 0;
      player.tricksWon = 0;
    }

    // Reset card tracking
    for (let i = 0; i < 4; i++) {
      state.playedCards[i] = Array(52).fill(false);
    }
  }

  /**
   * Check if bidding is complete
   */
  static isBiddingComplete(state: GameState): boolean {
    return state.bidsMade >= 4;
  }

  /**
   * Get the team index for a player (0 for team 1, 1 for team 2)
   */
  static getPlayerTeam(playerIndex: number): number {
    return playerIndex % 2;
  }

  /**
   * Get partner index for a player
   */
  static getPartnerIndex(playerIndex: number): number {
    return (playerIndex + 2) % 4;
  }

  /**
   * Create a deep copy of the game state (for MCTS simulations)
   */
  static cloneState(state: GameState): GameState {
    return {
      deck: [...state.deck],
      players: state.players.map(p => ({
        hand: [...p.hand],
        bid: p.bid,
        tricksWon: p.tricksWon,
      })) as [Player, Player, Player, Player],
      team1Score: state.team1Score,
      team2Score: state.team2Score,
      team1Bags: state.team1Bags,
      team2Bags: state.team2Bags,
      currentPlayerIndex: state.currentPlayerIndex,
      trickLeaderIndex: state.trickLeaderIndex,
      bidsMade: state.bidsMade,
      spadesBroken: state.spadesBroken,
      currentTrick: [...state.currentTrick],
      playedCards: state.playedCards.map(arr => [...arr]),
    };
  }
}

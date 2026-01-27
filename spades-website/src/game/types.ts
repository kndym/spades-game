// Represents the suit of a card
export enum Suit {
  CLUBS = 0,
  DIAMONDS = 1,
  HEARTS = 2,
  SPADES = 3,
}

// Represents the rank of a card
export enum Rank {
  TWO = 0,
  THREE = 1,
  FOUR = 2,
  FIVE = 3,
  SIX = 4,
  SEVEN = 5,
  EIGHT = 6,
  NINE = 7,
  TEN = 8,
  JACK = 9,
  QUEEN = 10,
  KING = 11,
  ACE = 12,
}

// Represents a single playing card
export interface Card {
  suit: Suit;
  rank: Rank;
}

// Represents a player in the game
export interface Player {
  hand: Card[];
  bid: number;
  tricksWon: number;
}

// Game state matching C++ GameState struct
export interface GameState {
  deck: Card[];
  players: [Player, Player, Player, Player]; // 4 players

  team1Score: number;  // Players 0 and 2
  team2Score: number;  // Players 1 and 3
  team1Bags: number;
  team2Bags: number;

  currentPlayerIndex: number;
  trickLeaderIndex: number;
  bidsMade: number;

  spadesBroken: boolean;
  currentTrick: Card[];

  // Card tracking: which cards each player has played (4 players x 52 cards)
  playedCards: boolean[][];
}

// Game phases
export enum GamePhase {
  LOADING = 'loading',
  BIDDING = 'bidding',
  PLAYING = 'playing',
  TRICK_END = 'trick_end',
  ROUND_END = 'round_end',
  GAME_OVER = 'game_over',
}

// Extended state for UI
export interface UIGameState extends GameState {
  phase: GamePhase;
  humanPlayerIndex: number;
  lastTrickWinner: number | null;
  lastTrickLeaderIndex: number | null; // Leader of the completed trick (for display positioning)
  displayTrick: Card[]; // Completed trick shown temporarily before clearing
  roundNumber: number;
  message: string;
}

// Helper functions
export function createCard(suit: Suit, rank: Rank): Card {
  return { suit, rank };
}

export function cardToIndex(card: Card): number {
  return card.suit * 13 + card.rank;
}

export function indexToCard(index: number): Card {
  return {
    suit: Math.floor(index / 13) as Suit,
    rank: (index % 13) as Rank,
  };
}

export function compareCards(a: Card, b: Card): number {
  if (a.suit !== b.suit) {
    return a.suit - b.suit;
  }
  return a.rank - b.rank;
}

export function suitToString(suit: Suit): string {
  switch (suit) {
    case Suit.CLUBS: return '♣';
    case Suit.DIAMONDS: return '♦';
    case Suit.HEARTS: return '♥';
    case Suit.SPADES: return '♠';
  }
}

export function rankToString(rank: Rank): string {
  switch (rank) {
    case Rank.TWO: return '2';
    case Rank.THREE: return '3';
    case Rank.FOUR: return '4';
    case Rank.FIVE: return '5';
    case Rank.SIX: return '6';
    case Rank.SEVEN: return '7';
    case Rank.EIGHT: return '8';
    case Rank.NINE: return '9';
    case Rank.TEN: return '10';
    case Rank.JACK: return 'J';
    case Rank.QUEEN: return 'Q';
    case Rank.KING: return 'K';
    case Rank.ACE: return 'A';
  }
}

export function cardToString(card: Card): string {
  return `${rankToString(card.rank)}${suitToString(card.suit)}`;
}

export function suitColor(suit: Suit): 'red' | 'black' {
  return suit === Suit.HEARTS || suit === Suit.DIAMONDS ? 'red' : 'black';
}

export function createEmptyPlayer(): Player {
  return {
    hand: [],
    bid: 0,
    tricksWon: 0,
  };
}

export function createInitialGameState(): GameState {
  return {
    deck: [],
    players: [
      createEmptyPlayer(),
      createEmptyPlayer(),
      createEmptyPlayer(),
      createEmptyPlayer(),
    ],
    team1Score: 0,
    team2Score: 0,
    team1Bags: 0,
    team2Bags: 0,
    currentPlayerIndex: 0,
    trickLeaderIndex: 0,
    bidsMade: 0,
    spadesBroken: false,
    currentTrick: [],
    playedCards: Array.from({ length: 4 }, () => Array(52).fill(false)),
  };
}

export function createInitialUIGameState(): UIGameState {
  return {
    ...createInitialGameState(),
    phase: GamePhase.LOADING,
    humanPlayerIndex: 0, // South
    lastTrickWinner: null,
    lastTrickLeaderIndex: null,
    displayTrick: [],
    roundNumber: 1,
    message: 'Loading...',
  };
}

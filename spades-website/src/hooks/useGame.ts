'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  UIGameState,
  GamePhase,
  createInitialUIGameState,
  GameState,
} from '@/game/types';
import { GameLogic } from '@/game/GameLogic';
import { MCTSBot, createMCTSBot } from '@/game/MCTSBot';
import { ModelManager, getModelManager } from '@/game/ONNXModel';

const HUMAN_PLAYER_INDEX = 0;
const BOT_THINK_DELAY = 500; // ms delay before bot plays (for visual feedback)
const TRICK_DISPLAY_DELAY = 1500; // ms to show completed trick

// Helper to get grammatically correct turn message
const PLAYER_NAMES = ['You', 'West', 'Partner', 'East'];
function getTurnMessage(playerIndex: number, suffix: string = ''): string {
  if (playerIndex === 0) {
    return suffix ? `Your ${suffix}` : 'Your turn';
  }
  return suffix ? `${PLAYER_NAMES[playerIndex]}'s ${suffix}` : `${PLAYER_NAMES[playerIndex]}'s turn`;
}
function getWinMessage(playerIndex: number): string {
  if (playerIndex === 0) {
    return 'You win the trick!';
  }
  return `${PLAYER_NAMES[playerIndex]} wins the trick!`;
}

// Deep clone the UI game state to prevent mutation issues
function cloneUIGameState(state: UIGameState): UIGameState {
  return {
    ...state,
    deck: [...state.deck],
    players: state.players.map(p => ({
      hand: [...p.hand],
      bid: p.bid,
      tricksWon: p.tricksWon,
    })) as [typeof state.players[0], typeof state.players[1], typeof state.players[2], typeof state.players[3]],
    currentTrick: [...state.currentTrick],
    displayTrick: [...state.displayTrick],
    playedCards: state.playedCards.map(arr => [...arr]),
  };
}

export function useGame() {
  const [gameState, setGameState] = useState<UIGameState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Tick counter to force effect re-evaluation after each bot turn
  const [botTurnTick, setBotTurnTick] = useState(0);
  
  const modelManagerRef = useRef<ModelManager | null>(null);
  const botsRef = useRef<MCTSBot[]>([]);
  const processingRef = useRef(false);

  // Initialize models on mount
  useEffect(() => {
    const initModels = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const manager = getModelManager();
        
        // Try to load models - if they fail, we'll use heuristic bots
        try {
          await manager.loadAll('/models');
          modelManagerRef.current = manager;
          console.log('Models loaded successfully');
        } catch (modelError) {
          console.warn('Could not load ONNX models, using heuristic bots:', modelError);
          modelManagerRef.current = null;
        }

        // Create bots for players 1, 2, 3 (all except human at index 0)
        const simulations = 30; // Light MCTS for responsive play
        botsRef.current = [
          createMCTSBot(modelManagerRef.current, simulations), // Player 1 (West)
          createMCTSBot(modelManagerRef.current, simulations), // Player 2 (North/Partner)
          createMCTSBot(modelManagerRef.current, simulations), // Player 3 (East)
        ];

        setIsLoading(false);
      } catch (err) {
        console.error('Initialization error:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize game');
        setIsLoading(false);
      }
    };

    initModels();

    return () => {
      // Cleanup
      modelManagerRef.current?.disposeAll();
    };
  }, []);

  // Start a new game
  const startNewGame = useCallback(() => {
    const state = createInitialUIGameState();
    
    // Initialize and shuffle deck
    state.deck = GameLogic.shuffleDeck(GameLogic.initializeDeck());
    
    // Deal cards
    GameLogic.dealCards(state);
    
    // Start with bidding phase
    state.phase = GamePhase.BIDDING;
    state.currentPlayerIndex = 0; // Start with player 0 (human)
    state.humanPlayerIndex = HUMAN_PLAYER_INDEX;
    state.message = 'Bidding phase - make your bid';
    
    setGameState(state);
  }, []);

  // Process bot turns
  const processBotTurn = useCallback(async () => {
    if (!gameState || processingRef.current) return;
    if (gameState.currentPlayerIndex === HUMAN_PLAYER_INDEX) return;
    if (gameState.phase !== GamePhase.BIDDING && gameState.phase !== GamePhase.PLAYING) return;

    processingRef.current = true;

    try {
      // Get the bot for this player (index 0 in bots array is player 1)
      const botIndex = gameState.currentPlayerIndex - 1;
      const bot = botsRef.current[botIndex];
      
      if (!bot) {
        console.error('No bot for player', gameState.currentPlayerIndex);
        processingRef.current = false;
        return;
      }

      // Add a small delay for visual feedback
      await new Promise(resolve => setTimeout(resolve, BOT_THINK_DELAY));

      setGameState(prev => {
        if (!prev) return null;
        const newState = cloneUIGameState(prev);

        if (prev.phase === GamePhase.BIDDING) {
          // Bot makes a bid
          // For now, use a simple heuristic until async is properly handled
          const player = newState.players[newState.currentPlayerIndex];
          let bid = 0;
          for (const card of player.hand) {
            if (card.suit === 3 && card.rank >= 10) bid++; // High spades
            else if (card.suit !== 3 && card.rank === 12) bid++; // Aces
          }
          bid = Math.max(1, bid);
          
          GameLogic.applyBid(newState, bid);
          
          if (GameLogic.isBiddingComplete(newState)) {
            newState.phase = GamePhase.PLAYING;
            newState.message = 'Playing phase - play your cards';
          } else {
            newState.message = getTurnMessage(newState.currentPlayerIndex, 'turn to bid');
          }
        } else if (prev.phase === GamePhase.PLAYING) {
          // Bot plays a card
          const validMoves = GameLogic.getValidMoves(newState);
          if (validMoves.length > 0) {
            // Simple heuristic: play lowest valid card
            const hand = newState.players[newState.currentPlayerIndex].hand;
            let bestMove = validMoves[0];
            let lowestRank = hand[bestMove].rank;
            
            for (const move of validMoves) {
              if (hand[move].rank < lowestRank) {
                lowestRank = hand[move].rank;
                bestMove = move;
              }
            }
            
            const prevTrickLen = newState.currentTrick.length;
            const trickLeaderBeforeMove = newState.trickLeaderIndex;
            
            // Save the completed trick for display before applyMove clears it
            if (prevTrickLen === 3) {
              // Build the complete 4-card trick for display
              const cardToPlay = hand[bestMove];
              newState.displayTrick = [...newState.currentTrick, cardToPlay];
              newState.lastTrickLeaderIndex = trickLeaderBeforeMove;
            }
            
            GameLogic.applyMove(newState, bestMove);
            
            // Check if trick was completed
            if (prevTrickLen === 3 && newState.currentTrick.length === 0) {
              const winner = newState.trickLeaderIndex;
              newState.lastTrickWinner = winner;
              newState.message = getWinMessage(winner);
              // Set phase to TRICK_END to pause before next action
              newState.phase = GamePhase.TRICK_END;
            } else {
              // Trick not complete, update message to show next player's turn
              newState.message = getTurnMessage(newState.currentPlayerIndex);
            }
            
            // Check if round is over (will be handled after trick display)
            if (GameLogic.isRoundOver(newState)) {
              // Store that round ended - will be processed after trick display
              newState.phase = GamePhase.ROUND_END;
            }
          }
        }

        return newState;
      });
    } catch (err) {
      console.error('Bot turn error:', err);
    } finally {
      processingRef.current = false;
      // Increment tick to trigger effect re-evaluation for next bot turn
      setBotTurnTick(t => t + 1);
    }
  }, [gameState]);

  // Effect to handle trick end display delay
  useEffect(() => {
    if (!gameState) return;
    if (gameState.phase !== GamePhase.TRICK_END && gameState.phase !== GamePhase.ROUND_END) return;

    const timeout = setTimeout(() => {
      setGameState(prev => {
        if (!prev) return null;
        const newState = cloneUIGameState(prev);
        
        // Clear the display trick
        newState.displayTrick = [];
        newState.lastTrickLeaderIndex = null;
        
        if (prev.phase === GamePhase.ROUND_END) {
          // Process round end
          GameLogic.updateScores(newState);
          
          if (GameLogic.isGameOver(newState)) {
            newState.phase = GamePhase.GAME_OVER;
          } else {
            // Start new round
            newState.roundNumber++;
            const dealerIndex = (newState.roundNumber - 1) % 4;
            GameLogic.resetForNewRound(newState, dealerIndex);
            newState.deck = GameLogic.shuffleDeck(GameLogic.initializeDeck());
            GameLogic.dealCards(newState);
            newState.phase = GamePhase.BIDDING;
            newState.message = `Round ${newState.roundNumber} - Bidding phase`;
          }
        } else {
          // Continue to next trick
          newState.phase = GamePhase.PLAYING;
          newState.message = getTurnMessage(newState.currentPlayerIndex);
        }
        
        return newState;
      });
    }, TRICK_DISPLAY_DELAY);

    return () => clearTimeout(timeout);
  }, [gameState?.phase]);

  // Effect to trigger bot turns
  useEffect(() => {
    if (!gameState) return;
    if (gameState.currentPlayerIndex === HUMAN_PLAYER_INDEX) return;
    if (gameState.phase !== GamePhase.BIDDING && gameState.phase !== GamePhase.PLAYING) return;
    if (processingRef.current) return; // Already processing a bot turn

    const timeout = setTimeout(() => {
      processBotTurn();
    }, 100);

    return () => clearTimeout(timeout);
  }, [gameState?.currentPlayerIndex, gameState?.phase, botTurnTick, processBotTurn]);

  // Human plays a card
  const playCard = useCallback((cardIndex: number) => {
    if (!gameState) return;
    if (gameState.currentPlayerIndex !== HUMAN_PLAYER_INDEX) return;
    if (gameState.phase !== GamePhase.PLAYING) return;

    const validMoves = GameLogic.getValidMoves(gameState);
    if (!validMoves.includes(cardIndex)) return;

    setGameState(prev => {
      if (!prev) return null;
      const newState = cloneUIGameState(prev);
      
      const prevTrickLen = newState.currentTrick.length;
      const trickLeaderBeforeMove = newState.trickLeaderIndex;
      const hand = newState.players[newState.currentPlayerIndex].hand;
      
      // Save the completed trick for display before applyMove clears it
      if (prevTrickLen === 3) {
        const cardToPlay = hand[cardIndex];
        newState.displayTrick = [...newState.currentTrick, cardToPlay];
        newState.lastTrickLeaderIndex = trickLeaderBeforeMove;
      }
      
      GameLogic.applyMove(newState, cardIndex);
      
      // Check if trick was completed
      if (prevTrickLen === 3 && newState.currentTrick.length === 0) {
        const winner = newState.trickLeaderIndex;
        newState.lastTrickWinner = winner;
        newState.message = getWinMessage(winner);
        newState.phase = GamePhase.TRICK_END;
      } else {
        newState.message = getTurnMessage(newState.currentPlayerIndex);
      }
      
      // Check if round is over (will be handled after trick display)
      if (GameLogic.isRoundOver(newState)) {
        newState.phase = GamePhase.ROUND_END;
      }
      
      return newState;
    });
  }, [gameState]);

  // Human makes a bid
  const makeBid = useCallback((bid: number) => {
    if (!gameState) return;
    if (gameState.currentPlayerIndex !== HUMAN_PLAYER_INDEX) return;
    if (gameState.phase !== GamePhase.BIDDING) return;

    setGameState(prev => {
      if (!prev) return null;
      const newState = cloneUIGameState(prev);
      
      GameLogic.applyBid(newState, bid);
      
      if (GameLogic.isBiddingComplete(newState)) {
        newState.phase = GamePhase.PLAYING;
        newState.message = 'Playing phase - play your cards';
      } else {
        newState.message = getTurnMessage(newState.currentPlayerIndex, 'turn to bid');
      }
      
      return newState;
    });
  }, [gameState]);

  return {
    gameState,
    isLoading,
    error,
    startNewGame,
    playCard,
    makeBid,
  };
}

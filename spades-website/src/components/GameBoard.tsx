'use client';

import { useState, useEffect } from 'react';
import { UIGameState, GamePhase } from '@/game/types';
import { GameLogic } from '@/game/GameLogic';
import { PlayerHand } from './PlayerHand';
import { TrickArea } from './TrickArea';
import { ScoreBoard } from './ScoreBoard';
import { BiddingModal } from './BiddingModal';

interface GameBoardProps {
  gameState: UIGameState;
  onPlayCard: (cardIndex: number) => void;
  onBid: (bid: number) => void;
}

export function GameBoard({ gameState, onPlayCard, onBid }: GameBoardProps) {
  const [selectedCard, setSelectedCard] = useState<number | null>(null);

  // Reset selected card when turn changes
  useEffect(() => {
    setSelectedCard(null);
  }, [gameState.currentPlayerIndex]);

  const validMoves = gameState.phase === GamePhase.PLAYING 
    ? GameLogic.getValidMoves(gameState)
    : [];

  const isHumanTurn = gameState.currentPlayerIndex === gameState.humanPlayerIndex;
  const isBiddingPhase = gameState.phase === GamePhase.BIDDING;
  const isPlayingPhase = gameState.phase === GamePhase.PLAYING;
  const isTrickEndPhase = gameState.phase === GamePhase.TRICK_END;
  const isRoundEndPhase = gameState.phase === GamePhase.ROUND_END;
  const showTrickArea = isPlayingPhase || isTrickEndPhase || isRoundEndPhase;

  // Calculate team bids and tricks
  const team1Bid = gameState.players[0].bid + gameState.players[2].bid;
  const team2Bid = gameState.players[1].bid + gameState.players[3].bid;
  const team1Tricks = gameState.players[0].tricksWon + gameState.players[2].tricksWon;
  const team2Tricks = gameState.players[1].tricksWon + gameState.players[3].tricksWon;

  const handlePlayCard = () => {
    if (selectedCard !== null && validMoves.includes(selectedCard)) {
      onPlayCard(selectedCard);
      setSelectedCard(null);
    }
  };

  const currentBids: (number | null)[] = gameState.players.map((p, idx) => 
    idx < gameState.bidsMade ? p.bid : null
  );

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Score Board */}
      <ScoreBoard
        team1Score={gameState.team1Score}
        team2Score={gameState.team2Score}
        team1Bags={gameState.team1Bags}
        team2Bags={gameState.team2Bags}
        team1Bid={team1Bid}
        team2Bid={team2Bid}
        team1Tricks={team1Tricks}
        team2Tricks={team2Tricks}
        roundNumber={gameState.roundNumber}
      />

      {/* Message display - positioned on the left side to avoid North/South */}
      {gameState.message && (
        <div className="fixed top-1/3 left-4 z-30">
          <div className="bg-black bg-opacity-70 rounded-lg px-6 py-2 text-white text-center animate-fade-in">
            {gameState.message}
          </div>
        </div>
      )}

      {/* Trick Area */}
      {showTrickArea && (
        <TrickArea
          currentTrick={gameState.currentTrick}
          trickLeaderIndex={gameState.trickLeaderIndex}
          displayTrick={gameState.displayTrick}
          displayTrickLeaderIndex={gameState.lastTrickLeaderIndex}
        />
      )}

      {/* Player Hands */}
      {/* South (Human) */}
      <PlayerHand
        cards={gameState.players[0].hand}
        validMoves={isHumanTurn && isPlayingPhase ? validMoves : []}
        selectedCard={selectedCard}
        onCardSelect={setSelectedCard}
        onPlayCard={handlePlayCard}
        isHumanTurn={isHumanTurn && isPlayingPhase}
        position="south"
        playerName="You"
        bid={gameState.players[0].bid}
        tricksWon={gameState.players[0].tricksWon}
      />

      {/* West (Bot) */}
      <PlayerHand
        cards={gameState.players[1].hand}
        validMoves={[]}
        selectedCard={null}
        onCardSelect={() => {}}
        onPlayCard={() => {}}
        isHumanTurn={false}
        position="west"
        playerName="West"
        bid={gameState.players[1].bid}
        tricksWon={gameState.players[1].tricksWon}
      />

      {/* North (Partner Bot) */}
      <PlayerHand
        cards={gameState.players[2].hand}
        validMoves={[]}
        selectedCard={null}
        onCardSelect={() => {}}
        onPlayCard={() => {}}
        isHumanTurn={false}
        position="north"
        playerName="Partner"
        bid={gameState.players[2].bid}
        tricksWon={gameState.players[2].tricksWon}
      />

      {/* East (Bot) */}
      <PlayerHand
        cards={gameState.players[3].hand}
        validMoves={[]}
        selectedCard={null}
        onCardSelect={() => {}}
        onPlayCard={() => {}}
        isHumanTurn={false}
        position="east"
        playerName="East"
        bid={gameState.players[3].bid}
        tricksWon={gameState.players[3].tricksWon}
      />

      {/* Bidding Modal */}
      {isBiddingPhase && (
        <BiddingModal
          playerCards={gameState.players[gameState.humanPlayerIndex].hand}
          onBid={onBid}
          currentBids={currentBids}
          currentPlayerIndex={gameState.currentPlayerIndex}
          isHumanTurn={isHumanTurn}
        />
      )}

      {/* Game Over Modal */}
      {gameState.phase === GamePhase.GAME_OVER && (
        <div className="modal-backdrop">
          <div className="modal-content text-center">
            <h2 className="text-3xl font-bold text-gray-800 mb-4">
              Game Over!
            </h2>
            <div className="text-xl mb-6">
              {gameState.team1Score >= 500 ? (
                <span className="text-green-600">🎉 You Win! 🎉</span>
              ) : gameState.team2Score >= 500 ? (
                <span className="text-red-600">Opponents Win</span>
              ) : gameState.team1Score <= -200 ? (
                <span className="text-red-600">You went bust!</span>
              ) : (
                <span className="text-red-600">Opponents went bust!</span>
              )}
            </div>
            <div className="text-gray-600 mb-6">
              <div>Your Team: {gameState.team1Score}</div>
              <div>Opponents: {gameState.team2Score}</div>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="btn-primary"
            >
              Play Again
            </button>
          </div>
        </div>
      )}

      {/* Turn indicator - positioned in bottom-left corner to avoid all players */}
      {isPlayingPhase && !isHumanTurn && (
        <div className="fixed bottom-4 left-4 z-20">
          <div className="bg-black bg-opacity-70 rounded-lg px-4 py-2 flex items-center gap-2">
            <div className="spinner border-white"></div>
            <span className="text-white">
              {['', 'West', 'Partner', 'East'][gameState.currentPlayerIndex]} is thinking...
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

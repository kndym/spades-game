'use client';

import { useEffect, useState } from 'react';
import { GameBoard } from '@/components/GameBoard';
import { useGame } from '@/hooks/useGame';

export default function Home() {
  const { gameState, isLoading, error, startNewGame, playCard, makeBid } = useGame();
  const [showInstructions, setShowInstructions] = useState(true);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-red-900 bg-opacity-80 rounded-xl p-8 max-w-md text-center">
          <h2 className="text-2xl font-bold mb-4">Error Loading Game</h2>
          <p className="text-red-200 mb-4">{error}</p>
          <button onClick={() => window.location.reload()} className="btn-primary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="spinner mb-4"></div>
        <p className="text-xl">Loading AI models...</p>
        <p className="text-sm text-gray-300 mt-2">This may take a few seconds</p>
      </div>
    );
  }

  if (showInstructions && !gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-xl p-8 max-w-2xl">
          <h1 className="text-4xl font-bold mb-6 text-center">♠ Spades</h1>
          <h2 className="text-xl mb-4 text-center text-gray-200">Play Against AI Bots</h2>
          
          <div className="space-y-4 text-gray-200 mb-8">
            <p>
              <strong>You are South.</strong> Your partner is North. You play against East and West.
            </p>
            <p>
              <strong>Objective:</strong> Be the first team to reach 500 points by winning tricks.
            </p>
            <p>
              <strong>Bidding:</strong> Predict how many tricks your team will win (0-13).
            </p>
            <p>
              <strong>Playing:</strong> Follow suit if possible. Spades are trump.
            </p>
            <p>
              <strong>Scoring:</strong> Make your bid = 10× bid + overtricks. 
              Fail = -10× bid. 10 overtricks (bags) = -100 penalty.
            </p>
          </div>

          <div className="flex justify-center">
            <button
              onClick={() => {
                setShowInstructions(false);
                startNewGame();
              }}
              className="btn-primary text-xl px-8 py-4"
            >
              Start Game
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen relative overflow-hidden">
      {gameState && (
        <GameBoard
          gameState={gameState}
          onPlayCard={playCard}
          onBid={makeBid}
        />
      )}
    </main>
  );
}

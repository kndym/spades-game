'use client';

import { Card } from '@/game/types';
import { CardComponent } from './Card';

interface TrickAreaProps {
  currentTrick: Card[];
  trickLeaderIndex: number;
  displayTrick?: Card[];
  displayTrickLeaderIndex?: number | null;
}

export function TrickArea({ 
  currentTrick, 
  trickLeaderIndex,
  displayTrick = [],
  displayTrickLeaderIndex = null,
}: TrickAreaProps) {
  // Use displayTrick if available (showing completed trick), otherwise currentTrick
  const cardsToShow = displayTrick.length > 0 ? displayTrick : currentTrick;
  const leaderIndex = displayTrick.length > 0 && displayTrickLeaderIndex !== null 
    ? displayTrickLeaderIndex 
    : trickLeaderIndex;

  // Position cards based on who played them
  // leaderIndex tells us who played first
  // Cards are in order of play
  
  const getCardPosition = (cardIndex: number): string => {
    // Which player played this card?
    const playerIndex = (leaderIndex + cardIndex) % 4;
    
    // Position based on player position (0=South, 1=West, 2=North, 3=East)
    switch (playerIndex) {
      case 0: // South (human) - bottom
        return 'translate-y-12';
      case 1: // West - left
        return '-translate-x-16';
      case 2: // North - top
        return '-translate-y-12';
      case 3: // East - right
        return 'translate-x-16';
      default:
        return '';
    }
  };

  const getPlayerLabel = (cardIndex: number): string => {
    const playerIndex = (leaderIndex + cardIndex) % 4;
    const names = ['You', 'West', 'Partner', 'East'];
    return names[playerIndex];
  };

  return (
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
      {/* Background circle for trick area */}
      <div className="w-48 h-48 sm:w-56 sm:h-56 rounded-full bg-green-800 bg-opacity-50 
        border-2 border-green-600 flex items-center justify-center relative">
        
        {cardsToShow.length === 0 ? (
          <div className="text-green-400 text-opacity-50 text-sm">Trick Area</div>
        ) : (
          cardsToShow.map((card, index) => (
            <div
              key={`trick-${index}`}
              className={`absolute transition-all duration-300 animate-card-play ${getCardPosition(index)}`}
            >
              <CardComponent card={card} small />
              <div className="text-xs text-center text-white mt-1 bg-black bg-opacity-50 rounded px-1">
                {getPlayerLabel(index)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

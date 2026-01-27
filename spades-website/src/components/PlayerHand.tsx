'use client';

import { Card, suitToString, rankToString } from '@/game/types';
import { CardComponent, CardBack } from './Card';

interface PlayerHandProps {
  cards: Card[];
  validMoves: number[];
  selectedCard: number | null;
  onCardSelect: (index: number) => void;
  onPlayCard: () => void;
  isHumanTurn: boolean;
  position: 'south' | 'north' | 'east' | 'west';
  playerName: string;
  bid: number;
  tricksWon: number;
}

export function PlayerHand({
  cards,
  validMoves,
  selectedCard,
  onCardSelect,
  onPlayCard,
  isHumanTurn,
  position,
  playerName,
  bid,
  tricksWon,
}: PlayerHandProps) {
  const isHuman = position === 'south';
  
  // Calculate card spread based on hand size
  const getCardOffset = (index: number, total: number): string => {
    if (position === 'south') {
      // Human player - spread horizontally
      const baseOffset = -((total - 1) * 15);
      return `translateX(${baseOffset + index * 30}px)`;
    } else if (position === 'north') {
      const baseOffset = -((total - 1) * 8);
      return `translateX(${baseOffset + index * 16}px)`;
    } else {
      // East/West - stack vertically
      const baseOffset = -((total - 1) * 6);
      return `translateY(${baseOffset + index * 12}px)`;
    }
  };

  const containerClasses = {
    south: 'fixed bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2',
    north: 'fixed top-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1',
    east: 'fixed right-4 top-1/2 -translate-y-1/2 flex flex-row-reverse items-center gap-2',
    west: 'fixed left-4 top-1/2 -translate-y-1/2 flex flex-row items-center gap-2',
  };

  const cardsContainerClasses = {
    south: 'flex items-end justify-center relative h-32',
    north: 'flex items-start justify-center relative h-20',
    east: 'flex flex-col items-center justify-center relative w-16',
    west: 'flex flex-col items-center justify-center relative w-16',
  };

  return (
    <div className={containerClasses[position]}>
      {/* Player info */}
      <div className={`
        bg-black bg-opacity-50 rounded-lg px-3 py-1 text-center
        ${position === 'east' || position === 'west' ? 'writing-mode-vertical' : ''}
      `}>
        <div className="text-sm font-semibold text-white">{playerName}</div>
        <div className="text-xs text-gray-300">
          Bid: {bid} | Won: {tricksWon}
        </div>
      </div>

      {/* Cards */}
      <div className={cardsContainerClasses[position]}>
        {cards.map((card, index) => {
          const isValid = validMoves.includes(index);
          const isSelected = selectedCard === index;

          return (
            <div
              key={`${card.suit}-${card.rank}`}
              className="absolute transition-transform duration-200"
              style={{ transform: getCardOffset(index, cards.length) }}
            >
              {isHuman ? (
                <CardComponent
                  card={card}
                  onClick={() => isHumanTurn && isValid && onCardSelect(index)}
                  disabled={!isHumanTurn || !isValid}
                  selected={isSelected}
                />
              ) : (
                <CardBack small />
              )}
            </div>
          );
        })}
      </div>

      {/* Play button for human */}
      {isHuman && selectedCard !== null && (
        <button
          onClick={onPlayCard}
          className="btn-primary mt-2 animate-fade-in"
        >
          Play Card
        </button>
      )}
    </div>
  );
}

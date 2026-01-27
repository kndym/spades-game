'use client';

import { Card as CardType, Suit, suitToString, rankToString, suitColor } from '@/game/types';

interface CardProps {
  card: CardType;
  onClick?: () => void;
  disabled?: boolean;
  selected?: boolean;
  faceDown?: boolean;
  small?: boolean;
}

export function CardComponent({ card, onClick, disabled, selected, faceDown, small }: CardProps) {
  const color = suitColor(card.suit);
  const suitSymbol = suitToString(card.suit);
  const rankStr = rankToString(card.rank);

  const baseClasses = small
    ? 'w-12 h-16 text-xs'
    : 'w-16 h-24 sm:w-20 sm:h-28 text-sm sm:text-base';

  if (faceDown) {
    return (
      <div
        className={`${baseClasses} bg-blue-800 rounded-lg border-2 border-blue-900 shadow-md
          flex items-center justify-center`}
      >
        <div className="text-blue-600 text-2xl">♠</div>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        ${baseClasses} bg-white rounded-lg border-2 shadow-md
        flex flex-col items-center justify-between p-1
        transition-all duration-150
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-xl hover:-translate-y-1'}
        ${selected ? 'ring-4 ring-yellow-400 -translate-y-3 shadow-xl' : 'border-gray-300'}
        ${color === 'red' ? 'text-red-600' : 'text-gray-900'}
      `}
    >
      <div className="self-start font-bold leading-none">
        {rankStr}
        <span className="block text-lg leading-none">{suitSymbol}</span>
      </div>
      <div className="text-3xl sm:text-4xl">{suitSymbol}</div>
      <div className="self-end font-bold leading-none rotate-180">
        {rankStr}
        <span className="block text-lg leading-none">{suitSymbol}</span>
      </div>
    </button>
  );
}

export function CardBack({ small }: { small?: boolean }) {
  const baseClasses = small
    ? 'w-12 h-16'
    : 'w-16 h-24 sm:w-20 sm:h-28';

  return (
    <div
      className={`${baseClasses} bg-gradient-to-br from-blue-700 to-blue-900 rounded-lg 
        border-2 border-blue-950 shadow-md flex items-center justify-center`}
    >
      <div className="text-blue-400 text-2xl opacity-50">♠</div>
    </div>
  );
}

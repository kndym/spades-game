'use client';

import { useState } from 'react';
import { Card, suitToString, rankToString, Suit } from '@/game/types';

interface BiddingModalProps {
  playerCards: Card[];
  onBid: (bid: number) => void;
  currentBids: (number | null)[];
  currentPlayerIndex: number;
  isHumanTurn: boolean;
}

export function BiddingModal({
  playerCards,
  onBid,
  currentBids,
  currentPlayerIndex,
  isHumanTurn,
}: BiddingModalProps) {
  const [selectedBid, setSelectedBid] = useState<number | null>(null);

  // Group cards by suit for display
  const cardsBySuit = [Suit.SPADES, Suit.HEARTS, Suit.DIAMONDS, Suit.CLUBS].map(suit => ({
    suit,
    cards: playerCards.filter(c => c.suit === suit).sort((a, b) => b.rank - a.rank),
  }));

  const playerNames = ['You', 'West', 'Partner', 'East'];

  const handleConfirmBid = () => {
    if (selectedBid !== null) {
      onBid(selectedBid);
      setSelectedBid(null);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content max-w-lg">
        <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">
          Bidding Phase
        </h2>

        {/* Current bids */}
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-600 mb-2">Current Bids:</h3>
          <div className="flex justify-around">
            {playerNames.map((name, idx) => (
              <div key={name} className={`text-center px-3 py-1 rounded ${
                idx === currentPlayerIndex ? 'bg-yellow-200' : 'bg-gray-100'
              }`}>
                <div className="text-xs text-gray-500">{name}</div>
                <div className="font-bold text-gray-800">
                  {currentBids[idx] !== null ? currentBids[idx] : '—'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Show waiting message if not human's turn */}
        {!isHumanTurn ? (
          <div className="text-center py-8">
            <div className="spinner mx-auto mb-4 border-gray-400"></div>
            <p className="text-gray-600">
              Waiting for {playerNames[currentPlayerIndex]} to bid...
            </p>
          </div>
        ) : (
          <>
            {/* Show player's cards */}
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-gray-600 mb-2">Your Cards:</h3>
              <div className="grid grid-cols-4 gap-2">
                {cardsBySuit.map(({ suit, cards }) => (
                  <div key={suit} className="text-center">
                    <div className={`text-xl ${suit === Suit.HEARTS || suit === Suit.DIAMONDS ? 'text-red-600' : 'text-gray-800'}`}>
                      {suitToString(suit)}
                    </div>
                    <div className="text-sm space-y-0.5">
                      {cards.map(card => (
                        <div key={`${card.suit}-${card.rank}`} className={`
                          ${suit === Suit.HEARTS || suit === Suit.DIAMONDS ? 'text-red-600' : 'text-gray-800'}
                        `}>
                          {rankToString(card.rank)}
                        </div>
                      ))}
                      {cards.length === 0 && <div className="text-gray-400">—</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bid selection */}
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-gray-600 mb-2">Select Your Bid:</h3>
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: 14 }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedBid(i)}
                    className={`
                      py-2 rounded font-bold transition-colors
                      ${selectedBid === i
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}
                      ${i === 0 ? 'text-red-600' : ''}
                    `}
                  >
                    {i === 0 ? 'Nil' : i}
                  </button>
                ))}
              </div>
            </div>

            {/* Confirm button */}
            <div className="flex justify-center">
              <button
                onClick={handleConfirmBid}
                disabled={selectedBid === null}
                className={`
                  px-8 py-3 rounded-lg font-bold text-white transition-colors
                  ${selectedBid !== null
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-gray-400 cursor-not-allowed'}
                `}
              >
                Confirm Bid
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

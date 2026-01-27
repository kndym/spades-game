'use client';

interface ScoreBoardProps {
  team1Score: number;
  team2Score: number;
  team1Bags: number;
  team2Bags: number;
  team1Bid: number;
  team2Bid: number;
  team1Tricks: number;
  team2Tricks: number;
  roundNumber: number;
}

export function ScoreBoard({
  team1Score,
  team2Score,
  team1Bags,
  team2Bags,
  team1Bid,
  team2Bid,
  team1Tricks,
  team2Tricks,
  roundNumber,
}: ScoreBoardProps) {
  return (
    <div className="fixed top-4 right-4 bg-black bg-opacity-70 rounded-xl p-4 min-w-48 z-20">
      <h3 className="text-lg font-bold text-center mb-3 text-white">
        Round {roundNumber}
      </h3>
      
      <div className="space-y-3">
        {/* Team 1 (You + Partner) */}
        <div className="bg-blue-900 bg-opacity-50 rounded-lg p-2">
          <div className="text-sm font-semibold text-blue-300 mb-1">
            Your Team (You + Partner)
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-400">Score:</span>
              <span className="text-white font-bold ml-1">{team1Score}</span>
            </div>
            <div>
              <span className="text-gray-400">Bags:</span>
              <span className="text-yellow-400 font-bold ml-1">{team1Bags}</span>
            </div>
            <div>
              <span className="text-gray-400">Bid:</span>
              <span className="text-white ml-1">{team1Bid}</span>
            </div>
            <div>
              <span className="text-gray-400">Tricks:</span>
              <span className={`ml-1 font-bold ${team1Tricks >= team1Bid ? 'text-green-400' : 'text-white'}`}>
                {team1Tricks}
              </span>
            </div>
          </div>
        </div>

        {/* Team 2 (West + East) */}
        <div className="bg-red-900 bg-opacity-50 rounded-lg p-2">
          <div className="text-sm font-semibold text-red-300 mb-1">
            Opponents (West + East)
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-400">Score:</span>
              <span className="text-white font-bold ml-1">{team2Score}</span>
            </div>
            <div>
              <span className="text-gray-400">Bags:</span>
              <span className="text-yellow-400 font-bold ml-1">{team2Bags}</span>
            </div>
            <div>
              <span className="text-gray-400">Bid:</span>
              <span className="text-white ml-1">{team2Bid}</span>
            </div>
            <div>
              <span className="text-gray-400">Tricks:</span>
              <span className={`ml-1 font-bold ${team2Tricks >= team2Bid ? 'text-green-400' : 'text-white'}`}>
                {team2Tricks}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Win condition */}
      <div className="mt-3 pt-2 border-t border-gray-600 text-xs text-gray-400 text-center">
        First to 500 wins
      </div>
    </div>
  );
}

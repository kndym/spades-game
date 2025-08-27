#include "../include/Bot.hpp"
#include <chrono>

RandomBot::RandomBot() {
    unsigned seed = std::chrono::system_clock::now().time_since_epoch().count();
    rng.seed(seed);
}

// A slightly more realistic random bid
int RandomBot::getBid(const Player& player) {
    int spadeCount = 0;
    int highCards = 0;
    for(const auto& card : player.hand) {
        if (card.suit == Suit::SPADES) spadeCount++;
        if (card.rank == Rank::ACE || card.rank == Rank::KING) highCards++;
    }
    int potentialTricks = spadeCount + highCards / 2;
    if (potentialTricks == 0) return 1; // Bid at least 1
    std::uniform_int_distribution<int> distrib(std::max(1, potentialTricks-1), std::min(4, potentialTricks + 1));
    return distrib(rng);
}

int RandomBot::getMove(const GameState& state, const std::vector<int>& validMoves) {
    std::uniform_int_distribution<int> distrib(0, validMoves.size() - 1);
    return validMoves[distrib(rng)];
}
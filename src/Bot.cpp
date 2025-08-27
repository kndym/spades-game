#include "../include/Bot.hpp"
#include <algorithm>
#include <iostream>

RandomBot::RandomBot() {
    std::random_device rd; // Obtain a non-deterministic seed
    std::mt19937 rng(rd()); 
}

// A slightly more realistic random bid
int RandomBot::getBid(const Player& player) {
    int potentialTricks = 0;
    for(const auto& card : player.hand) {
        if (card.rank == Rank::ACE || 
            card.rank == Rank::KING || 
            card.suit == Suit::SPADES) potentialTricks++;
    }
    potentialTricks*=0.68;

    int lower_bound = std::max(0, potentialTricks - 1);
    int upper_bound = std::min(13, potentialTricks + 1);

    // Crucial Check: Ensure the range is valid
    if (lower_bound > upper_bound) {
        std::cerr << "Error: Invalid range for uniform_int_distribution!" << std::endl;
        std::cerr << "potentialTricks: " << potentialTricks << std::endl;
        std::cerr << "Lower bound: " << lower_bound << ", Upper bound: " << upper_bound << std::endl;
        // Handle this error, e.g., return a default bid or throw an exception
        return 1; // Or some other sensible default
    }

    std::uniform_int_distribution<int> distrib(lower_bound, upper_bound);
    return distrib(rng);
}

int RandomBot::getMove(const GameState& state, const std::vector<int>& validMoves) {
    const auto& currentPlayer = state.players[state.currentPlayerIndex];
    const auto& hand = currentPlayer.hand;

    if (state.currentTrick.empty()) {
        // Lead with the highest card
        auto bestMoveIt = std::max_element(validMoves.begin(), validMoves.end(), [&](int a, int b) {
            return hand[a].rank < hand[b].rank;
        });
        return *bestMoveIt;
    } else {
        Suit leadingSuit = state.currentTrick[0].suit;
        std::vector<int> movesInSuit;
        for (int move : validMoves) {
            if (hand[move].suit == leadingSuit) {
                movesInSuit.push_back(move);
            }
        }

        if (!movesInSuit.empty()) {
            // Play the highest card of the leading suit
            auto bestMoveIt = std::max_element(movesInSuit.begin(), movesInSuit.end(), [&](int a, int b) {
                return hand[a].rank < hand[b].rank;
            });
            return *bestMoveIt;
        } else {
            // If no card of the leading suit, check for spades
            std::vector<int> spades;
            for (int move : validMoves) {
                if (hand[move].suit == Suit::SPADES) {
                    spades.push_back(move);
                }
            }

            if (!spades.empty()) {
                // Play the highest spade
                auto bestMoveIt = std::max_element(spades.begin(), spades.end(), [&](int a, int b) {
                    return hand[a].rank < hand[b].rank;
                });
                return *bestMoveIt;
            } else {
                // Otherwise, play the highest card
                auto bestMoveIt = std::max_element(validMoves.begin(), validMoves.end(), [&](int a, int b) {
                    return hand[a].rank < hand[b].rank;
                });
                return *bestMoveIt;
            }
        }
    }
}
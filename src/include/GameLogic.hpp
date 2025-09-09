#ifndef GAMELOGIC_HPP
#define GAMELOGIC_HPP

#include "GameState.hpp"
#include "SpadesTypes.hpp"
#include <vector>
#include <array> // For std::array

namespace GameLogic {
    void initializeDeck(std::vector<Card>& deck);
    void shuffleDeck(std::vector<Card>& deck);
    void dealCards(GameState& state);
    std::vector<int> getValidMoves(const GameState& state);
    int determineTrickWinner(const GameState& state);
    void updateScores(GameState& state, int& team1RoundPoints, int& team2RoundPoints); // Note: teamXRoundPoints are OUT parameters
    bool isGameOver(const GameState& state);

    // MCTS simulation specific functions
    void applyMove(GameState& state, int moveIndex); // Applies a card play move
    void applyBid(GameState& state, int bid);       // Applies a bid
    bool isRoundOver(const GameState& state);       // Checks if the current round (13 tricks) is over
    void resetForNewRound(GameState& state, int dealerIndex);

    // Helper for TRAM - will be called by MCTS too
    bool canTram(const GameState& state); 
}

#endif // GAMELOGIC_HPP
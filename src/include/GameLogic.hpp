#pragma once

#include "GameState.hpp"
#include <vector>

namespace GameLogic {
    void initializeDeck(std::vector<Card>& deck);
    void shuffleDeck(std::vector<Card>& deck);
    void dealCards(GameState& state);
    std::vector<int> getValidMoves(const GameState& state);
    int determineTrickWinner(const GameState& state);
    void updateScores(GameState& state, int& team1RoundPoints, int& team2RoundPoints);
    bool isGameOver(const GameState& state);
    void resetForNewRound(GameState& state, int dealerIndex);
    bool canTram(const GameState& state);
}
#pragma once

#include "GameState.hpp"
#include <random>

class RandomBot {
public:
    RandomBot();
    int getBid(const Player& player);
    int getMove(const GameState& state, const std::vector<int>& validMoves);

private:
    std::mt19937 rng;
};
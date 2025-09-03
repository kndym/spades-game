#pragma once

#include <vector>
#include "SpadesTypes.hpp"

// Represents a player in the game
struct Player {
    std::vector<Card> hand;
    int bid = 0;
    int tricksWon = 0;
};
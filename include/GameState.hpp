#pragma once

#include <vector>
#include "Player.hpp"
#include "SpadesTypes.hpp"

// Represents the entire state of the game
struct GameState {
    std::vector<Card> deck;
    std::vector<Player> players{4};
    int currentPlayerIndex = 0;
    std::vector<Card> currentTrick;
    int trickLeaderIndex = 0;
    bool spadesBroken = false;
    int team1Score = 0;
    int team2Score = 0;
};
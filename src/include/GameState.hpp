#ifndef GAMESTATE_HPP
#define GAMESTATE_HPP

#include "Player.hpp"
#include <vector>
#include <array>

struct GameState {
    std::vector<Card> deck;
    std::array<Player, 4> players;

    int team1Score = 0;
    int team2Score = 0;
    int team1Bags = 0;
    int team2Bags = 0;

    int currentPlayerIndex = 0;
    int trickLeaderIndex = 0;
    int bidsMade = 0;

    bool spadesBroken = false;
    std::vector<Card> currentTrick;
};

#endif // GAMESTATE_HPP
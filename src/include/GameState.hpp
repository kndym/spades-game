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
    
    // Card tracking: which cards each player has played (4 players x 52 cards)
    // playedCards[player][cardIndex] = true if player has played that card
    std::array<std::array<bool, 52>, 4> playedCards = {};
};

#endif // GAMESTATE_HPP
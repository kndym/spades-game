#pragma once

#include "SpadesTypes.hpp"
#include "GameState.hpp"
#include <vector>

namespace UI {
    std::string suitToString(Suit suit);
    std::string rankToString(Rank rank);
    void printCard(const Card& card);
    void printHand(const std::vector<Card>& hand);
    void printRoundStart(const GameState& state);
    void printTurnInfo(const GameState& state);
    void printTrickWinner(int winnerIndex, const std::vector<Card>& trick);
    void printScores(const GameState& state);
    void printFinalScores(const GameState& state);
}
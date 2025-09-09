#pragma once

#include "GameState.hpp"
#include <random>
#include "IBot.hpp"


class RandomBot : public IBot {
public:
    RandomBot();
    int getBid(const Player& player, const GameState& state) override;
    int getMove(const GameState& state, const std::vector<int>& validMoves) override;

private:
    std::mt19937 rng;

    // Helper functions for getMove
    Suit getLeadSuit(const std::vector<Card>& trick) const;
    bool isPartnerWinningTrick(const GameState& state) const;
    int getPartnerIndex(int playerIndex) const;
    Card getWinningCardOfTrick(const std::vector<Card>& trick) const;

    int getBestWinningCard(const Player& player, const std::vector<int>& validMoves) const;
    int getLowestCardOfLongestSuit(const Player& player, const std::vector<int>& validMoves) const;
    int getLowestCardOfShortestSuit(const Player& player, const std::vector<int>& validMoves) const;
    bool hasCardOfSuit(const Player& player, Suit suit) const;
    int getLowestCardOfSuit(const Player& player, Suit suit, const std::vector<int>& validMoves) const;
    
    int getHighestCardOfSuit(const Player& player, Suit suit, const std::vector<int>& validMoves) const;

    bool canWinTrick(const Player& player, const std::vector<Card>& trick, Suit leadSuit, const std::vector<int>& validMoves) const;
    int getLowestWinningCardOfSuit(const Player& player, const std::vector<Card>& trick, Suit leadSuit, const std::vector<int>& validMoves) const;
    Card getHighestCardOnTrick(const std::vector<Card>& trick) const;
    int getLowestNonSpadeCard(const Player& player, const std::vector<int>& validMoves) const;
    bool canWinWithSpade(const Player& player, const std::vector<Card>& trick, const std::vector<int>& validMoves) const;
    int getLowestWinningSpade(const Player& player, const std::vector<Card>& trick, const std::vector<int>& validMoves) const;
    int getHighestRankInSuit(const Player& player, Suit suit) const;
    int getHighestPlayedRankInSuit(const GameState& state, Suit suit) const;
    bool hasHighWinningCard(const Player& player, const GameState& state, const std::vector<int>& validMoves) const;

};
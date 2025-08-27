#include "../include/GameLogic.hpp"
#include <algorithm>
#include <chrono>
#include <random>

void GameLogic::initializeDeck(std::vector<Card>& deck) {
    deck.clear();
    deck.reserve(52);
    for (int s = 0; s < 4; ++s) {
        for (int r = 0; r < 13; ++r) {
            deck.push_back({static_cast<Suit>(s), static_cast<Rank>(r)});
        }
    }
}

void GameLogic::shuffleDeck(std::vector<Card>& deck) {
    unsigned seed = std::chrono::system_clock::now().time_since_epoch().count();
    std::shuffle(deck.begin(), deck.end(), std::default_random_engine(seed));
}

void GameLogic::dealCards(GameState& state) {
    for (int i = 0; i < 52; ++i) {
        state.players[i % 4].hand.push_back(state.deck[i]);
    }
    for (auto& player : state.players) {
        std::sort(player.hand.begin(), player.hand.end());
    }
}

std::vector<int> GameLogic::getValidMoves(const GameState& state) {
    std::vector<int> validMoves;
    const auto& hand = state.players[state.currentPlayerIndex].hand;
    Suit ledSuit = state.currentTrick.empty() ? Suit::CLUBS : state.currentTrick[0].suit;

    if (state.currentTrick.empty()) { // Leading a trick
        bool canPlayNonSpade = std::any_of(hand.begin(), hand.end(), [](const Card& c){ return c.suit != Suit::SPADES; });
        for (size_t i = 0; i < hand.size(); ++i) {
            if (state.spadesBroken || !canPlayNonSpade || hand[i].suit != Suit::SPADES) {
                validMoves.push_back(i);
            }
        }
    } else { // Following suit
        bool canFollowSuit = std::any_of(hand.begin(), hand.end(), [ledSuit](const Card& c){ return c.suit == ledSuit; });
        if (canFollowSuit) {
            for (size_t i = 0; i < hand.size(); ++i) {
                if (hand[i].suit == ledSuit) validMoves.push_back(i);
            }
        } else { // Cannot follow suit, can play anything
            for (size_t i = 0; i < hand.size(); ++i) validMoves.push_back(i);
        }
    }
    return validMoves;
}

int GameLogic::determineTrickWinner(const GameState& state) {
    int winnerIndex = state.trickLeaderIndex;
    Card winningCard = state.currentTrick[0];
    for (size_t i = 1; i < state.currentTrick.size(); ++i) {
        int playerIndex = (state.trickLeaderIndex + i) % 4;
        const auto& card = state.currentTrick[i];
        if (card.suit == winningCard.suit) {
            if (card.rank > winningCard.rank) {
                winningCard = card;
                winnerIndex = playerIndex;
            }
        } else if (card.suit == Suit::SPADES) {
            if (winningCard.suit != Suit::SPADES || card.rank > winningCard.rank) {
                winningCard = card;
                winnerIndex = playerIndex;
            }
        }
    }
    return winnerIndex;
}

void GameLogic::updateScores(GameState& state, int& team1RoundPoints, int& team2RoundPoints) {
    int team1Tricks = state.players[0].tricksWon + state.players[2].tricksWon;
    int team1Bid = state.players[0].bid + state.players[2].bid;
    int team2Tricks = state.players[1].tricksWon + state.players[3].tricksWon;
    int team2Bid = state.players[1].bid + state.players[3].bid;

    team1RoundPoints = (team1Tricks >= team1Bid) ? (team1Bid * 10 + (team1Tricks - team1Bid)) : (-team1Bid * 10);
    team2RoundPoints = (team2Tricks >= team2Bid) ? (team2Bid * 10 + (team2Tricks - team2Bid)) : (-team2Bid * 10);

    state.team1Score += team1RoundPoints;
    state.team2Score += team2RoundPoints;
}

bool GameLogic::isGameOver(const GameState& state) {
    return state.team1Score >= 500 || state.team2Score >= 500 ||
           state.team1Score <= -200 || state.team2Score <= -200;
}

void GameLogic::resetForNewRound(GameState& state, int dealerIndex) {
    for (auto& player : state.players) {
        player.hand.clear();
        player.tricksWon = 0;
        player.bid = 0;
    }
    state.spadesBroken = false;
    state.trickLeaderIndex = (dealerIndex + 1) % 4;
    state.currentPlayerIndex = (dealerIndex + 1) % 4;
}
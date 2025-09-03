#include "include/GameLogic.hpp"
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
    team1RoundPoints = 0;
    team2RoundPoints = 0;

    // Team 1
    int team1Bid = 0;
    int team1Tricks = 0;
    bool player0Nil = state.players[0].bid == 0;
    bool player2Nil = state.players[2].bid == 0;

    if (player0Nil) {
        if (state.players[0].tricksWon == 0) {
            team1RoundPoints += 100;
        } else {
            team1RoundPoints -= 100;
        }
    } else {
        team1Bid += state.players[0].bid;
        team1Tricks += state.players[0].tricksWon;
    }

    if (player2Nil) {
        if (state.players[2].tricksWon == 0) {
            team1RoundPoints += 100;
        } else {
            team1RoundPoints -= 100;
        }
    } else {
        team1Bid += state.players[2].bid;
        team1Tricks += state.players[2].tricksWon;
    }

    if (team1Bid > 0) {
        if (team1Tricks >= team1Bid) {
            team1RoundPoints += team1Bid * 10;
            int overtricks = team1Tricks - team1Bid;
            team1RoundPoints += overtricks;
            state.team1Bags += overtricks;
            if (state.team1Bags >= 10) {
                team1RoundPoints -= 100;
                state.team1Bags -= 10;
            }
        } else {
            team1RoundPoints -= team1Bid * 10;
        }
    }

    // Team 2
    int team2Bid = 0;
    int team2Tricks = 0;
    bool player1Nil = state.players[1].bid == 0;
    bool player3Nil = state.players[3].bid == 0;

    if (player1Nil) {
        if (state.players[1].tricksWon == 0) {
            team2RoundPoints += 100;
        } else {
            team2RoundPoints -= 100;
        }
    } else {
        team2Bid += state.players[1].bid;
        team2Tricks += state.players[1].tricksWon;
    }

    if (player3Nil) {
        if (state.players[3].tricksWon == 0) {
            team2RoundPoints += 100;
        } else {
            team2RoundPoints -= 100;
        }
    } else {
        team2Bid += state.players[3].bid;
        team2Tricks += state.players[3].tricksWon;
    }

    if (team2Bid > 0) {
        if (team2Tricks >= team2Bid) {
            team2RoundPoints += team2Bid * 10;
            int overtricks = team2Tricks - team2Bid;
            team2RoundPoints += overtricks;
            state.team2Bags += overtricks;
            if (state.team2Bags >= 10) {
                team2RoundPoints -= 100;
                state.team2Bags -= 10;
            }
        } else {
            team2RoundPoints -= team2Bid * 10;
        }
    }

    state.team1Score += team1RoundPoints;
    state.team2Score += team2RoundPoints;
}

bool GameLogic::isGameOver(const GameState& state) {
    return state.team1Score >= 500 || state.team2Score >= 500 ||
           state.team1Score <= -200 || state.team2Score <= -200;
}



bool GameLogic::canTram(const GameState& state) {
    const auto& currentPlayer = state.players[state.currentPlayerIndex];
    const auto& hand = currentPlayer.hand;
    int remainingTricks = 13 - (state.players[0].tricksWon + state.players[1].tricksWon + state.players[2].tricksWon + state.players[3].tricksWon);

    if (hand.size() < remainingTricks) {
        return false;
    }

    std::vector<Card> spadesInHand;
    for (const auto& card : hand) {
        if (card.suit == Suit::SPADES) {
            spadesInHand.push_back(card);
        }
    }

    if (spadesInHand.size() < remainingTricks) {
        return false;
    }

    std::sort(spadesInHand.begin(), spadesInHand.end(), [](const Card& a, const Card& b) {
        return a.rank > b.rank;
    });

    for (int i = 0; i < remainingTricks; ++i) {
        if (spadesInHand[i].rank != static_cast<Rank>(12 - i)) {
            return false;
        }
    }

    return true;
}

void GameLogic::resetForNewRound(GameState& state, int dealerIndex) {
    state.deck.clear();
    state.spadesBroken = false;
    state.trickLeaderIndex = (dealerIndex + 1) % 4;
    state.currentPlayerIndex = (dealerIndex + 1) % 4;
    
    for (auto& player : state.players) {
        player.hand.clear();
        player.bid = 0;
        player.tricksWon = 0;
    }
}
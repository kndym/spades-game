#include "include/GameLogic.hpp"
#include <algorithm>
#include <chrono>
#include <random>
#include <numeric> // For std::accumulate

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
    // Replace this line:
    // unsigned seed = std::chrono::system_clock::now().time_since_epoch().count();

    // With this fix:
    auto now = std::chrono::system_clock::now().time_since_epoch().count();
    unsigned seed = static_cast<unsigned>(now);
    std::shuffle(deck.begin(), deck.end(), std::default_random_engine(seed));
}

void GameLogic::dealCards(GameState& state) {
    // Clear hands first to be safe
    for (auto& player : state.players) {
        player.hand.clear();
    }
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
    Suit ledSuit = state.currentTrick.empty() ? Suit::CLUBS : state.currentTrick[0].suit; // Default to CLUBS if no card led

    if (state.currentTrick.empty()) { // Leading a trick
        bool canPlayNonSpade = std::any_of(hand.begin(), hand.end(), [](const Card& c){ return c.suit != Suit::SPADES; });
        for (size_t i = 0; i < hand.size(); ++i) {
            // Cannot lead spades unless spades are broken AND no non-spade cards are available
            // OR if spades are already broken
            if (state.spadesBroken || !canPlayNonSpade || hand[i].suit != Suit::SPADES) {
                validMoves.push_back(static_cast<int>(i)); // Cast size_t to int
            }
        }
    } else { // Following suit
        bool canFollowSuit = std::any_of(hand.begin(), hand.end(), [ledSuit](const Card& c){ return c.suit == ledSuit; });
        if (canFollowSuit) {
            for (size_t i = 0; i < hand.size(); ++i) {
                if (hand[i].suit == ledSuit) validMoves.push_back(static_cast<int>(i)); // Cast size_t to int
            }
        } else { // Cannot follow suit, can play anything
            for (size_t i = 0; i < hand.size(); ++i) validMoves.push_back(static_cast<int>(i)); // Cast size_t to int
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
        if (card.suit == winningCard.suit) { // Same suit as current winning card
            if (card.rank > winningCard.rank) {
                winningCard = card;
                winnerIndex = playerIndex;
            }
        } else if (card.suit == Suit::SPADES) { // Trump card
            if (winningCard.suit != Suit::SPADES || card.rank > winningCard.rank) { // If winning card is not spade OR current spade is higher
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
    bool player0Nil = (state.players[0].bid == 0);
    bool player2Nil = (state.players[2].bid == 0);

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
    bool player1Nil = (state.players[1].bid == 0);
    bool player3Nil = (state.players[3].bid == 0);

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

// MCTS specific functions

void GameLogic::applyMove(GameState& state, int moveIndex) {
    if (state.players[state.currentPlayerIndex].hand.empty() || moveIndex < 0 || moveIndex >= state.players[state.currentPlayerIndex].hand.size()) {
        // This should not happen if validMoves is correctly used.
        // In a simulation, might need more robust error handling or just return.
        return; 
    }

    Card playedCard = state.players[state.currentPlayerIndex].hand[moveIndex];

    if (playedCard.suit == Suit::SPADES && !state.spadesBroken) {
        state.spadesBroken = true;
    }
    state.currentTrick.push_back(playedCard);
    
    // Remove the card from the player's hand efficiently
    state.players[state.currentPlayerIndex].hand.erase(state.players[state.currentPlayerIndex].hand.begin() + moveIndex);
    
    int originalTrickLeader = state.trickLeaderIndex; // Store to determine players in trick
    
    // Check if the trick is complete (4 cards played)
    if (state.currentTrick.size() == 4) {
        int trickWinner = determineTrickWinner(state);
        state.players[trickWinner].tricksWon++;
        
        // Reset for the next trick: winner leads, current trick empty
        state.currentPlayerIndex = trickWinner;
        state.trickLeaderIndex = trickWinner;
        state.currentTrick.clear();
    } else {
        // Move to the next player in the current trick
        state.currentPlayerIndex = (state.currentPlayerIndex + 1) % 4;
    }
}


void GameLogic::applyBid(GameState& state, int bid) {
    if (state.bidsMade < 4) {
        state.players[state.currentPlayerIndex].bid = bid;
        state.bidsMade++;
        state.currentPlayerIndex = (state.currentPlayerIndex + 1) % 4;
    }
}

bool GameLogic::isRoundOver(const GameState& state) {
    int totalTricksWon = 0;
    for (const auto& player : state.players) {
        totalTricksWon += player.tricksWon;
    }
    return totalTricksWon >= 13;
}

bool GameLogic::canTram(const GameState& state) {
    const auto& currentPlayer = state.players[state.currentPlayerIndex];
    const auto& hand = currentPlayer.hand;
    int totalTricksWonByAll = 0;
    for(const auto& p : state.players) {
        totalTricksWonByAll += p.tricksWon;
    }
    int remainingTricks = 13 - totalTricksWonByAll;
    if (hand.empty() || static_cast<int>(hand.size()) < remainingTricks) {
        return false;
    }
    std::vector<Card> spadesInHand;
    for (const auto& card : hand) {
        if (card.suit == Suit::SPADES) {
            spadesInHand.push_back(card);
        }
    }
    std::sort(spadesInHand.begin(), spadesInHand.end(), [](const Card& a, const Card& b) {
        return static_cast<int>(a.rank) > static_cast<int>(b.rank);
    });
    if (static_cast<int>(spadesInHand.size()) < remainingTricks) {
        return false;
    }
    for (int i = 0; i < remainingTricks; ++i) {
        int expectedRank = static_cast<int>(Rank::ACE) - i;
        if (static_cast<int>(spadesInHand[i].rank) != expectedRank) {
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
    state.currentTrick.clear();
    state.bidsMade = 0;
    for (auto& player : state.players) {
        player.hand.clear();
        player.bid = 0;
        player.tricksWon = 0;
    }
}
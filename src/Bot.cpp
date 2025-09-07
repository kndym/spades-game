#include "include/Bot.hpp"
#include <algorithm>
#include <iostream>
#include <map>

RandomBot::RandomBot() {
    std::random_device rd;
    rng.seed(rd());
}

int RandomBot::getBid(const Player& player) {
    int potentialTricks = 0;
    for(const auto& card : player.hand) {
        if (card.suit == Suit::SPADES && card.rank >= Rank::QUEEN) potentialTricks++;
        else if (card.suit != Suit::SPADES && card.rank == Rank::ACE) potentialTricks++;
        else if (card.suit != Suit::SPADES && card.rank == Rank::KING && player.hand.size() < 5) potentialTricks++;
    }
    return std::max(1, potentialTricks);
}

// Main logic for choosing a card
int RandomBot::getMove(const GameState& state, const std::vector<int>& validMoves) {
    if (validMoves.empty()) {
        // This should not happen in a valid game. If it does, we have no choice.
        return 0; 
    }

    const auto& currentPlayer = state.players[state.currentPlayerIndex];

    int teamId = state.currentPlayerIndex % 2;
    int teamBid = 0;
    int teamTricksWon = 0;
    if (teamId == 0) { // Team 1
        teamBid = state.players[0].bid + state.players[2].bid;
        teamTricksWon = state.players[0].tricksWon + state.players[2].tricksWon;
    } else { // Team 2
        teamBid = state.players[1].bid + state.players[3].bid;
        teamTricksWon = state.players[1].tricksWon + state.players[3].tricksWon;
    }
    int tricksNeeded = teamBid - teamTricksWon;

    if (state.currentTrick.empty()) { // Leading the trick
        if (tricksNeeded > 0) {
            if (hasHighWinningCard(currentPlayer, state, validMoves)) {
                return getBestWinningCard(currentPlayer, validMoves);
            } else {
                return getLowestCardOfLongestSuit(currentPlayer, validMoves);
            }
        } else {
            return getLowestCardOfShortestSuit(currentPlayer, validMoves);
        }
    } else { // Following
        Suit leadSuit = getLeadSuit(state.currentTrick);
        bool partnerIsWinning = isPartnerWinningTrick(state);

        if (hasCardOfSuit(currentPlayer, leadSuit)) {
            if (partnerIsWinning) {
                return getLowestCardOfSuit(currentPlayer, leadSuit, validMoves);
            } else {
                if (tricksNeeded > 0 && canWinTrick(currentPlayer, state.currentTrick, leadSuit, validMoves)) {
                    return getLowestWinningCardOfSuit(currentPlayer, state.currentTrick, leadSuit, validMoves);
                } else {
                    return getLowestCardOfSuit(currentPlayer, leadSuit, validMoves);
                }
            }
        } else { // Cannot follow suit
            if (hasCardOfSuit(currentPlayer, Suit::SPADES)) {
                if (partnerIsWinning) {
                    return getLowestNonSpadeCard(currentPlayer, validMoves);
                } else {
                    if (tricksNeeded > 0 && canWinWithSpade(currentPlayer, state.currentTrick, validMoves)) {
                        return getLowestWinningSpade(currentPlayer, state.currentTrick, validMoves);
                    } else {
                        return getLowestNonSpadeCard(currentPlayer, validMoves);
                    }
                }
            } else {
                // No spades, cannot follow suit
                return getLowestCardOfLongestSuit(currentPlayer, validMoves);
            }
        }
    }
}


// HELPER FUNCTIONS

Suit RandomBot::getLeadSuit(const std::vector<Card>& trick) const {
    return trick.empty() ? Suit::CLUBS : trick[0].suit; // Default to clubs if trick is empty, though this should be handled by caller
}

int RandomBot::getPartnerIndex(int playerIndex) const {
    return (playerIndex + 2) % 4;
}

Card RandomBot::getWinningCardOfTrick(const std::vector<Card>& trick) const {
    if (trick.empty()) return {}; // Return a default card if trick is empty
    
    Card winningCard = trick[0];
    for (size_t i = 1; i < trick.size(); ++i) {
        const auto& card = trick[i];
        if (card.suit == winningCard.suit) {
            if (card.rank > winningCard.rank) {
                winningCard = card;
            }
        } else if (card.suit == Suit::SPADES && winningCard.suit != Suit::SPADES) {
            winningCard = card;
        }
    }
    return winningCard;
}


bool RandomBot::isPartnerWinningTrick(const GameState& state) const {
    if (state.currentTrick.empty() || state.currentTrick.size() == 4) return false;

    int partnerIndex = getPartnerIndex(state.currentPlayerIndex);
    int trickLeaderIndex = state.trickLeaderIndex;
    
    int winningPlayerIndex = trickLeaderIndex;
    Card winningCard = state.currentTrick[0];

    for (size_t i = 1; i < state.currentTrick.size(); ++i) {
        int playerIndex = (trickLeaderIndex + i) % 4;
        const auto& card = state.currentTrick[i];
        if (card.suit == winningCard.suit) {
            if (card.rank > winningCard.rank) {
                winningCard = card;
                winningPlayerIndex = playerIndex;
            }
        } else if (card.suit == Suit::SPADES) {
            if (winningCard.suit != Suit::SPADES || card.rank > winningCard.rank) {
                winningCard = card;
                winningPlayerIndex = playerIndex;
            }
        }
    }
    return winningPlayerIndex == partnerIndex;
}

bool RandomBot::hasHighWinningCard(const Player& player, const GameState& state, const std::vector<int>& validMoves) const {
    for (int index : validMoves) {
        const Card& card = player.hand[index];
        if (card.suit != Suit::SPADES) {
            if (card.rank == Rank::ACE) return true;
            if (card.rank == Rank::KING) return true; 
        }
    }
    return false;
}

int RandomBot::getBestWinningCard(const Player& player, const std::vector<int>& validMoves) const {
    int bestCardIndex = -1;
    Rank bestRank = Rank::TWO;
    for (int index : validMoves) {
        const Card& card = player.hand[index];
        if (card.suit != Suit::SPADES && card.rank >= bestRank) { // Use >= to handle case of single high card
            bestRank = card.rank;
            bestCardIndex = index;
        }
    }
    return bestCardIndex != -1 ? bestCardIndex : validMoves[0];
}

int RandomBot::getLowestCardOfLongestSuit(const Player& player, const std::vector<int>& validMoves) const {
    std::map<Suit, std::vector<int>> suitMap;
    for (int index : validMoves) {
        if(player.hand[index].suit != Suit::SPADES)
            suitMap[player.hand[index].suit].push_back(index);
    }

    if (suitMap.empty()) { // Only spades left or only spades are valid
         for (int index : validMoves) {
            suitMap[player.hand[index].suit].push_back(index);
        }
    }

    if (suitMap.empty()) return validMoves[0];

    size_t maxLength = 0;
    Suit longestSuit = suitMap.begin()->first;
    for (auto it = suitMap.begin(); it != suitMap.end(); ++it) {
        Suit suit = it->first;
        const std::vector<int>& indices = it->second;
        if (indices.size() > maxLength) {
            maxLength = indices.size();
            longestSuit = suit;
        }
    }

    int lowestCardIndex = -1;
    Rank lowestRank = Rank::ACE;
    for (int index : suitMap[longestSuit]) {
        if (player.hand[index].rank <= lowestRank) {
            lowestRank = player.hand[index].rank;
            lowestCardIndex = index;
        }
    }
    return lowestCardIndex != -1 ? lowestCardIndex : validMoves[0];
}

int RandomBot::getLowestCardOfShortestSuit(const Player& player, const std::vector<int>& validMoves) const {
     std::map<Suit, std::vector<int>> suitMap;
    for (int index : validMoves) {
        if(player.hand[index].suit != Suit::SPADES)
            suitMap[player.hand[index].suit].push_back(index);
    }

    if (suitMap.empty()) { // Only spades left
         for (int index : validMoves) {
            suitMap[player.hand[index].suit].push_back(index);
        }
    }

    if (suitMap.empty()) return validMoves[0];

    size_t minLength = 14;
    Suit shortestSuit = suitMap.begin()->first;
    for (auto it = suitMap.begin(); it != suitMap.end(); ++it) {
        Suit suit = it->first;
        const std::vector<int>& indices = it->second;
        if (indices.size() < minLength) {
            minLength = indices.size();
            shortestSuit = suit;
        }
    }

    int lowestCardIndex = -1;
    Rank lowestRank = Rank::ACE;
    for (int index : suitMap[shortestSuit]) {
        if (player.hand[index].rank <= lowestRank) {
            lowestRank = player.hand[index].rank;
            lowestCardIndex = index;
        }
    }
    return lowestCardIndex != -1 ? lowestCardIndex : validMoves[0];
}


bool RandomBot::hasCardOfSuit(const Player& player, Suit suit) const {
    for (const auto& card : player.hand) {
        if (card.suit == suit) return true;
    }
    return false;
}

int RandomBot::getLowestCardOfSuit(const Player& player, Suit suit, const std::vector<int>& validMoves) const {
    int lowestCardIndex = -1;
    Rank lowestRank = Rank::ACE;
    for (int index : validMoves) {
        if (player.hand[index].suit == suit) {
            if (player.hand[index].rank <= lowestRank) {
                lowestRank = player.hand[index].rank;
                lowestCardIndex = index;
            }
        }
    }
    return lowestCardIndex != -1 ? lowestCardIndex : validMoves[0];
}

bool RandomBot::canWinTrick(const Player& player, const std::vector<Card>& trick, Suit leadSuit, const std::vector<int>& validMoves) const {
    Card winningCard = getWinningCardOfTrick(trick);
    if (winningCard.suit != leadSuit) return false; // A spade has already been played

    for (int index : validMoves) {
        const Card& myCard = player.hand[index];
        if (myCard.suit == leadSuit && myCard.rank > winningCard.rank) {
            return true;
        }
    }
    return false;
}

int RandomBot::getLowestWinningCardOfSuit(const Player& player, const std::vector<Card>& trick, Suit leadSuit, const std::vector<int>& validMoves) const {
    Card winningCard = getWinningCardOfTrick(trick);
    int bestCardIndex = -1;
    Rank bestRank = Rank::ACE;

    for (int index : validMoves) {
        const Card& myCard = player.hand[index];
        if (myCard.suit == leadSuit && myCard.rank > winningCard.rank) {
            if (myCard.rank <= bestRank) { // find lowest winning card
                bestRank = myCard.rank;
                bestCardIndex = index;
            }
        }
    }
    return bestCardIndex != -1 ? bestCardIndex : validMoves[0];
}

int RandomBot::getLowestNonSpadeCard(const Player& player, const std::vector<int>& validMoves) const {
    int lowestCardIndex = -1;
    Rank lowestRank = Rank::ACE;
    for (int index : validMoves) {
        if (player.hand[index].suit != Suit::SPADES) {
            if (player.hand[index].rank <= lowestRank) {
                lowestRank = player.hand[index].rank;
                lowestCardIndex = index;
            }
        }
    }
    return lowestCardIndex != -1 ? lowestCardIndex : validMoves[0];
}

bool RandomBot::canWinWithSpade(const Player& player, const std::vector<Card>& trick, const std::vector<int>& validMoves) const {
    Card winningCard = getWinningCardOfTrick(trick);
    for (int index : validMoves) {
        const Card& myCard = player.hand[index];
        if (myCard.suit == Suit::SPADES) {
            if (winningCard.suit != Suit::SPADES || myCard.rank > winningCard.rank) {
                return true;
            }
        }
    }
    return false;
}

int RandomBot::getLowestWinningSpade(const Player& player, const std::vector<Card>& trick, const std::vector<int>& validMoves) const {
    Card winningCard = getWinningCardOfTrick(trick);
    int bestCardIndex = -1;
    Rank bestRank = Rank::ACE;

    for (int index : validMoves) {
        const Card& myCard = player.hand[index];
        if (myCard.suit == Suit::SPADES) {
            if (winningCard.suit != Suit::SPADES || myCard.rank > winningCard.rank) {
                if (myCard.rank <= bestRank) {
                    bestRank = myCard.rank;
                    bestCardIndex = index;
                }
            }
        }
    }
    return bestCardIndex != -1 ? bestCardIndex : validMoves[0];
}
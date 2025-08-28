#include <iostream>
#include <vector>
#include <string>
#include <algorithm>
#include <random>
#include <chrono>

// Represents the suit of a card
enum class Suit { CLUBS, DIAMONDS, HEARTS, SPADES };

// Represents the rank of a card
enum class Rank {
    TWO, THREE, FOUR, FIVE, SIX, SEVEN, EIGHT, NINE, TEN,
    JACK, QUEEN, KING, ACE
};

// Represents a single playing card
struct Card {
    Suit suit;
    Rank rank;

    bool operator<(const Card& other) const {
        if (suit != other.suit) {
            return suit < other.suit;
        }
        return rank < other.rank;
    }
};

// Represents a player in the game
struct Player {
    std::vector<Card> hand;
    int bid = 0;
    int tricksWon = 0;
};

// Represents the entire state of the game
struct GameState {
    std::vector<Card> deck;
    std::vector<Player> players;
    int currentPlayerIndex = 0;
    std::vector<Card> currentTrick;
    int trickLeaderIndex = 0;
    bool spadesBroken = false;
    int team1Score = 0;
    int team2Score = 0;
};

// Function to get the string representation of a suit
std::string suitToString(Suit suit) {
    switch (suit) {
        case Suit::CLUBS: return "Clubs";
        case Suit::DIAMONDS: return "Diamonds";
        case Suit::HEARTS: return "Hearts";
        case Suit::SPADES: return "Spades";
    }
    return "";
}

// Function to get the string representation of a rank
std::string rankToString(Rank rank) {
    switch (rank) {
        case Rank::TWO: return "2";
        case Rank::THREE: return "3";
        case Rank::FOUR: return "4";
        case Rank::FIVE: return "5";
        case Rank::SIX: return "6";
        case Rank::SEVEN: return "7";
        case Rank::EIGHT: return "8";
        case Rank::NINE: return "9";
        case Rank::TEN: return "10";
        case Rank::JACK: return "Jack";
        case Rank::QUEEN: return "Queen";
        case Rank::KING: return "King";
        case Rank::ACE: return "Ace";
    }
    return "";
}

// Function to print a card
void printCard(const Card& card) {
    std::cout << rankToString(card.rank) << " of " << suitToString(card.suit);
}

// Function to print a player's hand
void printHand(const std::vector<Card>& hand) {
    for (size_t i = 0; i < hand.size(); ++i) {
        std::cout << i + 1 << ": ";
        printCard(hand[i]);
        std::cout << std::endl;
    }
}

// Function to initialize a standard 52-card deck
void initializeDeck(std::vector<Card>& deck) {
    deck.clear();
    for (int s = 0; s < 4; ++s) {
        for (int r = 0; r < 13; ++r) {
            deck.push_back({static_cast<Suit>(s), static_cast<Rank>(r)});
        }
    }
}

// Function to shuffle the deck
void shuffleDeck(std::vector<Card>& deck) {
    unsigned seed = std::chrono::system_clock::now().time_since_epoch().count();
    std::shuffle(deck.begin(), deck.end(), std::default_random_engine(seed));
}

// Function to deal cards to players
void dealCards(GameState& state) {
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

// Function for players to make bids
void getBids(GameState& state) {
    for (int i = 0; i < 4; ++i) {
        std::cout << "\nPlayer " << i + 1 << "'s turn to bid." << std::endl;
        printHand(state.players[i].hand);
        int bid;
        do {
            std::cout << "Enter your bid (0-13): ";
            std::cin >> bid;
        } while (bid < 0 || bid > 13);
        state.players[i].bid = bid;
    }
}

// Function to get the valid moves for the current player
std::vector<int> getValidMoves(const GameState& state) {
    std::vector<int> validMoves;
    const auto& hand = state.players[state.currentPlayerIndex].hand;
    if (state.currentTrick.empty()) { // Leading the trick
        if (state.spadesBroken) {
            for (size_t i = 0; i < hand.size(); ++i) {
                validMoves.push_back(i);
            }
        } else {
            bool hasNonSpade = false;
            for (const auto& card : hand) {
                if (card.suit != Suit::SPADES) {
                    hasNonSpade = true;
                    break;
                }
            }
            if (hasNonSpade) {
                for (size_t i = 0; i < hand.size(); ++i) {
                    if (hand[i].suit != Suit::SPADES) {
                        validMoves.push_back(i);
                    }
                }
            } else { // Only has spades
                for (size_t i = 0; i < hand.size(); ++i) {
                    validMoves.push_back(i);
                }
            }
        }
    } else { // Following suit
        Suit ledSuit = state.currentTrick[0].suit;
        bool canFollowSuit = false;
        for (const auto& card : hand) {
            if (card.suit == ledSuit) {
                canFollowSuit = true;
                break;
            }
        }
        if (canFollowSuit) {
            for (size_t i = 0; i < hand.size(); ++i) {
                if (hand[i].suit == ledSuit) {
                    validMoves.push_back(i);
                }
            }
        } else { // Cannot follow suit, can play anything
            for (size_t i = 0; i < hand.size(); ++i) {
                validMoves.push_back(i);
            }
        }
    }
    return validMoves;
}

// Function to determine the winner of a trick
int determineTrickWinner(const GameState& state) {
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
            if (winningCard.suit != Suit::SPADES) {
                winningCard = card;
                winnerIndex = playerIndex;
            } else if (card.rank > winningCard.rank) {
                winningCard = card;
                winnerIndex = playerIndex;
            }
        }
    }
    return winnerIndex;
}

// Function to update the score at the end of a round
void updateScores(GameState& state) {
    int team1Tricks = state.players[0].tricksWon + state.players[2].tricksWon;
    int team1Bid = state.players[0].bid + state.players[2].bid;
    int team2Tricks = state.players[1].tricksWon + state.players[3].tricksWon;
    int team2Bid = state.players[1].bid + state.players[3].bid;

    // Team 1
    if (team1Tricks >= team1Bid) {
        state.team1Score += team1Bid * 10 + (team1Tricks - team1Bid);
    } else {
        state.team1Score -= team1Bid * 10;
    }

    // Team 2
    if (team2Tricks >= team2Bid) {
        state.team2Score += team2Bid * 10 + (team2Tricks - team2Bid);
    } else {
        state.team2Score -= team2Bid * 10;
    }

    // Reset for next round
    for (auto& player : state.players) {
        player.tricksWon = 0;
        player.bid = 0;
    }
    state.spadesBroken = false;
}

// Main game loop
int main() {
    GameState state;
    state.players.resize(4);
    int startingPlayer = 0;

    while (state.team1Score < 500 && state.team2Score < 500) {
        initializeDeck(state.deck);
        shuffleDeck(state.deck);
        dealCards(state);
        getBids(state);

        state.currentPlayerIndex = startingPlayer;
        state.trickLeaderIndex = startingPlayer;

        for (int trick = 0; trick < 13; ++trick) {
            state.currentTrick.clear();
            for (int i = 0; i < 4; ++i) {
                std::cout << "\nPlayer " << state.currentPlayerIndex + 1 << "'s turn." << std::endl;
                printHand(state.players[state.currentPlayerIndex].hand);

                if (!state.currentTrick.empty()) {
                    std::cout << "Current trick:" << std::endl;
                    for (const auto& card : state.currentTrick) {
                        printCard(card);
                        std::cout << " ";
                    }
                    std::cout << std::endl;
                }

                auto validMoves = getValidMoves(state);
                std::cout << "Valid moves: ";
                for (int move : validMoves) {
                    std::cout << move + 1 << " ";
                }
                std::cout << std::endl;

                int choice;
                bool validChoice = false;
                do {
                    std::cout << "Choose a card to play: ";
                    std::cin >> choice;
                    for (int move : validMoves) {
                        if (choice - 1 == move) {
                            validChoice = true;
                            break;
                        }
                    }
                } while (!validChoice);

                Card playedCard = state.players[state.currentPlayerIndex].hand[choice - 1];
                if (playedCard.suit == Suit::SPADES) {
                    state.spadesBroken = true;
                }
                state.currentTrick.push_back(playedCard);
                state.players[state.currentPlayerIndex].hand.erase(state.players[state.currentPlayerIndex].hand.begin() + choice - 1);

                state.currentPlayerIndex = (state.currentPlayerIndex + 1) % 4;
            }

            int trickWinner = determineTrickWinner(state);
            state.players[trickWinner].tricksWon++;
            std::cout << "\nPlayer " << trickWinner + 1 << " wins the trick." << std::endl;
            state.currentPlayerIndex = trickWinner;
            state.trickLeaderIndex = trickWinner;
        }

        updateScores(state);
        std::cout << "\n--- End of Round ---" << std::endl;
        std::cout << "Team 1 (P1 & P3) Score: " << state.team1Score << std::endl;
        std::cout << "Team 2 (P2 & P4) Score: " << state.team2Score << std::endl;
        startingPlayer = (startingPlayer + 1) % 4;
    }

    std::cout << "\n--- Game Over ---" << std::endl;
    if (state.team1Score >= 500) {
        std::cout << "Team 1 wins!" << std::endl;
    } else {
        std::cout << "Team 2 wins!" << std::endl;
    }

    return 0;
}
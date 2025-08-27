
#include "../include/UI.hpp"
#include <iostream>

std::string UI::suitToString(Suit suit) {
    switch (suit) {
        case Suit::CLUBS:    return "♣";
        case Suit::DIAMONDS: return "♦";
        case Suit::HEARTS:   return "♥";
        case Suit::SPADES:   return "♠";
    }
    return "";
}

std::string UI::rankToString(Rank rank) {
    switch (rank) {
        case Rank::TWO: return "2";
        case Rank::THREE: return "3";
        case Rank::FOUR: return "4";
        case Rank::FIVE: return "5";
        case Rank::SIX: return "6";
        case Rank::SEVEN: return "7";
        case Rank::EIGHT: return "8";
        case Rank::NINE: return "9";
        case Rank::TEN: return "T";
        case Rank::JACK: return "J";
        case Rank::QUEEN: return "Q";
        case Rank::KING: return "K";
        case Rank::ACE: return "A";
    }
    return "";
}

void UI::printCard(const Card& card) {
    std::cout << rankToString(card.rank) << suitToString(card.suit);
}

void UI::printHand(const std::vector<Card>& hand) {
    for (const auto& card : hand) {
        printCard(card);
        std::cout << " ";
    }
    std::cout << std::endl;
}

void UI::printRoundStart(const GameState& state) {
    std::cout << "\n================ NEW ROUND ================" << std::endl;
    UI::printScores(state);
    std::cout << "-------------------------------------------" << std::endl;
}

void UI::printTurnInfo(const GameState& state) {
    std::cout << "\n--- Player " << state.currentPlayerIndex + 1 << "'s Turn ---" << std::endl;
    std::cout << "Hand: ";
    printHand(state.players[state.currentPlayerIndex].hand);

    if (!state.currentTrick.empty()) {
        std::cout << "Trick: ";
        for (const auto& card : state.currentTrick) {
            printCard(card);
            std::cout << " ";
        }
        std::cout << std::endl;
    }
}

void UI::printTrickWinner(int winnerIndex, const std::vector<Card>& trick) {
    std::cout << "Trick Winner: Player " << winnerIndex + 1 << " with ";
    printCard(trick.back());
    std::cout << std::endl;
}

void UI::printScores(const GameState& state) {
    std::cout << "Team 1 (P1/P3) Score: " << state.team1Score
              << " | Team 2 (P2/P4) Score: " << state.team2Score << std::endl;
}

void UI::printFinalScores(const GameState& state) {
    std::cout << "\n================ GAME OVER ================" << std::endl;
    printScores(state);
    if(state.team1Score > state.team2Score) {
        std::cout << "Team 1 WINS!" << std::endl;
    } else if (state.team2Score > state.team1Score) {
        std::cout << "Team 2 WINS!" << std::endl;
    } else {
        std::cout << "It's a TIE!" << std::endl;
    }
    std::cout << "=========================================" << std::endl;
}
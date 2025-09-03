#pragma once

#include <string>

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
#ifndef IBOT_HPP
#define IBOT_HPP

#include "SpadesTypes.hpp"
#include "Player.hpp"
#include "GameState.hpp"
#include <vector>

class IBot {
public:
    virtual ~IBot() = default;
    virtual int getBid(const Player& player, const GameState& state) = 0;
    virtual int getMove(const GameState& state, const std::vector<int>& validMoves) = 0;
};

#endif // IBOT_HPP
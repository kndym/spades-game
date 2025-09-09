#ifndef MCTSBOT_HPP
#define MCTSBOT_HPP

#include "Bot.hpp"
#include "GameState.hpp"
#include "ONNXModel.hpp"
#include <memory>
#include <random>
#include <vector> // Required for std::vector<int64_t>

// Forward declaration
class MCTSNode;

class MCTSBot : public IBot {
public:
    MCTSBot(int simulations_per_move,
            std::shared_ptr<ONNXModel> nn1, // Bidding
            std::shared_ptr<ONNXModel> nn2, // Playing
            std::shared_ptr<ONNXModel> nn3  // Win Prediction
    );

    int getBid(const Player& player, const GameState& state) override;
    int getMove(const GameState& state, const std::vector<int>& validMoves) override;

    // Public for DataCollector to access
    std::vector<float> getLastActionProbs() const { return lastActionProbs; }
    std::vector<float> getLastValueEstimate() const { return lastValueEstimate; }


private:
    int simulationsPerMove;
    std::shared_ptr<ONNXModel> nn1_model;
    std::shared_ptr<ONNXModel> nn2_model;
    std::shared_ptr<ONNXModel> nn3_model;
    std::mt19937 rng;

    std::vector<float> lastActionProbs;   // Policy output from root MCTS search
    std::vector<float> lastValueEstimate; // Value output from root MCTS search (for NN3)


    std::unique_ptr<MCTSNode> runMCTS(const GameState& rootState, bool isBidding);
};

#endif // MCTSBOT_HPP
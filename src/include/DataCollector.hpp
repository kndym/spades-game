#ifndef DATACOLLECTOR_HPP
#define DATACOLLECTOR_HPP

#include "GameState.hpp"
#include "MCTSBot.hpp"
#include <fstream>
#include <vector>
#include <string>
#include <numeric> // For std::accumulate

class DataCollector {
public:
    DataCollector(const std::string& filepath);
    ~DataCollector();

    void record(const GameState& state, MCTSBot& bot, bool isBidding);
    void finalize(int winning_team_id);

private:
    struct TrainingSample {
        std::vector<float> state_features;
        std::vector<float> policy_target;
        float value_target; // MCTS value estimate, NOT final game outcome for NN3
        int player_idx; // Track which player made the move for perspective during finalization
    };

    std::ofstream file;
    std::vector<TrainingSample> game_buffer;

    // Feature extraction helpers
    std::vector<float> extractBidFeatures(const GameState& state);
    std::vector<float> extractPlayFeatures(const GameState& state);
};


#endif // DATACOLLECTOR_HPP
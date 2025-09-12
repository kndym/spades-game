#ifndef DATACOLLECTOR_HPP
#define DATACOLLECTOR_HPP

#include "GameState.hpp"
#include "MCTSBot.hpp"
#include "test.pb.h" // Include the generated Protobuf header
#include <fstream>
#include <vector>
#include <string>

class DataCollector {
public:
    DataCollector(const std::string& filepath);
    ~DataCollector();

    void record(const GameState& state, MCTSBot& bot, bool isBidding);
    void finalize(int winning_team_id);

private:
    // The buffer now holds the type-safe Protobuf message objects
    std::vector<TrainingSample> game_buffer;
    std::ofstream file;

    // Feature extraction helpers remain the same
    std::vector<float> extractBidFeatures(const GameState& state);
    std::vector<float> extractPlayFeatures(const GameState& state);
};

#endif // DATACOLLECTOR_HPP
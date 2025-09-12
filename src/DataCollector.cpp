#include "include/DataCollector.hpp"
#include "include/MCTSBot.hpp"
#include <stdexcept>

DataCollector::DataCollector(const std::string & filepath) {
    // Open in binary mode as Protobuf is a binary format
    file.open(filepath, std::ios::binary | std::ios::app);
    if (!file.is_open()) {
        throw std::runtime_error("Could not open data file for writing: " + filepath);
    }
}

DataCollector::~DataCollector() {
    if (file.is_open()) {
        file.close();
    }
}

void DataCollector::record(const GameState& state, MCTSBot& bot, bool isBidding) {
    // Create a Protobuf message object instead of a custom struct
    TrainingSample sample;

    sample.set_is_bidding(isBidding);
    sample.set_player_idx(state.currentPlayerIndex);

    // Get features and policy targets
    std::vector<float> features = isBidding ? extractBidFeatures(state) : extractPlayFeatures(state);
    std::vector<float> policy = bot.getLastActionProbs();
    auto value_vec = bot.getLastValueEstimate();

    // Populate the Protobuf message using the generated setters
    for (float f : features) {
        sample.add_state_features(f);
    }
    for (float p : policy) {
        sample.add_policy_target(p);
    }

    if (!value_vec.empty()) {
        sample.set_value_target(value_vec[0]);
    } else {
        sample.set_value_target(0.5f); // Default value
    }

    // actual_game_win_value will be set in finalize()
    game_buffer.push_back(sample);
}

void DataCollector::finalize(int winning_team_id) {
    for (auto& sample : game_buffer) {
        // Determine the final game outcome for this player's team
        int sample_player_team_id = sample.player_idx() % 2;
        float actual_win = (sample_player_team_id == winning_team_id) ? 1.0f : 0.0f;
        sample.set_actual_game_win_value(actual_win);

        // Serialize the entire message to a binary string
        std::string serialized_data;
        if (!sample.SerializeToString(&serialized_data)) {
            throw std::runtime_error("Failed to serialize training sample.");
        }

        // Write the data using a size-delimited format. This is robust.
        // 1. Write the size of the upcoming message as a 32-bit integer.
        // 2. Write the actual message data.
        int32_t size = serialized_data.size();
        file.write(reinterpret_cast<const char*>(&size), sizeof(size));
        file.write(serialized_data.c_str(), size);
    }
    game_buffer.clear();
}


// --- Feature extraction helpers do not need to change ---
std::vector<float> DataCollector::extractBidFeatures(const GameState& state) {
    // ... same implementation as before
    std::vector<float> features;
    features.push_back(static_cast<float>(state.team1Score));
    features.push_back(static_cast<float>(state.team2Score));
    features.push_back(static_cast<float>(state.team1Bags));
    features.push_back(static_cast<float>(state.team2Bags));
    for (int i = 0; i < 4; ++i) {
        features.push_back(static_cast<float>((i < state.bidsMade) ? state.players[i].bid : -1.0f));
    }
    return features;
}

std::vector<float> DataCollector::extractPlayFeatures(const GameState& state) {
    // ... same implementation as before
    std::vector<float> features;
    features.push_back(static_cast<float>(state.team1Score));
    features.push_back(static_cast<float>(state.team2Score));
    features.push_back(static_cast<float>(state.team1Bags));
    features.push_back(static_cast<float>(state.team2Bags));
    for (int i = 0; i < 4; ++i) { features.push_back(static_cast<float>(state.players[i].bid)); }
    std::vector<bool> hand_encoding(52, false);
    for (const auto& card : state.players[state.currentPlayerIndex].hand) { hand_encoding[static_cast<int>(card.suit) * 13 + static_cast<int>(card.rank)] = true; }
    for (bool bit : hand_encoding) { features.push_back(static_cast<float>(bit)); }
    std::vector<bool> trick_encoding(52, false);
    for (const auto& card : state.currentTrick) { trick_encoding[static_cast<int>(card.suit) * 13 + static_cast<int>(card.rank)] = true; }
    for (bool bit : trick_encoding) { features.push_back(static_cast<float>(bit)); }
    for (int i = 0; i < 4; ++i) { features.push_back(static_cast<float>(state.players[i].tricksWon)); }
    features.push_back(static_cast<float>(state.spadesBroken ? 1.0f : 0.0f));
    features.push_back(static_cast<float>(state.currentPlayerIndex));
    return features;
}
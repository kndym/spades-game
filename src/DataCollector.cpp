#include "include/DataCollector.hpp"
#include "include/MCTSBot.hpp"
#include <stdexcept>

DataCollector::DataCollector(const std::string& filepath) {
    // Open in binary mode, as Protobuf serialization is binary
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
    // 1. Create a Protobuf message object
    TrainingSample sample;

    // 2. Populate the message using the generated, type-safe setters
    sample.set_is_bidding(isBidding);
    sample.set_player_idx(state.currentPlayerIndex);

    std::vector<float> features = isBidding ? extractBidFeatures(state) : extractPlayFeatures(state);
    std::vector<float> policy = bot.getLastActionProbs();
    auto value_vec = bot.getLastValueEstimate();

    // For 'repeated' fields, loop and use the 'add_*' method
    for (float f : features) {
        sample.add_state_features(f);
    }
    for (float p : policy) {
        sample.add_policy_target(p);
    }

    if (!value_vec.empty()) {
        sample.set_value_target(value_vec[0]);
    }
    else {
        sample.set_value_target(0.5f); // Set a default
    }

    // 3. Add the populated object to the in-memory buffer
    // The 'actual_game_win_value' will be set later in finalize()
    game_buffer.push_back(sample);
}

void DataCollector::finalize(int winning_team_id) {
    for (auto& sample : game_buffer) {
        // a. Set the final field on the buffered sample
        int sample_player_team_id = sample.player_idx() % 2;
        float actual_win = (sample_player_team_id == winning_team_id) ? 1.0f : 0.0f;
        sample.set_actual_game_win_value(actual_win);

        // b. Serialize the entire message object to a binary string
        std::string serialized_data;
        if (!sample.SerializeToString(&serialized_data)) {
            // This is a critical error if it fails
            throw std::runtime_error("Failed to serialize training sample.");
        }

        // c. Write the data using a robust, size-delimited format
        //    This prevents any possible misalignment during reading.
        //    First, write the size of the message as a 4-byte integer.
        //    Then, write the actual message data.
        int32_t size = static_cast<int32_t>(serialized_data.size());
        file.write(reinterpret_cast<const char*>(&size), sizeof(size));
        file.write(serialized_data.c_str(), size);
    }
    game_buffer.clear();
}


// --- Feature Extraction Helpers ---
// These functions do NOT need to change. Their job is simply to generate
// the feature vectors, which are then used to populate the Protobuf message.

std::vector<float> DataCollector::extractBidFeatures(const GameState& state) {
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
#include "include/DataCollector.hpp"
#include "include/MCTSBot.hpp" // For NN feature extraction helpers
#include <stdexcept>
#include <numeric> // For std::accumulate

DataCollector::DataCollector(const std::string & filepath) {
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
    TrainingSample sample;
    sample.player_idx = state.currentPlayerIndex; // Record the player who made the decision

    if (isBidding) {
        sample.state_features = extractBidFeatures(state);
        sample.policy_target = bot.getLastActionProbs(); // Policy for NN1 (bids)
    }
    else {
        sample.state_features = extractPlayFeatures(state);
        sample.policy_target = bot.getLastActionProbs(); // Policy for NN2 (card plays)
    }

    // Value target comes directly from the MCTS root's value estimate for this state
    // This is crucial for training a strong value head, rather than just final game outcome.
    auto value_vec = bot.getLastValueEstimate();
    if (!value_vec.empty()) {
        sample.value_target = value_vec[0];
    }
    else {
        sample.value_target = 0.5f; // Default if MCTS somehow failed to produce a value
    }

    game_buffer.push_back(sample);
}

void DataCollector::finalize(int winning_team_id) {
    // Write all buffered samples for this game with the final outcome
    for (auto& sample : game_buffer) {
        // Determine the actual win/loss (1.0 for win, 0.0 for loss) for the player's team
        // This is used for NN3 training, where the final game outcome is the true label.
        int sample_player_team_id = sample.player_idx % 2;
        float actual_game_win_value = (sample_player_team_id == winning_team_id) ? 1.0f : 0.0f;

        // Write to file in binary format
        // Format: [isBidding (int32), player_idx (int32), state_size, state_data, policy_size, policy_data, value_target_from_MCTS, actual_game_win_value]
        int32_t is_bidding_flag = (sample.policy_target.size() == 14) ? 1 : 0;
        file.write(reinterpret_cast<const char*>(&is_bidding_flag), sizeof(is_bidding_flag));

        int32_t player_idx = sample.player_idx; // Also store player index
        file.write(reinterpret_cast<const char*>(&player_idx), sizeof(player_idx));

        // Explicitly cast size_t to int32_t to resolve C4267 warnings
        int32_t state_size = static_cast<int32_t>(sample.state_features.size());
        file.write(reinterpret_cast<const char*>(&state_size), sizeof(state_size));
        file.write(reinterpret_cast<const char*>(sample.state_features.data()), state_size * sizeof(float));

        // Explicitly cast size_t to int32_t to resolve C4267 warnings
        int32_t policy_size = static_cast<int32_t>(sample.policy_target.size());
        file.write(reinterpret_cast<const char*>(&policy_size), sizeof(policy_size));
        file.write(reinterpret_cast<const char*>(sample.policy_target.data()), policy_size * sizeof(float));

        file.write(reinterpret_cast<const char*>(&sample.value_target), sizeof(float)); // MCTS value estimate
        file.write(reinterpret_cast<const char*>(&actual_game_win_value), sizeof(float)); // Actual game win/loss
    }
    game_buffer.clear();
}


// These feature extraction helpers are moved from MCTSBot.cpp
// and are used by DataCollector to save the state features.
// They must match the features expected by your Python NNs.
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
    // Add team scores and bags
    features.push_back(static_cast<float>(state.team1Score));
    features.push_back(static_cast<float>(state.team2Score));
    features.push_back(static_cast<float>(state.team1Bags));
    features.push_back(static_cast<float>(state.team2Bags));

    // Add all player bids
    for (int i = 0; i < 4; ++i) {
        features.push_back(static_cast<float>(state.players[i].bid));
    }

    // Add cards in hand (52-bit multi-hot encoding)
    std::vector<bool> hand_encoding(52, false);
    for (const auto& card : state.players[state.currentPlayerIndex].hand) {
        hand_encoding[static_cast<int>(card.suit) * 13 + static_cast<int>(card.rank)] = true;
    }
    for (bool bit : hand_encoding) {
        features.push_back(static_cast<float>(bit));
    }

    // Add cards in current trick (52-bit multi-hot encoding)
    std::vector<bool> trick_encoding(52, false);
    for (const auto& card : state.currentTrick) {
        trick_encoding[static_cast<int>(card.suit) * 13 + static_cast<int>(card.rank)] = true;
    }
    for (bool bit : trick_encoding) {
        features.push_back(static_cast<float>(bit));
    }

    // Add tricks won by each player
    for (int i = 0; i < 4; ++i) {
        features.push_back(static_cast<float>(state.players[i].tricksWon));
    }

    // Indicate if spades are broken
    features.push_back(static_cast<float>(state.spadesBroken ? 1.0f : 0.0f));

    // Current player index
    features.push_back(static_cast<float>(state.currentPlayerIndex));

    return features;
}
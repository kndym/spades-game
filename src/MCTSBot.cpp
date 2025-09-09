#include "include/MCTSBot.hpp"
#include "include/GameLogic.hpp"
#include <cmath>
#include <numeric>
#include <algorithm>
#include <iostream>
#include <stdexcept>
#include <map>

// --- MCTS Node Definition (Internal to this file) ---
class MCTSNode {
public:
    GameState state;
    MCTSNode* parent;
    std::vector<std::unique_ptr<MCTSNode>> children;
    int visit_count;
    double value_sum;
    int action_idx; // The index of the move that led to this node
    bool is_bidding_node;
    std::vector<float> prior_probabilities; // Policy prediction from NN1/NN2 for this node

    MCTSNode(GameState s, MCTSNode* p, int action, bool is_bidding, std::vector<float> priors = {})
        : state(s), parent(p), visit_count(0), value_sum(0.0), action_idx(action), is_bidding_node(is_bidding), prior_probabilities(priors) {
    }

    bool is_fully_expanded(const GameState& current_state) const {
        if (is_bidding_node) {
            // For bidding, we expand all 14 possible bids (0-13)
            return children.size() == 14;
        }
        else {
            // For playing, we expand all valid moves in the current state
            return children.size() == GameLogic::getValidMoves(current_state).size();
        }
    }

    double get_ucb1_score(double exploration_constant) const {
        if (visit_count == 0) {
            // Return a very high value for unvisited nodes to encourage exploration
            // If prior probabilities are available, use them to bias initial exploration
            if (!prior_probabilities.empty() && action_idx >= 0 && action_idx < prior_probabilities.size()) {
                // Large initial value, biased by prior. Add a small epsilon to prior to avoid log(0)
                return std::numeric_limits<double>::max() * (prior_probabilities[action_idx] + 1e-6);
            }
            return std::numeric_limits<double>::max();
        }
        double exploitation_term = value_sum / visit_count;
        double exploration_term = exploration_constant * std::sqrt(std::log(static_cast<double>(parent->visit_count)) / visit_count);

        // PUCT formula variant: incorporate prior probability
        if (!prior_probabilities.empty() && action_idx >= 0 && action_idx < prior_probabilities.size()) {
            // Scale exploration term by prior
            exploration_term *= prior_probabilities[action_idx];
        }

        return exploitation_term + exploration_term;
    }

    MCTSNode* select_best_child(double exploration_constant) {
        if (children.empty()) {
            throw std::runtime_error("Attempted to select child from node with no children.");
        }
        auto best_child_it = std::max_element(children.begin(), children.end(),
            [exploration_constant](const auto& a, const auto& b) {
                return a->get_ucb1_score(exploration_constant) < b->get_ucb1_score(exploration_constant);
            });
        return best_child_it->get();
    }
};


// --- MCTSBot Implementation ---

MCTSBot::MCTSBot(int simulations_per_move,
    std::shared_ptr<ONNXModel> nn1,
    std::shared_ptr<ONNXModel> nn2,
    std::shared_ptr<ONNXModel> nn3)
    : simulationsPerMove(simulations_per_move),
    nn1_model(nn1), nn2_model(nn2), nn3_model(nn3) {
    std::random_device rd;
    rng.seed(rd());
}

// Helper to convert game state to a feature vector for NN3
std::vector<float> stateToNN3Features(const GameState& state, int perspective_player_idx) {
    int perspective_team_id = perspective_player_idx % 2; // 0 for team 1, 1 for team 2
    float team_score = (perspective_team_id == 0) ? static_cast<float>(state.team1Score) : static_cast<float>(state.team2Score);
    float other_team_score = (perspective_team_id == 1) ? static_cast<float>(state.team1Score) : static_cast<float>(state.team2Score);
    float team_bags = (perspective_team_id == 0) ? static_cast<float>(state.team1Bags) : static_cast<float>(state.team2Bags);
    float other_team_bags = (perspective_team_id == 1) ? static_cast<float>(state.team1Bags) : static_cast<float>(state.team2Bags);

    return { team_score + other_team_score, team_score - other_team_score, team_bags, other_team_bags };
}

// Helper to convert game state to feature vector for NN1 (Bidding)
std::vector<float> stateToNN1Features(const GameState& state) {
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

// Helper to convert game state to feature vector for NN2 (Playing)
std::vector<float> stateToNN2Features(const GameState& state) {
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

    // Add trick history (e.g., last 3 tricks played - more complex, placeholder for now)
    // For simplicity, we'll just add the current number of tricks won by each player
    for (int i = 0; i < 4; ++i) {
        features.push_back(static_cast<float>(state.players[i].tricksWon));
    }

    // Indicate if spades are broken
    features.push_back(static_cast<float>(state.spadesBroken ? 1.0f : 0.0f));

    // Current player index
    features.push_back(static_cast<float>(state.currentPlayerIndex));

    return features;
}


std::unique_ptr<MCTSNode> MCTSBot::runMCTS(const GameState& rootState, bool isBidding) {
    auto root = std::make_unique<MCTSNode>(rootState, nullptr, -1, isBidding);

    // Get policy priors from NN1/NN2 if models are available
    if (isBidding && nn1_model) {
        std::vector<float> nn1_features = stateToNN1Features(rootState);
        std::vector<int64_t> nn1_shape = { 1, static_cast<int64_t>(nn1_features.size()) };
        root->prior_probabilities = nn1_model->predict(nn1_features, nn1_shape);
    }
    else if (!isBidding && nn2_model) {
        std::vector<float> nn2_features = stateToNN2Features(rootState);
        std::vector<int64_t> nn2_shape = { 1, static_cast<int64_t>(nn2_features.size()) };
        // Ensure NN2 output is masked for valid moves
        std::vector<float> raw_nn2_output = nn2_model->predict(nn2_features, nn2_shape);

        std::vector<int> valid_moves = GameLogic::getValidMoves(rootState);
        root->prior_probabilities.assign(raw_nn2_output.size(), 0.0f); // Initialize to zeros

        float sum_valid_probs = 0.0f; // Use float for sum
        for (int move_idx : valid_moves) {
            if (move_idx < raw_nn2_output.size()) {
                root->prior_probabilities[move_idx] = raw_nn2_output[move_idx];
                sum_valid_probs += raw_nn2_output[move_idx];
            }
        }
        // Normalize only valid moves
        if (sum_valid_probs > 0) {
            for (int move_idx : valid_moves) {
                if (move_idx < root->prior_probabilities.size()) {
                    root->prior_probabilities[move_idx] /= sum_valid_probs;
                }
            }
        }
        else { // Fallback to uniform if NN gives all zeros for valid moves
            for (int move_idx : valid_moves) {
                if (move_idx < root->prior_probabilities.size()) {
                    root->prior_probabilities[move_idx] = 1.0f / valid_moves.size();
                }
            }
        }
    }


    for (int i = 0; i < simulationsPerMove; ++i) {
        MCTSNode* current_node = root.get();
        GameState sim_state = rootState; // Copy for simulation, MCTSNode stores its own state

        // 1. SELECTION
        while (!GameLogic::isRoundOver(sim_state) && current_node->is_fully_expanded(sim_state)) {
            current_node = current_node->select_best_child(1.41); // UCT constant
            // Apply the action of the selected child to update sim_state for deeper selection
            if (current_node->is_bidding_node) {
                GameLogic::applyBid(sim_state, current_node->action_idx);
            }
            else {
                // We need to know which card was played for the trick in sim_state
                // This requires a more robust applyMove in GameLogic that tracks original hand indices
                // For simplicity here, we assume validMoves are hand indices.
                // A better approach for sim_state would be to rebuild the hand if needed for applyMove
                GameLogic::applyMove(sim_state, current_node->action_idx);
            }
        }

        // 2. EXPANSION
        if (!GameLogic::isRoundOver(sim_state) && !current_node->is_fully_expanded(sim_state)) {
            std::vector<int> available_moves_for_expansion; // The actual moves (bids or hand indices)
            if (current_node->is_bidding_node) {
                for (int bid_val = 0; bid_val <= 13; ++bid_val) {
                    // Check if this bid has already been expanded
                    bool expanded = false;
                    for (const auto& child : current_node->children) {
                        if (child->action_idx == bid_val) {
                            expanded = true;
                            break;
                        }
                    }
                    if (!expanded) {
                        available_moves_for_expansion.push_back(bid_val);
                        break; // Expand only one new node per iteration
                    }
                }
            }
            else { // Playing card
                std::vector<int> valid_moves = GameLogic::getValidMoves(sim_state);
                for (int move_idx : valid_moves) {
                    bool expanded = false;
                    for (const auto& child : current_node->children) {
                        if (child->action_idx == move_idx) {
                            expanded = true;
                            break;
                        }
                    }
                    if (!expanded) {
                        available_moves_for_expansion.push_back(move_idx);
                        break; // Expand only one new node per iteration
                    }
                }
            }

            if (!available_moves_for_expansion.empty()) {
                int move_to_expand_idx = available_moves_for_expansion[0]; // Take the first unexpanded move
                GameState next_state_for_child = sim_state; // Start from the current sim_state
                if (current_node->is_bidding_node) {
                    GameLogic::applyBid(next_state_for_child, move_to_expand_idx);
                }
                else {
                    GameLogic::applyMove(next_state_for_child, move_to_expand_idx);
                }

                // Get policy priors for the *new* child node
                std::vector<float> child_priors;
                if (isBidding && nn1_model) {
                    std::vector<float> child_nn1_features = stateToNN1Features(next_state_for_child);
                    std::vector<int64_t> child_nn1_shape = { 1, static_cast<int64_t>(child_nn1_features.size()) };
                    child_priors = nn1_model->predict(child_nn1_features, child_nn1_shape);
                }
                else if (!isBidding && nn2_model) {
                    std::vector<float> child_nn2_features = stateToNN2Features(next_state_for_child);
                    std::vector<int64_t> child_nn2_shape = { 1, static_cast<int64_t>(child_nn2_features.size()) };
                    child_priors = nn2_model->predict(child_nn2_features, child_nn2_shape);
                    // Mask and normalize child_priors for valid moves here if needed
                }

                current_node->children.push_back(std::make_unique<MCTSNode>(next_state_for_child, current_node, move_to_expand_idx, isBidding, child_priors));
                current_node = current_node->children.back().get();
            }
        }

        // 3. SIMULATION (ROLLOUT)
        // Ensure sim_state is reset to the state of the node we are rolling out from.
        // This is crucial. If we expanded, sim_state is already at the expanded node's state.
        // If no expansion, sim_state is at the selected node's state.
        RandomBot rollout_bot; // Use RandomBot for fast rollouts for now
        int current_rollout_player_idx = sim_state.currentPlayerIndex; // Track who's turn it is in the rollout

        while (!GameLogic::isGameOver(sim_state) && !GameLogic::isRoundOver(sim_state)) {
            if (sim_state.bidsMade < 4) { // Bidding phase during rollout
                int bid = rollout_bot.getBid(sim_state.players[current_rollout_player_idx], sim_state);
                GameLogic::applyBid(sim_state, bid);
            }
            else { // Playing phase during rollout
                std::vector<int> valid_moves = GameLogic::getValidMoves(sim_state);
                if (valid_moves.empty()) { // Should not happen in a valid game, but guard against infinite loops
                    break;
                }
                int move_idx = rollout_bot.getMove(sim_state, valid_moves);
                GameLogic::applyMove(sim_state, move_idx);
            }
            current_rollout_player_idx = sim_state.currentPlayerIndex; // Update for next turn in rollout
        }

        // After rollout, calculate score and get win probability from NN3
        int t1_round_points, t2_round_points; // dummy vars, will update state scores
        GameLogic::updateScores(sim_state, t1_round_points, t2_round_points); // updates sim_state.teamXScore/Bags

        int perspective_team_id = rootState.currentPlayerIndex % 2; // For NN3, we need perspective of the *root player's* team
        auto nn3_features = stateToNN3Features(sim_state, perspective_team_id);
        std::vector<int64_t> nn3_shape = { 1, 4 }; // Batch size 1, 4 features

        double value = 0.5; // Default if NN3 not available
        if (nn3_model) {
            auto result_vec = nn3_model->predict(nn3_features, nn3_shape);
            if (!result_vec.empty()) {
                value = result_vec[0]; // NN3 predicts win probability (0 to 1)
            }
        }


        // 4. BACKPROPAGATION
        while (current_node != nullptr) {
            current_node->visit_count++;
            current_node->value_sum += value;
            current_node = current_node->parent;
        }
    }

    // Store policy and value from root node for training data
    lastActionProbs.assign(isBidding ? 14 : rootState.players[rootState.currentPlayerIndex].hand.size(), 0.0f);
    float total_visits = 0.0f; // Initialize as float
    for (const auto& child : root->children) {
        if (isBidding && child->action_idx < 14) {
            lastActionProbs[child->action_idx] += static_cast<float>(child->visit_count); // Cast to float
            total_visits += static_cast<float>(child->visit_count); // Cast to float
        }
        else if (!isBidding && child->action_idx < lastActionProbs.size()) { // For playing, action_idx is hand index
            lastActionProbs[child->action_idx] += static_cast<float>(child->visit_count); // Cast to float
            total_visits += static_cast<float>(child->visit_count); // Cast to float
        }
    }
    if (total_visits > 0) {
        for (float& prob : lastActionProbs) {
            prob /= total_visits;
        }
    }
    else { // If no children were visited (e.g. MCTS failed or 0 simulations)
        // Fallback: use uniform distribution for valid moves
        if (isBidding) {
            std::fill(lastActionProbs.begin(), lastActionProbs.end(), 1.0f / 14.0f);
        }
        else {
            std::vector<int> valid_moves_root = GameLogic::getValidMoves(rootState);
            if (!valid_moves_root.empty()) {
                float uniform_prob = 1.0f / static_cast<float>(valid_moves_root.size()); // Cast to float
                for (int move_idx : valid_moves_root) {
                    if (move_idx < lastActionProbs.size()) {
                        lastActionProbs[move_idx] = uniform_prob;
                    }
                }
            }
        }
    }

    // Store the value from the root
    lastValueEstimate = { (float)(root->value_sum / root->visit_count) };


    return root;
}


int MCTSBot::getBid(const Player& player, const GameState& state) {
    auto root = runMCTS(state, true);

    // Choose the bid with the most visits (most explored, highest confidence)
    int best_bid = -1;
    int max_visits = -1;

    // Iterate over children to find the best action (bid)
    // The children are already sorted by action_idx implicitly due to expansion logic
    for (const auto& child : root->children) {
        if (child->visit_count > max_visits) {
            max_visits = child->visit_count;
            best_bid = child->action_idx;
        }
    }

    // Fallback if no simulations were successfully run (shouldn't happen with >0 simulations)
    if (best_bid == -1 && !root->children.empty()) {
        best_bid = root->children[0]->action_idx;
    }
    else if (best_bid == -1) { // Really shouldn't happen
        return 1; // Default safe bid
    }

    return best_bid;
}

int MCTSBot::getMove(const GameState& state, const std::vector<int>& validMoves) {
    auto root = runMCTS(state, false);

    // Choose the card play with the most visits
    int best_move_idx = -1;
    int max_visits = -1;

    for (const auto& child : root->children) {
        if (child->visit_count > max_visits) {
            max_visits = child->visit_count;
            best_move_idx = child->action_idx;
        }
    }

    // Fallback
    if (best_move_idx == -1 && !root->children.empty()) {
        best_move_idx = root->children[0]->action_idx;
    }
    else if (best_move_idx == -1 && !validMoves.empty()) { // Really shouldn't happen
        return validMoves[0]; // Default to first valid move
    }
    else if (best_move_idx == -1) { // No valid moves or children
        throw std::runtime_error("MCTSBot::getMove: No valid moves or children to select from.");
    }

    return best_move_idx;
}

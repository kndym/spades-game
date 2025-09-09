#include "include/SpadesTypes.hpp"
#include "include/Player.hpp"
#include "include/Bot.hpp" // For RandomBot fallback in rollouts
#include "include/MCTSBot.hpp"
#include "include/GameState.hpp"
#include "include/GameLogic.hpp"
#include "include/UI.hpp" // Still useful for sim mode or debugging
#include "include/ONNXModel.hpp"
#include "include/DataCollector.hpp"

#include <iostream>
#include <string>
#include <vector>
#include <memory>
#include <filesystem> // For std::filesystem::exists
#include <chrono> // For std::chrono
#include <thread> // For std::this_thread::sleep_for (only in sim mode)
#include <random> // For sampling moves


// Forward declarations (if needed, but usually not for functions in GameLogic or UI)
// Example for runSimulationMode if it's still needed from previous version

void runSelfPlayMode(int numGames, const std::string& modelPath, const std::string& outputFile) {
    std::shared_ptr<ONNXModel> nn1, nn2, nn3; // Shared pointers for models

    try {
        // --- Load NN3 (Win Probability) ---
        std::string nn3_onnx_path = modelPath + "/nn3_model.onnx";
        if (std::filesystem::exists(nn3_onnx_path)) {
            nn3 = std::make_shared<ONNXModel>(nn3_onnx_path);
            std::cout << "Loaded NN3 model." << std::endl;
        }
        else {
            std::cerr << "FATAL: NN3 model not found at " << nn3_onnx_path << ". Cannot run self-play." << std::endl;
            return;
        }

        // --- Load NN1 (Bidding Policy) ---
        std::string nn1_onnx_path = modelPath + "/nn1_model.onnx";
        if (std::filesystem::exists(nn1_onnx_path)) {
            nn1 = std::make_shared<ONNXModel>(nn1_onnx_path);
            std::cout << "Loaded NN1 model." << std::endl;
        }
        else {
            std::cout << "NN1 model not found at " << nn1_onnx_path << ". MCTS will use random rollouts for bidding policy." << std::endl;
        }

        // --- Load NN2 (Playing Policy) ---
        std::string nn2_onnx_path = modelPath + "/nn2_model.onnx";
        if (std::filesystem::exists(nn2_onnx_path)) {
            nn2 = std::make_shared<ONNXModel>(nn2_onnx_path);
            std::cout << "Loaded NN2 model." << std::endl;
        }
        else {
            std::cout << "NN2 model not found at " << nn2_onnx_path << ". MCTS will use random rollouts for playing policy." << std::endl;
        }

    }
    catch (const Ort::Exception& e) {
        std::cerr << "ONNX Runtime Error during model loading: " << e.what() << std::endl;
        return;
    }
    catch (const std::exception& e) {
        std::cerr << "Standard library error during model loading: " << e.what() << std::endl;
        return;
    }


    DataCollector data_collector(outputFile);
    std::vector<MCTSBot> bots;
    for (int i = 0; i < 4; ++i) {
        bots.emplace_back(50, nn1, nn2, nn3); // 50 simulations per move
    }

    // Create a single random number generator for the entire self-play session
    std::mt19937 rng(std::random_device{}());

    // Counters for training data samples
    long long nn1_sample_count = 0;
    long long nn2_sample_count = 0;

    for (int i = 0; i < numGames; ++i) {
        GameState state;
        int dealerIndex = i % 4; // Rotate dealer

        while (!GameLogic::isGameOver(state)) {
            GameLogic::resetForNewRound(state, dealerIndex);

            GameLogic::initializeDeck(state.deck);
            GameLogic::shuffleDeck(state.deck);
            GameLogic::dealCards(state);

            // --- Bidding Phase ---
            for (int p_turn = 0; p_turn < 4; ++p_turn) {
                int current_player_idx = state.currentPlayerIndex; // The player whose turn it is to bid

                // Run MCTS to get the improved policy, but ignore the "best" bid it returns.
                // The primary goal here is to populate the bot's internal policy vector.
                bots[current_player_idx].getBid(state.players[current_player_idx], state);

                // Record the MCTS policy (visit counts) as the training target.
                data_collector.record(state, bots[current_player_idx], true);
                nn1_sample_count++;

                // Now, sample a bid from that MCTS policy for exploration during gameplay.
                auto policy = bots[current_player_idx].getLastActionProbs();
                std::discrete_distribution<> dist(policy.begin(), policy.end());
                int sampledBid = dist(rng);

                // Apply the *sampled* bid to the game state
                state.players[current_player_idx].bid = sampledBid;
                GameLogic::applyBid(state, sampledBid); // This also advances currentPlayerIndex and increments bidsMade
            }

            // --- Playing Phase (13 Tricks) ---
            for (int trick_num = 0; trick_num < 13; ++trick_num) {
                for (int turn_in_trick = 0; turn_in_trick < 4; ++turn_in_trick) {
                    // Check for TRAM (The Rest Are Mine) condition
                    if (GameLogic::canTram(state)) {
                        int remainingTricks = 13 - trick_num; // tricks_num is 0-indexed
                        state.players[state.currentPlayerIndex].tricksWon += remainingTricks;
                        // Fast forward to end of round after TRAM
                        goto end_of_round_self_play;
                    }

                    int current_player_idx = state.currentPlayerIndex; // The player whose turn it is to play a card

                    auto validMoves = GameLogic::getValidMoves(state);
                    if (validMoves.empty()) {
                        // This indicates a problem in GameLogic or hand management, but prevents crashes.
                        // In a real game, this shouldn't happen.
                        std::cerr << "WARNING: Player " << current_player_idx << " has no valid moves!" << std::endl;
                        break;
                    }

                    // Run MCTS search to get the improved policy, ignoring the returned best move.
                    bots[current_player_idx].getMove(state, validMoves);

                    // Record the MCTS policy as the training target *before* applying the move.
                    data_collector.record(state, bots[current_player_idx], false);
                    nn2_sample_count++;

                    // Sample a move from the MCTS policy distribution for exploration.
                    auto policy = bots[current_player_idx].getLastActionProbs();
                    std::discrete_distribution<> dist(policy.begin(), policy.end());
                    int sampledMoveIndex = dist(rng);

                    // Apply the *sampled* card play to the game state
                    GameLogic::applyMove(state, sampledMoveIndex); // This also advances currentPlayerIndex and handles trick winner/reset
                }
                // If the round is already over due to TRAM, we'll jump out.
                if (GameLogic::isRoundOver(state)) break;
            }

        end_of_round_self_play:; // Label for goto

            int team1RoundPoints, team2RoundPoints; // OUT parameters to capture round points
            GameLogic::updateScores(state, team1RoundPoints, team2RoundPoints);
            dealerIndex = (dealerIndex + 1) % 4; // Rotate dealer for next round
        } // End of game loop

        // Determine final game winner to finalize data
        int winning_team_id = -1; // 0 for Team 1, 1 for Team 2
        if (state.team1Score > state.team2Score) {
            winning_team_id = 0;
        }
        else if (state.team2Score > state.team1Score) {
            winning_team_id = 1;
        }
        else {
            // Tie game, assign winner arbitrarily or handle as tie
            // For simplicity, let's say Team 1 wins on tie for training label if 1/0 is expected
            winning_team_id = 0;
        }
        data_collector.finalize(winning_team_id);

        if ((i + 1) % 10 == 0) {
            std::cout << "Generated " << i + 1 << " / " << numGames << " games... "
                << "(NN1 Bids: " << nn1_sample_count
                << ", NN2 Plays: " << nn2_sample_count << ")" << std::endl;
        }
    }

    // Final Summary
    std::cout << "\n--- Data Generation Summary ---" << std::endl;
    std::cout << "Total Games Generated: " << numGames << std::endl;
    std::cout << "Bidding Model (NN1) Training Samples: " << nn1_sample_count << std::endl;
    std::cout << "Playing Model (NN2) Training Samples: " << nn2_sample_count << std::endl;
    long long total_samples = nn1_sample_count + nn2_sample_count;
    std::cout << "Value Model (NN3) Training Samples: " << total_samples << std::endl;
    std::cout << "(Each bid and play decision point serves as a state for the value model)." << std::endl;
    std::cout << "---------------------------------" << std::endl;
    std::cout << "Self-play data generation complete. Saved to " << outputFile << std::endl;
}


int main(int argc, char* argv[]) {
    // Command line argument parsing
    if (argc < 2) {
        std::cerr << "Usage: " << argv[0] << " --mode self-play [options]\n";
        std::cerr << "Options for self-play mode:\n";
        std::cerr << "  --games <number> (required) : Number of self-play games to generate.\n";
        std::cerr << "  --output-data-path <filename.bin> (required) : Path to save the generated binary training data.\n";
        std::cerr << "  --input-model-path <directory> (required) : Directory containing nnX_model.onnx files.\n";
        // Optionally add a verbose mode
        return 1;
    }

    std::string mode = "";
    int numGames = 0;
    std::string outputFile = "";
    std::string inputModelPath = "models"; // Default, but required to be passed

    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg == "--mode" && i + 1 < argc) {
            mode = argv[++i];
        }
        else if (arg == "--games" && i + 1 < argc) {
            numGames = std::stoi(argv[++i]);
        }
        else if (arg == "--output-data-path" && i + 1 < argc) {
            outputFile = argv[++i];
        }
        else if (arg == "--input-model-path" && i + 1 < argc) {
            inputModelPath = argv[++i];
        }
    }

    if (mode == "self-play") {
        if (numGames <= 0 || outputFile.empty() || inputModelPath.empty()) {
            std::cerr << "Error: --games, --output-data-path, and --input-model-path are all required for self-play mode.\n";
            return 1;
        }
        runSelfPlayMode(numGames, inputModelPath, outputFile);
    }
    else {
        std::cerr << "Error: Invalid or unsupported mode specified. Only 'self-play' is supported in this build.\n";
        return 1;
    }

    return 0;
}
#include "include/SpadesTypes.hpp"
#include "include/Player.hpp"
#include "include/Bot.hpp"
#include "include/MCTSBot.hpp"
#include "include/GameState.hpp"
#include "include/GameLogic.hpp"
#include "include/ONNXModel.hpp"

#include <iostream>
#include <string>
#include <vector>
#include <memory>
#include <filesystem>
#include <fstream>
#include <iomanip>

struct ModelSet {
    std::shared_ptr<ONNXModel> nn1;
    std::shared_ptr<ONNXModel> nn2;
    std::shared_ptr<ONNXModel> nn3;
};

bool loadModelSet(const std::string& modelPath, ModelSet& out, const std::string& label) {
    try {
        std::string nn3_path = modelPath + "/nn3_model.onnx";
        if (!std::filesystem::exists(nn3_path)) {
            std::cerr << "FATAL: " << label << " NN3 model not found at " << nn3_path << std::endl;
            return false;
        }
        out.nn3 = std::make_shared<ONNXModel>(nn3_path);

        std::string nn1_path = modelPath + "/nn1_model.onnx";
        if (std::filesystem::exists(nn1_path)) {
            out.nn1 = std::make_shared<ONNXModel>(nn1_path);
        } else {
            std::cout << "Warning: " << label << " NN1 model not found at " << nn1_path << ". Using random rollouts for bidding." << std::endl;
        }

        std::string nn2_path = modelPath + "/nn2_model.onnx";
        if (std::filesystem::exists(nn2_path)) {
            out.nn2 = std::make_shared<ONNXModel>(nn2_path);
        } else {
            std::cout << "Warning: " << label << " NN2 model not found at " << nn2_path << ". Using random rollouts for playing." << std::endl;
        }
    }
    catch (const Ort::Exception& e) {
        std::cerr << "ONNX Runtime Error during model loading (" << label << "): " << e.what() << std::endl;
        return false;
    }
    catch (const std::exception& e) {
        std::cerr << "Standard library error during model loading (" << label << "): " << e.what() << std::endl;
        return false;
    }
    return true;
}

void runEvaluationMode(int numGames, const std::string& baselinePath, const std::string& candidatePath, const std::string& outputPath) {
    ModelSet baselineModels;
    ModelSet candidateModels;
    if (!loadModelSet(baselinePath, baselineModels, "Baseline") || !loadModelSet(candidatePath, candidateModels, "Candidate")) {
        return;
    }

    int baselineWins = 0;
    int candidateWins = 0;
    int ties = 0;
    long long baselineScoreSum = 0;
    long long candidateScoreSum = 0;

    for (int i = 0; i < numGames; ++i) {
        GameState state;
        int dealerIndex = i % 4;

        std::vector<MCTSBot> bots;
        bots.emplace_back(150, baselineModels.nn1, baselineModels.nn2, baselineModels.nn3);
        bots.emplace_back(150, candidateModels.nn1, candidateModels.nn2, candidateModels.nn3);
        bots.emplace_back(150, baselineModels.nn1, baselineModels.nn2, baselineModels.nn3);
        bots.emplace_back(150, candidateModels.nn1, candidateModels.nn2, candidateModels.nn3);

        while (!GameLogic::isGameOver(state)) {
            GameLogic::resetForNewRound(state, dealerIndex);

            GameLogic::initializeDeck(state.deck);
            GameLogic::shuffleDeck(state.deck);
            GameLogic::dealCards(state);

            for (int p_turn = 0; p_turn < 4; ++p_turn) {
                int current_player_idx = state.currentPlayerIndex;
                int bid = bots[current_player_idx].getBid(state.players[current_player_idx], state);
                state.players[current_player_idx].bid = bid;
                GameLogic::applyBid(state, bid);
            }

            for (int trick_num = 0; trick_num < 13; ++trick_num) {
                for (int turn_in_trick = 0; turn_in_trick < 4; ++turn_in_trick) {
                    if (GameLogic::canTram(state)) {
                        int remainingTricks = 13 - trick_num;
                        state.players[state.currentPlayerIndex].tricksWon += remainingTricks;
                        goto end_of_round_eval;
                    }

                    int current_player_idx = state.currentPlayerIndex;
                    auto validMoves = GameLogic::getValidMoves(state);
                    if (validMoves.empty()) {
                        break;
                    }
                    int moveIdx = bots[current_player_idx].getMove(state, validMoves);
                    GameLogic::applyMove(state, moveIdx);
                }
                if (GameLogic::isRoundOver(state)) {
                    break;
                }
            }

        end_of_round_eval:
            int team1RoundPoints, team2RoundPoints;
            GameLogic::updateScores(state, team1RoundPoints, team2RoundPoints);
            dealerIndex = (dealerIndex + 1) % 4;
        }

        baselineScoreSum += state.team1Score;
        candidateScoreSum += state.team2Score;

        if (state.team1Score > state.team2Score) {
            baselineWins++;
        }
        else if (state.team2Score > state.team1Score) {
            candidateWins++;
        }
        else {
            ties++;
        }
    }

    double baselineWinRate = static_cast<double>(baselineWins) / numGames;
    double candidateWinRate = static_cast<double>(candidateWins) / numGames;
    double avgScoreDiff = static_cast<double>(candidateScoreSum - baselineScoreSum) / numGames;
    double baselineAvgScore = static_cast<double>(baselineScoreSum) / numGames;
    double candidateAvgScore = static_cast<double>(candidateScoreSum) / numGames;

    std::cout << "\n--- Evaluation Summary ---" << std::endl;
    std::cout << "Games: " << numGames << std::endl;
    std::cout << "Baseline Wins: " << baselineWins << std::endl;
    std::cout << "Candidate Wins: " << candidateWins << std::endl;
    std::cout << "Ties: " << ties << std::endl;
    std::cout << "Baseline Win Rate: " << std::fixed << std::setprecision(4) << baselineWinRate << std::endl;
    std::cout << "Candidate Win Rate: " << std::fixed << std::setprecision(4) << candidateWinRate << std::endl;
    std::cout << "Avg Score Diff (Candidate - Baseline): " << std::fixed << std::setprecision(2) << avgScoreDiff << std::endl;
    std::cout << "--------------------------" << std::endl;

    if (!outputPath.empty()) {
        std::ofstream out(outputPath);
        if (out.is_open()) {
            out << "{\n";
            out << "  \"games\": " << numGames << ",\n";
            out << "  \"baseline_wins\": " << baselineWins << ",\n";
            out << "  \"candidate_wins\": " << candidateWins << ",\n";
            out << "  \"ties\": " << ties << ",\n";
            out << "  \"baseline_win_rate\": " << std::fixed << std::setprecision(6) << baselineWinRate << ",\n";
            out << "  \"candidate_win_rate\": " << std::fixed << std::setprecision(6) << candidateWinRate << ",\n";
            out << "  \"avg_score_diff\": " << std::fixed << std::setprecision(6) << avgScoreDiff << ",\n";
            out << "  \"baseline_avg_score\": " << std::fixed << std::setprecision(6) << baselineAvgScore << ",\n";
            out << "  \"candidate_avg_score\": " << std::fixed << std::setprecision(6) << candidateAvgScore << "\n";
            out << "}\n";
            std::cout << "Evaluation results saved to " << outputPath << std::endl;
        } else {
            std::cerr << "Warning: Could not write evaluation output to " << outputPath << std::endl;
        }
    }
}

int main(int argc, char* argv[]) {
    if (argc < 2) {
        std::cerr << "Usage: " << argv[0] << " --mode evaluate [options]\n";
        std::cerr << "Options for evaluate mode:\n";
        std::cerr << "  --games <number> (required)\n";
        std::cerr << "  --baseline-model-path <directory> (required)\n";
        std::cerr << "  --candidate-model-path <directory> (required)\n";
        std::cerr << "  --output <filename.json> (optional)\n";
        return 1;
    }

    std::string mode = "";
    int numGames = 0;
    std::string baselinePath = "";
    std::string candidatePath = "";
    std::string outputPath = "";

    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg == "--mode" && i + 1 < argc) {
            mode = argv[++i];
        }
        else if (arg == "--games" && i + 1 < argc) {
            numGames = std::stoi(argv[++i]);
        }
        else if (arg == "--baseline-model-path" && i + 1 < argc) {
            baselinePath = argv[++i];
        }
        else if (arg == "--candidate-model-path" && i + 1 < argc) {
            candidatePath = argv[++i];
        }
        else if (arg == "--output" && i + 1 < argc) {
            outputPath = argv[++i];
        }
    }

    if (mode == "evaluate") {
        if (numGames <= 0 || baselinePath.empty() || candidatePath.empty()) {
            std::cerr << "Error: --games, --baseline-model-path, and --candidate-model-path are required.\n";
            return 1;
        }
        runEvaluationMode(numGames, baselinePath, candidatePath, outputPath);
    }
    else {
        std::cerr << "Error: Invalid or unsupported mode specified. Only 'evaluate' is supported.\n";
        return 1;
    }

    return 0;
}

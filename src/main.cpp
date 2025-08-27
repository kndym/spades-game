#include "../include/SpadesTypes.hpp"
#include "../include/Player.hpp"
#include "../include/Bot.hpp"
#include "../include/GameState.hpp"
#include "../include/GameLogic.hpp"
#include "../include/Bot.hpp"
#include "../include/UI.hpp"
#include <iostream>
#include <string>
#include <chrono>
#include <thread>
#include <fstream>
#include <vector>
#include <fcntl.h> // For _O_U16TEXT


void runSimulationMode() {
    GameState state;
    std::vector<RandomBot> bots(4);
    int dealerIndex = 0;

    while (!GameLogic::isGameOver(state)) {
        // GameLogic::resetForNewRound(state, dealerIndex);
        UI::printRoundStart(state);
        
        GameLogic::initializeDeck(state.deck);
        GameLogic::shuffleDeck(state.deck);
        GameLogic::dealCards(state);

        std::cout << "--- Bidding Phase ---" << std::endl;
        for(int i = 0; i < 4; ++i) {
            state.players[i].bid = bots[i].getBid(state.players[i]);
            std::cout << "Player " << i+1 << " bids " << state.players[i].bid << std::endl;
        }

        for (int trick = 0; trick < 13; ++trick) {
            state.currentTrick.clear();
            for (int i = 0; i < 4; ++i) {
                UI::printTurnInfo(state);

                if (GameLogic::canTram(state)) {
                    std::cout << "Player " << state.currentPlayerIndex + 1 << " has TRAM." << std::endl;
                    int remainingTricks = 13 - trick;
                    state.players[state.currentPlayerIndex].tricksWon += remainingTricks;
                    goto end_of_round;
                }

                auto validMoves = GameLogic::getValidMoves(state);
                int moveIndex = bots[state.currentPlayerIndex].getMove(state, validMoves);
                Card playedCard = state.players[state.currentPlayerIndex].hand[moveIndex];

                std::cout << "Player " << state.currentPlayerIndex + 1 << " plays: ";
                UI::printCard(playedCard);
                std::cout << std::endl;

                if (playedCard.suit == Suit::SPADES) {
                    state.spadesBroken = true;
                }
                state.currentTrick.push_back(playedCard);
                state.players[state.currentPlayerIndex].hand.erase(state.players[state.currentPlayerIndex].hand.begin() + moveIndex);
                
                state.currentPlayerIndex = (state.currentPlayerIndex + 1) % 4;
                std::this_thread::sleep_for(std::chrono::milliseconds(1500));
            }

            int trickWinner = GameLogic::determineTrickWinner(state);
            state.players[trickWinner].tricksWon++;
            UI::printTrickWinner(trickWinner, state.currentTrick);

            state.currentPlayerIndex = trickWinner;
            state.trickLeaderIndex = trickWinner;
        }

    end_of_round:
        int t1p, t2p; // unused in this mode
        GameLogic::updateScores(state, t1p, t2p);
        dealerIndex = (dealerIndex + 1) % 4;
    }
    UI::printFinalScores(state);
}

void runDataGenerationMode(int numGames, const std::string& outputFile) {
    std::ofstream csvFile(outputFile);
    if (!csvFile.is_open()) {
        std::cerr << "Error: Could not open file " << outputFile << std::endl;
        return;
    }
    
    // Write CSV Header
    csvFile << "GameID,RoundNum,Team1Bid,Team2Bid,Team1Tricks,Team2Tricks,Team1RoundPoints,Team2RoundPoints,Team1FinalScore,Team2FinalScore\n";

    std::vector<RandomBot> bots(4);

    for (int i = 0; i < numGames; ++i) {
        GameState state;
        int dealerIndex = i % 4;
        int roundNum = 0;

        while (!GameLogic::isGameOver(state)) {
            roundNum++;
            // GameLogic::resetForNewRound(state, dealerIndex);
            
            GameLogic::initializeDeck(state.deck);
            GameLogic::shuffleDeck(state.deck);
            GameLogic::dealCards(state);

            for(int p_idx = 0; p_idx < 4; ++p_idx) {
                state.players[p_idx].bid = bots[p_idx].getBid(state.players[p_idx]);
            }

            for (int trick = 0; trick < 13; ++trick) {
                state.currentTrick.clear();
                for (int turn = 0; turn < 4; ++turn) {
                    if (GameLogic::canTram(state)) {
                        int remainingTricks = 13 - trick;
                        state.players[state.currentPlayerIndex].tricksWon += remainingTricks;
                        goto end_of_round_data;
                    }
                    auto validMoves = GameLogic::getValidMoves(state);
                    int moveIndex = bots[state.currentPlayerIndex].getMove(state, validMoves);
                    Card playedCard = state.players[state.currentPlayerIndex].hand[moveIndex];
                    if (playedCard.suit == Suit::SPADES) state.spadesBroken = true;
                    state.currentTrick.push_back(playedCard);
                    state.players[state.currentPlayerIndex].hand.erase(state.players[state.currentPlayerIndex].hand.begin() + moveIndex);
                    state.currentPlayerIndex = (state.currentPlayerIndex + 1) % 4;
                }
                int trickWinner = GameLogic::determineTrickWinner(state);
                state.players[trickWinner].tricksWon++;
                state.currentPlayerIndex = trickWinner;
                state.trickLeaderIndex = trickWinner;
            }
            
        end_of_round_data:
            int team1Bid = state.players[0].bid + state.players[2].bid;
            int team2Bid = state.players[1].bid + state.players[3].bid;
            int team1Tricks = state.players[0].tricksWon + state.players[2].tricksWon;
            int team2Tricks = state.players[1].tricksWon + state.players[3].tricksWon;
            int team1RoundPoints, team2RoundPoints;

            GameLogic::updateScores(state, team1RoundPoints, team2RoundPoints);
            
            csvFile << i + 1 << "," << roundNum << "," << team1Bid << "," << team2Bid << ","
                    << team1Tricks << "," << team2Tricks << "," << team1RoundPoints << ","
                    << team2RoundPoints << "," << state.team1Score << "," << state.team2Score << "\n";

            dealerIndex = (dealerIndex + 1) % 4;
        }
         if ((i + 1) % 1000 == 0) {
            std::cout << "Generated " << i + 1 << " / " << numGames << " games..." << std::endl;
        }
    }
    std::cout << "Data generation complete. Saved to " << outputFile << std::endl;
}


int main(int argc, char* argv[]) {
    if (argc < 2) {
        std::cerr << "Usage: " << argv[0] << " --mode [sim|data]\n";
        std::cerr << "  sim: Run a single game with CLI output and pauses.\n";
        std::cerr << "  data: Generate game data efficiently.\n";
        std::cerr << "    --games <number> (required for data mode)\n";
        std::cerr << "    --output <filename.csv> (required for data mode)\n";
        return 1;
    }
    std::string mode = "";
    int numGames = 0;
    std::string outputFile = "";
    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg == "--mode" && i + 1 < argc) {
            mode = argv[++i];
        } else if (arg == "--games" && i + 1 < argc) {
            numGames = std::stoi(argv[++i]);
        } else if (arg == "--output" && i + 1 < argc) {
            outputFile = argv[++i];
        }
    }

    if (mode == "sim") {
        runSimulationMode();
    } else if (mode == "data") {
        if (numGames <= 0 || outputFile.empty()) {
            std::cerr << "Error: --games and --output are required for data mode.\n";
            return 1;
        }
        runDataGenerationMode(numGames, outputFile);
    } else {
        std::cerr << "Error: Invalid mode specified.\n";
    }

    return 0;
}
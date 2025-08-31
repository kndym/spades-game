#include <iostream>
#include <fstream>
#include <sstream>
#include <string>
#include <vector>
#include <map>

struct RoundData {
    int gameID;
    int roundNum;
    int team1Score;
    int team2Score;
    int team1Bags;
    int team2Bags;
};

int main() {
    std::string inputFilename, outputFilename;

    std::cout << "Enter the input CSV file name: ";
    std::cin >> inputFilename;

    std::cout << "Enter the output CSV file name: ";
    std::cin >> outputFilename;

    std::ifstream inputFile(inputFilename);
    std::ofstream outputFile(outputFilename);

    if (!inputFile.is_open() || !outputFile.is_open()) {
        std::cerr << "Error opening files." << std::endl;
        return 1;
    }

    outputFile << "total_points,point_differential,team_bags,other_team_bags,game_win\n";

    std::string line;
    std::getline(inputFile, line); // Skip header

    std::map<int, std::vector<RoundData>> games;
    while (std::getline(inputFile, line)) {
        std::stringstream ss(line);
        std::string field;
        RoundData data;

        std::getline(ss, field, ','); data.gameID = std::stoi(field);
        std::getline(ss, field, ','); data.roundNum = std::stoi(field);
        for(int i = 0; i < 6; ++i) std::getline(ss, field, ','); // Skip unused columns
        std::getline(ss, field, ','); data.team1Bags = std::stoi(field);
        std::getline(ss, field, ','); data.team2Bags = std::stoi(field);
        std::getline(ss, field, ','); data.team1Score = std::stoi(field);
        std::getline(ss, field, ','); data.team2Score = std::stoi(field);

        games[data.gameID].push_back(data);
    }

    for (auto const& [gameID, rounds] : games) {
        if (rounds.empty()) continue;

        int team1Won = 0;
        int team2Won = 0;

        const RoundData* finalRound = nullptr;

        for(const auto& round : rounds) {
            if (round.team1Score >= 500 || round.team2Score >= 500) {
                finalRound = &round;
                break;
            }
        }

        if (finalRound == nullptr) {
            finalRound = &rounds.back();
        }

        if (finalRound->team1Score > finalRound->team2Score) {
            team1Won = 1;
        } else {
            team1Won = 0;
        }
        team2Won = 1 - team1Won;


        int prevTeam1Score = 0;
        int prevTeam2Score = 0;
        int prevTeam1Bags = 0;
        int prevTeam2Bags = 0;

        for (const auto& round : rounds) {
            // Team 1 perspective
            outputFile << prevTeam1Score + prevTeam2Score << "," << prevTeam1Score - prevTeam2Score << ","
                       << prevTeam1Bags << "," << prevTeam2Bags << ","
                       << team1Won << "\n";

            // Team 2 perspective
            outputFile << prevTeam1Score + prevTeam2Score << "," << prevTeam2Score - prevTeam1Score << ","
                       << prevTeam2Bags << "," << prevTeam1Bags << ","
                       << team2Won << "\n";

            prevTeam1Score = round.team1Score;
            prevTeam2Score = round.team2Score;
            prevTeam1Bags = round.team1Bags;
            prevTeam2Bags = round.team2Bags;
        }
    }

    inputFile.close();
    outputFile.close();

    std::cout << "Training data created successfully in " << outputFilename << std::endl;

    return 0;
}
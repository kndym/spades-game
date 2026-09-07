cmake_minimum_required(VERSION 3.16)
project(spades-game LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find dependencies (onnxruntime only)
find_package(onnxruntime CONFIG REQUIRED)

# Common source files used by multiple targets (EXCLUDING DataCollector and protobuf)
set(COMMON_SOURCES_NO_PROTO
    src/Bot.cpp
    src/GameLogic.cpp
    src/MCTSBot.cpp
    src/ONNXModel.cpp
    src/UI.cpp
)

set(COMMON_HEADERS_NO_PROTO
    src/include/Bot.hpp
    src/include/GameLogic.hpp
    src/include/GameState.hpp
    src/include/IBot.hpp
    src/include/MCTSBot.hpp
    src/include/ONNXModel.hpp
    src/include/Player.hpp
    src/include/SpadesTypes.hpp
    src/include/UI.hpp
)

# Include directories
include_directories(${CMAKE_SOURCE_DIR}/src)

# --- evaluation_main ---
add_executable(evaluation_main
    src/evaluation_main.cpp
    ${COMMON_SOURCES_NO_PROTO}
    ${COMMON_HEADERS_NO_PROTO}
)
target_link_libraries(evaluation_main PRIVATE
    onnxruntime::onnxruntime
)

# --- mcts_server ---
add_executable(mcts_server
    bot_evaluation/mcts_server.cpp
    ${COMMON_SOURCES_NO_PROTO}
    ${COMMON_HEADERS_NO_PROTO}
)
target_link_libraries(mcts_server PRIVATE
    onnxruntime::onnxruntime
    ws2_32 # Winsock for Windows
)

# Note: self_play_main and simulation_main likely depend on Protobuf/DataCollector
# We comment them out to allow building evaluation_main without protobuf
# add_executable(self_play_main src/self_play_main.cpp src/DataCollector.cpp src/test.pb.cc ${COMMON_SOURCES_NO_PROTO})

#include <iostream>
#include <vector>
#include "include/ONNXModel.hpp"

int main() {
    try {
        ONNXModel nn3("C:/Users/knday/Github/spades-game/models/nn3_model.onnx");
        std::cout << "NN3 model loaded successfully!" << std::endl;
        // Create dummy input data matching the model's expectation
        std::vector<float> input_data = {600.0f, 100.0f, 5.0f, 3.0f}; // total_points, diff, bags, other_bags
        std::vector<int64_t> input_shape{1, 4}; // Batch size 1, 4 features

        auto result = nn3.predict(input_data, input_shape);

        std::cout << "Prediction for [600, 100, 5, 3]: " << result[0] << std::endl;

    } catch (const Ort::Exception& e) {
        std::cerr << "ONNX Runtime error: " << e.what() << std::endl;
        return 1;
    }
    return 0;
}
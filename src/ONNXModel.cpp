#include "include/ONNXModel.hpp"
#include <stdexcept>
#include <vector>

// Helper function to convert std::string to std::wstring
static std::wstring to_wstring(const std::string& str) {
    return std::wstring(str.begin(), str.end());
}

ONNXModel::ONNXModel(const std::string& model_path)
    : env(ORT_LOGGING_LEVEL_WARNING, "SpadesBot"),
      session(env, to_wstring(model_path).c_str(), Ort::SessionOptions()) {

    Ort::AllocatorWithDefaultOptions allocator;

    // Get input node names and store owned strings
    size_t num_input_nodes = session.GetInputCount();
    input_names_str.reserve(num_input_nodes);
    input_node_names.resize(num_input_nodes);
    for (size_t i = 0; i < num_input_nodes; i++) {
        auto input_name = session.GetInputNameAllocated(i, allocator);
        input_names_str.emplace_back(input_name.get()); // store owned copy
        input_node_names[i] = input_names_str.back().c_str(); // pointer valid while object lives
    }

    // Get output node names and store owned strings
    size_t num_output_nodes = session.GetOutputCount();
    output_names_str.reserve(num_output_nodes);
    output_node_names.resize(num_output_nodes);
    for (size_t i = 0; i < num_output_nodes; i++) {
        auto output_name = session.GetOutputNameAllocated(i, allocator);
        output_names_str.emplace_back(output_name.get()); // store owned copy
        output_node_names[i] = output_names_str.back().c_str(); // pointer valid while object lives
    }
}

std::vector<float> ONNXModel::predict(const std::vector<float>& input_data, const std::vector<int64_t>& input_shape) {
    auto memory_info = Ort::MemoryInfo::CreateCpu(OrtArenaAllocator, OrtMemTypeDefault);

    Ort::Value input_tensor = Ort::Value::CreateTensor<float>(
        memory_info,
        const_cast<float*>(input_data.data()),
        input_data.size(),
        input_shape.data(),
        input_shape.size()
    );

    auto output_tensors = session.Run(
        Ort::RunOptions{nullptr},
        input_node_names.data(), &input_tensor, 1,
        output_node_names.data(), output_node_names.size()
    );

    float* floatarr = output_tensors[0].GetTensorMutableData<float>();
    size_t output_size = output_tensors[0].GetTensorTypeAndShapeInfo().GetElementCount();

    return std::vector<float>(floatarr, floatarr + output_size);
}
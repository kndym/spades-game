#ifndef ONNXMODEL_HPP
#define ONNXMODEL_HPP

#include <string>
#include <vector>
#include <memory>
#include <onnxruntime_cxx_api.h>

class ONNXModel {
public:
    ONNXModel(const std::string& model_path);

    // Run inference and return the output tensor values
    std::vector<float> predict(const std::vector<float>& input_data, const std::vector<int64_t>& input_shape);

private:
    Ort::Env env;
    Ort::Session session;

    // Keep owned std::string copies so c_str() pointers remain valid.
    std::vector<std::string> input_names_str;
    std::vector<std::string> output_names_str;

    // Pointers required by ORT API (point into the std::string data above)
    std::vector<const char*> input_node_names;
    std::vector<const char*> output_node_names;
};

#endif // ONNXMODEL_HPP
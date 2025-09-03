import torch
import os

# Important: The model definition must be available.
# We import it from the training script.
from train_nn_pytorch import NN3Model

def main():
    # --- User Input ---
    pytorch_model_path = input("Enter the path to the trained PyTorch model file (.pth): ")
    
    while not os.path.exists(pytorch_model_path):
        print(f"Error: File '{pytorch_model_path}' not found.")
        pytorch_model_path = input("Please enter a valid .pth file path: ")

    onnx_model_path = input("Enter the desired output path for the ONNX model (.onnx): ")
    if not onnx_model_path.endswith('.onnx'):
        onnx_model_path += '.onnx'

    # --- Model Loading ---
    print(f"Loading PyTorch model from {pytorch_model_path}...")
    model = NN3Model()
    model.load_state_dict(torch.load(pytorch_model_path))
    model.eval() # Set model to evaluation mode
    print("Model loaded successfully.")

    # --- ONNX Export ---
    # Create a dummy input with the correct shape (batch size of 1, 4 features)
    dummy_input = torch.randn(1, 4, requires_grad=True)

    print(f"Exporting model to ONNX format at {onnx_model_path}...")
    torch.onnx.export(
        model,                          # model being run
        dummy_input,                    # model input (or a tuple for multiple inputs)
        onnx_model_path,                # where to save the model
        export_params=True,             # store the trained parameter weights inside the model file
        opset_version=10,               # the ONNX version to export the model to
        do_constant_folding=True,       # whether to execute constant folding for optimization
        input_names=['input'],          # the model's input names
        output_names=['output'],        # the model's output names
        dynamic_axes={'input' : {0 : 'batch_size'},    # variable length axes
                      'output' : {0 : 'batch_size'}}
    )
    print("Export complete.")
    print(f"ONNX model saved to {onnx_model_path}")

if __name__ == '__main__':
    main()
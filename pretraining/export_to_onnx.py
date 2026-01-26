import argparse
import os
import sys
from pathlib import Path

import torch

repo_root = Path(__file__).resolve().parents[1]
if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))

from pretraining.nn3_model import NN3Model


def export_model(pytorch_model_path, onnx_model_path):
    print(f"Loading PyTorch model from {pytorch_model_path}...")
    model = NN3Model()
    model.load_state_dict(torch.load(pytorch_model_path))
    model.eval()
    print("Model loaded successfully.")

    dummy_input = torch.randn(1, 4)
    # Use TorchScript tracing for robust export across PyTorch versions
    traced_model = torch.jit.trace(model, dummy_input)
    print(f"Exporting model to ONNX format at {onnx_model_path}...")
    torch.onnx.export(
        traced_model,
        dummy_input,
        onnx_model_path,
        export_params=True,
        opset_version=11,
        do_constant_folding=True,
        input_names=['input'],
        output_names=['output']
    )
    print("Export complete.")
    print(f"ONNX model saved to {onnx_model_path}")


def run_interactive():
    pytorch_model_path = input("Enter the path to the trained PyTorch model file (.pth): ")
    while not os.path.exists(pytorch_model_path):
        print(f"Error: File '{pytorch_model_path}' not found.")
        pytorch_model_path = input("Please enter a valid .pth file path: ")

    onnx_model_path = input("Enter the desired output path for the ONNX model (.onnx): ")
    if not onnx_model_path.endswith('.onnx'):
        onnx_model_path += '.onnx'

    export_model(pytorch_model_path, onnx_model_path)


def main():
    parser = argparse.ArgumentParser(description="Export NN3 PyTorch model to ONNX.")
    parser.add_argument("--input-pth", type=str, help="Path to PyTorch .pth model.")
    parser.add_argument("--output-onnx", type=str, help="Path to output .onnx model.")
    args = parser.parse_args()

    if not args.input_pth and not args.output_onnx:
        run_interactive()
        return

    if not args.input_pth or not args.output_onnx:
        parser.error("--input-pth and --output-onnx are required for non-interactive mode.")

    export_model(args.input_pth, args.output_onnx)


if __name__ == '__main__':
    main()
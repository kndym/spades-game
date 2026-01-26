import argparse
import os
import sys
from pathlib import Path

# Fix Windows console encoding for PyTorch 2.x ONNX export unicode output
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import TensorDataset, DataLoader
from sklearn.model_selection import train_test_split
import matplotlib.pyplot as plt
from tqdm import tqdm

repo_root = Path(__file__).resolve().parents[1]
if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))

import test_pb2 as pb
from pretraining.nn3_model import NN3Model


def load_value_samples_from_proto(filepath):
    samples = []
    with open(filepath, 'rb') as f:
        while True:
            size_bytes = f.read(4)
            if not size_bytes:
                break
            size = np.frombuffer(size_bytes, dtype=np.int32)[0]
            msg_bytes = f.read(size)
            if len(msg_bytes) != size:
                print("Warning: Incomplete message found at end of file.")
                continue

            sample = pb.TrainingSample()
            sample.ParseFromString(msg_bytes)

            if len(sample.state_features) < 4:
                continue

            team1_score, team2_score, team1_bags, team2_bags = sample.state_features[:4]
            total_points = team1_score + team2_score
            if sample.player_idx % 2 == 0:
                point_diff = team1_score - team2_score
                team_bags = team1_bags
                other_bags = team2_bags
            else:
                point_diff = team2_score - team1_score
                team_bags = team2_bags
                other_bags = team1_bags

            features = [total_points, point_diff, team_bags, other_bags]
            label = sample.actual_game_win_value
            samples.append((features, label))

    return samples


def train_model(X, y, epochs, batch_size, show_graphs):
    X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.2, random_state=42)
    X_train_tensor = torch.tensor(X_train, dtype=torch.float32)
    y_train_tensor = torch.tensor(y_train, dtype=torch.float32)
    X_val_tensor = torch.tensor(X_val, dtype=torch.float32)
    y_val_tensor = torch.tensor(y_val, dtype=torch.float32)

    train_dataset = TensorDataset(X_train_tensor, y_train_tensor)
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)

    print("Building PyTorch model...")
    model = NN3Model()
    criterion = nn.BCELoss()
    optimizer = optim.Adam(model.parameters())

    print("Starting training...")
    history = {'loss': [], 'accuracy': [], 'val_loss': [], 'val_accuracy': []}

    for epoch in range(epochs):
        model.train()
        running_loss = 0.0
        correct_train = 0
        total_train = 0

        progress_bar = tqdm(train_loader, desc=f"Epoch {epoch+1}/{epochs}", leave=False)
        for inputs, labels in progress_bar:
            optimizer.zero_grad()
            outputs = model(inputs)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()

            running_loss += loss.item()
            predicted = (outputs > 0.5).float()
            total_train += labels.size(0)
            correct_train += (predicted == labels).sum().item()
            progress_bar.set_postfix({'loss': loss.item()})

        epoch_loss = running_loss / len(train_loader)
        epoch_acc = correct_train / total_train
        history['loss'].append(epoch_loss)
        history['accuracy'].append(epoch_acc)

        model.eval()
        with torch.no_grad():
            val_outputs = model(X_val_tensor)
            val_loss = criterion(val_outputs, y_val_tensor)
            predicted_val = (val_outputs > 0.5).float()
            total_val = y_val_tensor.size(0)
            correct_val = (predicted_val == y_val_tensor).sum().item()
            val_accuracy = correct_val / total_val

            history['val_loss'].append(val_loss.item())
            history['val_accuracy'].append(val_accuracy)

        print(f"Epoch {epoch+1}/{epochs} -> "
              f"Loss: {epoch_loss:.4f}, Accuracy: {epoch_acc*100:.2f}% | "
              f"Val Loss: {val_loss.item():.4f}, Val Accuracy: {val_accuracy*100:.2f}%")

    if show_graphs:
        print("Displaying training graphs...")
        plt.figure(figsize=(12, 5))
        plt.subplot(1, 2, 1)
        plt.plot(history['accuracy'])
        plt.plot(history['val_accuracy'])
        plt.title('Model accuracy')
        plt.ylabel('Accuracy')
        plt.xlabel('Epoch')
        plt.legend(['Train', 'Validation'], loc='upper left')

        plt.subplot(1, 2, 2)
        plt.plot(history['loss'])
        plt.plot(history['val_loss'])
        plt.title('Model loss')
        plt.ylabel('Loss')
        plt.xlabel('Epoch')
        plt.legend(['Train', 'Validation'], loc='upper left')

        plt.tight_layout()
        plt.show()

    return model


def export_to_onnx(model, output_path):
    model.eval()
    dummy_input = torch.randn(1, 4)
    # Use TorchScript tracing for robust export across PyTorch versions
    traced_model = torch.jit.trace(model, dummy_input)
    # Save and reload to ensure clean export
    temp_pt = output_path.replace('.onnx', '_traced.pt')
    torch.jit.save(traced_model, temp_pt)
    loaded_model = torch.jit.load(temp_pt)
    torch.onnx.export(
        loaded_model,
        dummy_input,
        output_path,
        export_params=True,
        opset_version=11,
        do_constant_folding=True,
        input_names=['input'],
        output_names=['output'],
        verbose=False,
        dynamo=False
    )
    if os.path.exists(temp_pt):
        os.remove(temp_pt)


def run_interactive():
    csv_filename = input("Enter the name of the training data CSV file: ")
    while not os.path.exists(csv_filename):
        print(f"Error: File '{csv_filename}' not found.")
        csv_filename = input("Please enter a valid CSV file name: ")

    show_graphs_input = input("Do you want to display graphs of training progress? (y/n): ").lower()
    show_graphs = show_graphs_input == 'y'

    model_filename = "weights/" + input("Enter the name of the output .pth file: ")
    if not model_filename.endswith('.pth'):
        model_filename += '.pth'
    os.makedirs("weights", exist_ok=True)

    print("Loading and preprocessing data...")
    data = pd.read_csv(csv_filename).sample(frac=1, random_state=42)
    X = data[['total_points', 'point_differential', 'team_bags', 'other_team_bags']].values
    y = data['game_win'].values.reshape(-1, 1)

    model = train_model(X, y, epochs=int(input("Number of Epochs: ")), batch_size=32, show_graphs=show_graphs)
    torch.save(model.state_dict(), model_filename)
    print(f"Model saved to {model_filename}")


def main():
    parser = argparse.ArgumentParser(description="Train NN3 win-probability model.")
    parser.add_argument("--mode", type=str, default="interactive",
                        choices=["interactive", "train_from_csv", "train_from_proto", "generate_random"])
    parser.add_argument("--input-csv", type=str, help="Path to CSV training data.")
    parser.add_argument("--input-proto", type=str, help="Path to Protobuf .bin training data.")
    parser.add_argument("--output-model-path", type=str, default="weights", help="Directory to save model files.")
    parser.add_argument("--epochs", type=int, default=10, help="Number of epochs.")
    parser.add_argument("--batch-size", type=int, default=32, help="Batch size.")
    parser.add_argument("--export-onnx", action="store_true", help="Also export nn3_model.onnx.")
    parser.add_argument("--show-graphs", action="store_true", help="Display training graphs.")
    args = parser.parse_args()

    if args.mode == "interactive":
        run_interactive()
        return

    os.makedirs(args.output_model_path, exist_ok=True)
    pth_path = os.path.join(args.output_model_path, "nn3_model.pth")
    onnx_path = os.path.join(args.output_model_path, "nn3_model.onnx")

    if args.mode == "generate_random":
        model = NN3Model()
        torch.save(model.state_dict(), pth_path)
        if args.export_onnx:
            export_to_onnx(model, onnx_path)
        print(f"Random NN3 model saved to {pth_path}")
        if args.export_onnx:
            print(f"ONNX model saved to {onnx_path}")
        return

    if args.mode == "train_from_csv":
        if not args.input_csv:
            parser.error("--input-csv is required for train_from_csv")
        data = pd.read_csv(args.input_csv).sample(frac=1, random_state=42)
        X = data[['total_points', 'point_differential', 'team_bags', 'other_team_bags']].values
        y = data['game_win'].values.reshape(-1, 1)
    elif args.mode == "train_from_proto":
        if not args.input_proto:
            parser.error("--input-proto is required for train_from_proto")
        samples = load_value_samples_from_proto(args.input_proto)
        if not samples:
            print("No value samples found in proto data.")
            return
        X = np.array([item[0] for item in samples], dtype=np.float32)
        y = np.array([item[1] for item in samples], dtype=np.float32).reshape(-1, 1)
    else:
        parser.error("Unsupported mode.")

    model = train_model(X, y, epochs=args.epochs, batch_size=args.batch_size, show_graphs=args.show_graphs)
    torch.save(model.state_dict(), pth_path)
    print(f"Model saved to {pth_path}")
    if args.export_onnx:
        export_to_onnx(model, onnx_path)
        print(f"ONNX model saved to {onnx_path}")


if __name__ == '__main__':
    main()

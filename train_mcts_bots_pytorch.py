import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import TensorDataset, DataLoader
import os
import argparse
from tqdm import tqdm
import test_pb2 as pb# Import the generated module

# --- Model Definitions ---

class BiddingModelNN1(nn.Module):
    def __init__(self, input_size=8):
        super(BiddingModelNN1, self).__init__()
        self.network = nn.Sequential(
            nn.Linear(input_size, 32),
            nn.ReLU(),
            nn.Linear(32, 32),
            nn.ReLU(),
            nn.Linear(32, 14), # 14 outputs for bids 0-13
            nn.Softmax(dim=-1)
        )
    def forward(self, x):
        return self.network(x)

class PlayingModelNN2(nn.Module):
    # This is a placeholder architecture. A real one would be more complex.
    def __init__(self, input_size=50): # Placeholder input size
        super(PlayingModelNN2, self).__init__()
        self.network = nn.Sequential(
            nn.Linear(input_size, 128),
            nn.ReLU(),
            nn.Linear(128, 128),
            nn.ReLU(),
            nn.Linear(128, 13), # Max 13 cards in hand
            nn.Softmax(dim=-1)
        )
    def forward(self, x):
        return self.network(x)

# --- NEW, TYPE-SAFE DATA LOADING FUNCTION ---
def load_training_data_proto(filepath):
    """Loads training data from the size-delimited Protobuf binary format."""
    samples = {'bidding': [], 'playing': []}
    with open(filepath, 'rb') as f:
        while True:
            # 1. Read the 4-byte size prefix
            size_bytes = f.read(4)
            if not size_bytes:
                break # End of file

            size = np.frombuffer(size_bytes, dtype=np.int32)[0]

            # 2. Read the actual message data
            msg_bytes = f.read(size)
            if len(msg_bytes) != size:
                print("Warning: Incomplete message found at end of file.")
                continue

            # 3. Parse the message using the generated Protobuf class
            sample = pb.TrainingSample()
            sample.ParseFromString(msg_bytes)

            # 4. Extract the data in a 100% type-safe way
            state_vec = np.array(sample.state_features, dtype=np.float32)
            policy_vec = np.array(sample.policy_target, dtype=np.float32)
            
            # You can choose which value to use for training.
            # The MCTS value is often better for policy heads.
            value = sample.value_target
            
            # Add to the correct list
            if sample.is_bidding:
                # Optional sanity check
                if state_vec.shape[0] == 8 and policy_vec.shape[0] == 14:
                    samples['bidding'].append((state_vec, policy_vec, value))
            else:
                # Placeholder for playing data
                pass

    return samples


def export_model_to_onnx(model, dummy_input, filepath):
    """Exports a PyTorch model to ONNX format."""
    print(f"Exporting model to {filepath}...")
    torch.onnx.export(
        model,
        dummy_input,
        filepath,
        export_params=True,
        opset_version=10,
        do_constant_folding=True,
        input_names=['input'],
        output_names=['output'],
        dynamic_axes={'input': {0: 'batch_size'}, 'output': {0: 'batch_size'}},
        dynamo=True
    )
    print("Export complete.")

def generate_random_onnx_model(model_type, input_size, output_dir):
    """Generates a model with random weights and saves it as ONNX."""
    if model_type == 'nn1':
        model = BiddingModelNN1(input_size=input_size)
        dummy_input = torch.randn(1, input_size)
        onnx_filename = os.path.join(output_dir, "nn1_model.onnx")
    elif model_type == 'nn2':
        model = PlayingModelNN2(input_size=input_size) # Adjust input_size later
        dummy_input = torch.randn(1, input_size)
        onnx_filename = os.path.join(output_dir, "nn2_model.onnx")
    else:
        raise ValueError("Invalid model_type for random model generation.")

    # Ensure model is in eval mode for export
    model.eval()
    export_model_to_onnx(model, dummy_input, onnx_filename)
    print(f"Generated random {model_type.upper()} ONNX model at {onnx_filename}")

# --- Main Training Logic ---

def main(args):
    if args.mode == 'generate_initial_models':
        print(f"Generating initial random ONNX models in {args.output_model_path}...")
        # Determine actual input sizes for NN1 and NN2
        # For NN1 (Bidding), input_size is 8: [T1_score, T2_score, T1_bags, T2_bags, P1_bid, P2_bid, P3_bid, P4_bid]
        bid_input_size = 8
        # For NN2 (Playing), input_size is more complex:
        # 4 (scores/bags) + 4 (bids) + 52 (hand) + 52 (trick) + 4 (tricks_won) + 1 (spades_broken) + 1 (current_player_idx) = 118
        # If your PlayingModelNN2 default input_size is different, update it here.
        play_input_size = 118 # As derived from DataCollector::extractPlayFeatures
        
        generate_random_onnx_model('nn1', bid_input_size, args.output_model_path)
        generate_random_onnx_model('nn2', play_input_size, args.output_model_path)
        return
    print("Loading training data from Protobuf file...")
    # Call the new, safe data loader
    all_data = load_training_data_proto(args.input_data_path)

    # --- Train Bidding Model (NN1) ---
    if all_data['bidding']:
        print(f"Found {len(all_data['bidding'])} bidding samples.")
        X_bid = torch.tensor(np.array([item[0] for item in all_data['bidding']]), dtype=torch.float32)
        y_policy_bid = torch.tensor(np.array([item[1] for item in all_data['bidding']]), dtype=torch.float32)

        train_dataset = TensorDataset(X_bid, y_policy_bid)
        train_loader = DataLoader(train_dataset, batch_size=args.batch_size, shuffle=True)

        nn1_path_pth = os.path.join(args.output_model_path, "nn1_model.pth")
        nn1_path_onnx = os.path.join(args.output_model_path, "nn1_model.onnx")

        # Load existing model or create a new one
        input_size = X_bid.shape[1]
        model_nn1 = BiddingModelNN1(input_size=input_size)
        if os.path.exists(nn1_path_pth):
            print("Loading existing NN1 model to continue training...")
            model_nn1.load_state_dict(torch.load(nn1_path_pth))
        else:
            print("Creating new NN1 model...")

        criterion = nn.CrossEntropyLoss()
        optimizer = optim.Adam(model_nn1.parameters(), lr=0.001)

        model_nn1.train()
        for epoch in range(args.epochs):
            progress_bar = tqdm(train_loader, desc=f"NN1 Epoch {epoch+1}/{args.epochs}", leave=False)
            for states, policies in progress_bar:
                optimizer.zero_grad()
                outputs = model_nn1(states)
                loss = criterion(outputs, policies)
                loss.backward()
                optimizer.step()
                progress_bar.set_postfix({'loss': f'{loss.item():.4f}'})

        print("NN1 training finished.")
        torch.save(model_nn1.state_dict(), nn1_path_pth)
        print(f"PyTorch model saved to {nn1_path_pth}")
        export_model_to_onnx(model_nn1, torch.randn(1, input_size), nn1_path_onnx)
    else:
        print("No valid bidding data found to train NN1.")

    # --- Train Playing Model (NN2) ---
    # As noted, this part is a placeholder. A full implementation requires
    # careful handling of state representation and variable-sized policies.
    if all_data['playing']:
        print(f"\nFound {len(all_data['playing'])} playing samples.")
        print("WARNING: NN2 training is a placeholder and is currently skipped.")
    else:
        print("\nNo playing data found to train NN2.")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Train Spades AI models from self-play data using PyTorch.")
    parser.add_argument("--mode", type=str, default="train", choices=['train', 'generate_initial_models'],
                        help="Operation mode: 'train' to train from data, or 'generate_initial_models' to create new random models.")
    parser.add_argument("--input-data-path", type=str, help="Path to the .bin file generated by the C++ app. Required for 'train' mode.")
    parser.add_argument("--output-model-path", type=str, required=True, help="Directory to save or generate the models.")
    parser.add_argument("--epochs", type=int, default=10, help="Number of epochs to train for.")
    parser.add_argument("--batch-size", type=int, default=64, help="Training batch size.")
    args = parser.parse_args()

    # Validate arguments based on mode
    if args.mode == 'train' and not args.input_data_path:
        parser.error("--input-data-path is required for 'train' mode.")

    # Ensure output directory exists
    os.makedirs(args.output_model_path, exist_ok=True)
    main(args)
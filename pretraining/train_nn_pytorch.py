import pandas as pd
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import TensorDataset, DataLoader
from sklearn.model_selection import train_test_split
import matplotlib.pyplot as plt
import os
from tqdm import tqdm

# --- PyTorch Model Definition ---
class NN3Model(nn.Module):
    def __init__(self):
        super(NN3Model, self).__init__()
        # Scaling factors for the input features
        self.scale = torch.tensor([1000.0, 100.0, 10.0, 10.0])
        self.fc1 = nn.Linear(4, 4)
        self.fc2 = nn.Linear(4, 1)
        self.softplus = nn.Softplus()
        self.sigmoid = nn.Sigmoid()

    def forward(self, x):
        # Apply scaling
        x = x / self.scale.to(x.device)
        x = self.softplus(self.fc1(x))
        x = self.sigmoid(self.fc2(x))
        return x

def main():
    # --- User Input ---
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


    # --- Data Loading and Preprocessing ---
    print("Loading and preprocessing data...")
    data = pd.read_csv(csv_filename).sample(frac=1, random_state=42)

    X = data[['total_points', 'point_differential', 'team_bags', 'other_team_bags']].values
    y = data['game_win'].values.reshape(-1, 1) # Reshape for loss function

    X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.2, random_state=42)

    # Convert to PyTorch Tensors
    X_train_tensor = torch.tensor(X_train, dtype=torch.float32)
    y_train_tensor = torch.tensor(y_train, dtype=torch.float32)
    X_val_tensor = torch.tensor(X_val, dtype=torch.float32)
    y_val_tensor = torch.tensor(y_val, dtype=torch.float32)

    # Create DataLoader
    train_dataset = TensorDataset(X_train_tensor, y_train_tensor)
    train_loader = DataLoader(train_dataset, batch_size=32, shuffle=True)

    # --- Neural Network Model ---
    print("Building PyTorch model...")
    model = NN3Model()
    criterion = nn.BCELoss() # Binary Cross Entropy Loss
    optimizer = optim.Adam(model.parameters())

    # --- Training ---
    print("Starting training...")
    epochs = int(input("Number of Epochs: "))
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

        # --- Validation ---
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


    # --- Evaluation Summary ---
    final_val_loss, final_val_accuracy = history['val_loss'][-1], history['val_accuracy'][-1]
    print(f"\nFinal Validation Accuracy: {final_val_accuracy*100:.2f}%")
    print(f"Final Validation Loss: {final_val_loss:.4f}")

    # --- Save the Model ---
    torch.save(model.state_dict(), model_filename)
    print(f"Model saved to {model_filename}")

    # --- Graphing ---
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

if __name__ == '__main__':
    main()
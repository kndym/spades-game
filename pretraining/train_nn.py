import pandas as pd
import tensorflow as tf
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from tqdm.keras import TqdmCallback
import matplotlib.pyplot as plt
import os

def main():
    # --- User Input ---
    csv_filename = input("Enter the name of the training data CSV file: ")

    while not os.path.exists(csv_filename):
        print(f"Error: File '{csv_filename}' not found.")
        csv_filename = input("Please enter a valid CSV file name: ")

    show_graphs_input = input("Do you want to display graphs of training progress? (y/n): ").lower()
    show_graphs = show_graphs_input == 'y'

    model_filename = "weights/" + input("Enter the name of the output .h5 file: ")
    if not model_filename.endswith('.h5'):
        model_filename += '.h5'

    # --- Data Loading and Preprocessing ---
    print("Loading and preprocessing data...")
    data = pd.read_csv(csv_filename).sample(frac=1, random_state=42)

    X = data[['team_points', 'team_bags', 'other_team_points', 'other_team_bags']].values
    y = data['game_win'].values

    X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.2, random_state=42)

    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_train)
    X_val = scaler.transform(X_val)

    # --- Neural Network Model ---
    print("Building neural network model...")
    model = tf.keras.models.Sequential([
        tf.keras.layers.Input(shape=(4,)),
        tf.keras.layers.Dense(4, activation='relu'),
        tf.keras.layers.Dense(1, activation='sigmoid')
    ])

    model.compile(optimizer='adam',
                  loss='binary_crossentropy',
                  metrics=['accuracy'])

    # --- Training ---
    print("Starting training...")
    history = model.fit(X_train, y_train,
                        epochs=10, # You can adjust the number of epochs
                        validation_data=(X_val, y_val),
                        callbacks=[TqdmCallback(verbose=1)],
                        verbose=0) # Set to 0 to let tqdm handle the output

    # --- Evaluation ---
    loss, accuracy = model.evaluate(X_val, y_val, verbose=0)
    print(f"\nValidation Accuracy: {accuracy*100:.2f}%")
    print(f"Validation Loss: {loss:.4f}")

    # --- Save the Model ---
    model.save(model_filename)
    print(f"Model saved to {model_filename}")

    # --- Graphing ---
    if show_graphs:
        print("Displaying training graphs...")
        # Plot training & validation accuracy values
        plt.figure(figsize=(12, 5))
        plt.subplot(1, 2, 1)
        plt.plot(history.history['accuracy'])
        plt.plot(history.history['val_accuracy'])
        plt.title('Model accuracy')
        plt.ylabel('Accuracy')
        plt.xlabel('Epoch')
        plt.legend(['Train', 'Validation'], loc='upper left')

        # Plot training & validation loss values
        plt.subplot(1, 2, 2)
        plt.plot(history.history['loss'])
        plt.plot(history.history['val_loss'])
        plt.title('Model loss')
        plt.ylabel('Loss')
        plt.xlabel('Epoch')
        plt.legend(['Train', 'Validation'], loc='upper left')

        plt.tight_layout()
        plt.show()

if __name__ == '__main__':
    main()

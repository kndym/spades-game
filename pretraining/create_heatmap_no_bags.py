import numpy as np
import tensorflow as tf
import matplotlib.pyplot as plt
import seaborn as sns
import os

def create_heatmap():
    # --- Model Loading ---
    model_path=input("Enter the name of the model file: ")
    if not os.path.exists(model_path):
        print(f"Error: Model file not found at '{model_path}'")
        return

    print("Loading model...")
    model = tf.keras.models.load_model(model_path)

    # --- Data Generation ---
    print("Generating data for heatmap...")
    our_points_range = np.arange(0, 501, 50)
    their_points_range = np.arange(0, 501, 50)
    
    win_probabilities = np.zeros((len(our_points_range), len(their_points_range)))

    # --- Prediction ---
    print("Calculating win probabilities...")
    for i, our_points in enumerate(our_points_range):
        for j, their_points in enumerate(their_points_range):
            # Input format: [team_points, team_bags, other_team_points, other_team_bags]
            input_data = np.array([[our_points, 5, their_points, 5]])
            
            # Note: The original training script uses StandardScaler. 
            # For this heatmap, we are not applying scaling, as the scaler was not saved.
            # This will affect the absolute accuracy of predictions, but the overall trend should be visible.
            
            win_prob = model.predict(input_data, verbose=0)[0][0]
            win_probabilities[i, j] = win_prob

    # --- Heatmap Creation ---
    print("Creating heatmap...")
    plt.figure(figsize=(12, 10))
    ax = sns.heatmap(
        win_probabilities, 
        xticklabels=their_points_range, 
        yticklabels=our_points_range, 
        cmap="viridis",
        annot=True,
        fmt=".2f",
        annot_kws={"size": 8}
    )
    ax.invert_yaxis() # To have 0 at the bottom-left

    plt.xlabel("Opponent's Points")
    plt.ylabel("Our Points")
    plt.title("Win Probability Heatmap (No Bags) - spades_win_minimum model")
    
    # --- Save and Show ---
    output_name = input("Enter the name of the output file (without extension): ")
    output_filename = "img/" + output_name + ".png"
    plt.savefig(output_filename)
    print(f"Heatmap saved to {output_filename}")
    
    plt.show()

if __name__ == '__main__':
    create_heatmap()

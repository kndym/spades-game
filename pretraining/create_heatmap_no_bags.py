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
    model = tf.keras.models.load_model(model_path, safe_mode=False)

    # --- Data Generation ---
    print("Generating data for heatmap...")
    total_points_range = np.arange(0, 1001, 50)
    points_diff_range = np.arange(-200, 201, 20)
    
    win_probabilities = np.zeros((len(total_points_range), len(points_diff_range)))
    annotations = np.empty((len(total_points_range), len(points_diff_range)), dtype=object)

    # --- Prediction ---
    print("Calculating win probabilities...")
    for i, total_points in enumerate(total_points_range):
        for j, diff in enumerate(points_diff_range):
            # Input format: [total_points, point_differential, team_bags, other_team_bags]
            input_data = np.array([[total_points, diff, 0, 0]])
            
            win_prob = model.predict(input_data, verbose=0)[0][0]
            win_probabilities[i, j] = win_prob
            
            # Check for scores > 500
            # Assumes "our score" is the one associated with the win probability
            our_score = (total_points + diff) / 2
            their_score = (total_points - diff) / 2
            
            annotation = f"{win_prob:.2f}"
            if our_score > 500 or their_score > 500:
                annotation += "*"
            annotations[i, j] = annotation

    # --- Heatmap Creation ---
    print("Creating heatmap...")
    plt.figure(figsize=(18, 14))
    ax = sns.heatmap(
        win_probabilities, 
        xticklabels=points_diff_range, 
        yticklabels=total_points_range, 
        cmap="viridis",
        annot=annotations,
        fmt="", # Use custom annotations
        annot_kws={"size": 8}
    )
    ax.invert_yaxis() # To have 0 at the bottom-left

    plt.xlabel("Point Differential (Our Score - Their Score)")
    plt.ylabel("Total Points (Our Score + Their Score)")
    plt.title("Win Probability Heatmap - Asterisk (*) indicates one team's score > 500")
    
    # --- Save and Show ---
    output_name = input("Enter the name of the output file (without extension): ")
    output_filename = "img/" + output_name + ".png"
    plt.savefig(output_filename)
    print(f"Heatmap saved to {output_filename}")
    
    plt.show()

if __name__ == '__main__':
    create_heatmap()
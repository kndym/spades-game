import numpy as np
import torch
import torch.nn as nn
import matplotlib.pyplot as plt
import seaborn as sns
import os

# Important: The model definition must be available.
# We import it from the training script.
from train_nn_pytorch import NN3Model

# --- Heatmap Generation Functions ---

def generate_total_vs_point_diff_heatmaps(model, base_output_name):
    """Generates heatmaps of total_points vs point_diff for different bag counts."""
    
    bag_scenarios = [(0, 0), (5, 5), (9, 9)]
    model.eval() # Set the model to evaluation mode
    
    for our_bags, their_bags in bag_scenarios:
        print(f"\n--- Generating heatmap for total_points vs point_diff (Bags: {our_bags},{their_bags}) ---")
        
        total_points_range = np.arange(0, 1001, 50)
        points_diff_range = np.arange(-200, 201, 20)
        
        win_probabilities = np.zeros((len(total_points_range), len(points_diff_range)))
        annotations = np.empty((len(total_points_range), len(points_diff_range)), dtype=object)

        for i, total_points in enumerate(total_points_range):
            for j, diff in enumerate(points_diff_range):
                input_data = np.array([[total_points, diff, our_bags, their_bags]])
                input_tensor = torch.tensor(input_data, dtype=torch.float32)
                
                with torch.no_grad():
                    win_prob = model(input_tensor).item()

                win_probabilities[i, j] = win_prob
                
                our_score = (total_points + diff) / 2
                their_score = (total_points - diff) / 2
                
                annotation = f"{win_prob:.2f}"
                if our_score > 500 or their_score > 500:
                    annotation += "*"
                annotations[i, j] = annotation

        plt.figure(figsize=(18, 14))
        ax = sns.heatmap(win_probabilities, xticklabels=points_diff_range, yticklabels=total_points_range, cmap="viridis", annot=annotations, fmt="", annot_kws={"size": 8})
        ax.invert_yaxis()

        plt.xlabel("Point Differential")
        plt.ylabel("Total Points")
        title = (f"Win Probability (Bags: Our={our_bags}, Their={their_bags})")
        plt.title(title)
        
        output_suffix = f"_total_vs_point_diff_bags_{our_bags}_{their_bags}"
        output_filename = f"img/{base_output_name}{output_suffix}.png"
        plt.savefig(output_filename)
        print(f"Heatmap saved to {output_filename}")
        plt.show()


def generate_point_vs_bag_diff_heatmaps(model, base_output_name):
    """Generates heatmaps of point_diff vs bag_diff for different total_points."""
    
    total_points_scenarios = [250, 500, 750]
    total_bags_const = 10
    model.eval()
    
    for total_points_const in total_points_scenarios:
        print(f"\n--- Generating heatmap for point_diff vs bag_diff (Total Points: {total_points_const}) ---")
        
        points_diff_range = np.arange(-200, 201, 20)
        bag_diff_range = np.arange(-10, 11, 2)
        
        win_probabilities = np.zeros((len(bag_diff_range), len(points_diff_range)))

        for i, bag_diff in enumerate(bag_diff_range):
            for j, point_diff in enumerate(points_diff_range):
                our_bags = (total_bags_const + bag_diff) / 2
                their_bags = (total_bags_const - bag_diff) / 2
                input_data = np.array([[total_points_const, point_diff, our_bags, their_bags]])
                input_tensor = torch.tensor(input_data, dtype=torch.float32)

                with torch.no_grad():
                    win_prob = model(input_tensor).item()
                win_probabilities[i, j] = win_prob

        plt.figure(figsize=(18, 8))
        ax = sns.heatmap(win_probabilities, xticklabels=points_diff_range, yticklabels=bag_diff_range.astype(int), cmap="viridis", annot=True, fmt=".2f", annot_kws={"size": 8})
        ax.invert_yaxis()

        plt.xlabel("Point Differential")
        plt.ylabel("Bag Differential")
        title = (f"Win Probability (Total Points={total_points_const}, Total Bags={total_bags_const})")
        plt.title(title)
        
        output_suffix = f"_point_vs_bag_diff_total_points_{total_points_const}"
        output_filename = f"img/{base_output_name}{output_suffix}.png"
        plt.savefig(output_filename)
        print(f"Heatmap saved to {output_filename}")
        plt.show()


def generate_total_vs_bag_diff_heatmaps(model, base_output_name):
    """Generates heatmaps of total_points vs bag_diff for different point_diffs."""
    
    point_diff_scenarios = [-100, 0, 100]
    total_bags_const = 10
    model.eval()

    for point_diff_const in point_diff_scenarios:
        print(f"\n--- Generating heatmap for total_points vs bag_diff (Point Diff: {point_diff_const}) ---")
        
        total_points_range = np.arange(0, 1001, 50)
        bag_diff_range = np.arange(-10, 11, 2)
        
        win_probabilities = np.zeros((len(bag_diff_range), len(total_points_range)))

        for i, bag_diff in enumerate(bag_diff_range):
            for j, total_points in enumerate(total_points_range):
                our_bags = (total_bags_const + bag_diff) / 2
                their_bags = (total_bags_const - bag_diff) / 2
                input_data = np.array([[total_points, point_diff_const, our_bags, their_bags]])
                input_tensor = torch.tensor(input_data, dtype=torch.float32)

                with torch.no_grad():
                    win_prob = model(input_tensor).item()
                win_probabilities[i, j] = win_prob

        plt.figure(figsize=(18, 8))
        ax = sns.heatmap(win_probabilities, xticklabels=total_points_range, yticklabels=bag_diff_range.astype(int), cmap="viridis", annot=True, fmt=".2f", annot_kws={"size": 8})
        ax.invert_yaxis()

        plt.xlabel("Total Points")
        plt.ylabel("Bag Differential")
        title = (f"Win Probability (Point Diff={point_diff_const}, Total Bags={total_bags_const})")
        plt.title(title)
        
        output_suffix = f"_total_vs_bag_diff_point_diff_{point_diff_const}"
        output_filename = f"img/{base_output_name}{output_suffix}.png"
        plt.savefig(output_filename)
        print(f"Heatmap saved to {output_filename}")
        plt.show()


def main():
    # --- Model Loading ---
    model_path = input("Enter the name of the model file (.pth): ")
    if not os.path.exists(model_path):
        print(f"Error: Model file not found at '{model_path}'")
        return

    print("Loading model...")
    # Instantiate the model and load the saved state
    model = NN3Model()
    model.load_state_dict(torch.load(model_path))
    model.eval()

    # --- User Input for Output ---
    base_output_name = input("Enter the base name for the output files (e.g., heatmap_v1): ")
    os.makedirs("img", exist_ok=True)

    # --- Generate Heatmaps ---
    generate_total_vs_point_diff_heatmaps(model, base_output_name)
    generate_point_vs_bag_diff_heatmaps(model, base_output_name)
    generate_total_vs_bag_diff_heatmaps(model, base_output_name)


if __name__ == '__main__':
    main()
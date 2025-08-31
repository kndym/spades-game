import pandas as pd
import matplotlib.pyplot as plt
import os

def plot_statistical_win_fraction():
    # --- User Input ---
    csv_filename = input("Enter the name of the training data CSV file: ")

    while not os.path.exists(csv_filename):
        print(f"Error: File '{csv_filename}' not found.")
        csv_filename = input("Please enter a valid CSV file name: ")

    # --- Data Loading ---
    print("Loading data...")
    data = pd.read_csv(csv_filename)

    # --- Calculation ---
    print("Calculating statistical win fraction by point differential...")
    # Group by point differential and calculate the mean of 'game_win'
    # which is the win fraction.
    win_frac_by_diff = data.groupby('point_differential')['game_win'].mean().reset_index()
    
    # Also, get the number of games for each point differential to show as size on the plot
    games_count = data.groupby('point_differential')['game_win'].count().reset_index()
    games_count.rename(columns={'game_win': 'n_games'}, inplace=True)
    
    win_frac_by_diff = pd.merge(win_frac_by_diff, games_count, on='point_differential')

    # --- Plot Creation ---
    print("Creating plot...")
    plt.figure(figsize=(14, 8))
    
    # Scatter plot where the size of the dot is proportional to the number of games
    plt.scatter(win_frac_by_diff['point_differential'], 
                win_frac_by_diff['game_win'], 
                s=win_frac_by_diff['n_games'] / win_frac_by_diff['n_games'].max() * 200 + 10, # Scale sizes
                alpha=0.7)

    plt.xlabel("Point Differential")
    plt.ylabel("Statistical Win Fraction")
    plt.title("Statistical Win Fraction by Point Differential")
    plt.grid(True)
    
    # Add a horizontal line at y=0.5 for reference
    plt.axhline(y=0.5, color='r', linestyle='--')

    # --- Save and Show ---
    output_name = input("Enter the name of the output file (without extension): ")
    output_filename = "img/" + output_name + ".png"
    plt.savefig(output_filename)
    print(f"Plot saved to {output_filename}")
    
    plt.show()

if __name__ == '__main__':
    plot_statistical_win_fraction()

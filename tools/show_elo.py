
import json
import math
from pathlib import Path
import sys

def load_all_metadata(versions_dir):
    """Load metadata for all model versions."""
    metadata = {}
    if not versions_dir.exists():
        return metadata
    for item in versions_dir.iterdir():
        if item.is_dir() and item.name.startswith("v") and item.name[1:].isdigit():
            meta_file = item / "metadata.json"
            if meta_file.exists():
                with open(meta_file, "r", encoding="utf-8") as f:
                    metadata[item.name] = json.load(f)
    return metadata

def calculate_elo(metadata_dict, k=32, initial_elo=1000):
    """
    Calculate ELO ratings based on evaluation results.
    Each version's eval shows win rate vs its parent.
    """
    elo = {}
    
    # Sort versions by number to process in chronological order
    versions = sorted(metadata_dict.keys(), key=lambda v: int(v[1:]))
    
    for version in versions:
        meta = metadata_dict[version]
        
        # Initial version starts at base ELO
        if meta.get("type") == "initial" or "parent_version" not in meta:
            elo[version] = initial_elo
            continue
        
        parent = meta.get("parent_version")
        eval_data = meta.get("eval") or {}
        # Default to 0.5 if no eval data (though expected for trained models)
        win_rate = eval_data.get("candidate_win_rate", 0.5) if eval_data else 0.5
        
        # Get parent's ELO (or initial if not found)
        parent_elo = elo.get(parent, initial_elo)
        
        # Calculate ELO change
        # Formula: NewRating = OldRating + K * (ActualScore - ExpectedScore)
        # Expected score for equal rating is 0.5
        # We can simplify: calculate implied performance difference
        
        if win_rate >= 0.99: win_rate = 0.99
        if win_rate <= 0.01: win_rate = 0.01
        
        # Calculate difference based on logistic curve
        # win_rate = 1 / (1 + 10^((opp_elo - my_elo)/400))
        # => 1/win_rate - 1 = 10^(diff/400)
        # => log10(1/win_rate - 1) = diff/400
        # => diff = 400 * log10((1-win_rate)/win_rate) (this is parent - child)
        
        # Actually simpler:
        # If I beat parent with 60%, my ELO is higher.
        # diff = -400 * log10(1/win_rate - 1)
        
        elo_diff = -400 * math.log10(1/win_rate - 1)
        
        # However, purely chaining ELOs based on one match result is volatile.
        # But for this purpose (tracking progress), we often just update from parent.
        # Or we can do a standard update:
        # expected = 1 / (1 + 10 ** ((parent_elo - parent_elo) / 400)) = 0.5
        # new_elo = parent_elo + K * (win_rate - 0.5) ? No, that's for one game.
        # For a match of N games:
        # We implicitly assume the measured win rate IS the performance rating relative to parent
        
        elo[version] = parent_elo + elo_diff
        
        # Constraint to avoid explosions?
        # metadata.json win rates are from 100 games usually.
        
    return elo

def main():
    repo_root = Path(__file__).resolve().parents[1]
    versions_dir = repo_root / "models" / "versions"
    
    metadata = load_all_metadata(versions_dir)
    if not metadata:
        print("No model versions found.")
        return

    elo_ratings = calculate_elo(metadata)
    
    print(f"\n{'Version':<10} {'ELO':<8} {'Win Rate':<12} {'Parent':<10} {'Promoted':<10}")
    print("-" * 60)
    
    # Sort for display
    versions = sorted(metadata.keys(), key=lambda v: int(v[1:]))
    
    # Filter for 10-26 if requested (user asked for 10-26)
    # But showing context is nice. I'll just show all or range.
    
    for version in versions:
        v_num = int(version[1:])
        if not (10 <= v_num <= 27): # Include 27 to be thorough
             continue
             
        meta = metadata[version]
        rating = elo_ratings.get(version, 1000)
        parent = meta.get("parent_version", "-")
        promoted = "Yes" if meta.get("promoted") else "No"
        
        eval_data = meta.get("eval") or {}
        win_rate = eval_data.get("candidate_win_rate", None)
        win_str = f"{win_rate:.1%}" if win_rate is not None else "-"
        
        print(f"{version:<10} {rating:<8.0f} {win_str:<12} {parent:<10} {promoted:<10}")

if __name__ == "__main__":
    main()

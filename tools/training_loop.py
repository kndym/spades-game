"""
Training loop that runs the self-play pipeline for a specified duration,
tracking ELO ratings and win percentages between model versions.
"""
import argparse
import json
import math
import subprocess
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path


def run_pipeline(args, repo_root):
    """Run one iteration of the self-play pipeline."""
    cmd = [
        sys.executable, "tools/run_self_play_pipeline.py",
        "--self-play-bin", args.self_play_bin,
        "--eval-bin", args.eval_bin,
        "--games", str(args.games),
        "--eval-games", str(args.eval_games),
        "--epochs", str(args.epochs),
        "--batch-size", str(args.batch_size),
        "--promote-threshold", str(args.promote_threshold),
    ]
    result = subprocess.run(cmd, cwd=repo_root, capture_output=True, text=True)
    return result.returncode == 0, result.stdout, result.stderr


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
    Each version's eval shows win rate vs its parent (baseline at time of creation).
    """
    elo = {}
    
    # Sort versions by number
    versions = sorted(metadata_dict.keys(), key=lambda v: int(v[1:]))
    
    for version in versions:
        meta = metadata_dict[version]
        
        # Initial version starts at base ELO
        if meta.get("type") == "initial" or "parent_version" not in meta:
            elo[version] = initial_elo
            continue
        
        parent = meta.get("parent_version")
        eval_data = meta.get("eval") or {}
        win_rate = eval_data.get("candidate_win_rate", 0.5) if eval_data else 0.5
        
        # Get parent's ELO (or initial if not found)
        parent_elo = elo.get(parent, initial_elo)
        
        # Calculate expected score
        expected = 1 / (1 + 10 ** ((parent_elo - parent_elo) / 400))  # vs same-rated opponent
        
        # ELO change based on win rate (treating win_rate as actual score)
        # More wins = higher ELO gain
        if win_rate >= 0.5:
            # Won more than half - ELO above parent
            elo_diff = 400 * math.log10(win_rate / (1 - win_rate + 0.001))
            elo[version] = parent_elo + min(elo_diff, 200)  # Cap at +200
        else:
            # Lost more than half - ELO below parent  
            elo_diff = 400 * math.log10((1 - win_rate + 0.001) / (win_rate + 0.001))
            elo[version] = parent_elo - min(elo_diff, 200)  # Cap at -200
    
    return elo


def read_baseline(versions_dir):
    """Read current baseline version."""
    baseline_file = versions_dir / "baseline.txt"
    if baseline_file.exists():
        return baseline_file.read_text(encoding="utf-8").strip()
    return None


def print_status(iteration, elapsed, metadata, elo_ratings, baseline):
    """Print current training status."""
    print("\n" + "=" * 70)
    print(f"TRAINING STATUS - Iteration {iteration} | Elapsed: {elapsed}")
    print("=" * 70)
    
    # Sort versions by number (most recent first for display)
    versions = sorted(metadata.keys(), key=lambda v: int(v[1:]), reverse=True)
    
    print(f"\n{'Version':<10} {'ELO':<8} {'Win Rate':<12} {'Parent':<10} {'Promoted':<10}")
    print("-" * 60)
    
    for version in versions[:10]:  # Show last 10 versions
        meta = metadata[version]
        elo = elo_ratings.get(version, 1000)
        eval_data = meta.get("eval") or {}
        win_rate = eval_data.get("candidate_win_rate", None) if eval_data else None
        parent = meta.get("parent_version", "-")
        promoted = "Yes" if meta.get("promoted", False) else "No"
        
        win_str = f"{win_rate:.1%}" if win_rate is not None else "-"
        baseline_marker = " [BASELINE]" if version == baseline else ""
        
        print(f"{version:<10} {elo:<8.0f} {win_str:<12} {parent:<10} {promoted:<10}{baseline_marker}")
    
    if len(versions) > 10:
        print(f"... and {len(versions) - 10} more versions")
    
    # Summary stats
    if elo_ratings:
        best_version = max(elo_ratings, key=elo_ratings.get)
        best_elo = elo_ratings[best_version]
        current_elo = elo_ratings.get(baseline, 1000) if baseline else 1000
        print(f"\nCurrent baseline: {baseline} (ELO: {current_elo:.0f})")
        print(f"Best version: {best_version} (ELO: {best_elo:.0f})")
    
    print("=" * 70 + "\n")


def main():
    parser = argparse.ArgumentParser(description="Run training loop for specified duration.")
    parser.add_argument("--duration", type=int, default=30, help="Training duration in minutes.")
    parser.add_argument("--self-play-bin", default="build/Release/self_play_main.exe",
                        help="Path to self_play_main binary.")
    parser.add_argument("--eval-bin", default="build/Release/evaluation_main.exe",
                        help="Path to evaluation_main binary.")
    parser.add_argument("--games", type=int, default=200, help="Self-play games per iteration.")
    parser.add_argument("--eval-games", type=int, default=100, help="Evaluation games.")
    parser.add_argument("--epochs", type=int, default=10, help="Training epochs.")
    parser.add_argument("--batch-size", type=int, default=64, help="Batch size.")
    parser.add_argument("--promote-threshold", type=float, default=0.55,
                        help="Win rate threshold to promote candidate.")
    parser.add_argument("--status-interval", type=int, default=5,
                        help="Print status every N iterations.")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[1]
    versions_dir = repo_root / "models" / "versions"
    
    start_time = datetime.now()
    end_time = start_time + timedelta(minutes=args.duration)
    
    print(f"Starting training loop at {start_time.strftime('%H:%M:%S')}")
    print(f"Will run for {args.duration} minutes (until {end_time.strftime('%H:%M:%S')})")
    print(f"Settings: {args.games} self-play games, {args.eval_games} eval games, {args.epochs} epochs")
    print("-" * 70)
    
    iteration = 0
    successful_iterations = 0
    promotions = 0
    
    try:
        while datetime.now() < end_time:
            iteration += 1
            iter_start = datetime.now()
            
            print(f"\n[{iter_start.strftime('%H:%M:%S')}] Starting iteration {iteration}...")
            
            success, stdout, stderr = run_pipeline(args, repo_root)
            
            iter_duration = datetime.now() - iter_start
            elapsed = datetime.now() - start_time
            
            if success:
                successful_iterations += 1
                # Check if promoted
                if "Promoted" in stdout:
                    promotions += 1
                    print(f"  [OK] Completed in {iter_duration.total_seconds():.1f}s - PROMOTED!")
                else:
                    print(f"  [OK] Completed in {iter_duration.total_seconds():.1f}s - not promoted")
            else:
                print(f"  [FAIL] Failed after {iter_duration.total_seconds():.1f}s")
                if stderr:
                    print(f"    Error: {stderr[:200]}")
            
            # Print detailed status periodically
            if iteration % args.status_interval == 0:
                metadata = load_all_metadata(versions_dir)
                elo_ratings = calculate_elo(metadata)
                baseline = read_baseline(versions_dir)
                print_status(iteration, str(elapsed).split('.')[0], metadata, elo_ratings, baseline)
            
            # Check remaining time
            remaining = end_time - datetime.now()
            if remaining.total_seconds() < 30:
                print(f"\nLess than 30 seconds remaining, stopping...")
                break
                
    except KeyboardInterrupt:
        print("\n\nTraining interrupted by user.")
    
    # Final summary
    total_time = datetime.now() - start_time
    metadata = load_all_metadata(versions_dir)
    elo_ratings = calculate_elo(metadata)
    baseline = read_baseline(versions_dir)
    
    print("\n" + "=" * 70)
    print("FINAL TRAINING SUMMARY")
    print("=" * 70)
    print(f"Total time: {str(total_time).split('.')[0]}")
    print(f"Iterations: {iteration} ({successful_iterations} successful)")
    print(f"Promotions: {promotions}")
    print(f"Success rate: {successful_iterations/iteration*100:.1f}%")
    print(f"Promotion rate: {promotions/successful_iterations*100:.1f}%" if successful_iterations > 0 else "N/A")
    
    print_status(iteration, str(total_time).split('.')[0], metadata, elo_ratings, baseline)


if __name__ == "__main__":
    main()

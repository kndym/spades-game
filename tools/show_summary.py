"""Show training summary with ELO ratings."""
import json
import math
from pathlib import Path

versions_dir = Path("models/versions")

# Load all metadata
metadata = {}
for item in versions_dir.iterdir():
    if item.is_dir() and item.name.startswith("v") and item.name[1:].isdigit():
        meta_file = item / "metadata.json"
        if meta_file.exists():
            with open(meta_file, "r") as f:
                metadata[item.name] = json.load(f)

# Calculate ELO
elo = {}
versions = sorted(metadata.keys(), key=lambda v: int(v[1:]))

for version in versions:
    meta = metadata[version]
    if meta.get("type") == "initial" or "parent_version" not in meta:
        elo[version] = 1000
        continue
    
    parent = meta.get("parent_version")
    eval_data = meta.get("eval") or {}
    win_rate = eval_data.get("candidate_win_rate", 0.5) if eval_data else 0.5
    
    parent_elo = elo.get(parent, 1000)
    if win_rate >= 0.5:
        elo_diff = 400 * math.log10(win_rate / (1 - win_rate + 0.001))
        elo[version] = parent_elo + min(elo_diff, 200)
    else:
        elo_diff = 400 * math.log10((1 - win_rate + 0.001) / (win_rate + 0.001))
        elo[version] = parent_elo - min(elo_diff, 200)

# Read baseline
baseline = (versions_dir / "baseline.txt").read_text().strip()

# Print summary
print("=" * 70)
print("MODEL TRAINING SUMMARY")
print("=" * 70)
print(f"Total versions: {len(versions)}")
print(f"Current baseline: {baseline}")
print()
print(f"{'Version':<10} {'ELO':<8} {'Win Rate':<12} {'Parent':<10} {'Promoted':<10}")
print("-" * 60)

for version in sorted(versions, key=lambda v: int(v[1:]), reverse=True):
    meta = metadata[version]
    e = elo.get(version, 1000)
    eval_data = meta.get("eval") or {}
    win_rate = eval_data.get("candidate_win_rate")
    parent = meta.get("parent_version", "-")
    promoted = "Yes" if meta.get("promoted", False) else "No"
    win_str = f"{win_rate:.1%}" if win_rate is not None else "-"
    marker = " [BASELINE]" if version == baseline else ""
    print(f"{version:<10} {e:<8.0f} {win_str:<12} {parent:<10} {promoted:<10}{marker}")

print()
print(f"Best ELO: {max(elo.values()):.0f} ({max(elo, key=elo.get)})")
print(f"Baseline ELO: {elo.get(baseline, 1000):.0f}")
print("=" * 70)

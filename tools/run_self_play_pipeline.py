import argparse
import json
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path


def default_binary(name):
    if os.name == "nt":
        exe = f"{name}.exe"
        if Path(exe).exists():
            return exe
    return name


def ensure_dir(path):
    Path(path).mkdir(parents=True, exist_ok=True)


def list_versions(versions_dir):
    versions = []
    if not Path(versions_dir).exists():
        return versions
    for item in Path(versions_dir).iterdir():
        if item.is_dir() and item.name.startswith("v") and item.name[1:].isdigit():
            versions.append(item.name)
    return sorted(versions)


def next_version_id(versions_dir):
    versions = list_versions(versions_dir)
    if not versions:
        return "v0001"
    last = max(int(v[1:]) for v in versions)
    return f"v{last + 1:04d}"


def baseline_file(versions_dir):
    return Path(versions_dir) / "baseline.txt"


def read_baseline(versions_dir):
    path = baseline_file(versions_dir)
    if not path.exists():
        return None
    value = path.read_text(encoding="utf-8").strip()
    return value if value else None


def write_baseline(versions_dir, version_id):
    path = baseline_file(versions_dir)
    path.write_text(version_id, encoding="utf-8")


def write_metadata(version_dir, metadata):
    path = Path(version_dir) / "metadata.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)


def run_command(cmd, cwd):
    print(f"Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=cwd, check=True, capture_output=True, text=True)
    if result.stdout: print(result.stdout)
    if result.stderr: print(f"STDERR: {result.stderr}")


def init_baseline(versions_dir, repo_root, python_exec):
    version_id = next_version_id(versions_dir)
    version_dir = Path(versions_dir) / version_id
    ensure_dir(version_dir)

    run_command([python_exec, "train_mcts_bots_pytorch.py", "--mode", "generate_initial_models",
                 "--output-model-path", str(version_dir)], cwd=repo_root)
    run_command([python_exec, "pretraining/train_nn_pytorch.py", "--mode", "generate_random",
                 "--output-model-path", str(version_dir), "--export-onnx"], cwd=repo_root)

    metadata = {
        "version_id": version_id,
        "created_at": datetime.utcnow().isoformat() + "Z",
        "type": "initial",
        "training_data": None,
        "training_args": None,
        "eval": None
    }
    write_metadata(version_dir, metadata)
    write_baseline(versions_dir, version_id)
    print(f"Initialized baseline version {version_id}")
    return version_id


def main():
    parser = argparse.ArgumentParser(description="Run self-play training pipeline.")
    parser.add_argument("--self-play-bin", default=default_binary("self_play_main"),
                        help="Path to self_play_main binary.")
    parser.add_argument("--eval-bin", default=default_binary("evaluation_main"),
                        help="Path to evaluation_main binary.")
    parser.add_argument("--versions-dir", default="models/versions", help="Model versions directory.")
    parser.add_argument("--data-dir", default="data", help="Training data directory.")
    parser.add_argument("--games", type=int, default=100, help="Self-play games per iteration.")
    parser.add_argument("--eval-games", type=int, default=50, help="Evaluation games.")
    parser.add_argument("--epochs", type=int, default=10, help="Training epochs for NN1/NN2/NN3.")
    parser.add_argument("--batch-size", type=int, default=64, help="Batch size for NN1/NN2/NN3.")
    parser.add_argument("--promote-threshold", type=float, default=0.55,
                        help="Candidate win-rate threshold to promote.")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[1]
    versions_dir = repo_root / args.versions_dir
    data_dir = repo_root / args.data_dir
    ensure_dir(versions_dir)
    ensure_dir(data_dir)

    python_exec = sys.executable
    baseline_version = read_baseline(versions_dir)
    if baseline_version is None:
        baseline_version = init_baseline(versions_dir, repo_root, python_exec)

    baseline_dir = versions_dir / baseline_version
    candidate_version = next_version_id(versions_dir)
    candidate_dir = versions_dir / candidate_version
    ensure_dir(candidate_dir)

    data_path = data_dir / f"iter_{candidate_version}.bin"

    run_command([args.self_play_bin, "--mode", "self-play",
                 "--games", str(args.games),
                 "--output-data-path", str(data_path),
                 "--input-model-path", str(baseline_dir)], cwd=repo_root)

    run_command([python_exec, "train_mcts_bots_pytorch.py", "--mode", "train",
                 "--input-data-path", str(data_path),
                 "--output-model-path", str(candidate_dir),
                 "--epochs", str(args.epochs),
                 "--batch-size", str(args.batch_size)], cwd=repo_root)

    run_command([python_exec, "pretraining/train_nn_pytorch.py", "--mode", "train_from_proto",
                 "--input-proto", str(data_path),
                 "--output-model-path", str(candidate_dir),
                 "--epochs", str(args.epochs),
                 "--batch-size", str(args.batch_size),
                 "--export-onnx"], cwd=repo_root)

    eval_output = candidate_dir / "eval.json"
    run_command([args.eval_bin, "--mode", "evaluate",
                 "--games", str(args.eval_games),
                 "--baseline-model-path", str(baseline_dir),
                 "--candidate-model-path", str(candidate_dir),
                 "--output", str(eval_output)], cwd=repo_root)

    eval_data = {}
    if eval_output.exists():
        eval_data = json.loads(eval_output.read_text(encoding="utf-8"))

    candidate_win_rate = eval_data.get("candidate_win_rate", 0.0)
    promoted = candidate_win_rate >= args.promote_threshold

    metadata = {
        "version_id": candidate_version,
        "created_at": datetime.utcnow().isoformat() + "Z",
        "parent_version": baseline_version,
        "training_data": str(data_path),
        "training_args": {
            "games": args.games,
            "epochs": args.epochs,
            "batch_size": args.batch_size
        },
        "eval": eval_data,
        "promoted": promoted
    }
    write_metadata(candidate_dir, metadata)

    if promoted:
        write_baseline(versions_dir, candidate_version)
        print(f"Promoted {candidate_version} to baseline.")
    else:
        print(f"Candidate {candidate_version} not promoted (win_rate={candidate_win_rate:.4f}).")


if __name__ == "__main__":
    main()

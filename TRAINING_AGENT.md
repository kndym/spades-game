# Spades Bot Training Agent Instructions

## Overview

This document provides instructions for an AI agent to run an extended 1-2 hour training session for the Spades MCTS bot. The training pipeline uses self-play reinforcement learning with neural network guidance.

## Recent Upgrades (Important Context)

The following optimizations were just implemented:

1. **Larger Neural Networks**:
   - NN1 (Bidding): 64 hidden units, 3 layers (up from 32 units, 2 layers)
   - NN2 (Playing): 384→384→256 hidden units, 3 layers (up from 128 units, 2 layers)

2. **Enhanced State Representation**:
   - NN2 input size increased from 118 to 326 features
   - Added card tracking: which cards each player has played (4 players × 52 cards = 208 new features)
   - This enables card counting and memory of opponent plays

3. **Increased MCTS Simulations**:
   - Self-play and evaluation now use 150 simulations per move (up from 50)
   - This significantly improves move quality but increases training time per iteration

## Training Commands

### Start the Training Loop

Run the training loop for the desired duration:

```bash
python tools/training_loop.py --duration 90 --games 200 --eval-games 100 --status-interval 5
```

Parameters:
- `--duration`: Training time in minutes (recommend 90-120 for 1-2 hours)
- `--games`: Self-play games per iteration (200 recommended)
- `--eval-games`: Evaluation games to compare models (100 recommended)
- `--status-interval`: Print detailed ELO status every N iterations

### Monitor Progress

To check current training status at any time:

```bash
python tools/show_summary.py
```

### Run Single Iteration (for testing)

```bash
python tools/run_self_play_pipeline.py --self-play-bin build\Release\self_play_main.exe --eval-bin build\Release\evaluation_main.exe --games 200 --eval-games 100
```

## Expected Behavior

### Training Timeline
- **Each iteration**: ~2-3 minutes (due to increased MCTS simulations)
- **90-minute run**: ~30-45 iterations
- **120-minute run**: ~40-60 iterations

### Expected ELO Progression
Based on previous training runs:
- Starting ELO: 1000 (random baseline)
- After 30 min: ~1400-1600 ELO
- After 60 min: ~1700-1900 ELO  
- After 90 min: ~1800-2100 ELO (with new architecture)
- Ceiling estimate: ~2200-2500 ELO (with new optimizations)

### Promotion Rate
- Early training: ~60-80% promotion rate
- Mid training: ~30-50% promotion rate
- Late training: ~10-20% promotion rate (as model approaches ceiling)

## Files and Directories

- **Models**: `models/versions/v####/` - Each version contains:
  - `nn1_model.onnx` - Bidding policy network
  - `nn2_model.onnx` - Playing policy network  
  - `nn3_model.onnx` - Win probability value network
  - `metadata.json` - Training info and eval results
  - `eval.json` - Detailed evaluation metrics

- **Training Data**: `data/iter_v####.bin` - Protobuf training samples

- **Baseline Tracker**: `models/versions/baseline.txt` - Current best model version

## Troubleshooting

### If training fails mid-iteration:
1. Check that C++ binaries are built: `build\Release\self_play_main.exe` and `build\Release\evaluation_main.exe`
2. Run: `cmake --build build --config Release` to rebuild if needed

### If ONNX export fails:
The code uses `dynamo=False` in `torch.onnx.export()` to ensure compatibility with PyTorch 2.x

### If models are incompatible:
If you see feature size mismatch errors, the models were trained with the old 118-feature architecture. Delete old versions and restart:
```bash
Remove-Item -Path "models\versions\v*" -Recurse -Force
Remove-Item -Path "models\versions\baseline.txt" -Force
```

## Success Criteria

A successful training run should show:
1. Steady ELO improvement over time
2. Multiple model promotions (baseline changes)
3. Final ELO significantly higher than starting (target: +800-1200 ELO gain)

## Architecture Summary

```
Pipeline Flow:
1. Self-play (150 MCTS sims/move) → Training data
2. Train NN1 (bidding) + NN2 (playing) + NN3 (value)
3. Export to ONNX
4. Evaluate candidate vs baseline (150 MCTS sims/move)
5. If candidate win rate ≥ 55%: promote to baseline
6. Repeat
```

Feature Breakdown for NN2 (326 total):
- 4: Team scores and bags
- 4: Player bids
- 52: Current hand (one-hot)
- 52: Current trick cards (one-hot)
- 4: Tricks won by each player
- 1: Spades broken flag
- 1: Current player index
- 208: Card tracking (4 players × 52 cards played history)

export const BID_MODEL = {
  version: 1,
  method:
    "Ridge regression of tricks from public own-hand features; score-calibrated offset",
  weights: [
    0.391610239, -0.310939574, -0.31488836, -0.391590161, 1.017418097,
    0.934086239, 0.983731998, 0.992700437, 1.22682224, 0.552682887, 0.569083514,
    0.576777638, 0.877194399, 0.248786751, 0.26235819, 0.284805005, 0.631522985,
    0.141850051, 0.101927567, 0.283600632, 0.635844407,
  ],
  offset: -0.4,
  seed: 20261010,
  trainingHands: 12000,
  calibrationSeed: 20361010,
  calibrationHands: 1200,
  calibrationSeatSwap: true,
};

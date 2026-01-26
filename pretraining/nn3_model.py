import torch
import torch.nn as nn


class NN3Model(nn.Module):
    def __init__(self):
        super(NN3Model, self).__init__()
        self.scale = torch.tensor([1000.0, 100.0, 10.0, 10.0])
        self.fc1 = nn.Linear(4, 4)
        self.fc2 = nn.Linear(4, 1)
        self.softplus = nn.Softplus()
        self.sigmoid = nn.Sigmoid()

    def forward(self, x):
        x = x / self.scale.to(x.device)
        x = self.softplus(self.fc1(x))
        x = self.sigmoid(self.fc2(x))
        return x

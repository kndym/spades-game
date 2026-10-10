"""Small CPU-only Monte Carlo action-value pilot, separate from deployed bidder."""
import json,time, pathlib, hashlib
import torch
ROOT=pathlib.Path(__file__).resolve().parent
torch.set_num_threads(2)
torch.manual_seed(81200000)
started=time.perf_counter()
data=json.loads((ROOT/'value-data.json').read_text())
x=torch.tensor([r['x'] for r in data['rows']],dtype=torch.float32)
y=torch.tensor([[r['y']] for r in data['rows']],dtype=torch.float32)
model=torch.nn.Sequential(torch.nn.Linear(x.shape[1],64),torch.nn.ReLU(),torch.nn.Linear(64,32),torch.nn.ReLU(),torch.nn.Linear(32,1))
optimizer=torch.optim.Adam(model.parameters(),lr=.002)
losses=[]
for epoch in range(20):
    order=torch.randperm(x.shape[0]); total=0
    for ids in order.split(1024):
        optimizer.zero_grad(); pred=model(x[ids]); loss=torch.nn.functional.mse_loss(pred,y[ids]);loss.backward();optimizer.step();total+=loss.item()*len(ids)
    losses.append(total/len(x))
    if (epoch+1)%5==0:print(f'Epoch {epoch+1}: MSE {losses[-1]:.5f}',flush=True)
layers=[{'weight':m.weight.detach().tolist(),'bias':m.bias.detach().tolist()} for m in model if isinstance(m,torch.nn.Linear)]
payload={'version':1,'method':'CPU MLP counterfactual normal-bid advantage prediction','trainingSeed':data['seed'],'trainingHands':data['hands'],'featureCount':x.shape[1],'layers':layers,'penalty':0,'deployed':False}
(ROOT.parent.parent/'spades-web'/'value-bid-model.json').write_text(json.dumps(payload))
(ROOT/'value-training.json').write_text(json.dumps({'hands':data['hands'],'rows':len(x),'seed':data['seed'],'losses':losses,'seconds':time.perf_counter()-started,'threads':2,'dataGenerationSeconds':data['seconds'],'datasetSha256':hashlib.sha256((ROOT/'value-data.json').read_bytes()).hexdigest()},indent=2))
print(f'Training completed in {time.perf_counter()-started:.2f}s',flush=True)

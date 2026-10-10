import json,pathlib,time,hashlib,torch
ROOT=pathlib.Path(__file__).resolve().parent
torch.set_num_threads(2);torch.manual_seed(86200000);started=time.perf_counter()
data=json.loads((ROOT/'nil-data.json').read_text());rows=data['rows']
x=torch.tensor([r['x'] for r in rows],dtype=torch.float32);q=torch.tensor([r['advantage'] for r in rows]);p=torch.tensor([r['success'] for r in rows])
model=torch.nn.Sequential(torch.nn.Linear(x.shape[1],64),torch.nn.ReLU(),torch.nn.Linear(64,32),torch.nn.ReLU(),torch.nn.Linear(32,2));opt=torch.optim.Adam(model.parameters(),lr=.002);losses=[]
for epoch in range(35):
    total=0
    for ids in torch.randperm(len(x)).split(512):
        opt.zero_grad();z=model(x[ids]);loss=torch.nn.functional.mse_loss(z[:,0],q[ids])+.25*torch.nn.functional.binary_cross_entropy_with_logits(z[:,1],p[ids]);loss.backward();opt.step();total+=len(ids)*loss.item()
    losses.append(total/len(x))
    if (epoch+1)%10==0:print(f'Epoch {epoch+1}: loss {losses[-1]:.4f}',flush=True)
layers=[{'weight':m.weight.detach().tolist(),'bias':m.bias.detach().tolist()} for m in model if isinstance(m,torch.nn.Linear)]
payload={'version':1,'method':'Matched conditional-world nil advantage and success prediction','trainingSeed':data['seed'],'trainingHands':data['hands'],'featureCount':x.shape[1],'worlds':data['worlds'],'proposals':data['proposals'],'layers':layers,'threshold':0,'deployed':False}
(ROOT.parent.parent/'spades-web'/'nil-bid-model.json').write_text(json.dumps(payload));meta={k:v for k,v in data.items() if k!='rows'};meta.update(losses=losses,trainingSeconds=time.perf_counter()-started,torchVersion=torch.__version__,threads=2,datasetSha256=hashlib.sha256((ROOT/'nil-data.json').read_bytes()).hexdigest());(ROOT/'nil-training.json').write_text(json.dumps(meta,indent=2));print(f'Training took {time.perf_counter()-started:.2f}s',flush=True)

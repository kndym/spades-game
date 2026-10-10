"""Released jdfreden ISMCTS tree algorithm, with a public-information rules adapter.

The tree algorithm is imported unchanged. The upstream Spades state cannot be
used fairly: it scores individual rather than partnership contracts and puts
already-played cards back into sampled hands. This adapter replaces that state,
not the tree algorithm. This is an adapted research baseline, not a champion.
"""
import sys, json, random, hashlib, copy
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent/'external-vendor'/'ISMCTS-Spades'))
from Game import ISMCTS, SpadesGameState
from Types.types import Card, Suit, Player

ITERATIONS=int(sys.argv[1]) if len(sys.argv)>1 else 128
SUITS=[Suit.club,Suit.diamond,Suit.heart,Suit.spade]

class PublicState:
    def __init__(self,o):
        self.o=o
        self.playerToMove=o['player']
        self.numberOfPlayers=4
        self.EXPLORATION=.7
        self.currentTrick=[dict(c) for c in o['currentTrick']]
        self.bids=list(o['bids'])
        self.tricks=list(o['tricks'])
        self.bags=list(o['bags'])
        self.scores=list(o['scores'])
        self.spadesBroken=o['spadesBroken']
        self.terminal=False
        self.delta=[0,0]
        self.playerHands=self.sample()
    def sample(self):
        o=self.o; own=o['player']
        seen=set(o['hand'])|{c['card'] for t in o['completedTricks'] for c in t['cards']}|{c['card'] for c in o['currentTrick']}
        pool=[c for c in range(52) if c not in seen]
        assert len(pool)==sum(o['handSizes'])-len(o['hand'])
        for _ in range(300):
            h={p:(list(o['hand']) if p==own else []) for p in range(4)}
            capacity={p:o['handSizes'][p] for p in range(4) if p!=own}
            cards=list(pool);random.shuffle(cards)
            cards.sort(key=lambda c:sum(not o['voids'][p][c//13] for p in capacity))
            success=True
            for c in cards:
                allowed=[p for p in capacity if capacity[p]>0 and not o['voids'][p][c//13]]
                if not allowed:success=False;break
                p=random.choices(allowed,weights=[capacity[p] for p in allowed])[0]
                h[p].append(c);capacity[p]-=1
            if success:
                assert all(len(h[p])==o['handSizes'][p] for p in range(4))
                assert len(set(c for cards in h.values() for c in cards))==sum(o['handSizes'])
                return h
        raise RuntimeError('Could not sample a void-consistent public world; no fallback permitted')
    def CloneAndRandomize(self,observer):
        assert observer==self.o['player']
        s=copy.copy(self)
        s.currentTrick=[dict(c) for c in self.currentTrick]
        s.tricks=list(self.tricks);s.scores=list(self.scores);s.bags=list(self.bags);s.delta=list(self.delta)
        s.playerHands=self.sample()
        return s
    def GetMoves(self):
        if self.terminal:return []
        hand=self.playerHands[self.playerToMove]
        if self.currentTrick:
            follow=[c for c in hand if c//13==self.currentTrick[0]['card']//13]
            return follow or hand
        return hand if self.spadesBroken or all(c>=39 for c in hand) else [c for c in hand if c<39]
    def DoMove(self,c):
        p=self.playerToMove
        assert c in self.GetMoves()
        self.playerHands[p].remove(c)
        self.currentTrick.append({'player':p,'card':c})
        self.spadesBroken=self.spadesBroken or c>=39
        self.playerToMove=(p+1)%4
        if len(self.currentTrick)==4:
            lead=self.currentTrick[0]['card']//13
            high=max(self.currentTrick,key=lambda x:(2 if x['card']//13==3 else 1 if x['card']//13==lead else 0,x['card']%13))
            self.tricks[high['player']]+=1;self.playerToMove=high['player'];self.currentTrick=[]
            if sum(self.tricks)==13:
                self.terminal=True
                for team in range(2):
                    ps=[team,team+2]
                    normal=[p for p in ps if self.bids[p]>0]
                    contract=sum(self.bids[p] for p in normal)
                    tricks=sum(self.tricks[p] for p in normal)
                    over=max(0,tricks-contract)
                    self.delta[team]=(10*contract+over) if tricks>=contract else -10*contract
                    bags=over
                    for p in ps:
                        if self.bids[p]==0:
                            self.delta[team]+=100 if self.tricks[p]==0 else -100
                            self.delta[team]+=self.tricks[p]
                            bags+=self.tricks[p]
                    self.bags[team]+=bags
                    while self.bags[team]>=10:self.bags[team]-=10;self.delta[team]-=100
                    self.scores[team]+=self.delta[team]
    def GetResult(self,player):
        assert self.terminal
        team=int(player)%2
        return (self.delta[team]-self.delta[1-team])/130

def decide(o):
    random.seed(int.from_bytes(hashlib.sha256(json.dumps(o,sort_keys=True).encode()).digest()[:8],'little'))
    if o['phase']=='bidding':
        # The released opponent's own-hand-only Cohensius-inspired heuristic.
        holder=type('OwnHandOnly',(),{})()
        holder.playerHands={o['player']:[Card(SUITS[c//13],c%13+2) for c in o['hand']]}
        holder.bets={}
        SpadesGameState.Bet(holder,o['player'])
        return {'bid':int(holder.bets[o['player']])}
    s=PublicState(o)
    assert sorted(s.GetMoves())==sorted(o['legal'])
    if len(o['legal'])==1:return {'card':o['legal'][0]}
    return {'card':ISMCTS(s,itermax=ITERATIONS,verbose=0)}

for line in sys.stdin:
    try:
        o=json.loads(line)
        if o.get('scoreProbe'):
            o=o['scoreProbe'];s=PublicState(o);assert len(s.GetMoves())==1;s.DoMove(s.GetMoves()[0]);assert s.terminal
            result={'delta':s.delta,'bags':s.bags,'scores':s.scores}
        elif o.get('meta'):
            result={'variation':'None','deckSize':52,'scoreRoundTrip':{'points':120,'bags':3,'totalPoints':123},'nilEncoded':0,'oneEncoded':1,'iterations':ITERATIONS,'stateAdapter':'Common partnership rules, public void-consistent sampling; upstream ISMCTS unchanged'}
        else:result=decide(o)
        print(json.dumps(result),flush=True)
    except Exception as e:
        print(json.dumps({'error':repr(e)}),flush=True)

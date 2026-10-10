using Trickster.cloud;
using Trickster.Bots;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
// Only publicObservation is accepted: the actual other three hands never cross this process boundary.
static Card CardOf(int id) {var rank=id%13+2; var r=rank switch {10=>"T",11=>"J",12=>"Q",13=>"K",14=>"A",_=>rank.ToString()}; return new Hand($"{r}{"CDHS"[id/13]}")[0];}
static string Cards(IEnumerable<int> ids) => string.Join("",ids.Select(id=>CardOf(id).ToString()));
string line;
while((line=Console.ReadLine())!=null) {
 try {
  var o=JObject.Parse(line);
  if(o.Value<bool>("meta")) {var optionsProbe=new SpadesOptions{players=4,isPartnership=true,bagsPenalty=SpadesBagsPenalty.Minus100For10}; var packed=(long)new SpadesScore{points=120,bags=3}; var decoded=new SpadesScore(packed,10);var historyProbe=new PlayedCard(CardOf(34),CardOf(27)); Console.WriteLine(JsonConvert.SerializeObject(new{variation=((SpadesVariation)0).ToString(),deckSize=DeckBuilder.DeckSize(optionsProbe.deckType),scoreRoundTrip=new{packed,decoded.points,decoded.bags,decoded.totalPoints},nilEncoded=((BidBase)new SpadesBid(0,false,false)).value,oneEncoded=((BidBase)new SpadesBid(1,false,false)).value,historyProbe=new{cardPlayed=historyProbe.CardPlayed.ToString(),highInTrick=historyProbe.HighInTrick.ToString()},playedCardConstructorParameters=typeof(PlayedCard).GetConstructors().Single(c=>c.GetParameters().Length==2).GetParameters().Select(p=>p.Name).ToArray()})); continue;}
  var own=o.Value<int>("player");
  var options=new SpadesOptions {players=4,isPartnership=true,gameOverScore=o.Value<int>("target"),playTo=PlayTo.Score,variation=(SpadesVariation)0,
   nilOrZero=SpadesNilOrZero.Nil,canBidNil=SpadesNilBids.Anytime,nilPoints=100,nilPass=0,failedNilBags=FailedNilBags.TakesBags,
   bagsPenalty=SpadesBagsPenalty.Minus100For10,leadSpades=LeadSpadesWhen.OnceBroken,minBid=1,tenBonus=SpadesTenBonus.None};
  var bot=new SpadesBot(options,Suit.Spades);
  var players=Enumerable.Range(0,4).Select(p=>new PlayerBase {Seat=p,Hand=p==own?Cards(o["hand"].Values<int>()):"",
   Bid=o["bids"][p].Type==JTokenType.Null?BidBase.NoBid:((BidBase)new SpadesBid(o["bids"][p].Value<int>(),false,false)).value,
   BidHistory=o["bids"][p].Type==JTokenType.Null?new List<int>():new List<int>{((BidBase)new SpadesBid(o["bids"][p].Value<int>(),false,false)).value},
   HandScore=o["tricks"][p].Value<int>(),GameScore=(long)new SpadesScore{points=o["scores"][p%2].Value<int>()-o["bags"][p%2].Value<int>(),bags=o["bags"][p%2].Value<int>()},
   CardsTaken=Cards(o["completedTricks"].Where(t=>t.Value<int>("winner")==p).SelectMany(t=>t["cards"]).Select(c=>c.Value<int>("card"))),
   VoidSuits=o["voids"][p].Select((v,i)=>(v.Value<bool>(),i)).Where(x=>x.Item1).Select(x=>CardOf(x.i*13).suit).ToList(),
   PlayedCards=new List<PlayedCard>()}).ToArray();
  foreach(var t in o["completedTricks"]) {
   var winner=t.Value<int>("winner"); var high=CardOf(t["cards"].First(c=>c.Value<int>("player")==winner).Value<int>("card"));
   foreach(var c in t["cards"]) players[c.Value<int>("player")].PlayedCards.Add(new PlayedCard(high,CardOf(c.Value<int>("card"))));
  }
  if(o.Value<string>("phase")=="bidding") {
   var s=new SuggestBidState<SpadesOptions>{options=options,player=players[own],players=players,trumpSuit=Suit.Spades,dealerSeat=o.Value<int>("dealer"),
    hand=new Hand(players[own].Hand),legalBids=Enumerable.Range(0,14).Select(n=>(BidBase)new SpadesBid(n,false,false)).ToList()};
   var result=bot.SuggestBid(s.SortCardMembers()); Console.WriteLine(JsonConvert.SerializeObject(new{bid=new SpadesBid(result).Tricks}));
  } else {
   var trick=o["currentTrick"].Select(c=>CardOf(c.Value<int>("card"))).ToList();
   int highIndex=trick.Count==0?-1:bot.TrickHighCardIndex(trick); var taker=highIndex<0?null:players[o["currentTrick"][highIndex].Value<int>("player")];
   var s=new SuggestCardState<SpadesOptions>{options=options,player=players[own],players=players,trumpSuit=Suit.Spades,trick=trick,
    legalCards=o["legal"].Values<int>().Select(CardOf).ToList(),cardsPlayed=o["completedTricks"].SelectMany(t=>t["cards"]).Select(c=>CardOf(c.Value<int>("card"))).ToList(),
    cardsPlayedInOrder=string.Join("",o["completedTricks"].SelectMany(t=>t["cards"]).Concat(o["currentTrick"]).Select(c=>$"{c.Value<int>("player")}{CardOf(c.Value<int>("card")).ToString()}")),
    trickTaker=taker,cardTakingTrick=highIndex<0?null:trick[highIndex],isPartnerTakingTrick=taker!=null&&taker.Seat%2==own%2};
   var result=bot.SuggestNextCard(s.SortCardMembers()); var id=Enumerable.Range(0,52).Single(n=>CardOf(n).SameAs(result)); Console.WriteLine(JsonConvert.SerializeObject(new{card=id}));
  }
 } catch(Exception e) {Console.WriteLine(JsonConvert.SerializeObject(new{error=e.ToString()}));}
}


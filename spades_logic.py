import enum
import random
from typing import List, Optional, Tuple

class Suit(enum.IntEnum):
    CLUBS = 0
    DIAMONDS = 1
    HEARTS = 2
    SPADES = 3

class Rank(enum.IntEnum):
    TWO = 0
    THREE = 1
    FOUR = 2
    FIVE = 3
    SIX = 4
    SEVEN = 5
    EIGHT = 6
    NINE = 7
    TEN = 8
    JACK = 9
    QUEEN = 10
    KING = 11
    ACE = 12

class Card:
    def __init__(self, suit: Suit, rank: Rank):
        self.suit = suit
        self.rank = rank

    def __repr__(self):
        return f"{self.rank.name} of {self.suit.name}"

    def __eq__(self, other):
        return self.suit == other.suit and self.rank == other.rank

    def __lt__(self, other):
        if self.suit != other.suit:
            return self.suit < other.suit
        return self.rank < other.rank

class Player:
    def __init__(self):
        self.hand: List[Card] = []
        self.bid: int = 0
        self.tricksWon: int = 0

class GameState:
    def __init__(self):
        self.deck: List[Card] = []
        self.players: List[Player] = [Player() for _ in range(4)]
        self.team1Score: int = 0
        self.team2Score: int = 0
        self.team1Bags: int = 0
        self.team2Bags: int = 0
        
        self.currentTrick: List[Card] = []
        self.currentPlayerIndex: int = 0
        self.trickLeaderIndex: int = 0
        self.spadesBroken: bool = False
        self.bidsMade: int = 0
        
        # Track played cards for feature extraction: [player][card_index]
        self.playedCards: List[List[bool]] = [[False] * 52 for _ in range(4)]

class GameLogic:
    @staticmethod
    def initialize_deck() -> List[Card]:
        deck = []
        for s in Suit:
            for r in Rank:
                deck.append(Card(s, r))
        return deck

    @staticmethod
    def shuffle_deck(deck: List[Card]):
        random.shuffle(deck)

    @staticmethod
    def deal_cards(state: GameState):
        for p in state.players:
            p.hand.clear()
        
        for i, card in enumerate(state.deck):
            state.players[i % 4].hand.append(card)
            
        for p in state.players:
            p.hand.sort(key=lambda c: (c.suit, c.rank))

    @staticmethod
    def get_valid_moves(state: GameState) -> List[int]:
        valid_moves = []
        hand = state.players[state.currentPlayerIndex].hand
        
        if not state.currentTrick: # Leading
            can_play_non_spade = any(c.suit != Suit.SPADES for c in hand)
            for i, card in enumerate(hand):
                if state.spadesBroken or not can_play_non_spade or card.suit == Suit.SPADES:
                    valid_moves.append(i)
                elif card.suit != Suit.SPADES:
                     valid_moves.append(i)
        else: # Following
            led_suit = state.currentTrick[0].suit
            can_follow = any(c.suit == led_suit for c in hand)
            
            for i, card in enumerate(hand):
                if can_follow:
                    if card.suit == led_suit:
                        valid_moves.append(i)
                else:
                    valid_moves.append(i)
                    
        return valid_moves

    @staticmethod
    def determine_trick_winner(state: GameState) -> int:
        winner_idx = state.trickLeaderIndex
        winning_card = state.currentTrick[0]
        
        for i in range(1, len(state.currentTrick)):
            player_idx = (state.trickLeaderIndex + i) % 4
            card = state.currentTrick[i]
            
            if card.suit == winning_card.suit:
                if card.rank > winning_card.rank:
                    winning_card = card
                    winner_idx = player_idx
            elif card.suit == Suit.SPADES:
                if winning_card.suit != Suit.SPADES or card.rank > winning_card.rank:
                    winning_card = card
                    winner_idx = player_idx
                    
        return winner_idx

    @staticmethod
    def update_scores(state: GameState) -> Tuple[int, int]:
        t1_pts = 0
        t2_pts = 0
        
        # Team 1 (Players 0 and 2)
        p0 = state.players[0]
        p2 = state.players[2]
        t1_bid = 0
        t1_tricks = 0
        
        # Player 0
        if p0.bid == 0:
            if p0.tricksWon == 0: t1_pts += 100
            else: t1_pts -= 100
        else:
            t1_bid += p0.bid
            t1_tricks += p0.tricksWon
            
        # Player 2
        if p2.bid == 0:
            if p2.tricksWon == 0: t1_pts += 100
            else: t1_pts -= 100
        else:
            t1_bid += p2.bid
            t1_tricks += p2.tricksWon

        if t1_bid > 0:
            if t1_tricks >= t1_bid:
                t1_pts += t1_bid * 10
                overtricks = t1_tricks - t1_bid
                t1_pts += overtricks
                state.team1Bags += overtricks
                if state.team1Bags >= 10:
                    t1_pts -= 100
                    state.team1Bags -= 10
            else:
                t1_pts -= t1_bid * 10

        # Team 2 (Players 1 and 3)
        p1 = state.players[1]
        p3 = state.players[3]
        t2_bid = 0
        t2_tricks = 0
        
        # Player 1
        if p1.bid == 0:
            if p1.tricksWon == 0: t2_pts += 100
            else: t2_pts -= 100
        else:
            t2_bid += p1.bid
            t2_tricks += p1.tricksWon
            
        # Player 3
        if p3.bid == 0:
            if p3.tricksWon == 0: t2_pts += 100
            else: t2_pts -= 100
        else:
            t2_bid += p3.bid
            t2_tricks += p3.tricksWon

        if t2_bid > 0:
            if t2_tricks >= t2_bid:
                t2_pts += t2_bid * 10
                overtricks = t2_tricks - t2_bid
                t2_pts += overtricks
                state.team2Bags += overtricks
                if state.team2Bags >= 10:
                    t2_pts -= 100
                    state.team2Bags -= 10
            else:
                t2_pts -= t2_bid * 10

        state.team1Score += t1_pts
        state.team2Score += t2_pts
        return t1_pts, t2_pts

    @staticmethod
    def apply_bid(state: GameState, bid: int):
        if state.bidsMade < 4:
            state.players[state.currentPlayerIndex].bid = bid
            state.bidsMade += 1
            state.currentPlayerIndex = (state.currentPlayerIndex + 1) % 4

    @staticmethod
    def apply_move(state: GameState, move_index: int):
        current_p = state.players[state.currentPlayerIndex]
        if not current_p.hand: return 
        
        played_card = current_p.hand[move_index]
        
        if played_card.suit == Suit.SPADES and not state.spadesBroken:
            state.spadesBroken = True
            
        state.currentTrick.append(played_card)
        
        # Track played cards
        card_idx = int(played_card.suit) * 13 + int(played_card.rank)
        state.playedCards[state.currentPlayerIndex][card_idx] = True
        
        current_p.hand.pop(move_index)
        
        if len(state.currentTrick) == 4:
            winner = GameLogic.determine_trick_winner(state)
            state.players[winner].tricksWon += 1
            state.currentPlayerIndex = winner
            state.trickLeaderIndex = winner
            state.currentTrick.clear()
        else:
            state.currentPlayerIndex = (state.currentPlayerIndex + 1) % 4
            
    @staticmethod
    def reset_round(state: GameState, dealer_index: int):
        state.deck.clear()
        state.spadesBroken = False
        state.trickLeaderIndex = (dealer_index + 1) % 4
        state.currentPlayerIndex = (dealer_index + 1) % 4
        state.currentTrick.clear()
        state.bidsMade = 0
        for p in state.players:
            p.hand.clear()
            p.bid = 0
            p.tricksWon = 0
        for i in range(4):
            for j in range(52):
                state.playedCards[i][j] = False

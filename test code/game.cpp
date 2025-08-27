#include <iostream>
#include <string>
#include <vector>
#include <algorithm>
#include <random>

using namespace std;

class Card {
public:
    string suit;
    string rank;
    int num_id;

    Card(string s, string r) : suit(s[0]), rank(r[0]) {
        int suit_num = 0;
        switch (s[0]) {
            case 'H':
                suit_num = 1;
                break;
            case 'D':
                suit_num = 2;
                break;
            case 'C':
                suit_num = 3;
                break;
            case 'S':
                suit_num = 4;
                break;
        }
        int rank_num = 0;
        switch (r[0]) {
            case 'A':
                rank_num = 1;
                break;
            case 'K':
                rank_num = 13;
                break;
            case 'Q':
                rank_num = 12;
                break;
            case 'J':
                rank_num = 11;
                break;
            default:
                rank_num = stoi(r);
                break;
        }
        num_id = suit_num * 13 + rank_num;
    }

    void 
};


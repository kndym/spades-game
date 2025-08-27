#include <bits/stdc++.h> // or include <vector>, <algorithm>, <random>, <iostream>
using namespace std;

int main() {
    int n = 54; // size of permutation
    vector<int> nums(n);
    // fill with 0..n-1
    iota(nums.begin(), nums.end(), 0);
    // set up random engine
    random_device rd;
    mt19937 gen(rd());
    // shuffle the vector
    for (int i = 0; i < 10; i++){
        shuffle(nums.begin(), nums.end(), gen);
        // print result
        for (int x : nums) {
            cout << x << " ";
        }
        cout << "\n";
    }

    return 0;
}

//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.3;

import "./Game.sol";

contract BadCoinGame is Game {

    constructor() payable {
        next = 1;
    }

    function play(bool odd) public onlyRunning() inTurn(){
        if ((uint(blockhash(block.number-1)) % 2 == 1) == odd){
            winner = players[1];
            winnings[1] = 2*bet;
            transferWinnings(winner);
        } else {
            winner = players[0];
            winnings[0] = 2*bet;
        }
        status = Status.ended;
        emit Winner(winner);
    }

}
//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.3;

import "./Game.sol";


contract TicTacToe is Game {
    event Play(address player, uint256 row, uint256 col);

    constructor() payable{
        uint random = uint(
            keccak256(abi.encodePacked(block.difficulty, block.timestamp))
        );
        next = random % 2;
    }
    
    address[3][3] public tablero;
    bool inicio = false;
  
    // Permite realizar una jugada, indicando fila y columna
    // Las filas y columnas comienzan en 0
    // Sólo puede invocarse si el juego ya comenzó
    // Sólo puede invocarla el jugador que tiene el turno
    // Si la jugada es inválida, se rechaza con error "invalid move"
    // Debe emitir el evento Play(player, row, col) con cada jugada
    // Si un jugador gana al jugar, emite el evento Winner(winner)
    // Si no se puede jugar más es un empate y emite el evento
    // Draw(creator, challenger)
    function play(uint256 row, uint256 col) public onlyRunning inTurn {

        if(inicio == false){
            for(uint i=0; i<3; i++){
                for(uint j=0; j<3; j++){
                    tablero[i][j] = address(0);
                }
            }
            inicio = true;
        } //q raro con el require deberia andar igual

        require(row < 3 && col < 3, "Coordenadas invalidas");
        require(msg.sender == players[next], "No es tu turno");
        if(tablero[row][col]!=address(0)){
            revert("movimiento invalido");
        } //no se porque no lo toma correctamente el test.


        tablero[row][col] = msg.sender;
        emit Play(msg.sender, row, col);
        
        if (hayGanador(msg.sender)) {
            winner = players[next];
            emit Winner(winner);
            winnings[next] = 2 * bet;
            endGame();
            claimWinnings();
            return;
            
        } else if (tableroLleno()) {
            emit Draw(players[0], players[1]);
            winnings[0] = bet; 
            winnings[1] = bet; 
            endGame(); 
            claimWinnings(); 
            return;
        }
        
        next = (next + 1) % 2; //cambio de jugador
        emit PlayerTurn(players[next]);

    }

    function hayGanador(address jugador) private view returns (bool) {
        for (uint8 i = 0; i < 3; i++) { //chequeo vertical y horizontal
            if (tablero[i][0] == jugador && tablero[i][1] == jugador && tablero[i][2] == jugador) {
                return true;
            }
            if (tablero[0][i] == jugador && tablero[1][i] == jugador && tablero[2][i] == jugador) {
                return true;
            }
        } //chequeo cruzado
        if (tablero[0][0] == jugador && tablero[1][1] == jugador && tablero[2][2] == jugador) {
            return true;
        }
        if (tablero[0][2] == jugador && tablero[1][1] == jugador && tablero[2][0] == jugador) {
            return true;
        }
        return false;
    }

    function tableroLleno() public view returns (bool) {
    for (uint i = 0; i < 3; i++) {
        for (uint j = 0; j < 3; j++) {
            if (tablero[i][j] == address(0)) {
                return false; // si hay una celda vacía, retorna falso
            }
        }
    }
    return true; // si no hay celdas vacías, retorna verdadero
}
}


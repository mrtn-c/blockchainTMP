//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

/// @title Votación
contract Ballot {
    // Esta estructura representa a un votante
    event Vote(address voters);
    
    struct Voter {
        bool canVote; // si es verdadero, la persona puede votar
        bool voted; // si es verdadero, la persona ya votó
        uint vote; // índice de la propuesta elegida.
    }

    // Este tipo representa a una propuesta
    struct Proposal {
        bytes32 name; // nombre (hasta 32 bytes)
        uint voteCount; // votos recibidos por la propuesta
    }

    address public chairperson;

    // Variable de estado con los votantes
    mapping(address => Voter) public voters;
    // Cantidad de votantes
    uint public numVoters = 0;

    bool isStarted = false;
    bool isEnded = false;
    uint totalVoters = 0;

    // Arreglo dinámico de propuestas.
    Proposal[] public proposals;

    /// Crea una nueva votación para elegir entre `proposalNames`.
    constructor(bytes32[] memory proposalNames) {
        chairperson = msg.sender;
        require(
            proposalNames.length > 1,
            "There should be at least 2 proposals"
        );
        require(!isStarted, "la votacion ya comenzo");
        for (uint i = 0; i < proposalNames.length; i++) {
            // `Proposal({...})` crea un objeto temporal
            // de tipo Proposal y  `proposals.push(...)`
            // lo agrega al final de `proposals`.
            proposals.push(Proposal({name: proposalNames[i], voteCount: 0}));
        }
    }

    // Le da a `voter` el derecho a votar.
    // Solamente puede ser ejecutado por `chairperson`.
    // No se puede hacer si
    //  * El votante ya puede votar
    //  * La votación ya comenzó
    // Actualiza numVoters
    function giveRightToVote(address voter) public {
        require(
            msg.sender == chairperson,
            "Only chairperson can give right to vote."
        );
        require(!voters[voter].voted, "The voter already voted.");
        require(!voters[voter].canVote);
        require(!isStarted, "la votacion ya comenzo");
        voters[voter].canVote = true;
        numVoters += 1;
    }

    // Quita a `voter` el derecho a votar.
    // Solamente puede ser ejecutado por `chairperson`.
    // No se puede hacer si
    //  * El votante no puede votar
    //  * La votación ya comenzó
    // Actualiza numVoters
    function withdrawRightToVote(address voter) public {
            require(
                msg.sender == chairperson,
            "Only chairperson can withdraw right to vote."
        );
        require(!isStarted, "The voting has already started.");
        require(voters[voter].canVote, "The voter already cannot vote");
        voters[voter].canVote = false;
        numVoters -= 1;
    }

    // Le da a todas las direcciones contenidas en `list` el derecho a votar.
    // Solamente puede ser ejecutado por `chairperson`.
    // No se puede ejecutar si la votación ya comenzó
    // Si el votante ya puede votar, no hace nada.
    // Actualiza numVoters
    function giveAllRightToVote(address[] memory list) public {
        require(
            msg.sender == chairperson,
            "Only chairperson can give right to vote."
        );
        require(!isStarted, "la votacion ya comenzo");


        if(!isStarted)
            for (uint i=0; i<list.length; i++){
                if(!voters[list[i]].canVote){
                    voters[list[i]].canVote = true;
                    numVoters +=1;
                }
            }

    }

    // Devuelve la cantidad de propuestas
    function numProposals() public view returns (uint) {
        return proposals.length;
    }

    // Habilita el comienzo de la votación
    // Solo puede ser invocada por `chairperson`
    // No puede ser invocada una vez que la votación ha comenzado
    function start() public {
        require(
            msg.sender == chairperson,
            "Only chairperson can start the ballot."
        );
        require(!isStarted, "The ballot already started");
        isStarted = true;
    }

    // Indica si la votación ha comenzado
    function started() public view returns (bool) {
        return isStarted;
    }

    // Finaliza la votación
    // Solo puede ser invocada por `chairperson`
    // Solo puede ser invocada una vez que la votación ha comenzado
    // No puede ser invocada una vez que la votación ha finalizado
    function end() public {
         require(
            msg.sender == chairperson,
            "Only chairperson can finixh the ballot."
        );
        require(!isEnded, "The ballot has already finished");
        require(isStarted, "The ballot has not started");
        isEnded = true;
    }

    // Indica si la votación ha finalizado
    function ended() public view returns (bool) {
        return isEnded;
    }

    // Vota por la propuesta `proposals[proposal].name`.
    // Requiere que la votación haya comenzado y no haya terminado
    // Si `proposal` está fuera de rango, lanza
    // una excepción y revierte los cambios.
    // El votante tiene que esta habilitado
    // No se puede votar dos veces
    // No se puede votar si la votación aún no comenzó
    // No se puede votar si la votación ya terminó
    function vote(uint proposal) public {
        
        require(isStarted && !isEnded, "is not moment for vote");
        require(proposal < proposals.length, "The proposal doesnt exist");
        require(!isEnded, "The ballot has already finished");
        require(isStarted, "The ballot has not started");
        Voter storage sender = voters[msg.sender];
        require(sender.canVote, "Has no right to vote");
        require(!sender.voted, "Already voted.");
        if(!sender.voted){
            emit Vote(msg.sender);
            sender.voted = true;
            sender.vote = proposal;
            proposals[proposal].voteCount += 1;
        }
        
    }

    /// Calcula la propuestas ganadoras
    /// Devuelve un array con los índices de las propuestas ganadoras.
    // Solo se puede ejecutar si la votación terminó.
    // Si no hay votos, devuelve un array de longitud 0
    // Si hay un empate en el primer puesto, la longitud
    // del array es la cantidad de propuestas que empatan
    function winningProposals() public view returns (uint[] memory winningProposal_){
        require(isEnded, "the ballot didnt finished");
        uint winVoteCount = 0;
        uint [] memory winProposalsIndex;

        if (totalVoters == 0){
            return winProposalsIndex;
        }

        for (uint i = 0; i < proposals.length; i++ ){
            
            if(winVoteCount < proposals[i].voteCount){
                winVoteCount = proposals[i].voteCount;
                winProposalsIndex = new uint[](1);
                winProposalsIndex[0] = i;
            } else if (winVoteCount == proposals[i].voteCount){
                uint[] memory tmp = new uint[](winProposalsIndex.length + 1);
                for (uint j = 0; j<tmp.length; j++){
                    tmp[j] = winProposalsIndex[j];
                }
                tmp[tmp.length - 1] = i;
                winProposalsIndex = tmp;
            }
        }
        return winProposalsIndex;
    }

    // Devuelve un array con los nombres de las
    // propuestas ganadoras.
    // Solo se puede ejecutar si la votación terminó.
    // Si no hay votos, devuelve un array de longitud 0
    // Si hay un empate en el primer puesto, la longitud
    // del array es la cantidad de propuestas que empatan
    function winners() public view returns (bytes32[] memory winners_) {
        require (isEnded, "The ballot has not finished");

        if(totalVoters == 0){
            return winners_;
        }

        uint[] memory winningProposals_ = winningProposals(); 
        for(uint i = 0; i<winningProposals_.length; i++){
            winners_[winners_.length] = proposals[i].name;
        }

    }
}

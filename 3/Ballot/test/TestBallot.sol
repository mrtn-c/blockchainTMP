//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "truffle/Assert.sol";
import "truffle/DeployedAddresses.sol";
import "../contracts/Ballot.sol";

contract TestBallot {
    function testNumberOfProposals() public {
        Ballot meta = Ballot(DeployedAddresses.Ballot());

        Assert.isAtLeast(
            meta.numProposals(),
            2,
            "There should be at least two proposals"
        );
    }

    function testNumberOfProposalsWithNewContract() public {
        bytes32[] memory proposals = new bytes32[](2);
        proposals[0] = "AA";
        proposals[1] = "BB";
        Ballot meta = new Ballot(proposals);

        Assert.equal(
            meta.numProposals(),
            2,
            "There should be exactly two proposals"
        );
    }
}

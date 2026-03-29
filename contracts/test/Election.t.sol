// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Election } from "../src/Election.sol";

interface Vm {
    function prank(address) external;
    function expectRevert(bytes calldata) external;
}

contract ElectionTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    Election private election;
    address private voter = address(0xBEEF);
    address private otherVoter = address(0xCAFE);

    function setUp() public {
        election = new Election();
        election.addCandidate("Alice", "Unity");
        election.addCandidate("Bob", "Civic");
    }

    function testRegisterAndVoteOnce() public {
        bytes32 voterIdHash = keccak256("voter-1");
        election.registerVoter(voter, voterIdHash);

        vm.prank(voter);
        election.vote(1);

        Election.VoterStatus memory status = election.getVoterStatus(voter);
        require(status.eligible, "Expected eligible voter");
        require(status.hasVoted, "Expected hasVoted true");
        require(status.voterIdHash == voterIdHash, "Unexpected voter hash");
    }

    function testDoubleVoteReverts() public {
        bytes32 voterIdHash = keccak256("voter-2");
        election.registerVoter(voter, voterIdHash);

        vm.prank(voter);
        election.vote(1);

        vm.expectRevert(bytes("Already voted"));
        vm.prank(voter);
        election.vote(1);
    }

    function testResultsHiddenUntilPublished() public {
        bytes32 voterIdHash = keccak256("voter-3");
        election.registerVoter(voter, voterIdHash);

        vm.prank(voter);
        election.vote(1);

        vm.expectRevert(bytes("Results not published"));
        vm.prank(otherVoter);
        election.getResults();
    }

    function testPublishResultsAfterClose() public {
        bytes32 voterIdHash = keccak256("voter-4");
        election.registerVoter(voter, voterIdHash);

        vm.prank(voter);
        election.vote(1);

        election.setElectionActive(false);
        election.publishResults();

        bool published = election.resultsPublished();
        require(published, "Results should be published");
    }

    function testPublishResultsWhileActiveReverts() public {
        vm.expectRevert(bytes("Election still active"));
        election.publishResults();
    }

    function testVoteAfterPublishReverts() public {
        bytes32 voterIdHash = keccak256("voter-5");
        election.registerVoter(voter, voterIdHash);
        election.setElectionActive(false);
        election.publishResults();

        vm.expectRevert(bytes("Election closed"));
        vm.prank(voter);
        election.vote(1);
    }

    function testResetElectionStartsFresh() public {
        bytes32 voterIdHash = keccak256("voter-6");
        election.registerVoter(voter, voterIdHash);

        vm.prank(voter);
        election.vote(1);

        election.setElectionActive(false);
        election.publishResults();
        election.resetElection();

        Election.Candidate[] memory candidates = election.getCandidates();
        require(candidates.length == 0, "Expected empty candidates");

        Election.VoterStatus memory status = election.getVoterStatus(voter);
        require(!status.eligible, "Expected default eligible false");
        require(!status.hasVoted, "Expected default hasVoted false");
        require(status.voterIdHash == bytes32(0), "Expected empty voter hash");

        bool active = election.electionActive();
        require(active, "Expected active election");
        bool published = election.resultsPublished();
        require(!published, "Expected results unpublished");
    }
}

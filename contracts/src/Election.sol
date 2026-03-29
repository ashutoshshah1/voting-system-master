// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Election {
    struct VoterStatus {
        bool eligible;
        bool hasVoted;
        bytes32 voterIdHash;
    }

    struct Candidate {
        uint256 id;
        string name;
        string party;
    }

    struct Result {
        uint256 candidateId;
        uint256 votes;
    }

    address public owner;
    bool public electionActive;
    bool public resultsPublished;
    uint256 public electionId;

    mapping(uint256 => mapping(address => VoterStatus)) private voters;
    mapping(uint256 => mapping(bytes32 => address)) private voterIdToWallet;
    mapping(uint256 => Candidate[]) private candidates;
    mapping(uint256 => mapping(uint256 => uint256)) private votes;

    event VoterRegistered(address indexed wallet, bytes32 voterIdHash);
    event EligibilityUpdated(address indexed wallet, bool eligible);
    event CandidateAdded(uint256 indexed candidateId, string name, string party);
    event VoteCast(address indexed wallet, uint256 indexed candidateId);
    event ElectionStatusChanged(bool active);
    event ResultsPublished();
    event ElectionReset(uint256 indexed newElectionId);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor() {
        owner = msg.sender;
        electionActive = true;
        resultsPublished = false;
        electionId = 1;
    }

    function registerVoter(address wallet, bytes32 voterIdHash) external onlyOwner {
        require(wallet != address(0), "Invalid wallet");
        require(voters[electionId][wallet].voterIdHash == bytes32(0), "Wallet already registered");
        require(
            voterIdToWallet[electionId][voterIdHash] == address(0),
            "Voter ID already registered"
        );

        voters[electionId][wallet] = VoterStatus({
            eligible: true,
            hasVoted: false,
            voterIdHash: voterIdHash
        });
        voterIdToWallet[electionId][voterIdHash] = wallet;
        emit VoterRegistered(wallet, voterIdHash);
    }

    function setEligibility(address wallet, bool eligible) external onlyOwner {
        require(voters[electionId][wallet].voterIdHash != bytes32(0), "Voter not registered");
        voters[electionId][wallet].eligible = eligible;
        emit EligibilityUpdated(wallet, eligible);
    }

    function addCandidate(string calldata name, string calldata party) external onlyOwner {
        candidates[electionId].push(
            Candidate({ id: candidates[electionId].length + 1, name: name, party: party })
        );
        emit CandidateAdded(candidates[electionId].length, name, party);
    }

    function setElectionActive(bool active) external onlyOwner {
        electionActive = active;
        emit ElectionStatusChanged(active);
    }

    function publishResults() external onlyOwner {
        require(!electionActive, "Election still active");
        require(!resultsPublished, "Results already published");
        resultsPublished = true;
        emit ResultsPublished();
    }

    function getCandidates() external view returns (Candidate[] memory) {
        return candidates[electionId];
    }

    function getResults() external view returns (Result[] memory) {
        require(resultsPublished || msg.sender == owner, "Results not published");
        Candidate[] storage current = candidates[electionId];
        Result[] memory results = new Result[](current.length);
        for (uint256 i = 0; i < current.length; i++) {
            uint256 id = current[i].id;
            results[i] = Result({ candidateId: id, votes: votes[electionId][id] });
        }
        return results;
    }

    function getVoterStatus(address wallet) external view returns (VoterStatus memory) {
        return voters[electionId][wallet];
    }

    function vote(uint256 candidateId) external {
        require(electionActive, "Election closed");
        require(!resultsPublished, "Results published");
        VoterStatus storage voter = voters[electionId][msg.sender];
        require(voter.voterIdHash != bytes32(0), "Voter not registered");
        require(voter.eligible, "Not eligible");
        require(!voter.hasVoted, "Already voted");
        require(
            candidateId > 0 && candidateId <= candidates[electionId].length,
            "Invalid candidate"
        );

        voter.hasVoted = true;
        votes[electionId][candidateId] += 1;
        emit VoteCast(msg.sender, candidateId);
    }

    function resetElection() external onlyOwner {
        electionId += 1;
        electionActive = true;
        resultsPublished = false;
        emit ElectionReset(electionId);
    }
}

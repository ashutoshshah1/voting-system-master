import { ethers, isAddress } from "ethers";
import abi from "../contracts/abi.json";
import { chainConfig } from "../config/chain";
import type { Candidate, Result, VoterStatus } from "../types/election";
import { mockCandidates, mockResults, mockVoterStatus } from "./mockData";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export type VoteTransaction = {
  hash: string;
  wait: () => Promise<void>;
};

type ContractCandidate = {
  id: bigint | number;
  name: string;
  party: string;
};

type ContractResult = {
  candidateId: bigint | number;
  votes: bigint | number;
};

type ElectionContract = ethers.Contract & {
  getCandidates: () => Promise<ContractCandidate[]>;
  getResults: () => Promise<ContractResult[]>;
  getVoterStatus: (address: string) => Promise<VoterStatus>;
  electionActive: () => Promise<boolean>;
  resultsPublished: () => Promise<boolean>;
  vote: (candidateId: number) => Promise<VoteTransaction>;
};

export class ContractService {
  private provider: ethers.AbstractProvider;
  private contract: ElectionContract | null;
  private useMock: boolean;

  constructor(
    provider: ethers.AbstractProvider,
    options?: { forceMock?: boolean }
  ) {
    this.provider = provider;
    const isConfigured =
      isAddress(chainConfig.contractAddress) &&
      chainConfig.contractAddress !== ZERO_ADDRESS;
    this.useMock =
      options?.forceMock ?? (chainConfig.useMock || !isConfigured);
    this.contract = this.useMock
      ? null
      : (new ethers.Contract(
        chainConfig.contractAddress,
        abi,
        this.provider
      ) as ElectionContract);
  }

  isMockMode() {
    return this.useMock;
  }

  async getCandidates(): Promise<Candidate[]> {
    if (this.useMock) {
      return mockCandidates;
    }
    // Placeholder mapping until the contract ABI is finalized.
    // Map the contract response to plain objects and convert BigInts to numbers.
    if (!this.contract) throw new Error("Contract not initialized");
    const candidates = await this.contract.getCandidates();
    return candidates.map((c) => ({
      id: Number(c.id),
      name: c.name,
      party: c.party,
    }));
  }

  async getResults(): Promise<Result[]> {
    if (this.useMock) {
      return mockResults;
    }
    // Map the contract response to plain objects and convert BigInts to numbers.
    if (!this.contract) throw new Error("Contract not initialized");
    const results = await this.contract.getResults();
    return results.map((r) => ({
      candidateId: Number(r.candidateId),
      votes: Number(r.votes),
    }));
  }

  async getVoterStatus(address: string): Promise<VoterStatus> {
    if (this.useMock) {
      return mockVoterStatus;
    }
    // Map the contract response to a plain object.
    if (!this.contract) throw new Error("Contract not initialized");
    const status = await this.contract.getVoterStatus(address);
    return {
      eligible: status.eligible,
      hasVoted: status.hasVoted,
      voterIdHash: status.voterIdHash,
    };
  }

  async getElectionStatus(): Promise<boolean> {
    if (this.useMock) {
      return true;
    }
    return (await this.contract?.electionActive()) as boolean;
  }

  async getResultsPublished(): Promise<boolean> {
    if (this.useMock) {
      return true;
    }
    return (await this.contract?.resultsPublished()) as boolean;
  }

  async vote(candidateId: number): Promise<VoteTransaction> {
    if (this.useMock) {
      return {
        hash: `0xmock${candidateId.toString(16)}${Date.now().toString(16)}`,
        wait: async () => {
          await new Promise((resolve) => setTimeout(resolve, 700));
        },
      };
    }
    throw new Error("Voting is handled by the API relayer.");
  }
}

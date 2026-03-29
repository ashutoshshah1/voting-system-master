export type Candidate = {
  id: number;
  name: string;
  party: string;
  manifesto?: string;
};

export type Result = {
  candidateId: number;
  votes: number;
};

export type VoterStatus = {
  eligible: boolean;
  hasVoted: boolean;
  voterIdHash?: string;
};

export type VoteReceipt = {
  txHash: string;
  candidateId: number;
};

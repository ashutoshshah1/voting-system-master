import type { Candidate, Result, VoterStatus } from "../types/election";

export const mockCandidates: Candidate[] = [
  {
    id: 1,
    name: "Amara Quill",
    party: "Future Civic",
    manifesto: "Transparent budgeting and open civic data.",
  },
  {
    id: 2,
    name: "Ravi Sol",
    party: "Green Horizon",
    manifesto: "Community energy projects and green jobs.",
  },
  {
    id: 3,
    name: "Mina Ortega",
    party: "Unity Front",
    manifesto: "Local health access and digital literacy.",
  },
];

export const mockResults: Result[] = [
  { candidateId: 1, votes: 128 },
  { candidateId: 2, votes: 96 },
  { candidateId: 3, votes: 74 },
];

export const mockVoterStatus: VoterStatus = {
  eligible: true,
  hasVoted: false,
  voterIdHash: "0x5aa9...f12b",
};

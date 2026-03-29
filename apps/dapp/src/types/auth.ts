export type Role = "USER" | "ADMIN";
export type KycStatus = "PENDING" | "APPROVED" | "REJECTED";

export type User = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  kycStatus: KycStatus;
  walletAddress?: string | null;
  voterIdHash?: string | null;
};

export type PendingKyc = {
  id: string;
  documentType: string;
  documentUrl: string;
  status: KycStatus;
  createdAt: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    walletAddress?: string | null;
  };
};

export type AdminVoter = {
  id: string;
  fullName: string;
  email: string;
  kycStatus: KycStatus;
  walletAddress?: string | null;
  voterIdHash?: string | null;
  createdAt: string;
  onChain: {
    eligible: boolean;
    hasVoted: boolean;
    voterIdHash: string;
  } | null;
  onChainError?: string | null;
};

export type OfflineAdminProfile = {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  nid: string;
  kycStatus: KycStatus;
  walletAddress?: string | null;
  pinSetupRequired: boolean;
  failedPinAttempts: number;
  blockedUntil: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OfflineAuditEvent = {
  id: string;
  userId?: string | null;
  offlineProfileId?: string | null;
  eventType: string;
  status: string;
  reason?: string | null;
  metadata?: unknown;
  txHash?: string | null;
  createdAt: string;
};

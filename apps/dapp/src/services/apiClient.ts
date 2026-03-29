import type {
  AdminVoter,
  KycStatus,
  OfflineAdminProfile,
  OfflineAuditEvent,
  PendingKyc,
} from "../types/auth";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";
const OFFLINE_API_URL =
  import.meta.env.VITE_OFFLINE_API_URL || "http://localhost:4100";

type ApiOptions = RequestInit & { token?: string | null };

type ApiBase = "online" | "offline";

const resolveBaseUrl = (base: ApiBase) =>
  base === "offline" ? OFFLINE_API_URL : API_URL;

const request = async <T>(
  base: ApiBase,
  path: string,
  options: ApiOptions = {}
) => {
  const headers = new Headers(options.headers || {});
  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${resolveBaseUrl(base)}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => ({ message: "Request failed" }));
    throw new Error(payload.message || "Request failed");
  }
  return (await res.json()) as T;
};

const requestOnline = <T>(path: string, options: ApiOptions = {}) =>
  request<T>("online", path, options);

const requestOffline = <T>(path: string, options: ApiOptions = {}) =>
  request<T>("offline", path, options);

export type OfflineSessionGate = {
  pinReady: boolean;
  kycApproved: boolean;
  walletReady: boolean;
  officerVerificationRequired: boolean;
};

export type OfflineLinkedUser = {
  id: string;
  fullName: string;
  email: string;
  kycStatus: KycStatus;
  walletAddress: string | null;
};

export type OfflineProfileSummary = {
  id: string;
  pinSetupRequired: boolean;
};

export type OfflineLinkOnlineResponse = {
  message: string;
  user: OfflineLinkedUser;
  offlineProfile: OfflineProfileSummary;
  requiresAdminApproval: boolean;
};

export type OfflineSessionStartResponse = {
  message: string;
  preSessionToken: string | null;
  sessionToken: string | null;
  gate: OfflineSessionGate;
  user: {
    id: string;
    fullName: string;
    nid: string;
    kycStatus: KycStatus;
    walletAddress: string | null;
  };
};

export type OfflineSessionAttestResponse = {
  message: string;
  sessionToken: string;
  expiresAt: string;
  officer?: {
    id: string;
    fullName: string;
    employeeId: string;
  } | null;
};

export type OfflineProfilesResponse = {
  items: OfflineAdminProfile[];
};

export type OfflineAuditResponse = {
  items: OfflineAuditEvent[];
};

export const apiClient = {
  register: (payload: { fullName: string; email: string; nid: string; dob: string }) =>
    requestOnline<{ token: string; user: unknown }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  login: (payload: { nid: string; dob: string }) =>
    requestOnline<{ token: string; user: unknown }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  me: (token: string) => requestOnline<unknown>("/me", { token }),
  getWalletBalance: (token: string) =>
    requestOnline<{ walletAddress: string | null; balance: string | null }>(
      "/wallet/balance",
      { token }
    ),
  submitKyc: (token: string, payload: { documentType: string; file: File }) => {
    const data = new FormData();
    data.append("documentType", payload.documentType);
    data.append("document", payload.file);
    return requestOnline<{ id: string; status: string }>("/kyc/submit", {
      method: "POST",
      body: data,
      token,
    });
  },
  vote: (token: string, candidateId: number) =>
    requestOnline<{ txHash: string }>("/vote", {
      method: "POST",
      body: JSON.stringify({ candidateId }),
      token,
    }),
  adminPending: (token: string) =>
    requestOnline<PendingKyc[]>("/admin/kyc/pending", { token }),
  approveKyc: (token: string, id: string, reviewNote?: string) =>
    requestOnline<{ id: string; status: string; voterIdHash: string }>(
      `/admin/kyc/${id}/approve`,
      {
        method: "POST",
        body: JSON.stringify({ reviewNote }),
        token,
      }
    ),
  rejectKyc: (token: string, id: string, reviewNote?: string) =>
    requestOnline<{ id: string; status: string }>(`/admin/kyc/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reviewNote }),
      token,
    }),
  addCandidate: (token: string, payload: { name: string; party: string }) => {
    const data = new FormData();
    data.append("name", payload.name);
    data.append("party", payload.party);
    return requestOnline<{ txHash: string; candidateId?: number | null }>(
      "/admin/candidates",
      {
        method: "POST",
        body: data,
        token,
      }
    );
  },
  setElectionStatus: (token: string, active: boolean) =>
    requestOnline<{ txHash: string; active: boolean }>("/admin/election/status", {
      method: "POST",
      body: JSON.stringify({ active }),
      token,
    }),
  publishResults: (token: string) =>
    requestOnline<{ txHash: string }>("/admin/results/publish", {
      method: "POST",
      token,
    }),
  resetElection: (token: string) =>
    requestOnline<{ txHash: string }>("/admin/election/reset", {
      method: "POST",
      token,
    }),
  setEligibility: (
    token: string,
    payload: { walletAddress: string; eligible: boolean }
  ) =>
    requestOnline<{ txHash: string }>("/admin/voters/eligibility", {
      method: "POST",
      body: JSON.stringify(payload),
      token,
    }),
  getVoters: (token: string, limit = 250) =>
    requestOnline<{ voters: AdminVoter[] }>(`/admin/voters?limit=${limit}`, { token }),
  getOfflineProfiles: (token: string) =>
    requestOffline<OfflineProfilesResponse>("/offline/admin/profiles", { token }),
  getOfflineAudit: (token: string, limit = 100) =>
    requestOffline<OfflineAuditResponse>(`/offline/admin/audit?limit=${limit}`, { token }),
  offlineLinkOnline: (payload: {
    nid: string;
    dob: string;
    rfidUid: string;
    pin?: string;
  }) =>
    requestOffline<OfflineLinkOnlineResponse>("/offline/profiles/link-online", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  offlineRegisterProfile: (payload: {
    fullName: string;
    email: string;
    nid: string;
    dob: string;
    rfidUid: string;
    pin?: string;
  }) =>
    requestOffline<OfflineLinkOnlineResponse>("/offline/profiles/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  offlineStartSession: (payload: { rfidUid: string }) =>
    requestOffline<OfflineSessionStartResponse>("/offline/session/start", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  offlineAttestSession: (payload: {
    preSessionToken: string;
    officerEmployeeId: string;
    officerPin: string;
    boothCode?: string;
  }) =>
    requestOffline<OfflineSessionAttestResponse>("/offline/session/attest", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  offlineVote: (payload: {
    sessionToken: string;
    pin: string;
    candidateId: number;
  }) =>
    requestOffline<{ txHash: string }>("/offline/vote", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  fetchKycDocument: async (token: string, id: string) => {
    const res = await fetch(`${API_URL}/admin/kyc/${id}/document`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({ message: "Request failed" }));
      throw new Error(payload.message || "Request failed");
    }
    return res.blob();
  },
};

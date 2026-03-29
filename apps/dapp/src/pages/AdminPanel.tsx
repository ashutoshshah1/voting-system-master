import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../components/Button";
import { PageHeader } from "../components/PageHeader";
import { Panel } from "../components/Panel";
import { StatusBanner } from "../components/StatusBanner";
import { useAuth } from "../context/AuthContext";
import { useElection } from "../context/ElectionContext";
import { apiClient } from "../services/apiClient";
import type {
  AdminVoter,
  OfflineAdminProfile,
  OfflineAuditEvent,
  PendingKyc,
} from "../types/auth";
import { readCache, writeCache } from "../utils/cache";
import { getUserFacingErrorMessage } from "../utils/errorMessages";

const INPUT_CLASS =
  "w-full rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-neon-blue/60 focus:outline-none focus:ring-2 focus:ring-neon-blue/30";
const ZERO_VOTER_HASH =
  "0x0000000000000000000000000000000000000000000000000000000000000000";
const VOTER_CACHE_KEY = "votehybrid:admin:voters:v1";
const VOTER_CACHE_TTL = 30000;
const OFFLINE_AUDIT_LIMIT = 25;

const formatDateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString() : "Never";

const isProfileLocked = (value?: string | null) =>
  Boolean(value && Date.parse(value) > Date.now());

const formatMetadata = (value: unknown) => {
  if (value === undefined || value === null) {
    return null;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

function AdminStatCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | number;
  helper: string;
}) {
  return (
    <Panel className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-[0.25em] text-ink/50">
        {label}
      </div>
      <div className="text-3xl font-semibold text-ink">{value}</div>
      <div className="text-sm text-ink/60">{helper}</div>
    </Panel>
  );
}

export function AdminPanel() {
  const { user, token } = useAuth();
  const { candidates, electionActive, resultsPublished, refresh } = useElection();

  const [candidateName, setCandidateName] = useState("");
  const [candidateParty, setCandidateParty] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [eligible, setEligible] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentAction, setCurrentAction] = useState<string | null>(null);
  const [showSlowNotice, setShowSlowNotice] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [pendingKyc, setPendingKyc] = useState<PendingKyc[]>([]);
  const [isKycLoading, setIsKycLoading] = useState(false);
  const [kycError, setKycError] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);

  const [voters, setVoters] = useState<AdminVoter[]>([]);
  const [isVotersLoading, setIsVotersLoading] = useState(false);
  const [votersError, setVotersError] = useState<string | null>(null);

  const [offlineProfiles, setOfflineProfiles] = useState<OfflineAdminProfile[]>([]);
  const [offlineAudit, setOfflineAudit] = useState<OfflineAuditEvent[]>([]);
  const [isOfflineLoading, setIsOfflineLoading] = useState(false);
  const [offlineError, setOfflineError] = useState<string | null>(null);
  const showLegacyOfficerPanel = false;

  const officers: Array<{
    id: string;
    fullName: string;
    employeeId: string;
    isActive: boolean;
    lastSeenAt: string | null;
  }> = [];
  const officerFullName = "";
  const officerEmployeeId = "";
  const officerPin = "";
  const officerActive = true;
  const setOfficerFullName = (_value: string) => {
    void _value;
  };
  const setOfficerEmployeeId = (_value: string) => {
    void _value;
  };
  const setOfficerPin = (_value: string) => {
    void _value;
  };
  const setOfficerActive = (_value: boolean) => {
    void _value;
  };

  const isAdmin = user?.role === "ADMIN";

  useEffect(() => {
    if (!isSubmitting) {
      setShowSlowNotice(false);
      return;
    }
    setShowSlowNotice(false);
    const timeoutId = window.setTimeout(() => setShowSlowNotice(true), 20000);
    return () => window.clearTimeout(timeoutId);
  }, [isSubmitting]);

  const loadPendingKyc = useCallback(async () => {
    if (!token) {
      return;
    }
    setIsKycLoading(true);
    setKycError(null);
    try {
      const response = await apiClient.adminPending(token);
      setPendingKyc(response);
    } catch (err) {
      setKycError(
        getUserFacingErrorMessage(err, "admin", "Failed to load KYC queue.")
      );
    } finally {
      setIsKycLoading(false);
    }
  }, [token]);

  const loadVoters = useCallback(async () => {
    if (!token) {
      return;
    }
    const cached = readCache<AdminVoter[]>(VOTER_CACHE_KEY, VOTER_CACHE_TTL);
    if (cached) {
      setVoters(cached);
    }
    setIsVotersLoading(!cached);
    setVotersError(null);
    try {
      const response = await apiClient.getVoters(token, 250);
      setVoters(response.voters);
      writeCache(VOTER_CACHE_KEY, response.voters);
    } catch (err) {
      setVotersError(
        getUserFacingErrorMessage(err, "admin", "Failed to load voters.")
      );
    } finally {
      setIsVotersLoading(false);
    }
  }, [token]);

  const loadOfflineData = useCallback(async () => {
    if (!token) {
      return;
    }
    setIsOfflineLoading(true);
    setOfflineError(null);
    try {
      const [profilesResponse, auditResponse] = await Promise.all([
        apiClient.getOfflineProfiles(token),
        apiClient.getOfflineAudit(token, OFFLINE_AUDIT_LIMIT),
      ]);
      setOfflineProfiles(profilesResponse.items);
      setOfflineAudit(auditResponse.items);
    } catch (err) {
      setOfflineError(
        getUserFacingErrorMessage(
          err,
          "admin",
          "Failed to load offline booth data."
        )
      );
    } finally {
      setIsOfflineLoading(false);
    }
  }, [token]);

  const loadAllAdminData = useCallback(async () => {
    await Promise.all([loadPendingKyc(), loadVoters(), loadOfflineData()]);
  }, [loadOfflineData, loadPendingKyc, loadVoters]);

  useEffect(() => {
    if (isAdmin) {
      void loadAllAdminData();
    }
  }, [isAdmin, loadAllAdminData]);

  const runAdminAction = useCallback(
    async (label: string, action: () => Promise<void>) => {
      setCurrentAction(label);
      setIsSubmitting(true);
      setError(null);
      setStatusMessage(null);
      try {
        await action();
      } catch (err) {
        setError(getUserFacingErrorMessage(err, "admin", `${label} failed.`));
      } finally {
        setIsSubmitting(false);
        setCurrentAction(null);
      }
    },
    []
  );

  const handleViewDocument = async (id: string) => {
    if (!token) {
      return;
    }
    setViewingId(id);
    setError(null);
    try {
      const blob = await apiClient.fetchKycDocument(token, id);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      setError(
        getUserFacingErrorMessage(err, "admin", "Failed to open document.")
      );
    } finally {
      setViewingId(null);
    }
  };

  const handleAddCandidate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) {
      return;
    }
    await runAdminAction("Adding candidate", async () => {
      const response = await apiClient.addCandidate(token, {
        name: candidateName,
        party: candidateParty,
      });
      setCandidateName("");
      setCandidateParty("");
      setStatusMessage(`Candidate added. Tx: ${response.txHash}`);
      await refresh();
    });
  };

  const handleToggleElection = async () => {
    if (!token || electionActive === null) {
      return;
    }
    await runAdminAction(
      electionActive ? "Closing election" : "Opening election",
      async () => {
        const response = await apiClient.setElectionStatus(token, !electionActive);
        setStatusMessage(`Election status updated. Tx: ${response.txHash}`);
        await refresh();
      }
    );
  };

  const handlePublishResults = async () => {
    if (!token) {
      return;
    }
    await runAdminAction("Publishing results", async () => {
      const response = await apiClient.publishResults(token);
      setStatusMessage(`Results published. Tx: ${response.txHash}`);
      await refresh();
    });
  };

  const handleResetElection = async () => {
    if (!token) {
      return;
    }
    const confirmed = window.confirm(
      "Reset the election? This starts a new election and clears current candidates and votes."
    );
    if (!confirmed) {
      return;
    }
    await runAdminAction("Resetting election", async () => {
      const response = await apiClient.resetElection(token);
      setStatusMessage(`Election reset. Tx: ${response.txHash}`);
      await refresh();
    });
  };

  const handleEligibility = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) {
      return;
    }
    await runAdminAction("Updating voter eligibility", async () => {
      const response = await apiClient.setEligibility(token, {
        walletAddress,
        eligible,
      });
      setWalletAddress("");
      setStatusMessage(`Eligibility updated. Tx: ${response.txHash}`);
      await loadVoters();
    });
  };

  const handleApproveKyc = async (id: string) => {
    if (!token) {
      return;
    }
    await runAdminAction("Approving KYC", async () => {
      const response = await apiClient.approveKyc(token, id, "Approved from unified admin panel");
      setStatusMessage(`KYC approved. Voter hash: ${response.voterIdHash}`);
      await Promise.all([loadPendingKyc(), loadVoters(), loadOfflineData()]);
    });
  };

  const handleRejectKyc = async (id: string) => {
    if (!token) {
      return;
    }
    await runAdminAction("Rejecting KYC", async () => {
      await apiClient.rejectKyc(token, id, "Rejected from unified admin panel");
      setStatusMessage("KYC submission rejected.");
      await Promise.all([loadPendingKyc(), loadVoters(), loadOfflineData()]);
    });
  };

  const handleSaveOfficer = (event: React.FormEvent) => {
    event.preventDefault();
  };

  const summary = useMemo(() => {
    const registeredCount = voters.filter(
      (voter) =>
        voter.onChain?.voterIdHash && voter.onChain.voterIdHash !== ZERO_VOTER_HASH
    ).length;
    const votedCount = voters.filter((voter) => voter.onChain?.hasVoted).length;
    const readyOfflineProfiles = offlineProfiles.filter(
      (profile) =>
        !profile.pinSetupRequired &&
        profile.kycStatus === "APPROVED" &&
        Boolean(profile.walletAddress)
    ).length;
    const lockedProfiles = offlineProfiles.filter((profile) =>
      isProfileLocked(profile.blockedUntil)
    ).length;
    return {
      pendingKyc: pendingKyc.length,
      voters: voters.length,
      registeredCount,
      votedCount,
      offlineProfiles: offlineProfiles.length,
      readyOfflineProfiles,
      lockedProfiles,
      activeOfficerCount: 0,
    };
  }, [offlineProfiles, pendingKyc.length, voters]);

  if (!isAdmin) {
    return (
      <section className="space-y-6 animate-fadeUp">
        <PageHeader
          kicker="Admin"
          title="Unified admin panel"
          subtitle="Admin access required to manage election, KYC, and offline booth operations."
        />
        <StatusBanner tone="warning" title="Restricted" message="Admins only." />
      </section>
    );
  }

  return (
    <section className="space-y-6 animate-fadeUp">
      <PageHeader
        kicker="Admin"
        title="Unified admin panel"
        subtitle="One shared workspace for election controls, KYC review, voter sync, and hardware booth operations."
      />

      {isSubmitting ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 backdrop-blur-sm">
          <Panel className="w-[min(92vw,480px)] space-y-4">
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-ink/50">
              Admin action
            </div>
            <div className="text-base font-semibold text-ink">
              {currentAction || "Submitting transaction"}
            </div>
            <p className="text-sm text-ink/70">
              Waiting for the API and blockchain work to finish. Keep this tab open.
            </p>
            {showSlowNotice ? (
              <StatusBanner
                tone="info"
                title="Taking longer than usual"
                message="If this stays pending, check the funder wallet balance plus online/offline API logs."
              />
            ) : null}
          </Panel>
        </div>
      ) : null}

      {error ? <StatusBanner tone="error" title="Action failed" message={error} /> : null}
      {statusMessage ? (
        <StatusBanner tone="success" title="Update sent" message={statusMessage} />
      ) : null}

      <div className="flex flex-wrap justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => {
            void refresh();
            void loadAllAdminData();
          }}
          disabled={isSubmitting}
        >
          Refresh all
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          label="Pending KYC"
          value={summary.pendingKyc}
          helper="Identity checks waiting for review"
        />
        <AdminStatCard
          label="Registered Voters"
          value={`${summary.registeredCount}/${summary.voters}`}
          helper="On-chain registrations against known users"
        />
        <AdminStatCard
          label="Votes Recorded"
          value={summary.votedCount}
          helper="Users already marked as voted on-chain"
        />
        <AdminStatCard
          label="Offline Profiles"
          value={`${summary.readyOfflineProfiles}/${summary.offlineProfiles}`}
          helper={`Ready booth profiles. Locked: ${summary.lockedProfiles}`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Panel className="space-y-4">
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-ink/50">
            Candidates
          </div>
          <form className="space-y-4" onSubmit={handleAddCandidate}>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-ink">Name</label>
              <input
                className={INPUT_CLASS}
                value={candidateName}
                onChange={(event) => setCandidateName(event.target.value)}
                placeholder="Candidate name"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-ink">Party</label>
              <input
                className={INPUT_CLASS}
                value={candidateParty}
                onChange={(event) => setCandidateParty(event.target.value)}
                placeholder="Party or alliance"
                required
              />
            </div>
            <Button type="submit" isLoading={isSubmitting}>
              Add candidate
            </Button>
          </form>
          <div className="space-y-2 text-sm text-ink/70">
            {candidates.length === 0 ? (
              <div>No candidates yet.</div>
            ) : (
              candidates.map((candidate) => (
                <div key={candidate.id} className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-ink">{candidate.name}</span>
                  <span className="text-xs text-ink/60">{candidate.party}</span>
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel className="space-y-4">
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-ink/50">
            Election status
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3 text-sm text-slate-700">
            <div>
              Current status:{" "}
              <span className="font-semibold text-slate-900">
                {electionActive === null ? "Loading" : electionActive ? "Active" : "Closed"}
              </span>
            </div>
            <div className="mt-2">
              Results:{" "}
              <span className="font-semibold text-slate-900">
                {resultsPublished ? "Published" : "Hidden"}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleToggleElection}
              isLoading={isSubmitting}
              disabled={electionActive === null || resultsPublished === true}
            >
              {electionActive === null
                ? "Loading status"
                : electionActive
                  ? "Close election"
                  : "Open election"}
            </Button>
            <Button
              variant="outline"
              onClick={handlePublishResults}
              isLoading={isSubmitting}
              disabled={electionActive !== false || resultsPublished === true}
            >
              Publish results
            </Button>
            <Button
              variant="outline"
              onClick={handleResetElection}
              isLoading={isSubmitting}
              disabled={isSubmitting}
            >
              Reset election
            </Button>
          </div>
          {resultsPublished ? (
            <div className="text-xs text-ink/60">
              Results are final. Start a new election only when you are ready to clear the current round.
            </div>
          ) : null}
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Panel className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-ink/50">
              KYC review queue
            </div>
            <Button variant="outline" onClick={() => void loadPendingKyc()} isLoading={isKycLoading}>
              Refresh queue
            </Button>
          </div>
          {kycError ? (
            <StatusBanner tone="error" title="Queue error" message={kycError} />
          ) : null}
          {isKycLoading ? (
            <div className="text-sm text-ink/60">Loading submissions...</div>
          ) : pendingKyc.length === 0 ? (
            <div className="text-sm text-ink/60">No pending submissions.</div>
          ) : (
            <div className="space-y-4">
              {pendingKyc.map((item) => (
                <div
                  key={item.id}
                  className="space-y-3 rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-4 text-slate-900 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{item.user.fullName}</div>
                      <div className="text-xs text-slate-500">{item.user.email}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        Doc: {item.documentType} • Submitted {formatDateTime(item.createdAt)}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="ghost"
                        onClick={() => void handleViewDocument(item.id)}
                        disabled={viewingId === item.id}
                      >
                        {viewingId === item.id ? "Opening..." : "View document"}
                      </Button>
                      <Button variant="outline" onClick={() => void handleRejectKyc(item.id)}>
                        Reject
                      </Button>
                      <Button onClick={() => void handleApproveKyc(item.id)}>Approve</Button>
                    </div>
                  </div>
                  <div className="text-xs text-slate-600">
                    Wallet: {item.user.walletAddress || "Not assigned yet"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel className="space-y-4">
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-ink/50">
            Voter eligibility
          </div>
          <form className="space-y-4" onSubmit={handleEligibility}>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-ink">Wallet address</label>
              <input
                className={INPUT_CLASS}
                value={walletAddress}
                onChange={(event) => setWalletAddress(event.target.value)}
                placeholder="0x..."
                required
              />
            </div>
            <label className="flex items-center gap-3 text-sm font-semibold text-ink">
              <input
                type="checkbox"
                checked={eligible}
                onChange={(event) => setEligible(event.target.checked)}
              />
              Mark voter as eligible
            </label>
            <Button type="submit" isLoading={isSubmitting}>
              Update eligibility
            </Button>
          </form>
        </Panel>
      </div>

      <Panel className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-ink/50">
            Unified voter list
          </div>
          <Button variant="outline" onClick={() => void loadVoters()} isLoading={isVotersLoading}>
            Refresh voters
          </Button>
        </div>
        {votersError ? (
          <StatusBanner tone="error" title="Voter list error" message={votersError} />
        ) : null}
        {isVotersLoading ? (
          <div className="text-sm text-ink/60">Loading voters...</div>
        ) : voters.length === 0 ? (
          <div className="text-sm text-ink/60">No voters found.</div>
        ) : (
          <div className="space-y-3 text-sm text-ink/70">
            {voters.map((voter) => {
              const registered =
                voter.onChain?.voterIdHash &&
                voter.onChain.voterIdHash !== ZERO_VOTER_HASH;
              return (
                <div
                  key={voter.id}
                  className="space-y-2 rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3 text-slate-900 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold">{voter.fullName}</div>
                      <div className="text-xs text-slate-500">{voter.email}</div>
                    </div>
                    <div className="text-xs text-slate-500">
                      KYC: <span className="font-semibold">{voter.kycStatus}</span>
                    </div>
                  </div>
                  <div className="text-xs text-slate-600">
                    Wallet: {voter.walletAddress || "Not assigned"}
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs text-slate-600">
                    <div>
                      Registered: <span className="font-semibold">{registered ? "Yes" : "No"}</span>
                    </div>
                    <div>
                      Eligible:{" "}
                      <span className="font-semibold">
                        {voter.onChain ? (voter.onChain.eligible ? "Yes" : "No") : "Unknown"}
                      </span>
                    </div>
                    <div>
                      Voted:{" "}
                      <span className="font-semibold">
                        {voter.onChain ? (voter.onChain.hasVoted ? "Yes" : "No") : "Unknown"}
                      </span>
                    </div>
                  </div>
                  {voter.onChainError ? (
                    <div className="text-xs text-slate-500">
                      On-chain lookup: {voter.onChainError}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        {showLegacyOfficerPanel ? <Panel className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-ink/50">
              Offline booth officers
            </div>
            <Button variant="outline" onClick={() => void loadOfflineData()} isLoading={isOfflineLoading}>
              Refresh offline data
            </Button>
          </div>
          {offlineError ? (
            <StatusBanner tone="error" title="Offline booth error" message={offlineError} />
          ) : null}
          <form className="space-y-4" onSubmit={handleSaveOfficer}>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-ink">Officer full name</label>
              <input
                className={INPUT_CLASS}
                value={officerFullName}
                onChange={(event) => setOfficerFullName(event.target.value)}
                placeholder="Booth officer name"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-ink">Employee ID</label>
              <input
                className={INPUT_CLASS}
                value={officerEmployeeId}
                onChange={(event) => setOfficerEmployeeId(event.target.value)}
                placeholder="BOOTH-01"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-ink">PIN</label>
              <input
                className={INPUT_CLASS}
                value={officerPin}
                onChange={(event) => setOfficerPin(event.target.value)}
                placeholder="6 to 8 digit PIN"
                inputMode="numeric"
                pattern="[0-9]{6,8}"
                required
              />
            </div>
            <label className="flex items-center gap-3 text-sm font-semibold text-ink">
              <input
                type="checkbox"
                checked={officerActive}
                onChange={(event) => setOfficerActive(event.target.checked)}
              />
              Officer active
            </label>
            <Button type="submit" isLoading={isSubmitting}>
              Save officer
            </Button>
          </form>
          <div className="space-y-3 border-t border-white/10 pt-4">
            <div className="text-sm font-semibold text-ink">
              Active officers: {summary.activeOfficerCount}
            </div>
            {officers.length === 0 ? (
              <div className="text-sm text-ink/60">No booth officers configured.</div>
            ) : (
              officers.map((officer) => (
                <div
                  key={officer.id}
                  className="rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3 text-sm text-slate-900 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold">{officer.fullName}</div>
                    <div className="text-xs text-slate-500">
                      {officer.isActive ? "Active" : "Inactive"}
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {officer.employeeId} • Last seen {formatDateTime(officer.lastSeenAt)}
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel> : null}

        <Panel className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-ink/50">
              Offline linked profiles
            </div>
            <Button
              variant="outline"
              onClick={() => void loadOfflineData()}
              isLoading={isOfflineLoading}
            >
              Refresh offline data
            </Button>
          </div>
          {offlineError ? (
            <StatusBanner tone="error" title="Offline data error" message={offlineError} />
          ) : isOfflineLoading ? (
            <div className="text-sm text-ink/60">Loading offline profiles...</div>
          ) : offlineProfiles.length === 0 ? (
            <div className="text-sm text-ink/60">No offline profiles yet.</div>
          ) : (
            <div className="space-y-3">
              {offlineProfiles.map((profile) => (
                <div
                  key={profile.id}
                  className="space-y-2 rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3 text-slate-900 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold">{profile.fullName}</div>
                      <div className="text-xs text-slate-500">
                        {profile.email} • NID {profile.nid}
                      </div>
                    </div>
                    <div className="text-xs text-slate-500">
                      KYC: <span className="font-semibold">{profile.kycStatus}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs text-slate-600">
                    <div>
                      PIN ready:{" "}
                      <span className="font-semibold">
                        {profile.pinSetupRequired ? "No" : "Yes"}
                      </span>
                    </div>
                    <div>
                      Locked:{" "}
                      <span className="font-semibold">
                        {isProfileLocked(profile.blockedUntil) ? "Yes" : "No"}
                      </span>
                    </div>
                    <div>
                      Failed PINs:{" "}
                      <span className="font-semibold">{profile.failedPinAttempts}</span>
                    </div>
                  </div>
                  <div className="text-xs text-slate-600">
                    Wallet: {profile.walletAddress || "Not assigned"} • Last seen{" "}
                    {formatDateTime(profile.lastSeenAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel className="space-y-4">
        <div className="text-xs font-semibold uppercase tracking-[0.3em] text-ink/50">
          Offline audit trail
        </div>
        {isOfflineLoading ? (
          <div className="text-sm text-ink/60">Loading audit events...</div>
        ) : offlineAudit.length === 0 ? (
          <div className="text-sm text-ink/60">No offline audit events recorded yet.</div>
        ) : (
          <div className="space-y-3">
            {offlineAudit.map((event) => {
              const metadata = formatMetadata(event.metadata);
              return (
                <div
                  key={event.id}
                  className="space-y-2 rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3 text-slate-900 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold">
                      {event.eventType} • {event.status}
                    </div>
                    <div className="text-xs text-slate-500">
                      {formatDateTime(event.createdAt)}
                    </div>
                  </div>
                  {event.reason ? (
                    <div className="text-xs text-slate-600">Reason: {event.reason}</div>
                  ) : null}
                  {event.txHash ? (
                    <div className="break-all text-xs text-slate-600">Tx: {event.txHash}</div>
                  ) : null}
                  {metadata ? (
                    <pre className="overflow-x-auto rounded-2xl bg-slate-950/90 px-3 py-2 text-[11px] text-slate-100">
                      {metadata}
                    </pre>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </section>
  );
}

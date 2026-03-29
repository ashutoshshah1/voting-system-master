import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "../components/Button";
import { PageHeader } from "../components/PageHeader";
import { Panel } from "../components/Panel";
import { StatusBanner } from "../components/StatusBanner";
import { useAuth } from "../context/AuthContext";
import { useElection } from "../context/ElectionContext";

export function ConfirmVote() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    candidates,
    voterStatus,
    electionActive,
    resultsPublished,
    vote,
    isVoting,
    error,
  } = useElection();
  const candidateId = Number(params.get("candidateId"));
  const candidate = candidates.find((item) => item.id === candidateId);
  const [showSlowNotice, setShowSlowNotice] = useState(false);

  const isEligible = voterStatus?.eligible;
  const hasVoted = voterStatus?.hasVoted;
  const isKycApproved = user?.kycStatus === "APPROVED";
  const hasWallet = !!user?.walletAddress;
  const isRegisteredOnChain = !!voterStatus;
  const showRegistrationPending =
    user && isKycApproved && hasWallet && !isRegisteredOnChain;
  const isElectionClosed = electionActive === false;
  const areResultsPublished = resultsPublished === true;

  useEffect(() => {
    if (!isVoting) {
      return;
    }
    const timeoutId = window.setTimeout(() => setShowSlowNotice(true), 20000);
    return () => window.clearTimeout(timeoutId);
  }, [isVoting]);

  const handleVote = async () => {
    if (!candidate) return;
    setShowSlowNotice(false);
    const txHash = await vote(candidate.id);
    if (txHash) {
      navigate(`/receipt?txHash=${txHash}&candidateId=${candidate.id}`);
    }
  };

  return (
    <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] animate-fadeUp">
      {isVoting ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 backdrop-blur-sm">
          <Panel className="w-[min(92vw,480px)] space-y-4">
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-ink/50">
              Transaction processing
            </div>
            <div className="text-base font-semibold text-ink">Submitting vote</div>
            <p className="text-sm text-ink/70">
              Waiting for the blockchain transaction to confirm. Keep this tab open.
            </p>
            {showSlowNotice ? (
              <StatusBanner
                tone="info"
                title="Taking longer than usual"
                message="If this stays pending, check the funder wallet balance, RPC status, and API logs."
              />
            ) : null}
          </Panel>
        </div>
      ) : null}
      <div className="space-y-6">
        <PageHeader
          kicker="Step 3"
          title="Confirm your vote"
          subtitle="Review the candidate and submit the transaction. Voting is final."
        />

        {!user ? (
          <StatusBanner
            tone="warning"
            title="Login required"
            message="Register or log in before submitting KYC and voting."
          />
        ) : null}

        {user && !isKycApproved ? (
          <StatusBanner
            tone="info"
            title="KYC not approved"
            message="Submit your ID for verification before voting."
          />
        ) : null}

        {user && isKycApproved && !hasWallet ? (
          <StatusBanner
            tone="warning"
            title="Wallet not generated"
            message="Generate your voting wallet on the Wallet page to unlock voting."
          />
        ) : null}

        {showRegistrationPending ? (
          <StatusBanner
            tone="info"
            title="On-chain registration pending"
            message="Your wallet will be registered on-chain by the admin."
          />
        ) : null}

        {isElectionClosed ? (
          <StatusBanner
            tone="warning"
            title="Election closed"
            message="Voting is currently closed."
          />
        ) : null}

        {areResultsPublished ? (
          <StatusBanner
            tone="warning"
            title="Results published"
            message="Voting is closed because results are already published."
          />
        ) : null}

        {isEligible === false ? (
          <StatusBanner
            tone="error"
            title="Not eligible"
            message="Your verified ID is not approved to vote."
          />
        ) : null}

        {hasVoted ? (
          <StatusBanner
            tone="success"
            title="Already voted"
            message="You have already submitted a vote for this election."
          />
        ) : null}

        {error ? (
          <StatusBanner tone="error" title="Vote error" message={error} />
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button
            onClick={handleVote}
            isLoading={isVoting}
            disabled={
              !user ||
              !isKycApproved ||
              !hasWallet ||
              !isRegisteredOnChain ||
              isElectionClosed ||
              areResultsPublished ||
              !candidate ||
              !isEligible ||
              hasVoted
            }
          >
            Submit vote
          </Button>
          <Button variant="outline" onClick={() => navigate("/candidates")}>
            Back to candidates
          </Button>
        </div>
      </div>

      <Panel className="space-y-4">
        <div className="text-xs font-semibold uppercase tracking-[0.3em] text-ink/50">
          Candidate summary
        </div>
        {candidate ? (
          <div className="space-y-2">
            <div className="text-lg font-semibold text-ink">
              {candidate.name}
            </div>
            <div className="text-sm text-ink/60">{candidate.party}</div>
            <p className="text-sm text-ink/70">{candidate.manifesto}</p>
          </div>
        ) : (
          <div className="text-sm text-ink/60">
            Select a candidate first.
          </div>
        )}
      </Panel>
    </section>
  );
}

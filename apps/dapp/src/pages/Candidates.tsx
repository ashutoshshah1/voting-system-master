import { useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import { CandidateCard } from "../components/CandidateCard";
import { PageHeader } from "../components/PageHeader";
import { StatusBanner } from "../components/StatusBanner";
import { useAuth } from "../context/AuthContext";
import { useElection } from "../context/ElectionContext";

export function Candidates() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    candidates,
    voterStatus,
    electionActive,
    resultsPublished,
    isLoading,
    error,
  } = useElection();

  const handleSelect = (candidateId: number) => {
    navigate(`/confirm?candidateId=${candidateId}`);
  };

  const isEligible = voterStatus?.eligible;
  const hasVoted = voterStatus?.hasVoted;
  const isKycApproved = user?.kycStatus === "APPROVED";
  const hasWallet = !!user?.walletAddress;
  const isRegisteredOnChain = !!voterStatus;
  const showRegistrationPending =
    user && isKycApproved && hasWallet && !isRegisteredOnChain && !isLoading;
  const isElectionClosed = electionActive === false;
  const areResultsPublished = resultsPublished === true;

  return (
    <section className="space-y-6 animate-fadeUp">
      <PageHeader
        kicker="Step 2"
        title="Choose your candidate"
        subtitle="Your wallet can vote once. Eligibility is verified by the admin registry."
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
          message="Voting is currently closed. Check back later."
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
          message="Your verified ID is not cleared to vote. Contact the admin."
        />
      ) : null}

      {hasVoted ? (
        <StatusBanner
          tone="success"
          title="Vote already submitted"
          message="You can view results but cannot vote again."
        />
      ) : null}

      {error ? (
        <StatusBanner tone="error" title="Load failed" message={error} />
      ) : null}

      {isLoading ? (
        <div className="text-sm text-ink/60">Loading candidates...</div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {candidates.map((candidate) => (
            <CandidateCard
              key={candidate.id}
              candidate={candidate}
              onSelect={handleSelect}
              disabled={
                !user ||
                !isKycApproved ||
                !hasWallet ||
                !isRegisteredOnChain ||
                isElectionClosed ||
                areResultsPublished ||
                !isEligible ||
                hasVoted
              }
            />
          ))}
        </div>
      )}

      {hasVoted ? (
        <Button variant="outline" onClick={() => navigate("/results")}>
          View results
        </Button>
      ) : null}
    </section>
  );
}

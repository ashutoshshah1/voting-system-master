import { useEffect, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { Panel } from "../components/Panel";
import { StatusBanner } from "../components/StatusBanner";
import { chainConfig } from "../config/chain";
import { useAuth } from "../context/AuthContext";
import { useElection } from "../context/ElectionContext";
import { apiClient } from "../services/apiClient";

export function Connect() {
  const { user, token, error } = useAuth();
  const { voterStatus, isMockMode } = useElection();
  const [balance, setBalance] = useState<string | null>(null);
  const [isBalanceLoading, setIsBalanceLoading] = useState(false);

  const isKycApproved = user?.kycStatus === "APPROVED";
  const walletAddress = user?.walletAddress || null;

  useEffect(() => {
    let isMounted = true;
    const loadBalance = async () => {
      if (!walletAddress || !token) {
        setBalance(null);
        return;
      }
      setIsBalanceLoading(true);
      try {
        const response = await apiClient.getWalletBalance(token);
        if (isMounted) {
          const numericBalance = response.balance ? Number(response.balance) : NaN;
          setBalance(
            Number.isFinite(numericBalance)
              ? numericBalance.toFixed(4)
              : response.balance
          );
        }
      } catch {
        if (isMounted) {
          setBalance(null);
        }
      } finally {
        if (isMounted) {
          setIsBalanceLoading(false);
        }
      }
    };
    loadBalance();
    return () => {
      isMounted = false;
    };
  }, [walletAddress, token]);

  const zeroVoterHash =
    "0x0000000000000000000000000000000000000000000000000000000000000000";
  const voterIdHash =
    voterStatus?.voterIdHash && voterStatus.voterIdHash !== zeroVoterHash
      ? voterStatus.voterIdHash
      : null;

  return (
    <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] animate-fadeUp">
      <div className="space-y-6">
        <PageHeader
          kicker="Step 1"
          title="Assigned voting wallet"
          subtitle="We generate and fund a wallet for every verified voter."
        />

        {error ? (
          <StatusBanner tone="error" title="Account error" message={error} />
        ) : null}

        {!user ? (
          <StatusBanner
            tone="warning"
            title="Login required"
            message="Register or log in to submit KYC and receive a voting wallet."
          />
        ) : null}

        {user && !isKycApproved ? (
          <StatusBanner
            tone="info"
            title="KYC pending"
            message="Submit your ID for verification. The admin will assign your wallet after approval."
          />
        ) : null}

        {user && isKycApproved && !walletAddress ? (
          <StatusBanner
            tone="warning"
            title="Wallet pending"
            message="Your wallet will be assigned by the admin after KYC approval."
          />
        ) : null}

        {walletAddress && balance && Number(balance) > 0 ? (
          <StatusBanner
            tone="success"
            title="Wallet funded"
            message="Your wallet has gas for transaction fees."
          />
        ) : null}
      </div>

      <Panel className="space-y-4">
        <div className="text-xs font-semibold uppercase tracking-[0.3em] text-ink/50">
          Wallet status
        </div>
        <div className="space-y-2 text-sm text-ink/70">
          <div className="flex items-center justify-between">
            <span>Assigned address</span>
            <span className="font-mono text-xs font-semibold text-ink break-all text-right">
              {walletAddress || "Not assigned"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Network</span>
            <span className="font-semibold text-ink">{chainConfig.name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Wallet balance</span>
            <span className="font-semibold text-ink">
              {isBalanceLoading
                ? "Loading..."
                : balance
                  ? `${balance} ${chainConfig.nativeCurrency.symbol}`
                  : "Not available"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Voter ID hash</span>
            <span className="font-mono text-xs font-semibold text-ink break-all text-right">
              {voterIdHash || "Unverified"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Eligibility</span>
            <span className="font-semibold text-ink">
              {voterStatus
                ? voterStatus.eligible
                  ? "Eligible"
                  : "Not eligible"
                : "Not registered"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>KYC status</span>
            <span className="font-semibold text-ink">
              {user?.kycStatus || "Not started"}
            </span>
          </div>
        </div>

        {isMockMode ? (
          <StatusBanner
            tone="info"
            title="Mock mode"
            message="Using placeholder data until the smart contract is deployed."
          />
        ) : null}
      </Panel>
    </section>
  );
}

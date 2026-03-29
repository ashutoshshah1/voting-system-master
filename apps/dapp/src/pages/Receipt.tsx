import { useSearchParams, Link } from "react-router-dom";
import { Button } from "../components/Button";
import { PageHeader } from "../components/PageHeader";
import { Panel } from "../components/Panel";
import { chainConfig } from "../config/chain";
import { useElection } from "../context/ElectionContext";

export function Receipt() {
  const [params] = useSearchParams();
  const txHash = params.get("txHash");
  const candidateId = Number(params.get("candidateId"));
  const { candidates } = useElection();
  const candidate = candidates.find((item) => item.id === candidateId);

  const explorerUrl =
    chainConfig.explorerBaseUrl && txHash
      ? `${chainConfig.explorerBaseUrl}/tx/${txHash}`
      : null;

  return (
    <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] animate-fadeUp">
      <div className="space-y-6">
        <PageHeader
          kicker="Receipt"
          title="Vote submitted successfully"
          subtitle="Your transaction has been sent to the blockchain. Keep this receipt for verification."
        />
        <div className="flex flex-wrap gap-3">
          <Link to="/results">
            <Button>View results</Button>
          </Link>
          <Link to="/candidates">
            <Button variant="outline">Back to candidates</Button>
          </Link>
        </div>
      </div>

      <Panel className="space-y-4">
        <div className="text-xs font-semibold uppercase tracking-[0.3em] text-ink/50">
          Transaction
        </div>
        <div className="space-y-2 text-sm text-ink/70">
          <div>
            <span className="font-semibold text-ink">Candidate:</span>{" "}
            {candidate ? candidate.name : "Unknown"}
          </div>
          <div className="break-all text-xs text-ink/70">
            <span className="font-semibold text-ink">Tx hash:</span>{" "}
            {txHash || "Pending"}
          </div>
          {explorerUrl ? (
            <a
              className="text-xs font-semibold text-coral underline"
              href={explorerUrl}
              target="_blank"
              rel="noreferrer"
            >
              View on explorer
            </a>
          ) : null}
        </div>
      </Panel>
    </section>
  );
}

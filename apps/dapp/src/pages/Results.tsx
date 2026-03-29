import { PageHeader } from "../components/PageHeader";
import { Panel } from "../components/Panel";
import { StatusBanner } from "../components/StatusBanner";
import { useElection } from "../context/ElectionContext";

export function Results() {
  const { candidates, results, resultsPublished, electionActive, isLoading, error } =
    useElection();
  const totalVotes = results.reduce((sum, item) => sum + item.votes, 0);
  const showPending = !isLoading && resultsPublished !== true;
  const pendingMessage =
    electionActive === false
      ? "Election is closed. Results will be published by the admin."
      : "Election is ongoing. Results will be published after the election closes.";

  return (
    <section className="space-y-6 animate-fadeUp">
      <PageHeader
        kicker="Results"
        title="Live election tally"
        subtitle="Results are read-only and update as votes are confirmed on-chain."
      />

      {error ? (
        <StatusBanner tone="error" title="Load failed" message={error} />
      ) : null}

      {showPending ? (
        <StatusBanner
          tone="info"
          title="Results not published"
          message={pendingMessage}
        />
      ) : null}

      {isLoading ? (
        <div className="text-sm text-ink/60">Loading results...</div>
      ) : resultsPublished ? (
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Panel className="space-y-4">
            {results.map((result) => {
              const candidate = candidates.find(
                (item) => item.id === result.candidateId
              );
              const share =
                totalVotes > 0
                  ? Math.round((result.votes / totalVotes) * 100)
                  : 0;
              return (
                <div key={result.candidateId} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-ink/5 text-base font-semibold text-ink">
                        {(candidate?.name || "C").slice(0, 1)}
                      </div>
                      <div>
                        <div className="font-semibold text-ink">
                          {candidate?.name || "Unknown"}
                        </div>
                        <div className="text-xs text-ink/60">
                          {candidate?.party || "Independent"}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-ink">
                      {result.votes} votes
                    </div>
                  </div>
                  <div className="h-2 w-full rounded-full bg-ink/10">
                    <div
                      className="h-2 rounded-full bg-coral transition-all"
                      style={{ width: `${share}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </Panel>

          <Panel className="space-y-4">
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-ink/50">
              Summary
            </div>
            <div className="text-3xl font-semibold text-ink">
              {totalVotes}
            </div>
            <div className="text-sm text-ink/70">
              Total verified votes recorded on chain.
            </div>
          </Panel>
        </div>
      ) : null}
    </section>
  );
}

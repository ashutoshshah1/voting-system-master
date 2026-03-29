import type { Candidate } from "../types/election";

type CandidateCardProps = {
  candidate: Candidate;
  onSelect?: (candidateId: number) => void;
  disabled?: boolean;
};

export function CandidateCard({
  candidate,
  onSelect,
  disabled,
}: CandidateCardProps) {
  return (
    <div className="group relative flex flex-col gap-4 overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 p-5 text-slate-900 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-neon-purple via-neon-blue to-neon-green opacity-80" />
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
            Candidate {candidate.id}
          </div>
          <div className="text-lg font-semibold">{candidate.name}</div>
          <div className="text-sm text-slate-500">{candidate.party}</div>
        </div>
        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 text-xl font-semibold text-slate-700">
          {candidate.name.slice(0, 1)}
        </div>
      </div>
      {candidate.manifesto ? (
        <p className="text-sm text-slate-600">{candidate.manifesto}</p>
      ) : null}
      {onSelect ? (
        <button
          className="mt-auto rounded-full border border-neon-blue/40 bg-neon-blue/15 px-4 py-2 text-sm font-semibold text-neon-blue transition hover:border-neon-blue hover:bg-neon-blue/25 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => onSelect(candidate.id)}
          disabled={disabled}
        >
          Select candidate
        </button>
      ) : null}
    </div>
  );
}

import { Link } from "react-router-dom";
import { Button } from "../components/Button";
import { PageHeader } from "../components/PageHeader";
import { Panel } from "../components/Panel";
import { StatTile } from "../components/StatTile";
import { chainConfig } from "../config/chain";
import { useAuth } from "../context/AuthContext";
import { useVotingMode } from "../hooks/useVotingMode";

export function Landing() {
  const { user } = useAuth();
  const { votingMode, setVotingMode } = useVotingMode();

  const onlinePath = !user
    ? "/register"
    : user.kycStatus === "APPROVED" && user.walletAddress
      ? "/candidates"
      : "/kyc";
  const primaryPath = votingMode === "online" ? onlinePath : "/offline";
  const primaryLabel =
    votingMode === "online" ? "Start online voting" : "Open offline booth";
  const secondaryPath = votingMode === "online" ? "/results" : "/docs";
  const secondaryLabel =
    votingMode === "online" ? "View live results" : "Read offline workflow";

  return (
    <div className="space-y-32">
      {/* Hero Section */}
      <section className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="space-y-8">
          <div className="inline-flex flex-wrap items-center gap-3 rounded-full border border-white/5 bg-white/5 backdrop-blur px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-neon-blue animate-fadeUp">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neon-green/60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-neon-green" />
            </span>
            Live integrity
            <span className="text-white/20">|</span>
            {chainConfig.name}
          </div>

          <div className="space-y-4 animate-fadeUp" style={{ animationDelay: "100ms" }}>
            <PageHeader
              kicker="Phase 1 MVP"
              title="Online voting with offline integrity."
              subtitle="A hybrid election system that links every verified voter ID to a single wallet address and keeps results tamper-proof on chain."
            />
          </div>

          <div
            className="flex flex-wrap gap-3 animate-fadeUp"
            style={{ animationDelay: "200ms" }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 p-1">
              <button
                className={`rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                  votingMode === "online"
                    ? "bg-neon-blue/20 text-neon-blue"
                    : "text-text-muted hover:text-white"
                }`}
                onClick={() => setVotingMode("online")}
                type="button"
              >
                Online
              </button>
              <button
                className={`rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                  votingMode === "offline"
                    ? "bg-neon-purple/20 text-neon-purple"
                    : "text-text-muted hover:text-white"
                }`}
                onClick={() => setVotingMode("offline")}
                type="button"
              >
                Offline
              </button>
            </div>
          </div>

          <div
            className="flex flex-wrap gap-3 animate-fadeUp"
            style={{ animationDelay: "260ms" }}
          >
            <Link to={primaryPath}>
              <Button className="hover:scale-105 transition-transform">Start voting</Button>
            </Link>
            <Link to={secondaryPath}>
              <Button
                variant="ghost"
                className="hover:text-neon-purple hover:bg-neon-purple/10"
              >
                {secondaryLabel}
              </Button>
            </Link>
          </div>

          <div className="text-xs uppercase tracking-[0.2em] text-text-muted">
            Active mode:{" "}
            <span className="font-semibold text-white">{votingMode}</span>
            {" | "}
            <span className="font-semibold text-white">{primaryLabel}</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 animate-fadeUp" style={{ animationDelay: "300ms" }}>
            <StatTile label="Identity" value="1 ID -> 1 Wallet" />
            <StatTile label="Audit" value="Immutable Votes" />
            <StatTile
              label="Mode"
              value={votingMode === "online" ? "Online only" : "Offline booth"}
            />
          </div>
        </div>

        <Panel className="relative space-y-6 overflow-hidden animate-slideIn glass border-white/5 hover:border-white/20 transition-colors group">
          <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-neon-purple/20 blur-2xl group-hover:bg-neon-purple/30 transition-colors" />
          <div className="text-sm font-semibold uppercase tracking-[0.25em] text-text-muted">
            Voting flow
          </div>
          <ol className="space-y-4 text-sm text-text-muted">
            <li className="flex items-start gap-3">
              <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-surfaceHighlight text-neon-blue shadow-neonBlue text-xs font-bold">
                1
              </span>
              Register and upload your ID for verification.
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-surfaceHighlight text-neon-blue shadow-neonBlue text-xs font-bold">
                2
              </span>
              Receive your voting wallet and funding.
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-surfaceHighlight text-neon-blue shadow-neonBlue text-xs font-bold">
                3
              </span>
              Select a candidate and receive an on-chain receipt.
            </li>
          </ol>
          <div className="rounded-2xl border border-white/5 bg-black/20 px-4 py-3 text-xs text-text-muted/80">
            Admins verify each voter ID once and permanently link it to a wallet
            address. Eligibility can be toggled by admin only.
          </div>
        </Panel>
      </section>

      <section className="space-y-5">
        <Panel className="space-y-5 border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-[0.25em] text-text-muted">
                Choose Voting Channel
              </div>
              <div className="text-lg font-semibold text-white">
                {votingMode === "online"
                  ? "Online mode selected. Offline section is hidden."
                  : "Offline booth mode selected."}
              </div>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 p-1">
              <button
                className={`rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                  votingMode === "online"
                    ? "bg-neon-blue/20 text-neon-blue"
                    : "text-text-muted hover:text-white"
                }`}
                onClick={() => setVotingMode("online")}
                type="button"
              >
                Online voting
              </button>
              <button
                className={`rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                  votingMode === "offline"
                    ? "bg-neon-purple/20 text-neon-purple"
                    : "text-text-muted hover:text-white"
                }`}
                onClick={() => setVotingMode("offline")}
                type="button"
              >
                Offline booth
              </button>
            </div>
          </div>

          {votingMode === "online" ? (
            <div className="grid gap-4 md:grid-cols-1">
              <div className="rounded-2xl border border-neon-blue/50 bg-neon-blue/10 p-4 transition">
                <div className="text-sm font-semibold text-white">Online voting</div>
                <p className="mt-2 text-sm text-text-muted">
                  Register, complete KYC, connect wallet, and cast vote through the DApp.
                </p>
                <div className="mt-4">
                  <Link to={onlinePath}>
                    <Button variant="outline">Continue online</Button>
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-1">
              <div className="rounded-2xl border border-neon-purple/50 bg-neon-purple/10 p-4 transition">
                <div className="text-sm font-semibold text-white">Offline booth voting</div>
                <p className="mt-2 text-sm text-text-muted">
                  Use the same NID and DOB from online profile, link RFID, complete officer attestation, then vote.
                </p>
                <div className="mt-4">
                  <Link to="/offline">
                    <Button variant="outline">Open offline console</Button>
                  </Link>
                </div>
              </div>
            </div>
          )}
        </Panel>
      </section>

      {/* Features Grid */}
      <section className="space-y-12">
        <div className="text-center space-y-4">
          <h2 className="text-3xl font-display font-bold text-white">Uncompromised Security</h2>
          <p className="text-text-muted max-w-2xl mx-auto">
            Built on the principles of zero-trust architecture and cryptographic verification.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              title: "Identity Integrity",
              desc: "Government-issued IDs are verified off-chain to ensure one-person-one-vote without exposing personal data on-chain.",
              gradient: "from-neon-blue/20 to-transparent"
            },
            {
              title: "Zero-Knowledge Privacy",
              desc: "Your vote is cryptographically decoupled from your identity. Administrators can verify eligibility, but never your choice.",
              gradient: "from-neon-purple/20 to-transparent"
            },
            {
              title: "Immutable Ledger",
              desc: "Every vote is a transaction on the Sepolia network. Results are auditable by anyone, anywhere, forever.",
              gradient: "from-neon-green/20 to-transparent"
            }
          ].map((feature, i) => (
            <div key={i} className="glass p-8 rounded-2xl relative overflow-hidden group hover:-translate-y-2 transition-transform duration-300">
              <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
              <div className="relative z-10 space-y-4">
                <h3 className="text-xl font-bold text-white">{feature.title}</h3>
                <p className="text-text-muted leading-relaxed">
                  {feature.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Tech Stack / Hybrid Architecture */}
      <section className="grid gap-12 lg:grid-cols-2 items-center">
        <div className="space-y-6">
          <div className="inline-block rounded-full bg-neon-purple/10 px-3 py-1 text-xs font-bold text-neon-purple border border-neon-purple/20">
            HYBRID ARCHITECTURE
          </div>
          <h2 className="text-3xl font-display font-bold text-white">
            The best of both worlds.
          </h2>
          <p className="text-text-muted text-lg leading-relaxed">
            We combine the speed and privacy of traditional web servers with the trustlessness of public blockchains.
          </p>
          <ul className="space-y-4">
            {[
              "Off-chain KYC processing for speed and privacy",
              "On-chain voting for transparency and immutability",
              "Relayer system to pay gas fees for voters"
            ].map((item, i) => (
              <li key={i} className="flex items-center gap-3 text-text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-neon-blue" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <Panel className="glass min-h-[300px] flex items-center justify-center border-white/5 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-tr from-neon-blue/10 via-transparent to-neon-purple/10" />
          <div className="relative z-10 flex flex-col items-center gap-4 text-center px-6">
            <img
              src="/branding/vertic.png"
              alt="Hybrid architecture diagram"
              className="w-full max-w-[360px] max-h-[240px] object-contain drop-shadow-[0_10px_40px_rgba(0,0,0,0.35)]"
            />
            <div className="text-sm font-mono text-neon-blue">VoteHybrid Protocol v1.0</div>
          </div>
        </Panel>
      </section>

      {/* Call to Action */}
      <section className="relative rounded-3xl overflow-hidden glass border-white/10 p-12 text-center space-y-6">
        <div className="absolute inset-0 bg-gradient-to-r from-neon-purple/20 via-transparent to-neon-blue/20 opacity-50" />
        <div className="relative z-10 max-w-2xl mx-auto space-y-6">
          <h2 className="text-3xl font-display font-bold text-white">Ready to cast your vote?</h2>
          <p className="text-text-muted">
            Join the decentralized future of democratic elections. Registration takes less than 2 minutes.
          </p>
          <div className="flex justify-center gap-4">
            <Link to={primaryPath}>
              <Button className="px-8 py-3 text-base shadow-neon hover:shadow-neonBlue/50 transition-shadow">
                {votingMode === "online" ? "Register Now" : "Open Offline Console"}
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

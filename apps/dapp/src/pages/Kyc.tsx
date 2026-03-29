import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/Button";
import { PageHeader } from "../components/PageHeader";
import { Panel } from "../components/Panel";
import { StatusBanner } from "../components/StatusBanner";
import { useAuth } from "../context/AuthContext";

export function Kyc() {
  const { user, submitKyc, error, isLoading } = useAuth();
  const [documentType, setDocumentType] = useState("National ID");
  const [file, setFile] = useState<File | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) return;
    await submitKyc({ documentType, file });
    setSubmitted(true);
  };

  return (
    <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] animate-fadeUp">
      <div className="space-y-6">
        <PageHeader
          kicker="KYC"
          title="Verify your identity"
          subtitle="Upload a valid ID so the admin can verify your eligibility."
        />

        {!user ? (
          <StatusBanner
            tone="warning"
            title="Login required"
            message="Create an account or log in before submitting KYC."
          />
        ) : null}

        {error ? <StatusBanner tone="error" title="KYC error" message={error} /> : null}

        {user?.kycStatus === "APPROVED" ? (
          <StatusBanner
            tone="success"
            title="KYC approved"
            message="Your identity is verified. Link your wallet and vote."
          />
        ) : null}

        {submitted && user?.kycStatus === "PENDING" ? (
          <StatusBanner
            tone="info"
            title="Submission received"
            message="Please wait for the admin to approve your KYC."
          />
        ) : null}

        {user?.kycStatus === "PENDING" ? (
          <StatusBanner
            tone="info"
            title="KYC pending"
            message="Your document is under review. Please wait for admin approval."
          />
        ) : null}

        {user?.kycStatus === "REJECTED" ? (
          <StatusBanner
            tone="warning"
            title="KYC rejected"
            message="Please upload a clearer document or correct ID type."
          />
        ) : null}

        {user && user.kycStatus !== "APPROVED" ? (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-ink">Document type</label>
              <select
                className="w-full rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-neon-blue/60 focus:outline-none focus:ring-2 focus:ring-neon-blue/30"
                value={documentType}
                onChange={(event) => setDocumentType(event.target.value)}
              >
                <option>National ID</option>
                <option>Passport</option>
                <option>Driver License</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-ink">Upload document</label>
              <input
                className="w-full rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-neon-blue/60 focus:outline-none focus:ring-2 focus:ring-neon-blue/30"
                type="file"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
                accept="image/*,application/pdf"
                required
              />
            </div>
            <Button type="submit" isLoading={isLoading} disabled={!file}>
              Submit for verification
            </Button>
          </form>
        ) : null}
      </div>

      <Panel className="space-y-4">
        <div className="text-xs font-semibold uppercase tracking-[0.3em] text-ink/50">
          Next steps
        </div>
        <ol className="space-y-3 text-sm text-ink/70">
          <li>1) Admin reviews your ID document.</li>
          <li>2) Admin assigns and funds your wallet.</li>
          <li>3) You can then vote on-chain.</li>
        </ol>
        <div className="pt-2 text-sm text-ink/70">
          <Link className="text-coral font-semibold" to="/connect">
            Go to wallet status
          </Link>
        </div>
      </Panel>
    </section>
  );
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import { PageHeader } from "../components/PageHeader";
import { Panel } from "../components/Panel";
import { StatusBanner } from "../components/StatusBanner";
import { useAuth } from "../context/AuthContext";
import {
  MAX_DOB,
  MIN_DOB,
  normalizeNidInput,
  validateDob,
  validateNid,
} from "../utils/validation";

export function Login() {
  const navigate = useNavigate();
  const { login, error, isLoading } = useAuth();
  const [nid, setNid] = useState("");
  const [dob, setDob] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedNid = normalizeNidInput(nid);
    const nextError = validateNid(normalizedNid) ?? validateDob(dob);
    setNid(normalizedNid);
    if (nextError) {
      setValidationError(nextError);
      return;
    }

    setValidationError(null);
    try {
      await login({ nid: normalizedNid, dob });
      navigate("/kyc");
    } catch {
      // Auth context already surfaces the API error.
    }
  };

  const formError = validationError ?? error;

  return (
    <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] animate-fadeUp">
      <div className="space-y-6">
        <PageHeader
          kicker="Account"
          title="Welcome back"
          subtitle="Log in with your NID and date of birth to continue."
        />

        {formError ? (
          <StatusBanner tone="error" title="Login error" message={formError} />
        ) : null}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-ink">NID card number</label>
            <input
              className="w-full rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-neon-blue/60 focus:outline-none focus:ring-2 focus:ring-neon-blue/30"
              value={nid}
              onChange={(event) => {
                setValidationError(null);
                setNid(normalizeNidInput(event.target.value));
              }}
              placeholder="Enter your 10-digit NID number"
              inputMode="numeric"
              maxLength={10}
              minLength={10}
              pattern="[0-9]{10}"
              required
            />
            <p className="text-xs text-ink/60">Use exactly 10 digits.</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-ink">Date of birth</label>
            <input
              className="w-full rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-neon-blue/60 focus:outline-none focus:ring-2 focus:ring-neon-blue/30"
              value={dob}
              onChange={(event) => {
                setValidationError(null);
                setDob(event.target.value);
              }}
              type="date"
              min={MIN_DOB}
              max={MAX_DOB}
              autoComplete="bday"
              required
            />
          </div>
          <Button type="submit" isLoading={isLoading}>
            Log in
          </Button>
        </form>
      </div>

      <Panel className="space-y-4">
        <div className="text-xs font-semibold uppercase tracking-[0.3em] text-ink/50">
          Secure access
        </div>
        <p className="text-sm text-ink/70">
          Your account manages KYC status while your wallet handles voting on-chain.
          Both are required before you can vote.
        </p>
      </Panel>
    </section>
  );
}

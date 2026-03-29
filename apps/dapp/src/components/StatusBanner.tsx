type StatusBannerProps = {
  tone?: "info" | "success" | "warning" | "error";
  title: string;
  message: string;
};

const tones = {
  info: "border-sky/30 bg-sky/10 text-ink",
  success: "border-mint/40 bg-mint/10 text-ink",
  warning: "border-gold/40 bg-gold/10 text-ink",
  error: "border-coral/40 bg-coral/10 text-ink",
};

export function StatusBanner({
  tone = "info",
  title,
  message,
}: StatusBannerProps) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3 text-sm shadow-sm ${tones[tone]}`}
    >
      <div className="font-semibold">{title}</div>
      <div className="text-ink/70">{message}</div>
    </div>
  );
}

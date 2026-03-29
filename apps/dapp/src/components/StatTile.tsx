type StatTileProps = {
  label: string;
  value: string;
};

export function StatTile({ label, value }: StatTileProps) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/5 backdrop-blur px-4 py-3 shadow-lg transition-all hover:-translate-y-1 hover:bg-white/10 hover:border-neon-blue/30 hover:shadow-neonBlue/20 group">
      <div className="text-xs uppercase tracking-[0.25em] text-text-muted transition-colors group-hover:text-neon-blue">
        {label}
      </div>
      <div className="text-lg font-semibold text-text-main group-hover:text-white transition-colors">{value}</div>
    </div>
  );
}

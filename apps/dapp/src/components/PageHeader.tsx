type PageHeaderProps = {
  title: string;
  subtitle: string;
  kicker?: string;
};

export function PageHeader({ title, subtitle, kicker }: PageHeaderProps) {
  return (
    <div className="space-y-2">
      {kicker ? (
        <div className="text-xs font-semibold uppercase tracking-[0.3em] text-ink/50">
          {kicker}
        </div>
      ) : null}
      <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">
        {title}
      </h1>
      <p className="text-base text-ink/70">{subtitle}</p>
    </div>
  );
}

import { PageHeader } from "../components/PageHeader";
import { Panel } from "../components/Panel";
import { StatTile } from "../components/StatTile";

export type InfoSection = {
  title: string;
  body: string[];
};

export type InfoPageContent = {
  path: string;
  title: string;
  kicker?: string;
  subtitle: string;
  intro?: string;
  highlights?: { label: string; value: string }[];
  sections: InfoSection[];
};

type InfoPageProps = {
  content: InfoPageContent;
};

export function InfoPage({ content }: InfoPageProps) {
  const { title, kicker, subtitle, intro, highlights, sections } = content;

  return (
    <div className="space-y-16">
      <section className="space-y-6">
        <PageHeader kicker={kicker} title={title} subtitle={subtitle} />
        {intro ? (
          <p className="text-text-muted text-lg leading-relaxed">{intro}</p>
        ) : null}
        {highlights ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {highlights.map((item) => (
              <StatTile key={item.label} label={item.label} value={item.value} />
            ))}
          </div>
        ) : null}
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        {sections.map((section) => (
          <Panel key={section.title} className="space-y-3">
            <h2 className="text-lg font-semibold text-white">{section.title}</h2>
            <ul className="space-y-2 text-sm text-text-muted">
              {section.body.map((line) => (
                <li key={line} className="flex items-start gap-3">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-neon-blue" />
                  {line}
                </li>
              ))}
            </ul>
          </Panel>
        ))}
      </section>
    </div>
  );
}

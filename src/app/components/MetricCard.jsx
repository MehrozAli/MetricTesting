const FIELDS = [
  ["description", "Definition"],
  ["calculations", "Calculation"],
  ["recordedBy", "Recorded by"],
  ["sources", "Comes through"],
  ["importance", "Why it matters"],
];

export default function MetricCard({ metric }) {
  const values = { ...metric, sources: metric.sources?.join(", ") };
  const shown = FIELDS.filter(([key]) => values[key]);

  return (
    <article className="rounded-md border border-line border-l-4 border-l-teal bg-card p-5 sm:p-6">
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-serif text-xl font-semibold text-ink">{metric.title}</h3>
        {metric.id && (
          <span className="font-mono text-xs tracking-wide text-muted">{metric.id}</span>
        )}
      </header>
      <dl className="grid gap-4 sm:grid-cols-[9rem_1fr] sm:gap-x-6 sm:gap-y-3">
        {shown.map(([key, label]) => (
          <div key={key} className="contents">
            <dt className="text-xs font-semibold uppercase tracking-wider text-clay sm:pt-0.5">
              {label}
            </dt>
            <dd className="-mt-3 text-[0.95rem] leading-relaxed text-ink sm:mt-0">
              {values[key]}
            </dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

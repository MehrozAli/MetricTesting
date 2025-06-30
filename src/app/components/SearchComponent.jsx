"use client";

import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import MetricCard from "./MetricCard";
import { readEventStream } from "@/lib/readEventStream";

const EXAMPLE_QUESTIONS = [
  "Created Leads",
  "How is the scheduled to toured ratio calculated?",
  "Why are leased prospects important?",
];

const markdownComponents = {
  p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-teal">{children}</strong>,
  ul: ({ children }) => <ul className="mb-3 ml-5 list-disc space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="mb-3 ml-5 list-decimal space-y-1">{children}</ol>,
  h3: ({ children }) => <h3 className="mb-2 font-serif text-lg font-semibold">{children}</h3>,
  h4: ({ children }) => <h4 className="mb-2 font-semibold">{children}</h4>,
};

export default function SearchComponent() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("idle");
  const [answer, setAnswer] = useState("");
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState(null);
  const activeRequest = useRef(null);

  const runSearch = async (searchTerm) => {
    const question = searchTerm.trim();
    if (!question) return;

    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;

    setStatus("searching");
    setError(null);
    setAnswer("");
    setMetrics(null);

    try {
      const response = await fetch("/api/notion/database", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: question, prefetch_limit: 15 }),
        signal: controller.signal,
      });
      const contentType = response.headers.get("content-type") ?? "";

      if (!response.ok) {
        const details = contentType.includes("application/json")
          ? await response.json()
          : null;
        throw new Error(details?.error || `Search failed (${response.status})`);
      }

      if (contentType.includes("application/json")) {
        const data = await response.json();
        setMetrics(data.retrievedMetrics ?? []);
        setStatus("done");
        return;
      }

      setStatus("streaming");
      let accumulated = "";
      for await (const event of readEventStream(response.body)) {
        if (event.type === "content") {
          accumulated += event.content;
          setAnswer(accumulated);
        } else if (event.type === "error") {
          throw new Error(event.message);
        }
      }
      setStatus("done");
    } catch (err) {
      if (err.name === "AbortError") return;
      setError(err.message || "Search failed");
      setStatus("failed");
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    runSearch(query);
  };

  const askExample = (example) => {
    setQuery(example);
    runSearch(example);
  };

  const busy = status === "searching" || status === "streaming";

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-clay">
          Leasing metrics reference
        </p>
        <h1 className="font-serif text-3xl font-semibold text-ink sm:text-4xl">Metric Lookup</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Ask what a metric means, how it is calculated or why it matters. Answers come only
          from the metric catalogue.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="mb-8" role="search">
        <label htmlFor="metric-query" className="mb-2 block text-sm font-medium text-ink">
          Ask about a metric
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="metric-query"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. How are tours recorded?"
            maxLength={500}
            autoComplete="off"
            className="min-w-0 flex-1 rounded-md border border-line bg-card px-4 py-3 text-ink placeholder:text-muted"
          />
          <button
            type="submit"
            disabled={busy || !query.trim()}
            className="rounded-md bg-teal px-6 py-3 font-semibold text-paper transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Search
          </button>
        </div>
      </form>

      {status === "idle" && (
        <section aria-labelledby="examples-heading" className="rounded-md border border-dashed border-line p-5">
          <h2 id="examples-heading" className="mb-3 text-sm font-medium text-muted">
            Not sure where to start? Try one of these:
          </h2>
          <ul className="flex flex-wrap gap-2">
            {EXAMPLE_QUESTIONS.map((example) => (
              <li key={example}>
                <button
                  type="button"
                  onClick={() => askExample(example)}
                  className="rounded-full border border-line bg-card px-4 py-2 text-sm text-teal hover:border-teal"
                >
                  {example}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div role="status" aria-live="polite" className="sr-only">
        {status === "searching" ? "Searching the metric catalogue" : ""}
        {status === "done" && metrics ? `${metrics.length} matching metrics` : ""}
      </div>

      {status === "searching" && (
        <div className="flex items-center gap-3 text-muted" aria-hidden="true">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-teal" />
          Searching the metric catalogue…
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-md border border-danger/40 bg-danger-bg px-4 py-3 text-danger">
          {error}
        </div>
      )}

      {answer && (
        <section aria-labelledby="answer-heading" aria-busy={status === "streaming"} className="mb-8">
          <h2 id="answer-heading" className="mb-3 font-serif text-xl font-semibold">
            Answer
          </h2>
          <div className="rounded-md border border-line bg-teal-soft px-5 py-4 leading-relaxed text-ink">
            <ReactMarkdown components={markdownComponents}>{answer}</ReactMarkdown>
          </div>
        </section>
      )}

      {metrics && metrics.length === 0 && (
        <p className="text-muted">No metric in the catalogue matched that question. Try the metric&apos;s name.</p>
      )}

      {metrics?.length > 0 && (
        <section aria-labelledby="metrics-heading">
          <h2 id="metrics-heading" className="mb-4 font-serif text-xl font-semibold">
            {metrics.length === 1 ? "Matching metric" : `Matching metrics (${metrics.length})`}
          </h2>
          <ul className="grid gap-5">
            {metrics.map((metric, index) => (
              <li key={metric.id || index}>
                <MetricCard metric={metric} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

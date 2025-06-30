import { describe, expect, it } from "vitest";
import { buildLlmContext, selectAnsweredMetrics, toMetricCard } from "@/lib/metrics";
import { createdLeads, tours } from "./fixtures/metrics";

describe("toMetricCard", () => {
  it("prefers the m_ fields and wraps sources in a list", () => {
    expect(toMetricCard(createdLeads)).toEqual({
      id: "MET-001",
      title: "Created Leads",
      description: "New prospects entered into the CRM during the period.",
      calculations: "Count of lead records with a created date in the period.",
      recordedBy: "Leasing agents and web forms",
      importance: "Top-of-funnel demand signal.",
      sources: ["Website, phone, walk-in"],
      score: 0.92,
    });
  });

  it("falls back to the plain column names", () => {
    const card = toMetricCard(tours);
    expect(card.description).toBe("Property visits completed by a prospect.");
    expect(card.calculations).toBe("Count of completed tour appointments.");
    expect(card.sources).toEqual([]);
  });
});

describe("buildLlmContext", () => {
  it("lists filled fields per metric and separates metrics", () => {
    const context = buildLlmContext([createdLeads, tours]);
    const [first, second] = context.split("\n---\n");
    expect(first).toContain("Metric: Created Leads\n");
    expect(first).toContain("Value Type: Count\n");
    expect(first).toContain("Sources: Website, phone, walk-in\n");
    expect(second).toContain("Metric: Tours\n");
    expect(second).toContain("Data Sources: N/A\n");
    expect(second).not.toContain("Importance");
  });
});

describe("selectAnsweredMetrics", () => {
  it("returns the metrics the model named, in its order", () => {
    const cards = selectAnsweredMetrics([createdLeads, tours], {
      metrics: [{ id: "MET-002" }, { id: "MET-001" }, { id: "MET-002" }],
    });
    expect(cards.map((card) => card.title)).toEqual(["Tours", "Created Leads"]);
  });

  it("falls back to the best hit when the named ids were not retrieved", () => {
    const cards = selectAnsweredMetrics([createdLeads, tours], { metrics: [{ id: "nope" }] });
    expect(cards.map((card) => card.id)).toEqual(["MET-001"]);
  });
});

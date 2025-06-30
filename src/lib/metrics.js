function sourcesOf(payload) {
  return payload["m_They Come Through"] ? [payload["m_They Come Through"]] : [];
}

// Fields shown on a metric card in the UI.
export function toMetricCard(point) {
  const payload = point.payload ?? {};
  return {
    id: payload["UID"] || "",
    title: payload["Business Name"] || "",
    description: payload["m_Definition"] || payload["Definition"] || "",
    calculations: payload["m_Calculation"] || payload["Calculations"] || "",
    recordedBy: payload["m_Recorded By"] || "",
    importance: payload["Importance"] || "",
    sources: sourcesOf(payload),
    score: point.score,
  };
}

// Plain-text context handed to the model; empty fields are left out.
export function buildLlmContext(points) {
  return points
    .map(({ payload = {} }) => {
      const fields = [
        ["Metric", payload["Business Name"]],
        ["Definition", payload["m_Definition"] || payload["Definition"]],
        ["Calculations", payload["m_Calculation"] || payload["Calculations"]],
        ["Recorded By", payload["m_Recorded By"]],
        ["Sources", sourcesOf(payload).join(", ")],
        ["Value Type", payload["Value Type"]],
        ["Performance Indicator", payload["Performance Indicator"]],
        ["Data Sources", payload["Data Sources"] || "N/A"],
        ["Aggregation Type", payload["Aggregation Type"]],
        ["Importance", payload["Importance"]],
        ["Aliases", payload["Aliases"]],
      ];
      return fields
        .filter(([, value]) => value)
        .map(([label, value]) => `${label}: ${value}\n`)
        .join("");
    })
    .join("\n---\n");
}

// The model names the metric(s) the question is about; show those cards in
// its order, or the best search hit if it named none we retrieved.
export function selectAnsweredMetrics(points, directResponse) {
  const cards = points.map(toMetricCard);
  const byId = new Map(cards.filter((card) => card.id).map((card) => [card.id, card]));
  const chosen = (directResponse.metrics ?? [])
    .map((metric) => byId.get(metric?.id))
    .filter(Boolean);
  const unique = [...new Set(chosen)];
  return unique.length > 0 ? unique : cards.slice(0, 1);
}

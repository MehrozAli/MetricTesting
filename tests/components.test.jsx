// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MetricCard from "@/app/components/MetricCard";
import SearchComponent from "@/app/components/SearchComponent";

const card = {
  id: "MET-001",
  title: "Created Leads",
  description: "New prospects entered into the CRM during the period.",
  calculations: "Count of lead records created in the period.",
  recordedBy: "",
  importance: "Top-of-funnel demand signal.",
  sources: ["Website", "Phone"],
};

function jsonReply(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function streamReply(events) {
  const text = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("");
  return new Response(text, { headers: { "Content-Type": "text/event-stream" } });
}

async function search(text) {
  fireEvent.change(screen.getByLabelText(/ask about a metric/i), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: /^search$/i }));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("MetricCard", () => {
  it("shows the filled fields and skips empty ones", () => {
    render(<MetricCard metric={card} />);
    expect(screen.getByRole("heading", { name: "Created Leads" })).toBeTruthy();
    expect(screen.getByText(card.description)).toBeTruthy();
    expect(screen.getByText("Website, Phone")).toBeTruthy();
    expect(screen.getByText("MET-001")).toBeTruthy();
    expect(screen.queryByText("Recorded by")).toBeNull();
  });
});

describe("SearchComponent", () => {
  it("keeps the search button disabled until there is a query", () => {
    render(<SearchComponent />);
    const button = screen.getByRole("button", { name: /^search$/i });
    expect(button.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/ask about a metric/i), { target: { value: "tours" } });
    expect(button.disabled).toBe(false);
  });

  it("posts the query and renders metric cards from a direct response", async () => {
    const fetchMock = vi.fn(async () =>
      jsonReply({ searchType: "direct_response", retrievedMetrics: [card] })
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<SearchComponent />);
    await search("Created Leads");

    expect(await screen.findByRole("heading", { name: "Created Leads" })).toBeTruthy();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/notion/database");
    expect(JSON.parse(init.body)).toEqual({ query: "Created Leads", prefetch_limit: 15 });
  });

  it("renders a streamed markdown answer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        streamReply([
          { type: "metadata", resultCount: 2 },
          { type: "content", content: "**Tours** count completed" },
          { type: "content", content: " property visits." },
          { type: "done", retrievedMetrics: [] },
        ])
      )
    );
    render(<SearchComponent />);
    await search("How are tours counted?");

    const strong = await screen.findByText("Tours");
    expect(strong.tagName).toBe("STRONG");
    expect(screen.getByText(/count completed property visits\./)).toBeTruthy();
  });

  it("shows the server's error message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonReply({ success: false, error: "Search is not configured" }, 503))
    );
    render(<SearchComponent />);
    await search("tours");
    expect((await screen.findByRole("alert")).textContent).toBe("Search is not configured");
  });

  it("runs an example question from the empty state", async () => {
    const fetchMock = vi.fn(async () => jsonReply({ retrievedMetrics: [] }));
    vi.stubGlobal("fetch", fetchMock);
    render(<SearchComponent />);
    fireEvent.click(screen.getByRole("button", { name: "Created Leads" }));

    expect(await screen.findByText(/No metric in the catalogue matched/)).toBeTruthy();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).query).toBe("Created Leads");
    expect(screen.getByLabelText(/ask about a metric/i).value).toBe("Created Leads");
  });

  it("shows an error when the answer stream is interrupted", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        streamReply([
          { type: "content", content: "Partial" },
          { type: "error", message: "The answer was interrupted. Please try again." },
        ])
      )
    );
    render(<SearchComponent />);
    await search("tours");
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toMatch(/answer was interrupted/)
    );
  });
});

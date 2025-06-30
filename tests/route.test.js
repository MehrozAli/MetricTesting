import { beforeEach, describe, expect, it, vi } from "vitest";
import { readEventStream } from "@/lib/readEventStream";
import { DEFAULT_SYSTEM_PROMPT } from "@/lib/systemPrompt";
import { fakeClients, fakeCompletion } from "./fakes";
import { createdLeads, tours, VOCABULARY } from "./fixtures/metrics";

let clients;
vi.mock("@/lib/clients", () => ({ createClients: () => clients }));

const ENV = {
  OPENAI_API_KEY: "test-openai-key",
  QDRANT_URL: "http://qdrant.test:6333",
  QDRANT_COLLECTION: "demo_metrics",
};

async function loadRoute() {
  vi.resetModules();
  return import("@/app/api/notion/database/route");
}

function post(body) {
  return new Request("http://localhost/api/notion/database", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function events(response) {
  const all = [];
  for await (const event of readEventStream(response.body)) all.push(event);
  return all;
}

beforeEach(() => {
  vi.unstubAllEnvs();
  Object.entries(ENV).forEach(([name, value]) => vi.stubEnv(name, value));
  vi.stubEnv("NOTION_API_KEY", "");
  vi.stubEnv("NOTION_PROMPT_PAGE_ID", "");
  vi.spyOn(console, "error").mockImplementation(() => {});
  clients = fakeClients({
    points: [createdLeads, tours],
    vocabulary: VOCABULARY,
    answer: ["**Created Leads** are new", " prospects."],
  });
});

describe("POST /api/notion/database: validation", () => {
  it.each([
    ["invalid JSON", "{nope", /valid JSON/],
    ["missing query", {}, /non-empty string/],
    ["blank query", { query: "   " }, /non-empty string/],
    ["oversized query", { query: "x".repeat(501) }, /at most 500/],
  ])("rejects %s with 400", async (_, body, message) => {
    const { POST } = await loadRoute();
    const response = await POST(post(body));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(message);
    expect(clients.qdrant.query).not.toHaveBeenCalled();
  });

  it("returns 503 naming missing settings without calling any service", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const { POST } = await loadRoute();
    const response = await POST(post({ query: "tours" }));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ missing: ["OPENAI_API_KEY"] });
    expect(clients.openai.embeddings.create).not.toHaveBeenCalled();
  });

  it("returns 404 when the collection does not exist", async () => {
    clients = fakeClients({ exists: false });
    const { POST } = await loadRoute();
    const response = await POST(post({ query: "tours" }));
    expect(response.status).toBe(404);
    expect((await response.json()).error).toBe("Collection 'demo_metrics' not found");
  });
});

describe("POST /api/notion/database: search", () => {
  it("runs a weighted RRF hybrid query with dense and sparse prefetches", async () => {
    const { POST } = await loadRoute();
    await POST(post({ query: "  Created Leads ", prefetch_limit: 500 }));

    expect(clients.openai.embeddings.create).toHaveBeenCalledWith({
      model: "text-embedding-3-small",
      input: "Created Leads",
    });
    const [collection, request] = clients.qdrant.query.mock.calls[0];
    expect(collection).toBe("demo_metrics");
    expect(request.query).toEqual({ rrf: { weights: [0.8, 0.2] } });
    expect(request.limit).toBe(10);
    const [dense, sparse] = request.prefetch;
    expect(dense).toEqual({ query: [0.1, 0.2, 0.3], using: "dense", limit: 50 });
    expect(sparse.using).toBe("sparse");
    expect(sparse.query.indices).toEqual([0, 1, 2]);
  });

  it("streams a prose answer as server-sent events from a single model call", async () => {
    const { POST } = await loadRoute();
    const response = await POST(post({ query: "Why do created leads matter?" }));

    expect(response.headers.get("content-type")).toBe("text/event-stream");
    const all = await events(response);
    expect(all[0]).toMatchObject({ type: "metadata", resultCount: 2, fusionType: "rrf" });
    expect(all.filter((e) => e.type === "content").map((e) => e.content).join("")).toBe(
      "**Created Leads** are new prospects."
    );
    expect(all.at(-1)).toEqual({
      type: "done",
      retrievedMetrics: [
        { id: "MET-001", title: "Created Leads", score: 0.92 },
        { id: "MET-002", title: "Tours", score: 0.41 },
      ],
    });
    expect(clients.openai.chat.completions.create).toHaveBeenCalledTimes(1);

    const [{ messages, stream }] = clients.openai.chat.completions.create.mock.calls[0];
    expect(stream).toBe(true);
    expect(messages[0]).toEqual({ role: "system", content: DEFAULT_SYSTEM_PROMPT });
    expect(messages[1].content).toContain("Metric: Created Leads");
  });

  it("returns JSON cards for the metrics named in a direct response", async () => {
    clients = fakeClients({
      points: [createdLeads, tours],
      answer: ['```json\n{"directResponse": true, "metrics": [{"id": "MET-002"}]}\n```'],
    });
    const { POST } = await loadRoute();
    const response = await POST(post({ query: "Tours" }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.searchType).toBe("direct_response");
    expect(body.retrievedMetrics).toHaveLength(1);
    expect(body.retrievedMetrics[0]).toMatchObject({ id: "MET-002", title: "Tours" });
  });

  it("ends the stream with an error event when the model connection drops", async () => {
    const { POST } = await loadRoute();
    clients.openai.chat.completions.create.mockResolvedValueOnce(
      fakeCompletion(["Created leads", " are", " new"], { failAfter: 2 })
    );
    const all = await events(await POST(post({ query: "how are leads counted" })));
    expect(all.at(-1)).toEqual({
      type: "error",
      message: "The answer was interrupted. Please try again.",
    });
  });

  it("hides internal errors behind a generic 500", async () => {
    clients.qdrant.query.mockRejectedValueOnce(new Error("upstream secret detail"));
    const { POST } = await loadRoute();
    const response = await POST(post({ query: "tours" }));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("secret");
  });
});

describe("system prompt and caching", () => {
  it("uses the first JavaScript code block on the Notion prompt page", async () => {
    vi.stubEnv("NOTION_API_KEY", "test-notion-key");
    vi.stubEnv("NOTION_PROMPT_PAGE_ID", "demo-page");
    clients = fakeClients({
      points: [tours],
      answer: ["ok"],
      promptBlocks: [
        { type: "paragraph", paragraph: {} },
        { type: "code", code: { language: "python", rich_text: [{ plain_text: "no" }] } },
        { type: "code", code: { language: "javascript", rich_text: [{ plain_text: "Be " }, { plain_text: "brief." }] } },
      ],
    });
    const { POST } = await loadRoute();
    await events(await POST(post({ query: "tours" })));
    await events(await POST(post({ query: "tours again" })));

    const { messages } = clients.openai.chat.completions.create.mock.calls[1][0];
    expect(messages[0].content).toBe("Be brief.");
    expect(clients.notion.blocks.children.list).toHaveBeenCalledTimes(1);
    expect(clients.notion.blocks.children.list).toHaveBeenCalledWith({ block_id: "demo-page", page_size: 100 });
    expect(clients.qdrant.retrieve).toHaveBeenCalledTimes(1);
  });
});

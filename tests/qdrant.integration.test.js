// Runs only when QDRANT_TEST_URL points at a disposable Qdrant, e.g.
//   docker run --rm -p 6333:6333 qdrant/qdrant
//   QDRANT_TEST_URL=http://localhost:6333 npm test
// Embeddings come from a fake OpenAI client; no API key is used.
import { QdrantClient } from "@qdrant/js-client-rest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createMetricSearch, VOCABULARY_POINT_ID } from "@/lib/metricSearch";
import { createSparseVector } from "@/lib/sparse";
import { fakeClients } from "./fakes";
import { createdLeads, tours, VOCABULARY } from "./fixtures/metrics";

const url = process.env.QDRANT_TEST_URL;
const collection = `metric_test_${Date.now()}`;

describe.skipIf(!url)("hybrid search against a real Qdrant", () => {
  const qdrant = new QdrantClient({ url, checkCompatibility: false });
  const { openai } = fakeClients();
  openai.embeddings.create.mockResolvedValue({ data: [{ embedding: [1, 0, 0] }] });

  beforeAll(async () => {
    await qdrant.createCollection(collection, {
      vectors: { dense: { size: 3, distance: "Cosine" } },
      sparse_vectors: { sparse: {} },
    });
    const point = (fixture, dense) => ({
      id: fixture.id,
      vector: { dense, sparse: createSparseVector(fixture.payload["Business Name"], VOCABULARY) },
      payload: fixture.payload,
    });
    await qdrant.upsert(collection, {
      wait: true,
      points: [
        { id: VOCABULARY_POINT_ID, vector: {}, payload: { vocabulary: VOCABULARY } },
        point(createdLeads, [1, 0.1, 0]),
        point(tours, [0, 1, 0]),
      ],
    });
  });

  afterAll(async () => {
    await qdrant.deleteCollection(collection);
  });

  it("finds the collection and ranks the metric matching both vectors first", async () => {
    const search = createMetricSearch({ openai, qdrant, notion: null }, { collection, embeddingModel: "fake" });
    expect(await search.collectionExists()).toBe(true);

    const points = await search.hybridSearch("created leads", { limit: 5, prefetchLimit: 5 });
    expect(points[0].payload.UID).toBe("MET-001");
    expect(points.map((p) => p.id)).not.toContain(VOCABULARY_POINT_ID);
  });
});

import { createSparseVector } from "./sparse";
import { DEFAULT_SYSTEM_PROMPT } from "./systemPrompt";
import { cacheFor } from "./ttlCache";

// Reserved point that stores the token -> sparse index map written at ingest.
export const VOCABULARY_POINT_ID = "00000000-0000-0000-0000-000000000000";
const CACHE_TTL_MS = 5 * 60 * 1000;
const RRF_WEIGHTS = [0.8, 0.2];

export function createMetricSearch({ openai, qdrant, notion }, config) {
  const { collection } = config;

  const loadVocabulary = cacheFor(CACHE_TTL_MS, async () => {
    const [point] = await qdrant.retrieve(collection, {
      ids: [VOCABULARY_POINT_ID],
      with_payload: true,
    });
    return point?.payload?.vocabulary ?? {};
  });

  const loadSystemPrompt = cacheFor(CACHE_TTL_MS, async () => {
    if (!notion) return DEFAULT_SYSTEM_PROMPT;
    const { results } = await notion.blocks.children.list({
      block_id: config.notionPromptPageId,
      page_size: 100,
    });
    const block = results.find(
      (b) => b.type === "code" && ["javascript", "js"].includes(b.code.language)
    );
    const prompt = block?.code.rich_text.map((t) => t.plain_text).join("");
    return prompt || DEFAULT_SYSTEM_PROMPT;
  });

  async function collectionExists() {
    const { exists } = await qdrant.collectionExists(collection);
    return exists;
  }

  async function hybridSearch(query, { limit = 10, prefetchLimit = 15 } = {}) {
    const [vocabulary, embedding] = await Promise.all([
      loadVocabulary(),
      openai.embeddings.create({ model: config.embeddingModel, input: query }),
    ]);

    const { points } = await qdrant.query(collection, {
      prefetch: [
        { query: embedding.data[0].embedding, using: "dense", limit: prefetchLimit },
        { query: createSparseVector(query, vocabulary), using: "sparse", limit: prefetchLimit },
      ],
      query: { rrf: { weights: RRF_WEIGHTS } },
      limit,
      with_payload: true,
    });
    return points.filter((point) => point.id !== VOCABULARY_POINT_ID);
  }

  async function streamAnswer(query, context) {
    return openai.chat.completions.create({
      model: config.chatModel,
      messages: [
        { role: "system", content: await loadSystemPrompt() },
        {
          role: "user",
          content: `User Query: "${query}"\n\nRetrieved Context:\n${context}\n\nBased on the query type and the retrieved context above, provide an appropriate response.`,
        },
      ],
      stream: true,
      temperature: 0,
      max_tokens: 2000,
    });
  }

  return { collectionExists, hybridSearch, streamAnswer };
}

import { vi } from "vitest";

// An OpenAI-style streamed completion: an async iterable of delta chunks.
export async function* fakeCompletion(pieces, { failAfter } = {}) {
  for (const [index, content] of pieces.entries()) {
    if (index === failAfter) throw new Error("connection reset");
    yield { choices: [{ delta: { content } }] };
  }
}

export function fakeClients({ points = [], vocabulary = {}, answer = [], exists = true, promptBlocks } = {}) {
  return {
    qdrant: {
      collectionExists: vi.fn(async () => ({ exists })),
      retrieve: vi.fn(async () => [{ id: "vocab", payload: { vocabulary } }]),
      query: vi.fn(async () => ({ points })),
    },
    openai: {
      embeddings: { create: vi.fn(async () => ({ data: [{ embedding: [0.1, 0.2, 0.3] }] })) },
      chat: { completions: { create: vi.fn(async () => fakeCompletion(answer)) } },
    },
    notion: promptBlocks
      ? { blocks: { children: { list: vi.fn(async () => ({ results: promptBlocks })) } } }
      : null,
  };
}

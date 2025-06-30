import { Client } from "@notionhq/client";
import { QdrantClient } from "@qdrant/js-client-rest";
import OpenAI from "openai";

// Built on first request, not at import time, so `next build` needs no keys.
export function createClients(config) {
  return {
    openai: new OpenAI({ apiKey: config.openaiApiKey }),
    qdrant: new QdrantClient({
      url: config.qdrantUrl,
      apiKey: config.qdrantApiKey,
      timeout: 30000,
      checkCompatibility: false,
    }),
    notion:
      config.notionApiKey && config.notionPromptPageId
        ? new Client({ auth: config.notionApiKey })
        : null,
  };
}

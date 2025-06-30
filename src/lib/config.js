export function readConfig(env = process.env) {
  return {
    openaiApiKey: env.OPENAI_API_KEY,
    qdrantUrl: env.QDRANT_URL,
    qdrantApiKey: env.QDRANT_API_KEY || undefined,
    collection: env.QDRANT_COLLECTION || "metric_definitions",
    notionApiKey: env.NOTION_API_KEY,
    notionPromptPageId: env.NOTION_PROMPT_PAGE_ID,
    embeddingModel: env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
    chatModel: env.OPENAI_CHAT_MODEL || "gpt-4o",
  };
}

export function missingConfig(config) {
  const required = { OPENAI_API_KEY: config.openaiApiKey, QDRANT_URL: config.qdrantUrl };
  return Object.keys(required).filter((name) => !required[name]);
}

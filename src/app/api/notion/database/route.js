import { Client } from "@notionhq/client";
import { QdrantClient } from "@qdrant/js-client-rest";
import OpenAI from "openai";

const QDRANT_URL = process.env.QDRANT_URL;
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const COLLECTION_NAME = "HDB_METRIC_HYBRID"; // Updated for hybrid collection
const EMBEDDING_MODEL = "text-embedding-3-small";
const CHAT_MODEL = "gpt-4o";

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

const qdrantClient = new QdrantClient({
  url: QDRANT_URL,
  apiKey: QDRANT_API_KEY,
  timeout: 30000,
});

const openaiClient = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// const SYSTEM_PROMPT = `ROLE: You are a concise and direct property management metrics assistant for a help center system.
// PERSONA: Act as a knowledgeable but brief property management expert who provides clear, actionable answers without unnecessary elaboration.
// TONE: Professional, direct, and informative. Always be concise and to-the-point.
// TASK: Analyze user queries about property management metrics and provide precise answers using ONLY the retrieved metric data from the Notion database.

// RESPONSE FORMAT INTELLIGENCE:
// You must intelligently determine the appropriate response format based on the query type and context:

// JSON STRING RESPONSE CRITERIA:
// Return a structured JSON string response ONLY when ALL of the following conditions are met:
// 1. The query is a simple, direct definitional request about a single metric
// 2. The query matches ONE of these EXACT patterns:
//    - "What is [metric]"
//    - "What are [metric]"
//    - "[metric]" (just the metric name alone i.e "Created Leads", "Leased Prospects", "Sessions", "Tours", "scheduled to toured ratio" )
//    - "Explain [metric]"
//    - "Define [metric]"
//    - "Describe [metric]"
// 3. The query does NOT ask for processes, methodologies, or explanations (no "How", "Why", "When", "Where")
// 4. The query is NOT asking multiple questions or compound requests
// 5. The user expects structured data rather than conversational explanation

// NEVER use JSON string format response for:
// - "How is/are [metric] recorded/calculated/measured?"
// - "How does [metric] work?"
// - "Why is [metric] important?"
// - "When should [metric] be used?"
// - Any compound questions with "and"
// - Any questions asking for processes or explanations
// - "Tell me about [metric]"

// REMEMBER: JSON RESPONSE MUST NOT WRAPPED IN BACKTICKS.

// For these specific cases ONLY, return this EXACT JSON string format response:
// {
//   "directResponse": true,
//   "metrics": [
//     {
//       "id": "[UID from payload]",
//       "title": "[Business Name from payload]",
//       "description": "[m_Definition or Definition from payload]",
//       "calculations": "[m_Calculation or Calculations from payload]",
//       "recordedBy": "[m_Recorded By from payload]",
//       "sources": ["[m_They Come Through from payload]"]
//       "importance": "[m_Importance from payload]"
//     }
//   ]
// }

// EXAMPLES FOR JSON STRING RESPONSE:
// Query: "Scheduled Contacts"
// Response: {"directResponse": true, "metrics": [{"id": "...", "title": "Scheduled Contacts", "description": "...", "calculations": "...", "recordedBy": "...", "sources": ["..."], "importance": "..."}]}

// Query: "Define applied prospects"
// Response: {"directResponse": true, "metrics": [{"id": "...", "title": "Applied Prospects", "description": "...", "calculations": "...", "recordedBy": "...", "sources": ["..."], "importance": "..."}]}

// STREAMING RESPONSE CRITERIA:
// Use normal conversational streaming response for ALL queries except the very specific JSON cases above, including:
// 1. ANY questions starting with "How", "Why", "When", "Where"
// 2. Process/methodology questions (e.g., "How is X recorded?", "How is X calculated?")
// 3. Compound questions with "and" (e.g., "How are X recorded and calculated?")
// 4. Complex queries requiring analysis, comparison, or interpretation
// 5. Multi-part questions or questions about relationships between metrics
// 6. Questions asking for recommendations, best practices, or strategic insights
// 7. Questions that require contextual explanation beyond basic metric data
// 8. Follow-up questions or clarification requests
// 9. Questions "Tell me about"
// 10. Any question that doesn't match the exact patterns listed in JSON RESPONSE CRITERIA

// When streaming, provide natural, conversational responses while strictly adhering to database content.

// CRITICAL DATA SOURCE RULE:

// PRIMARY SOURCE: All responses must be based strictly on information retrieved from the Notion database
// REPHRASING: Only rephrase database content for grammatical clarity when necessary - do not add interpretations or external knowledge
// FALLBACK: Use general knowledge ONLY when the specific information is completely absent from the Notion database
// VERIFICATION: Always verify that your response content exists in the provided database columns before responding

// QUERY HANDLING RULES:
// For any question about a metric, analyze ALL available columns (Definition, Calculations, Importance, Data Sources, etc.) from the Notion database and provide the most relevant answer based on what the user is asking:

// Definition Questions

// Patterns: "What does [metric] measure?"

// Source: Extract from 'Definition' column in database. Add 'Calculations' column data if available. Do not infer or add external definitions.
// Calculation Questions

// Patterns: "How is [metric] calculated?" / "How is [metric] calculated in practice?"

// Source: Use only 'Calculations' column from database. Include 'Definition' context only if it exists in the database.
// Importance Questions

// Patterns: "Why is [metric] important?" / "Why is [metric] important for property performance?"

// Source: Extract directly from 'Importance' column. If column is empty, state "Information not available in current data."
// Low-Performance Actions

// Patterns: "What actions can be taken if [metric] is low?"

// Source: Use only information from 'Importance' or related action columns in database. Do not add general best practices unless they exist in the database.
// High-Performance Indicators

// Patterns: "What does a high [metric] indicate?"

// Source: Extract from 'Importance' or related performance columns in database. Reference benchmarks only if they exist in the database.
// Monitoring Frequency

// Patterns: "How frequently should [metric] be monitored?"

// Source: Check 'Data Sources' or frequency-related columns in database. If not specified, state "Monitoring frequency not specified in current data."
// Improvement Strategies

// Patterns: "How can we improve [metric] over time?"

// Source: Use only improvement information from 'Importance' or strategy columns in database. Do not add external tactics.
// Data Sources & Tools

// Patterns: "What tools or data sources are used to track [metric]?"

// Source: Extract directly from 'Data Sources' column. List only tools/sources mentioned in the database.
// Decision Influence

// Patterns: "How does [metric] influence leasing decisions?"

// Source: Use information from 'Importance' or decision-related columns in database. Do not infer decision impacts.
// Common Interpretation Errors

// Patterns: "What are common errors in interpreting [metric]?"

// Source: Use only error/interpretation information from database columns. If not available, state "Interpretation guidance not available in current data."
// Real-World Examples

// Patterns: "Can you explain [metric] using a real-world example?"

// Source: Use only examples provided in database. If none exist, state "Examples not available in current data."
// Metric Relationships

// Patterns: "How does [metric] relate to other metrics like conversion or engagement?"

// Source: Use only relationship information from database columns. Do not infer connections.
// Strategic Insights

// Patterns: "What strategic insights can be drawn from tracking [metric]?"

// Source: Extract from 'Importance' or strategy columns in database. Do not add external strategic insights.
// Department Usage

// Patterns: "What departments or teams use [metric] most frequently?"

// Source: Use only department/team information from database. If not specified, state "Department usage not specified in current data."
// General Search (metric-only queries)

// When the user supplies only a metric name, combine key information from multiple database columns.

// Format: [Metric Name]: [comprehensive description using only database content].

// RESPONSE GUIDELINES:

// Database Fidelity: Every piece of information in your response must trace back to the Notion database
// Content Verification: Before responding, verify that each claim exists in the provided database columns
// Minimal Rephrasing: Only rephrase for grammatical clarity; preserve original database language when possible
// Recognize metric-name variations (e.g., 'created leads' = 'new leads' = 'leads')
// Handle compound metrics (e.g., 'contacts who toured' = 'toured contacts')
// Address temporal qualifiers (e.g., '1st toured' = 'first toured')
// Keep responses ≤ 45 words when possible (longer if needed for completeness)
// Use bold only for metric names
// No bullet points unless listing multiple distinct metrics
// Strict Fallbacks:
// If specific information isn't in database: "Information not available in current data."
// If question is outside scope: "Your question is out of my domain. Please ask questions about the product."
// If database has no relevant data: "This metric information is not available in the current database."

// DATABASE VERIFICATION CHECKLIST:
// Before responding, confirm:

// ✓ The metric exists in the database
// ✓ The information used exists in the relevant columns
// ✓ No external knowledge has been added
// ✓ Response uses only database language (with minimal grammatical improvements)

// EXAMPLES:
// Query: "What does 'created leads' measure?"
// Response: Created leads [extract exact definition from Definition column + calculations from Calculations column if available, using only database content].
// Query: "Why is 'New Leads' important?"
// Response: [Use only content from Importance column in database. If empty: "Importance information not available in current data."]
// REMEMBER: Your role is to be a precise conduit for the Notion database information, not to interpret, enhance, or supplement it with external knowledge.`;

async function extractCodeFromPage(pageId) {
  try {
    const response = await notion.blocks.children.list({
      block_id: pageId,
    });

    const codeBlocks = [];

    for (const block of response.results) {
      if (block.type === "code") {
        const codeBlock = block.code;

        const code = codeBlock.rich_text
          .map((text) => text.plain_text)
          .join("");

        codeBlocks.push({
          language: codeBlock.language,
          code: code,
          id: block.id,
        });
      }
    }

    return codeBlocks;
  } catch (error) {
    console.error("Error fetching page blocks:", error);
    throw error;
  }
}

async function getJavaScriptCode(pageId) {
  try {
    const allCodeBlocks = await extractCodeFromPage(pageId);

    const jsCodeBlocks = allCodeBlocks.filter(
      (block) => block.language === "javascript" || block.language === "js"
    );

    return jsCodeBlocks;
  } catch (error) {
    console.error("Error extracting JavaScript code:", error);
    throw error;
  }
}

function tokenizeText(text) {
  if (!text) return [];

  text = text.toLowerCase().trim();

  const phrases = [];
  const separators = [",", ";", "|", "\n"];

  for (const separator of separators) {
    if (text.includes(separator)) {
      const parts = text.split(separator);
      text = parts[0];

      phrases.push(
        ...parts
          .slice(1)
          .map((p) => p.trim())
          .filter((p) => p)
      );
    }
  }

  if (text.trim()) {
    phrases.unshift(text.trim());
  }

  const cleanedPhrases = [];
  const trimChars = /^[.,!?()[\]{}"'\-_/]+|[.,!?()[\]{}"'\-_/]+$/g;

  for (const phrase of phrases) {
    const cleaned = phrase.replace(trimChars, "");
    if (cleaned) {
      cleanedPhrases.push(cleaned);
    }
  }

  const allTokens = [];

  for (const phrase of cleanedPhrases) {
    allTokens.push(phrase);

    const words = phrase.split(/\s+/);
    for (const word of words) {
      const cleanedWord = word.replace(trimChars, "");
      if (cleanedWord.length > 2) {
        allTokens.push(cleanedWord);
      }
    }
  }

  const seen = new Set();
  const uniqueTokens = [];

  for (const token of allTokens) {
    if (token && !seen.has(token)) {
      seen.add(token);
      uniqueTokens.push(token);
    }
  }

  return uniqueTokens;
}

/**
 * Create sparse vector from text
 */
function createSparseVector(text, vocab) {
  const tokens = tokenizeText(text);
  const tokenCounts = {};

  tokens.forEach((token) => {
    if (token in vocab) {
      tokenCounts[token] = (tokenCounts[token] || 0) + 1;
    }
  });

  const indices = [];
  const values = [];

  Object.entries(tokenCounts).forEach(([token, count]) => {
    if (token in vocab) {
      indices.push(vocab[token]);
      values.push(count);
    }
  });

  if (values.length > 0) {
    const norm = Math.sqrt(values.reduce((sum, val) => sum + val * val, 0));
    if (norm > 0) {
      for (let i = 0; i < values.length; i++) {
        values[i] /= norm;
      }
    }
  }

  return { indices, values };
}

/**
 * Get vocabulary from Qdrant
 */
async function getVocabularyFromQdrant() {
  try {
    const vocabId = "00000000-0000-0000-0000-000000000000";
    const result = await qdrantClient.retrieve(COLLECTION_NAME, {
      ids: [vocabId],
      with_payload: true,
    });

    if (result.length > 0) {
      return result[0].payload.vocabulary || {};
    }
    return {};
  } catch (error) {
    console.error(`Could not retrieve vocabulary: ${error}`);
    return {};
  }
}

/**
 * Generate embedding for a given text using OpenAI
 */
async function generateEmbedding(text) {
  try {
    const response = await openaiClient.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error(`Error generating embedding: ${error}`);
    throw error;
  }
}

/**
 * Perform hybrid search using Qdrant's native fusion
 */
async function hybridSearchWithNativeFusion(
  query,
  limit = 10,
  prefetchLimit = 20,
  fusionType = "rrf",
  weights = [0.8, 0.2]
) {
  const vocab = await getVocabularyFromQdrant();

  const denseQueryVector = await generateEmbedding(query);

  const sparseQueryVector = createSparseVector(query, vocab);

  const searchResult = await qdrantClient.query(COLLECTION_NAME, {
    prefetch: [
      {
        query: denseQueryVector,
        using: "dense",
        limit: prefetchLimit,
      },
      {
        query: sparseQueryVector,
        using: "sparse",
        limit: prefetchLimit,
      },
    ],
    query: {
      fusion: fusionType,
      weights: weights,
    },
    limit: limit,
    with_payload: true,
  });

  console.log(
    `Native fusion search found ${searchResult.points.length} results`
  );
  return searchResult.points;
}

function formatJsonResults(results) {
  return results.map((result) => {
    const payload = result.payload;

    return {
      id: payload["UID"] || "",
      title: payload["Business Name"] || "",
      description: payload["m_Definition"] || payload["Definition"] || "",
      calculations: payload["m_Calculation"] || payload["Calculations"] || "",
      recordedBy: payload["m_Recorded By"] || "",
      importance: payload["Importance"] || "",
      sources: payload["m_They Come Through"]
        ? [payload["m_They Come Through"]]
        : [],
      score: result.score,
    };
  });
}

function formatResults(results) {
  return results.map((result) => {
    const payload = result.payload;

    return {
      score: result.score,
      id: payload["UID"] || "",
      title: payload["Business Name"] || "",
      UniqueName:
        payload["Unique Name*"]?.string || payload["Unique Name*"] || "",
      InSubjectName: payload["In-subject Name"] || "",
      description: payload["m_Definition"] || payload["Definition"] || "",
      calculations: payload["m_Calculation"] || payload["Calculations"] || "",
      recordedBy: payload["m_Recorded By"] || "",
      example: payload["m_Example"] || "",
      sources: payload["m_They Come Through"]
        ? [payload["m_They Come Through"]]
        : [],
      aliases: payload["Aliases"] || "",
      valueType: payload["Value Type"] || "",
      performanceIndicator: payload["Performance Indicator"] || "",
      dataSources: payload["Data Sources"] || "N/A",
      aggregationType: payload["Aggregation Type"] || "",
      importance: payload["Importance"] || "",
      databaseName: payload["Database Name (Existing)"] || "",
      subjectInitials: payload["Subject Initials"] || "",
    };
  });
}

function generateContextForLLM(searchResults) {
  const formattedResults = formatResults(searchResults);

  return formattedResults
    .map((result) => {
      let context = `Metric: ${result.title}\n`;
      if (result.description) context += `Definition: ${result.description}\n`;
      if (result.calculations)
        context += `Calculations: ${result.calculations}\n`;
      if (result.recordedBy) context += `Recorded By: ${result.recordedBy}\n`;
      if (result.sources.length > 0)
        context += `Sources: ${result.sources.join(", ")}\n`;
      if (result.valueType) context += `Value Type: ${result.valueType}\n`;
      if (result.performanceIndicator)
        context += `Performance Indicator: ${result.performanceIndicator}\n`;
      if (result.dataSources)
        context += `Data Sources: ${result.dataSources}\n`;
      if (result.aggregationType)
        context += `Aggregation Type: ${result.aggregationType}\n`;
      if (result.importance) context += `Importance: ${result.importance}\n`;
      if (result.aliases) context += `Aliases: ${result.aliases}\n`;
      return context;
    })
    .join("\n---\n");
}

async function generateLLMResponse(
  query,
  context,
  isStreaming = true,
  SYSTEM_PROMPT_FROM_NOTION
) {
  const userPrompt = `User Query: "${query}"

Retrieved Context:
${context}

Based on the query type and the retrieved context above, provide an appropriate response.`;

  const stream = await openaiClient.chat.completions.create({
    model: CHAT_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT_FROM_NOTION },
      { role: "user", content: userPrompt },
    ],
    stream: isStreaming,
    temperature: 0,
    max_tokens: 2000,
  });

  if (!isStreaming) {
    return stream.choices[0].message.content;
  }

  return stream;
}

/**
 * Check if collection exists in Qdrant
 */
async function checkCollectionExists() {
  try {
    const collections = await qdrantClient.getCollections();
    return collections.collections.some((col) => col.name === COLLECTION_NAME);
  } catch (error) {
    console.error(`Error checking collection: ${error}`);
    return false;
  }
}

/**
 * Main POST handler
 */
export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid JSON in request body",
          message: error.message,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const pageId = "2291db9ba44180008dbcec5f1e11f81f";

    const jsCode = await getJavaScriptCode(pageId);

    const SYSTEM_PROMPT_FROM_NOTION = jsCode[0]?.code;

    const { query, prefetch_limit = 15 } = body;

    const collectionExists = await checkCollectionExists();
    if (!collectionExists) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Collection '${COLLECTION_NAME}' not found`,
          message:
            "Please ensure the collection is created and populated first",
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const searchResults = await hybridSearchWithNativeFusion(
      query.trim(),
      10,
      prefetch_limit,
      "rrf",
      [0.8, 0.2]
    );

    const context = generateContextForLLM(searchResults);

    const llmResponse = await generateLLMResponse(
      query.trim(),
      context,
      false,
      SYSTEM_PROMPT_FROM_NOTION
    );

    let isJsonResponse = false;
    let parsedJsonResponse = null;

    try {
      const trimmedResponse = llmResponse.trim();
      if (trimmedResponse.startsWith("{") && trimmedResponse.endsWith("}")) {
        parsedJsonResponse = JSON.parse(trimmedResponse);

        if (parsedJsonResponse.directResponse === true) {
          isJsonResponse = true;
        }
      }
    } catch (e) {
      isJsonResponse = false;
    }

    if (isJsonResponse) {
      return new Response(
        JSON.stringify({
          success: true,
          query: query.trim(),
          resultCount: searchResults.length,
          searchType: "direct_response",
          responseType: "json",
          directResponse: parsedJsonResponse,
          retrievedMetrics: formatJsonResults(searchResults),
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache, no-store, must-revalidate",
          },
        }
      );
    } else {
      const encoder = new TextEncoder();
      const stream = await generateLLMResponse(
        query.trim(),
        context,
        true,
        SYSTEM_PROMPT_FROM_NOTION
      );

      const readableStream = new ReadableStream({
        async start(controller) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "metadata",
                query: query.trim(),
                resultCount: searchResults.length,
                searchType: "hybrid_native_fusion",
                fusionType: "rrf",
              })}\n\n`
            )
          );

          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "content",
                    content: content,
                  })}\n\n`
                )
              );
            }
          }

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "done",
                retrievedMetrics: formatResults(searchResults).map((r) => ({
                  id: r.id,
                  title: r.title,
                  score: r.score,
                })),
              })}\n\n`
            )
          );

          controller.close();
        },
      });

      return new Response(readableStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }
  } catch (error) {
    console.error(`API error: ${error}`);
    return new Response(
      JSON.stringify({
        success: false,
        error: "An error occurred during processing",
        message: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

export async function OPTIONS(request) {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

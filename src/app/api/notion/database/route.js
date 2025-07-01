// api/notion/database/route.js - Updated with Qdrant Native Fusion
import { QdrantClient } from "@qdrant/js-client-rest";
import OpenAI from "openai";

// Configuration
const QDRANT_URL = process.env.QDRANT_URL;
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const COLLECTION_NAME = "HDB_METRIC_HYBRID"; // Updated for hybrid collection
const EMBEDDING_MODEL = "text-embedding-3-small";
const CHAT_MODEL = "gpt-4o";

// Initialize clients
const qdrantClient = new QdrantClient({
  url: QDRANT_URL,
  apiKey: QDRANT_API_KEY,
  timeout: 30000,
});

const openaiClient = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// System prompt (keeping your existing one)
const SYSTEM_PROMPT = `ROLE: You are a concise and direct property management metrics assistant for a help center system.
PERSONA: Act as a knowledgeable but brief property management expert who provides clear, actionable answers without unnecessary elaboration.
TONE: Professional, direct, and informative. Always be concise and to-the-point.
TASK: Analyze user queries about property management metrics and provide precise answers using ONLY the retrieved metric data from the Notion database.
CRITICAL DATA SOURCE RULE:

PRIMARY SOURCE: All responses must be based strictly on information retrieved from the Notion database
REPHRASING: Only rephrase database content for grammatical clarity when necessary - do not add interpretations or external knowledge
FALLBACK: Use general knowledge ONLY when the specific information is completely absent from the Notion database
VERIFICATION: Always verify that your response content exists in the provided database columns before responding

QUERY HANDLING RULES:
For any question about a metric, analyze ALL available columns (Definition, Calculations, Importance, Data Sources, etc.) from the Notion database and provide the most relevant answer based on what the user is asking:

Definition Questions

Patterns: "What does [metric] measure?" / "What is [metric]?"

Source: Extract from 'Definition' column in database. Add 'Calculations' column data if available. Do not infer or add external definitions.
Calculation Questions

Patterns: "How is [metric] calculated?" / "How is [metric] calculated in practice?"

Source: Use only 'Calculations' column from database. Include 'Definition' context only if it exists in the database.
Importance Questions

Patterns: "Why is [metric] important?" / "Why is [metric] important for property performance?"

Source: Extract directly from 'Importance' column. If column is empty, state "Information not available in current data."
Low-Performance Actions

Patterns: "What actions can be taken if [metric] is low?"

Source: Use only information from 'Importance' or related action columns in database. Do not add general best practices unless they exist in the database.
High-Performance Indicators

Patterns: "What does a high [metric] indicate?"

Source: Extract from 'Importance' or related performance columns in database. Reference benchmarks only if they exist in the database.
Monitoring Frequency

Patterns: "How frequently should [metric] be monitored?"

Source: Check 'Data Sources' or frequency-related columns in database. If not specified, state "Monitoring frequency not specified in current data."
Improvement Strategies

Patterns: "How can we improve [metric] over time?"

Source: Use only improvement information from 'Importance' or strategy columns in database. Do not add external tactics.
Data Sources & Tools

Patterns: "What tools or data sources are used to track [metric]?"

Source: Extract directly from 'Data Sources' column. List only tools/sources mentioned in the database.
Decision Influence

Patterns: "How does [metric] influence leasing decisions?"

Source: Use information from 'Importance' or decision-related columns in database. Do not infer decision impacts.
Common Interpretation Errors

Patterns: "What are common errors in interpreting [metric]?"

Source: Use only error/interpretation information from database columns. If not available, state "Interpretation guidance not available in current data."
Real-World Examples

Patterns: "Can you explain [metric] using a real-world example?"

Source: Use only examples provided in database. If none exist, state "Examples not available in current data."
Metric Relationships

Patterns: "How does [metric] relate to other metrics like conversion or engagement?"

Source: Use only relationship information from database columns. Do not infer connections.
Strategic Insights

Patterns: "What strategic insights can be drawn from tracking [metric]?"

Source: Extract from 'Importance' or strategy columns in database. Do not add external strategic insights.
Department Usage

Patterns: "What departments or teams use [metric] most frequently?"

Source: Use only department/team information from database. If not specified, state "Department usage not specified in current data."
General Search (metric-only queries)

When the user supplies only a metric name, combine key information from multiple database columns.

Format: [Metric Name]: [comprehensive description using only database content].

RESPONSE GUIDELINES:

Database Fidelity: Every piece of information in your response must trace back to the Notion database
Content Verification: Before responding, verify that each claim exists in the provided database columns
Minimal Rephrasing: Only rephrase for grammatical clarity; preserve original database language when possible
Recognize metric-name variations (e.g., 'created leads' = 'new leads' = 'leads')
Handle compound metrics (e.g., 'contacts who toured' = 'toured contacts')
Address temporal qualifiers (e.g., '1st toured' = 'first toured')
Keep responses ≤ 45 words when possible (longer if needed for completeness)
Use bold only for metric names
No bullet points unless listing multiple distinct metrics
Strict Fallbacks:
If specific information isn't in database: "Information not available in current data."
If question is outside scope: "Your question is out of my domain. Please ask questions about the product."
If database has no relevant data: "This metric information is not available in the current database."


DATABASE VERIFICATION CHECKLIST:
Before responding, confirm:

✓ The metric exists in the database
✓ The information used exists in the relevant columns
✓ No external knowledge has been added
✓ Response uses only database language (with minimal grammatical improvements)

EXAMPLES:
Query: "What does 'created leads' measure?"
Response: Created leads [extract exact definition from Definition column + calculations from Calculations column if available, using only database content].
Query: "Why is 'New Leads' important?"
Response: [Use only content from Importance column in database. If empty: "Importance information not available in current data."]
REMEMBER: Your role is to be a precise conduit for the Notion database information, not to interpret, enhance, or supplement it with external knowledge.`;

/**
 * Tokenize text for sparse vector creation
 */
function tokenizeText(text) {
  // Convert to lowercase and split by common delimiters
  text = text.toLowerCase();
  // Replace common punctuation with spaces
  const punctuation = [
    ",",
    ".",
    ";",
    ":",
    "!",
    "?",
    "(",
    ")",
    "[",
    "]",
    "{",
    "}",
    "-",
    "_",
    "/",
  ];
  punctuation.forEach((char) => {
    text = text.replace(new RegExp("\\" + char, "g"), " ");
  });
  // Split and filter out empty strings
  return text.split(" ").filter((token) => token.trim());
}

/**
 * Create sparse vector from text
 */
function createSparseVector(text, vocab) {
  const tokens = tokenizeText(text);
  const tokenCounts = {};

  // Count tokens
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

  // Normalize the vector
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
  console.log(`Performing hybrid search with native fusion for: '${query}'`);

  // Get vocabulary for sparse vector creation
  const vocab = await getVocabularyFromQdrant();

  // Generate dense embedding
  const denseQueryVector = await generateEmbedding(query);

  // Generate sparse vector
  const sparseQueryVector = createSparseVector(query, vocab);

  // Use native fusion
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

/**
 * Format search results for API response
 */
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

/**
 * Generate context from search results for LLM
 */
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

/**
 * Generate LLM response based on query and context
 */
async function generateLLMResponse(query, context, isStreaming = true) {
  console.log({ query, context });

  const userPrompt = `User Query: "${query}"

Retrieved Context:
${context}

Based on the query type and the retrieved context above, provide an appropriate response.`;

  if (isStreaming) {
    // Return a stream for the response
    const stream = await openaiClient.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      stream: true,
      temperature: 0,
      max_tokens: 2000,
    });

    return stream;
  } else {
    // Return a complete response
    const completion = await openaiClient.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0,
      max_tokens: 2000,
    });

    return completion.choices[0].message.content;
  }
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
    // Parse request body
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

    // Extract parameters
    const {
      query,
      limit = 5,
      filters = {},
      streaming = true,
      score_threshold = 0.4,
      prefetch_limit = 15,
      fusion_type = "rrf",
      weights = [0.8, 0.2],
    } = body;

    // Check collection exists
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

    // Perform hybrid search with native fusion
    const searchResults = await hybridSearchWithNativeFusion(
      query.trim(),
      limit,
      prefetch_limit,
      fusion_type,
      weights
    );

    // Filter by score threshold
    const filteredResults = searchResults.filter(
      (result) => result.score >= score_threshold
    );

    console.log(`Found ${filteredResults.length} results after filtering`);

    // Generate context for LLM
    const context = generateContextForLLM(filteredResults);

    if (streaming) {
      // Set up streaming response
      const encoder = new TextEncoder();
      const stream = await generateLLMResponse(query.trim(), context, true);

      const readableStream = new ReadableStream({
        async start(controller) {
          // Send initial metadata
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "metadata",
                query: query.trim(),
                resultCount: filteredResults.length,
                searchType: "hybrid_native_fusion",
                fusionType: fusion_type,
              })}\n\n`
            )
          );

          // Stream the LLM response
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

          // Send completion signal with retrieved metrics
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "done",
                retrievedMetrics: formatResults(filteredResults).map((r) => ({
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
    } else {
      // Non-streaming response
      const llmResponse = await generateLLMResponse(
        query.trim(),
        context,
        false
      );

      return new Response(
        JSON.stringify({
          success: true,
          query: query.trim(),
          resultCount: filteredResults.length,
          searchType: "hybrid_native_fusion",
          fusionType: fusion_type,
          response: llmResponse,
          retrievedMetrics: formatResults(filteredResults).map((r) => ({
            id: r.id,
            title: r.title,
            score: r.score,
          })),
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache, no-store, must-revalidate",
          },
        }
      );
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

// OPTIONS handler for CORS
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

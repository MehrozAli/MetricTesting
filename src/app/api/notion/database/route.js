import { QdrantClient } from "@qdrant/js-client-rest";
import OpenAI from "openai";

// Configuration
const QDRANT_URL = process.env.QDRANT_URL;
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const COLLECTION_NAME = "HDB_METRIC";
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

/**
 * Comprehensive prompt for LLM to understand and respond to queries
 */
const SYSTEM_PROMPT = `**ROLE:** You are a concise and direct property management metrics assistant for a help center system.

**PERSONA:** Act as a knowledgeable but brief property management expert who provides clear, actionable answers without unnecessary elaboration.

**TONE:** Professional, direct, and informative. Always be concise and to-the-point.

**TASK:** Analyze user queries about property management metrics and provide precise answers using the retrieved metric data.

**QUERY HANDLING RULES:**

For any question about a metric, analyze ALL available columns (Definition, Calculations, Importance, Data Sources, etc.) and provide the most relevant and comprehensive answer based on what the user is asking:

1. **Definition Questions**  
   Patterns: “What does **[metric]** measure?” / “What is **[metric]**?”  
   Combine information from ‘Definition’ **and** ‘Calculations’. Provide both what it measures **and** how it’s calculated if available.

2. **Calculation Questions**  
   Patterns: “How is **[metric]** calculated?” / “How is **[metric]** calculated in practice?”  
   Primary source: ‘Calculations’. Include practical implementation details; add context from ‘Definition’ when helpful.

3. **Importance Questions**  
   Patterns: “Why is **[metric]** important?” / “Why is **[metric]** important for property performance?”  
   Primary source: ‘Importance’. Link to property-performance outcomes; use ‘Definition’ if ‘Importance’ is missing.

4. **Low-Performance Actions**  
   Patterns: “What actions can be taken if **[metric]** is low?”  
   Draw from ‘Importance’ and best practices. Provide actionable improvement strategies considering operational context.

5. **High-Performance Indicators**  
   Patterns: “What does a high **[metric]** indicate?”  
   Analyze positive implications from ‘Importance’. Connect to business outcomes; reference benchmarks if available.

6. **Monitoring Frequency**  
   Patterns: “How frequently should **[metric]** be monitored?”  
   Check ‘Data Sources’ for update frequency. Consider metric volatility and business impact; provide practical cadence.

7. **Improvement Strategies**  
   Patterns: “How can we improve **[metric]** over time?”  
   Combine insights from ‘Importance’ and best practices to give actionable tactics and long-term approaches.

8. **Data Sources & Tools**  
   Patterns: “What tools or data sources are used to track **[metric]**?”  
   Primary source: ‘Data Sources’. Include system integrations, reporting tools, and data-collection methods.

9. **Decision Influence**  
   Patterns: “How does **[metric]** influence leasing decisions?”  
   Analyze strategic impact from ‘Importance’. Connect to decision-making processes and business outcomes.

10. **Common Interpretation Errors**  
    Patterns: “What are common errors in interpreting **[metric]**?”  
    Identify misunderstandings, clarify calculation nuances, and highlight context considerations.

11. **Real-World Examples**  
    Patterns: “Can you explain **[metric]** using a real-world example?”  
    Provide concrete scenarios with numerical illustrations when possible.

12. **Metric Relationships**  
    Patterns: “How does **[metric]** relate to other metrics like conversion or engagement?”  
    Map interdependencies and cascading effects among KPIs.

13. **Strategic Insights**  
    Patterns: “What strategic insights can be drawn from tracking **[metric]**?”  
    Extract high-level business implications and connect to strategic goals.

14. **Department Usage**  
    Patterns: “What departments or teams use **[metric]** most frequently?”  
    Identify primary stakeholders, departmental applications, and cross-functional uses.

15. **General Search (metric-only queries)**  
    When the user supplies only a metric name, combine key information from multiple columns.  
    Format: **[Metric Name]**: brief comprehensive description.

**RESPONSE GUIDELINES:**
- Recognize metric-name variations (e.g., ‘created leads’ = ‘new leads’ = ‘leads’).  
- Handle compound metrics (e.g., ‘contacts who toured’ = ‘toured contacts’).  
- Address temporal qualifiers (e.g., ‘1st toured’ = ‘first toured’).  
- Keep responses ≤ 45 words when possible (longer if needed for completeness).  
- Use **bold** only for metric names.  
- No bullet points unless listing multiple distinct metrics.  
- If information isn’t available, reply: “Information not available in current data.”  
- If the question is outside scope, reply: “Your question is out of my domain. Please ask questions about the product.”  
- **Always analyze ALL available columns** to provide the most helpful, concise answer.

**EXAMPLES:**
Query: "What does 'created leads' measure?"
Response: "**Created leads** measures [combine Definition + Calculations data to explain both what it tracks and how it's calculated]."

Query: "Why is 'New Leads' important?"
Response: "New leads help to evaluate how well marketing strategies are performing."

Remember: Be direct, extract exact information from the relevant column, and keep responses brief and actionable.`;

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
 * Search the Qdrant collection for the most relevant results
 */
async function searchBestMatches(
  query,
  limit = 5,
  filters = null,
  score_threshold = 0.4
) {
  try {
    console.log(`Searching for: '${query}' (returning top ${limit} results)`);

    const queryEmbedding = await generateEmbedding(query);

    const searchParams = {
      vector: queryEmbedding,
      limit: limit,
      with_payload: true,
      with_vector: true,
    };

    if (filters && Object.keys(filters).length > 0) {
      const mustConditions = Object.entries(filters).map(([key, value]) => ({
        key: key,
        match: { value: value },
      }));

      searchParams.filter = {
        must: mustConditions,
      };
    }

    const searchResults = await qdrantClient.search(
      COLLECTION_NAME,
      searchParams
    );

    // Filter results based on score threshold
    const filteredResults = searchResults.filter(
      (result) => result.score >= score_threshold
    );

    console.log(`Found ${filteredResults.length} results`);
    return filteredResults;
  } catch (error) {
    console.error(`Error during search: ${error}`);
    throw error;
  }
}

/**
 * Format search results for API response
 */
function formatResults(results) {
  return results.map((result) => {
    const payload = result.payload;
    console.log({ payload });

    return {
      score: result.score,
      id: payload["UID"] || "",
      title: payload["Business Name"] || "",
      UniqueName:
        payload["Unique Name*"]?.string || payload["Unique Name*"] || "",
      InSubjectName: payload["In-subject Name"] || "",
      description: payload["m_Definition"] || "",
      calculations: payload["m_Calculation"] || "",
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
      return context;
    })
    .join("\n---\n");
}

/**
 * Generate LLM response based on query and context
 */
async function generateLLMResponse(query, context, isStreaming = true) {
  // console.log({ query, context });

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
    } = body;

    // Validate query
    if (!query || typeof query !== "string" || query.trim() === "") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid or missing query parameter",
          message: "Query must be a non-empty string",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Validate limit
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid limit parameter",
          message: "Limit must be an integer between 1 and 100",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

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

    // Perform semantic search
    const searchResults = await searchBestMatches(
      query.trim(),
      limit,
      filters,
      score_threshold
    );

    // Generate context for LLM
    const context = generateContextForLLM(searchResults);

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
                resultCount: searchResults.length,
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
          resultCount: searchResults.length,
          response: llmResponse,
          retrievedMetrics: formatResults(searchResults).map((r) => ({
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

import { splitCompletion } from "@/lib/answer";
import { createClients } from "@/lib/clients";
import { missingConfig, readConfig } from "@/lib/config";
import { createMetricSearch } from "@/lib/metricSearch";
import { buildLlmContext, selectAnsweredMetrics } from "@/lib/metrics";

const MAX_QUERY_LENGTH = 500;
const RESULT_LIMIT = 10;

let search;

function getSearch(config) {
  search ??= createMetricSearch(createClients(config), config);
  return search;
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function parsePrefetchLimit(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 50) : 15;
}

function eventStream(writeEvents) {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      const send = (event) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      try {
        await writeEvents(send);
      } catch (error) {
        console.error(`Answer stream failed: ${error}`);
        send({ type: "error", message: "The answer was interrupted. Please try again." });
      }
      controller.close();
    },
  });
  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, error: "Request body must be valid JSON" }, 400);
  }

  const query = typeof body?.query === "string" ? body.query.trim() : "";
  if (!query || query.length > MAX_QUERY_LENGTH) {
    return jsonResponse(
      {
        success: false,
        error: `"query" must be a non-empty string of at most ${MAX_QUERY_LENGTH} characters`,
      },
      400
    );
  }

  const config = readConfig();
  const missing = missingConfig(config);
  if (missing.length > 0) {
    return jsonResponse({ success: false, error: "Search is not configured", missing }, 503);
  }

  try {
    const metricSearch = getSearch(config);
    if (!(await metricSearch.collectionExists())) {
      return jsonResponse(
        {
          success: false,
          error: `Collection '${config.collection}' not found`,
          message: "Please ensure the collection is created and populated first",
        },
        404
      );
    }

    const points = await metricSearch.hybridSearch(query, {
      limit: RESULT_LIMIT,
      prefetchLimit: parsePrefetchLimit(body.prefetch_limit),
    });
    const completion = await metricSearch.streamAnswer(query, buildLlmContext(points));
    const { direct, text, rest } = await splitCompletion(completion);

    if (direct) {
      return jsonResponse({
        success: true,
        query,
        resultCount: points.length,
        searchType: "direct_response",
        directResponse: direct,
        retrievedMetrics: selectAnsweredMetrics(points, direct),
      });
    }

    return eventStream(async (send) => {
      send({
        type: "metadata",
        query,
        resultCount: points.length,
        searchType: "hybrid_native_fusion",
        fusionType: "rrf",
      });
      if (text) send({ type: "content", content: text });
      if (rest) {
        for await (const content of rest) {
          if (content) send({ type: "content", content });
        }
      }
      send({
        type: "done",
        retrievedMetrics: points.map((point) => ({
          id: point.payload?.["UID"] || "",
          title: point.payload?.["Business Name"] || "",
          score: point.score,
        })),
      });
    });
  } catch (error) {
    console.error(`API error: ${error}`);
    return jsonResponse({ success: false, error: "An error occurred during processing" }, 500);
  }
}

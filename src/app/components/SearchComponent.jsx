"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import MetricCard from "./MetricCard";

function LLMResponse({ response }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4">
      <div className="prose prose-sm max-w-none dark:prose-invert">
        <ReactMarkdown
          components={{
            p: ({ children }) => (
              <p className="mb-3 text-sm text-gray-700 dark:text-gray-300">
                {children}
              </p>
            ),
            strong: ({ children }) => (
              <strong className="font-semibold text-gray-800 dark:text-gray-200">
                {children}
              </strong>
            ),
            ul: ({ children }) => (
              <ul className="mb-3 ml-4 list-disc space-y-1">{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className="mb-3 ml-4 list-decimal space-y-1">{children}</ol>
            ),
            li: ({ children }) => (
              <li className="text-sm text-gray-700 dark:text-gray-300">
                {children}
              </li>
            ),
            h3: ({ children }) => (
              <h3 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
                {children}
              </h3>
            ),
            h4: ({ children }) => (
              <h4 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
                {children}
              </h4>
            ),
          }}
        >
          {response}
        </ReactMarkdown>
      </div>
    </div>
  );
}

export default function SearchComponent() {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  const [llmResponse, setLlmResponse] = useState("");
  const [showLLMResponse, setShowLLMResponse] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchSearchResults = async (searchTerm) => {
    try {
      setIsLoading(true);
      setShowLLMResponse(false);
      setLlmResponse("");

      if (!searchTerm.trim()) return;

      // Use semantic search with LLM
      const response = await fetch("/api/notion/database", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: searchTerm,
          score_threshold: 0.6,
          prefetch_limit: 15,
        }),
      });

      if (!response.ok) {
        throw new Error(`Semantic search failed: ${response.statusText}`);
      }

      // Check if this is a direct JSON response
      const contentType = response.headers.get("content-type");

      if (contentType?.includes("application/json")) {
        // Handle direct JSON response
        const data = await response.json();

        if (data.searchType === "direct_response") {
          // Set the results directly to selectedSearchResult
          setSearchResults(data.retrievedMetrics);
          setShowLLMResponse(false);
          setIsLoading(false);
          return;
        }
      }

      // Handle streaming response
      if (contentType?.includes("text/event-stream")) {
        setShowLLMResponse(true);
        setSearchResults([]); // Clear block results
        setIsLoading(false);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedResponse = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split("\n");

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6);
                if (data.trim()) {
                  try {
                    const parsed = JSON.parse(data);

                    if (parsed.type === "metadata") {
                      console.log("Query metadata:", parsed);
                    } else if (parsed.type === "content") {
                      accumulatedResponse += parsed.content;
                      setLlmResponse(accumulatedResponse);
                    } else if (parsed.type === "done") {
                      // Keep the response visible after streaming completes
                      console.log("Streaming completed");
                    }
                  } catch (e) {
                    console.error("Error parsing streaming data:", e);
                  }
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      }
    } catch (error) {
      console.error("Search failed:", error);
      setSearchResults([]);
      setShowLLMResponse(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    await fetchSearchResults(query);
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Search Form */}
      <form onSubmit={handleSearch} className="mb-8">
        <div className="flex gap-4">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter your search query..."
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="px-6 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded-lg hover:bg-blue-600 dark:hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? "Searching..." : "Search"}
          </button>
        </div>
      </form>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="mb-6 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 dark:border-blue-400"></div>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Searching...</p>
        </div>
      )}

      {/* LLM Response Display */}
      {showLLMResponse && llmResponse && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">
            Response:
          </h3>
          <LLMResponse response={llmResponse} />
        </div>
      )}

      {/* Search Results (from primary API) */}
      {!showLLMResponse && searchResults.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-6 text-gray-900 dark:text-gray-100">
            Search Results (
            {searchResults.filter((result) => result.score > 0.6).length}):
          </h3>
          <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
            {searchResults
              .filter((result) => result.score > 0.6)
              .map((result, index) => (
                <MetricCard key={result.uid || index} metric={result} />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

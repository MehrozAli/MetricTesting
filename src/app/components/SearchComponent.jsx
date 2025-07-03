"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import MetricCard from "./MetricCard";

function LLMResponse({ response }) {
  return (
    <div className="rounded-lg border border-[#eee] bg-[#f9f9f9] p-4">
      <div className="prose prose-sm max-w-none">
        <ReactMarkdown
          components={{
            p: ({ children }) => (
              <p className="mb-3 text-sm text-[#333]">{children}</p>
            ),
            strong: ({ children }) => (
              <strong className="font-semibold text-[#333]">{children}</strong>
            ),
            ul: ({ children }) => (
              <ul className="mb-3 ml-4 list-disc space-y-1">{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className="mb-3 ml-4 list-decimal space-y-1">{children}</ol>
            ),
            li: ({ children }) => (
              <li className="text-sm text-[#333]">{children}</li>
            ),
            h3: ({ children }) => (
              <h3 className="mb-2 text-sm font-semibold text-[#333]">
                {children}
              </h3>
            ),
            h4: ({ children }) => (
              <h4 className="mb-2 text-sm font-semibold text-[#333]">
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
          score_threshold: 0.4,
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
                      setShowLLMResponse(false);
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
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? "Searching..." : "Search"}
          </button>
        </div>
      </form>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="mb-6 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <p className="mt-2 text-gray-600">Searching...</p>
        </div>
      )}

      {/* LLM Response Display */}
      {showLLMResponse && llmResponse && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">Response:</h3>
          <LLMResponse response={llmResponse} />
        </div>
      )}

      {/* Search Results (from primary API) */}
      {!showLLMResponse && searchResults.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-6">
            Search Results ({searchResults.length}):
          </h3>
          <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
            {searchResults.map((result, index) => (
              <MetricCard key={result.uid || index} metric={result} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

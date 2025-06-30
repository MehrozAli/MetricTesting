import { describe, expect, it } from "vitest";
import { readEventStream } from "@/lib/readEventStream";

function streamOf(...chunks) {
  const encoded = chunks.map((chunk) =>
    chunk instanceof Uint8Array ? chunk : new TextEncoder().encode(chunk)
  );
  return new ReadableStream({
    start(controller) {
      encoded.forEach((bytes) => controller.enqueue(bytes));
      controller.close();
    },
  });
}

async function readAll(body) {
  const events = [];
  for await (const event of readEventStream(body)) events.push(event);
  return events;
}

describe("readEventStream", () => {
  it("joins an event split across chunks", async () => {
    const events = await readAll(
      streamOf('data: {"type":"cont', 'ent","content":"Hi"}\n', '\ndata: {"type":"done"}\n\n')
    );
    expect(events).toEqual([{ type: "content", content: "Hi" }, { type: "done" }]);
  });

  it("decodes a multi-byte character split between chunks", async () => {
    const bytes = new TextEncoder().encode('data: {"content":"≤ 45 words"}\n\n');
    const events = await readAll(streamOf(bytes.slice(0, 19), bytes.slice(19)));
    expect(events).toEqual([{ content: "≤ 45 words" }]);
  });

  it("parses a final event that arrives without a trailing blank line", async () => {
    expect(await readAll(streamOf('data: {"type":"done"}'))).toEqual([{ type: "done" }]);
  });

  it("ignores comments and blank events", async () => {
    expect(await readAll(streamOf(": keep-alive\n\n\n\ndata: {}\n\n"))).toEqual([{}]);
  });
});

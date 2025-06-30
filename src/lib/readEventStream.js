// Yields the parsed `data:` payload of each server-sent event. Events can be
// split across network chunks, so text is buffered until a blank line ends one.
export async function* readEventStream(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });

      const events = buffer.split("\n\n");
      buffer = done ? "" : events.pop();

      for (const event of events) {
        const data = event
          .split("\n")
          .filter((line) => line.startsWith("data: "))
          .map((line) => line.slice(6))
          .join("\n");
        if (data.trim()) yield JSON.parse(data);
      }
      if (done) return;
    }
  } finally {
    reader.releaseLock();
  }
}

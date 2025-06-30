function deltaText(chunk) {
  return chunk.choices?.[0]?.delta?.content ?? "";
}

async function* drain(iterator) {
  for (;;) {
    const { done, value } = await iterator.next();
    if (done) return;
    yield deltaText(value);
  }
}

// The prompt asks for a bare JSON object on simple "what is X" questions;
// models sometimes wrap it in a ```json fence anyway.
export function parseDirectResponse(text) {
  const unfenced = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  if (!unfenced.startsWith("{") || !unfenced.endsWith("}")) return null;
  try {
    const parsed = JSON.parse(unfenced);
    return parsed?.directResponse === true && Array.isArray(parsed.metrics)
      ? parsed
      : null;
  } catch {
    return null;
  }
}

// Reads a streamed completion just far enough to tell a structured answer
// from prose, so each question costs one model call. Prose is returned as
// the text read so far plus a generator for the rest of the stream.
export async function splitCompletion(stream) {
  const iterator = stream[Symbol.asyncIterator]();
  let text = "";

  for (;;) {
    const { done, value } = await iterator.next();
    if (done) break;
    text += deltaText(value);

    const first = text.trimStart()[0];
    if (first === undefined) continue;
    if (first !== "{" && first !== "`") {
      return { direct: null, text, rest: drain(iterator) };
    }
    for await (const piece of drain(iterator)) text += piece;
    break;
  }

  const direct = parseDirectResponse(text);
  return { direct, text, rest: null };
}

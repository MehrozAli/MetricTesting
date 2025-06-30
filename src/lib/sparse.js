// Must mirror the tokenizer that built the collection's vocabulary point,
// otherwise query tokens will not line up with the stored sparse indices.
export function tokenizeText(text) {
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

export function createSparseVector(text, vocab) {
  const indices = [];
  const values = [];

  for (const token of tokenizeText(text)) {
    if (Object.hasOwn(vocab, token)) {
      indices.push(vocab[token]);
      values.push(1);
    }
  }

  const norm = Math.sqrt(values.length);
  return { indices, values: values.map((value) => value / norm) };
}

import { describe, expect, it } from "vitest";
import { createSparseVector, tokenizeText } from "@/lib/sparse";
import { VOCABULARY } from "./fixtures/metrics";

describe("tokenizeText", () => {
  it("keeps the whole phrase and its longer words, lower-cased and de-duplicated", () => {
    expect(tokenizeText("Created Leads leads")).toEqual([
      "created leads leads",
      "created",
      "leads",
    ]);
  });

  it("splits on separators and trims punctuation", () => {
    expect(tokenizeText('"Tours", created leads!')).toEqual([
      "tours",
      "created leads",
      "created",
      "leads",
    ]);
  });

  it("drops words of two characters or fewer", () => {
    expect(tokenizeText("is it ok")).toEqual(["is it ok"]);
  });

  it("returns nothing for empty input", () => {
    expect(tokenizeText("")).toEqual([]);
    expect(tokenizeText(undefined)).toEqual([]);
  });
});

describe("createSparseVector", () => {
  it("maps known tokens to vocabulary indices with unit length", () => {
    const vector = createSparseVector("created leads", VOCABULARY);
    expect(vector.indices).toEqual([0, 1, 2]);
    const length = Math.hypot(...vector.values);
    expect(length).toBeCloseTo(1);
  });

  it("is empty when no token is in the vocabulary", () => {
    expect(createSparseVector("occupancy", VOCABULARY)).toEqual({ indices: [], values: [] });
  });

  it("ignores inherited object keys", () => {
    expect(createSparseVector("constructor", VOCABULARY).indices).toEqual([]);
  });
});

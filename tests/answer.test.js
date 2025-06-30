import { describe, expect, it } from "vitest";
import { parseDirectResponse, splitCompletion } from "@/lib/answer";
import { fakeCompletion } from "./fakes";

const direct = '{"directResponse": true, "metrics": [{"id": "MET-001"}]}';

async function collect(generator) {
  let text = "";
  for await (const piece of generator) text += piece;
  return text;
}

describe("parseDirectResponse", () => {
  it("accepts a bare or fenced direct-response object", () => {
    expect(parseDirectResponse(direct).metrics).toHaveLength(1);
    expect(parseDirectResponse("```json\n" + direct + "\n```")).not.toBeNull();
  });

  it("rejects prose, invalid JSON and objects without directResponse", () => {
    expect(parseDirectResponse("Tours are visits.")).toBeNull();
    expect(parseDirectResponse("{not json}")).toBeNull();
    expect(parseDirectResponse('{"metrics": []}')).toBeNull();
  });
});

describe("splitCompletion", () => {
  it("reads a JSON answer to the end and parses it", async () => {
    const result = await splitCompletion(fakeCompletion(["  {\"directResponse\"", ': true, "metrics": []}']));
    expect(result.direct).toEqual({ directResponse: true, metrics: [] });
    expect(result.rest).toBeNull();
  });

  it("hands back prose after the first visible text without draining the stream", async () => {
    const pieces = ["", "**Tours** are", " property visits."];
    const result = await splitCompletion(fakeCompletion(pieces));
    expect(result.direct).toBeNull();
    expect(result.text).toBe("**Tours** are");
    expect(await collect(result.rest)).toBe(" property visits.");
  });

  it("treats brace-led text that is not valid JSON as prose", async () => {
    const result = await splitCompletion(fakeCompletion(["{tours} are visits"]));
    expect(result.direct).toBeNull();
    expect(result.text).toBe("{tours} are visits");
    expect(result.rest).toBeNull();
  });
});

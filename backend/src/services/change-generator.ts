import { AIDesignResponseSchema } from "../types/changes";
import type { AIDesignResponse } from "../types/changes";

/**
 * Parse and validate the raw AI response text into a structured AIDesignResponse.
 * Handles common issues: markdown fences, trailing commas, partial JSON.
 */
export function parseAIResponse(rawText: string): AIDesignResponse {
  // Strip markdown code fences if present
  let cleaned = rawText.trim();

  // Remove ```json ... ``` or ``` ... ```
  const fenceMatch = cleaned.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  // Also handle case where text starts with ``` but doesn't end with it
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?\s*```$/, "");
  }

  // Try to extract JSON if there is text before/after the object
  const jsonStart = cleaned.indexOf("{");
  const jsonEnd = cleaned.lastIndexOf("}");
  if (jsonStart !== -1 && jsonEnd !== -1 && jsonStart < jsonEnd) {
    cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new AIParseError(
      `Failed to parse AI response as JSON: ${(e as Error).message}`,
      rawText
    );
  }

  // Validate against schema
  const result = AIDesignResponseSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new AIParseError(
      `AI response does not match expected schema: ${issues}`,
      rawText
    );
  }

  return result.data;
}

/**
 * Custom error for AI response parsing failures.
 */
export class AIParseError extends Error {
  public readonly rawResponse: string;

  constructor(message: string, rawResponse: string) {
    super(message);
    this.name = "AIParseError";
    this.rawResponse = rawResponse;
  }
}

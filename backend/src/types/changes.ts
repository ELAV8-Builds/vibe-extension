import { z } from "zod";

/**
 * A single change instruction returned by the AI.
 * Can be either a CSS change (selector + properties) or a DOM change (action on element).
 */
export const CSSChangeSchema = z.object({
  type: z.literal("css"),
  selector: z.string().min(1),
  properties: z.record(z.string(), z.string()),
});

export const DOMChangeSchema = z.object({
  type: z.literal("dom"),
  action: z.enum([
    "addClass",
    "removeClass",
    "setAttribute",
    "setText",
    "moveElement",
    "wrapElement",
  ]),
  selector: z.string().min(1),
  attribute: z.string().optional(),
  value: z.string().optional(),
});

export const ChangeInstructionSchema = z.discriminatedUnion("type", [
  CSSChangeSchema,
  DOMChangeSchema,
]);

export const AIDesignResponseSchema = z.object({
  changes: z.array(ChangeInstructionSchema),
  description: z.string(),
  suggestions: z.array(z.string()).max(3),
  reasoning: z.string().optional(),
});

export type CSSChange = z.infer<typeof CSSChangeSchema>;
export type DOMChange = z.infer<typeof DOMChangeSchema>;
export type ChangeInstruction = z.infer<typeof ChangeInstructionSchema>;
export type AIDesignResponse = z.infer<typeof AIDesignResponseSchema>;

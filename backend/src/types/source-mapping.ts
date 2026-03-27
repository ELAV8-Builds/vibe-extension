import { z } from "zod";

/**
 * Schema for a source mapping record linking a CSS selector to source code.
 */
export const SourceMappingSchema = z.object({
  id: z.string(),
  selector: z.string(),
  componentName: z.string().nullable(),
  filePath: z.string(),
  lineNumber: z.number().int().nullable(),
  columnNumber: z.number().int().nullable(),
  confidence: z.number().min(0).max(1),
  source: z.enum(["sourcemap", "heuristic", "manual", "ast"]),
  projectRoot: z.string().nullable(),
  framework: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type SourceMapping = z.infer<typeof SourceMappingSchema>;

/**
 * Schema for registering a single source mapping.
 */
export const RegisterMappingSchema = z.object({
  selector: z.string().min(1),
  componentName: z.string().optional(),
  filePath: z.string().min(1),
  lineNumber: z.number().int().optional(),
  columnNumber: z.number().int().optional(),
  confidence: z.number().min(0).max(1).optional(),
  source: z.enum(["sourcemap", "heuristic", "manual", "ast"]).optional(),
  projectRoot: z.string().optional(),
  framework: z.string().optional(),
});

export type RegisterMappingRequest = z.infer<typeof RegisterMappingSchema>;

/**
 * Schema for bulk-registering multiple source mappings.
 */
export const RegisterBulkMappingsSchema = z.object({
  mappings: z.array(RegisterMappingSchema).min(1).max(1000),
  projectRoot: z.string().optional(),
  framework: z.string().optional(),
});

export type RegisterBulkMappingsRequest = z.infer<typeof RegisterBulkMappingsSchema>;

/**
 * Schema for looking up a source mapping by selector.
 */
export const LookupMappingSchema = z.object({
  selector: z.string().min(1),
  minConfidence: z.number().min(0).max(1).optional(),
});

export type LookupMappingRequest = z.infer<typeof LookupMappingSchema>;

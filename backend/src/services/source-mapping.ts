import { v4 as uuidv4 } from "uuid";
import { getDatabase } from "../db";
import type {
  SourceMapping,
  RegisterMappingRequest,
} from "../types/source-mapping";

/**
 * Row shape returned by SQLite for source_mappings table.
 */
interface SourceMappingRow {
  id: string;
  selector: string;
  component_name: string | null;
  file_path: string;
  line_number: number | null;
  column_number: number | null;
  confidence: number;
  source: string;
  project_root: string | null;
  framework: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Convert a database row to a SourceMapping object with camelCase keys.
 */
function rowToMapping(row: SourceMappingRow): SourceMapping {
  return {
    id: row.id,
    selector: row.selector,
    componentName: row.component_name,
    filePath: row.file_path,
    lineNumber: row.line_number,
    columnNumber: row.column_number,
    confidence: row.confidence,
    source: row.source as SourceMapping["source"],
    projectRoot: row.project_root,
    framework: row.framework,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Service for managing CSS selector to source code mappings.
 */
export class SourceMappingService {
  /**
   * Register a single source mapping. If a mapping with the same selector
   * and file_path already exists, it will be updated.
   */
  register(mapping: RegisterMappingRequest): SourceMapping {
    const db = getDatabase();
    const now = new Date().toISOString();

    // Check for existing mapping with same selector + file_path
    const existing = db
      .prepare(
        "SELECT id FROM source_mappings WHERE selector = ? AND file_path = ?"
      )
      .get(mapping.selector, mapping.filePath) as
      | { id: string }
      | undefined;

    if (existing) {
      // Update existing mapping
      db.prepare(
        `UPDATE source_mappings
         SET component_name = ?, line_number = ?, column_number = ?,
             confidence = ?, source = ?, project_root = ?, framework = ?,
             updated_at = ?
         WHERE id = ?`
      ).run(
        mapping.componentName || null,
        mapping.lineNumber ?? null,
        mapping.columnNumber ?? null,
        mapping.confidence ?? 0.5,
        mapping.source ?? "heuristic",
        mapping.projectRoot || null,
        mapping.framework || null,
        now,
        existing.id
      );

      const updated = db
        .prepare("SELECT * FROM source_mappings WHERE id = ?")
        .get(existing.id) as SourceMappingRow;

      return rowToMapping(updated);
    }

    // Insert new mapping
    const id = uuidv4();
    db.prepare(
      `INSERT INTO source_mappings
         (id, selector, component_name, file_path, line_number, column_number,
          confidence, source, project_root, framework, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      mapping.selector,
      mapping.componentName || null,
      mapping.filePath,
      mapping.lineNumber ?? null,
      mapping.columnNumber ?? null,
      mapping.confidence ?? 0.5,
      mapping.source ?? "heuristic",
      mapping.projectRoot || null,
      mapping.framework || null,
      now,
      now
    );

    const inserted = db
      .prepare("SELECT * FROM source_mappings WHERE id = ?")
      .get(id) as SourceMappingRow;

    return rowToMapping(inserted);
  }

  /**
   * Bulk register multiple source mappings. Applies project root and
   * framework defaults to each mapping if not individually specified.
   * Returns the number of mappings registered.
   */
  registerBulk(
    mappings: RegisterMappingRequest[],
    projectRoot?: string,
    framework?: string
  ): number {
    const db = getDatabase();

    const insertOrUpdate = db.transaction(() => {
      let count = 0;
      for (const mapping of mappings) {
        // Apply defaults from bulk request
        const enriched: RegisterMappingRequest = {
          ...mapping,
          projectRoot: mapping.projectRoot || projectRoot,
          framework: mapping.framework || framework,
        };
        this.register(enriched);
        count++;
      }
      return count;
    });

    return insertOrUpdate();
  }

  /**
   * Look up source mappings for a CSS selector.
   * Also tries partial matches by progressively stripping the last
   * segment of the selector (e.g., ".card-header h2" -> ".card-header").
   */
  lookup(selector: string, minConfidence?: number): SourceMapping[] {
    const db = getDatabase();
    const confidence = minConfidence ?? 0;

    // Exact match first
    const exactRows = db
      .prepare(
        `SELECT * FROM source_mappings
         WHERE selector = ? AND confidence >= ?
         ORDER BY confidence DESC`
      )
      .all(selector, confidence) as SourceMappingRow[];

    if (exactRows.length > 0) {
      return exactRows.map(rowToMapping);
    }

    // Try partial matches by stripping the last segment
    const parts = selector.trim().split(/\s+/);
    const results: SourceMapping[] = [];

    for (let i = parts.length - 1; i >= 1; i--) {
      const partial = parts.slice(0, i).join(" ");
      const partialRows = db
        .prepare(
          `SELECT * FROM source_mappings
           WHERE selector = ? AND confidence >= ?
           ORDER BY confidence DESC`
        )
        .all(partial, confidence) as SourceMappingRow[];

      if (partialRows.length > 0) {
        results.push(...partialRows.map(rowToMapping));
        break;
      }
    }

    // Also try LIKE match for broader results
    if (results.length === 0) {
      const likeRows = db
        .prepare(
          `SELECT * FROM source_mappings
           WHERE selector LIKE ? AND confidence >= ?
           ORDER BY confidence DESC
           LIMIT 10`
        )
        .all(`%${selector}%`, confidence) as SourceMappingRow[];

      results.push(...likeRows.map(rowToMapping));
    }

    return results;
  }

  /**
   * Reverse lookup: find all selectors mapped to a given file path.
   */
  lookupByFile(filePath: string): SourceMapping[] {
    const db = getDatabase();
    const rows = db
      .prepare(
        `SELECT * FROM source_mappings
         WHERE file_path = ?
         ORDER BY selector ASC`
      )
      .all(filePath) as SourceMappingRow[];

    return rows.map(rowToMapping);
  }

  /**
   * Find all mappings for a given component name.
   */
  lookupByComponent(componentName: string): SourceMapping[] {
    const db = getDatabase();
    const rows = db
      .prepare(
        `SELECT * FROM source_mappings
         WHERE component_name = ?
         ORDER BY selector ASC`
      )
      .all(componentName) as SourceMappingRow[];

    return rows.map(rowToMapping);
  }

  /**
   * Delete all mappings associated with a project root.
   * Returns the number of deleted rows.
   */
  deleteByProject(projectRoot: string): number {
    const db = getDatabase();
    const result = db
      .prepare("DELETE FROM source_mappings WHERE project_root = ?")
      .run(projectRoot);

    return result.changes;
  }

  /**
   * Get statistics about the current source mappings.
   */
  getStats(): {
    total: number;
    bySource: Record<string, number>;
    byFramework: Record<string, number>;
    avgConfidence: number;
  } {
    const db = getDatabase();

    // Total count
    const totalRow = db
      .prepare("SELECT COUNT(*) as total FROM source_mappings")
      .get() as { total: number };

    // Count by source
    const sourceRows = db
      .prepare(
        "SELECT source, COUNT(*) as count FROM source_mappings GROUP BY source"
      )
      .all() as { source: string; count: number }[];

    const bySource: Record<string, number> = {};
    for (const row of sourceRows) {
      bySource[row.source] = row.count;
    }

    // Count by framework
    const frameworkRows = db
      .prepare(
        `SELECT COALESCE(framework, 'unknown') as framework, COUNT(*) as count
         FROM source_mappings
         GROUP BY framework`
      )
      .all() as { framework: string; count: number }[];

    const byFramework: Record<string, number> = {};
    for (const row of frameworkRows) {
      byFramework[row.framework] = row.count;
    }

    // Average confidence
    const avgRow = db
      .prepare(
        "SELECT COALESCE(AVG(confidence), 0) as avg FROM source_mappings"
      )
      .get() as { avg: number };

    return {
      total: totalRow.total,
      bySource,
      byFramework,
      avgConfidence: Math.round(avgRow.avg * 1000) / 1000,
    };
  }
}

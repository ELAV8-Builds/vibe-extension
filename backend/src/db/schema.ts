import Database from "better-sqlite3";

/**
 * SQL statements to create the database schema.
 * Called on startup — uses IF NOT EXISTS for idempotency.
 */
export function createSchema(db: Database.Database): void {
  // Enable WAL mode for better concurrent read performance
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      title TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      dom_snapshot TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS snapshots (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      css_state TEXT NOT NULL,
      dom_changes TEXT,
      thumbnail BLOB,
      description TEXT,
      message_index INTEGER,
      created_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_session
      ON messages(session_id, created_at);

    CREATE INDEX IF NOT EXISTS idx_snapshots_session
      ON snapshots(session_id, created_at);

    CREATE TABLE IF NOT EXISTS source_mappings (
      id TEXT PRIMARY KEY,
      selector TEXT NOT NULL,
      component_name TEXT,
      file_path TEXT NOT NULL,
      line_number INTEGER,
      column_number INTEGER,
      confidence REAL NOT NULL DEFAULT 0.5,
      source TEXT NOT NULL DEFAULT 'heuristic' CHECK (source IN ('sourcemap', 'heuristic', 'manual', 'ast')),
      project_root TEXT,
      framework TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_source_mappings_selector
      ON source_mappings(selector);

    CREATE INDEX IF NOT EXISTS idx_source_mappings_file
      ON source_mappings(file_path);

    CREATE INDEX IF NOT EXISTS idx_source_mappings_component
      ON source_mappings(component_name);
  `);
}

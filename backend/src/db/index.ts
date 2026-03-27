import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { createSchema } from "./schema";

let db: Database.Database | null = null;

/**
 * Initialize the SQLite database connection.
 * Creates the data directory if it does not exist.
 * Runs migrations (schema creation) on startup.
 */
export function initDatabase(databasePath: string): Database.Database {
  // Ensure the directory exists
  const dir = path.dirname(databasePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(databasePath);

  // Run schema creation / migrations
  createSchema(db);

  console.log(`Database initialized at ${databasePath}`);
  return db;
}

/**
 * Get the current database instance.
 * Throws if the database has not been initialized.
 */
export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error(
      "Database not initialized. Call initDatabase() before accessing the database."
    );
  }
  return db;
}

/**
 * Close the database connection gracefully.
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    console.log("Database connection closed.");
  }
}

/**
 * Check if the database is connected and operational.
 */
export function isDatabaseHealthy(): boolean {
  try {
    if (!db) return false;
    const result = db.prepare("SELECT 1 AS ok").get() as
      | { ok: number }
      | undefined;
    return result?.ok === 1;
  } catch {
    return false;
  }
}

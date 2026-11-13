import { drizzle } from "drizzle-orm/mysql2";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      const e = error as { code?: string; message?: string };
      console.warn(
        `[Database] Failed to initialise: ${e.code ?? ""} ${(e.message ?? "").replace(/\w+:\/\/\S+/g, "<url>").slice(0, 300)}`,
      );
      _db = null;
    }
  } else if (!_db) {
    console.warn("[Database] DATABASE_URL is not set in this environment");
  }
  return _db;
}

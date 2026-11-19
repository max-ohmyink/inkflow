import { drizzle } from "drizzle-orm/mysql2";
import type { PoolOptions } from "mysql2";

let _db: ReturnType<typeof drizzle> | null = null;

/** Parses an ssl object written as JSON, or as JSON whose quotes a shell stripped. */
function parseSslObject(value: string): Record<string, unknown> | undefined {
  const text = value.trim();
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    // Fall through to the lenient form: {minVersion:TLSv1.2,rejectUnauthorized:true}
  }
  if (!text.startsWith("{") || !text.endsWith("}")) return undefined;
  const result: Record<string, unknown> = {};
  for (const pair of text.slice(1, -1).split(",")) {
    const separator = pair.indexOf(":");
    if (separator < 1) return undefined;
    const key = pair.slice(0, separator).trim().replace(/^["']|["']$/g, "");
    const raw = pair
      .slice(separator + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (!key) return undefined;
    result[key] =
      raw === "true"
        ? true
        : raw === "false"
          ? false
          : raw !== "" && !Number.isNaN(Number(raw))
            ? Number(raw)
            : raw;
  }
  return result;
}

/**
 * mysql2 reads an object-valued `ssl` from the URL query only when it is valid JSON, but shells
 * (notably PowerShell) strip the quotes from `ssl={"minVersion":...}` before the value reaches us.
 * Accept the quoted, URL-encoded and quote-stripped forms by moving `ssl` out of the URL.
 */
/** Removes quote characters that some shells leave around a pasted value. */
export function cleanDatabaseUrl(value: string): string {
  return value.trim().replace(/^["']+|["']+$/g, "");
}

export function databaseConnection(input: string): string | PoolOptions {
  const url = cleanDatabaseUrl(input);
  const match = url.match(/([?&])ssl=([^&]*)/);
  if (!match) return url;
  let value = match[2];
  try {
    value = decodeURIComponent(value);
  } catch {
    // Keep the raw text if it is not valid percent-encoding.
  }
  const ssl = parseSslObject(value);
  if (!ssl) return url; // a named SSL profile (e.g. "Amazon RDS") stays in the URL
  const rest = url
    .replace(match[0], match[1] === "?" ? "?" : "")
    .replace(/\?&/, "?")
    .replace(/\?$/, "");
  return { uri: rest, ssl: ssl as PoolOptions["ssl"] };
}

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle({ connection: databaseConnection(process.env.DATABASE_URL) });
    } catch (error) {
      const e = error as { code?: string; message?: string };
      const cleaned = cleanDatabaseUrl(process.env.DATABASE_URL);
      if (!cleaned.startsWith("mysql://"))
        console.warn(
          `[Database] DATABASE_URL must start with mysql:// but starts with ${JSON.stringify(cleaned.slice(0, 8))}`,
        );
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

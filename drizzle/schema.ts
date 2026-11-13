import {
  boolean,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** External account identifier. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/** Durable guest-owned stencil generation work; capability tokens are stored only as SHA-256 hashes. */
export const stencilJobs = mysqlTable(
  "stencil_jobs",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    tokenHash: varchar("tokenHash", { length: 64 }).notNull(),
    clientId: varchar("clientId", { length: 128 }).notNull(),
    requestId: varchar("requestId", { length: 128 }),
    concept: varchar("concept", { length: 240 }).notNull(),
    style: mysqlEnum("style", ["fine_line", "traditional", "geometric", "cyber"]).notNull(),
    medium: mysqlEnum("medium", ["blackwork", "jagua", "twotone"]).notNull(),
    prompt: text("prompt").notNull(),
    status: mysqlEnum("status", ["queued", "generating", "processing", "ready", "failed"])
      .notNull()
      .default("queued"),
    stage: varchar("stage", { length: 128 }).notNull().default("Queued"),
    progress: int("progress").notNull().default(0),
    error: varchar("error", { length: 512 }),
    workerId: varchar("workerId", { length: 128 }),
    startedAt: timestamp("startedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    uniqueIndex("stencil_jobs_client_request_unique").on(table.clientId, table.requestId),
    index("stencil_jobs_status_started_index").on(table.status, table.startedAt),
  ],
);

/** Stable storage-key index for each color original, mirrored stencil PNG, and optional true SVG. */
export const stencilOptions = mysqlTable(
  "stencil_options",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    jobId: varchar("jobId", { length: 36 }).notNull(),
    optionIndex: int("optionIndex").notNull(),
    originalStorageKey: varchar("originalStorageKey", { length: 512 }).notNull(),
    stencilStorageKey: varchar("stencilStorageKey", { length: 512 }).notNull(),
    svgStorageKey: varchar("svgStorageKey", { length: 512 }),
    width: int("width").notNull(),
    height: int("height").notNull(),
    mirrored: boolean("mirrored").notNull().default(true),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("stencil_options_job_index_unique").on(table.jobId, table.optionIndex),
    index("stencil_options_job_index").on(table.jobId),
  ],
);

export type StencilJob = typeof stencilJobs.$inferSelect;
export type InsertStencilJob = typeof stencilJobs.$inferInsert;
export type StencilOption = typeof stencilOptions.$inferSelect;
export type InsertStencilOption = typeof stencilOptions.$inferInsert;

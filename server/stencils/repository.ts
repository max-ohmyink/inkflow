import { and, asc, count, eq, inArray } from "drizzle-orm";
import {
  stencilJobs,
  stencilOptions,
  type InsertStencilJob,
  type InsertStencilOption,
} from "../../drizzle/schema";
import { getDb } from "../db";

export type StencilJobRow = typeof stencilJobs.$inferSelect;
export type StencilOptionRow = typeof stencilOptions.$inferSelect;

const ACTIVE_STATUSES = ["generating", "processing"] as const;

async function databaseOrThrow() {
  const db = await getDb();
  if (!db) throw new Error("database_unavailable");
  return db;
}

export async function findStencilJob(
  id: string,
): Promise<StencilJobRow | undefined> {
  const db = await databaseOrThrow();
  return (
    await db.select().from(stencilJobs).where(eq(stencilJobs.id, id)).limit(1)
  )[0];
}

export async function findStencilJobByRequest(
  clientId: string,
  requestId: string,
): Promise<StencilJobRow | undefined> {
  const db = await databaseOrThrow();
  return (
    await db
      .select()
      .from(stencilJobs)
      .where(
        and(
          eq(stencilJobs.clientId, clientId),
          eq(stencilJobs.requestId, requestId),
        ),
      )
      .limit(1)
  )[0];
}

export async function insertStencilJob(job: InsertStencilJob): Promise<void> {
  const db = await databaseOrThrow();
  await db.insert(stencilJobs).values(job);
}

export async function countClientActiveJobs(clientId: string): Promise<number> {
  const db = await databaseOrThrow();
  const result = await db
    .select({ total: count() })
    .from(stencilJobs)
    .where(
      and(
        eq(stencilJobs.clientId, clientId),
        inArray(stencilJobs.status, [...ACTIVE_STATUSES]),
      ),
    );
  return Number(result[0]?.total ?? 0);
}

export async function markJobGenerating(
  id: string,
  workerId: string,
): Promise<void> {
  const db = await databaseOrThrow();
  await db
    .update(stencilJobs)
    .set({
      status: "generating",
      stage: "Selecting catalog designs",
      progress: 12,
      workerId,
      startedAt: new Date(),
      error: null,
    })
    .where(eq(stencilJobs.id, id));
}

export async function markJobProcessing(id: string): Promise<void> {
  const db = await databaseOrThrow();
  await db
    .update(stencilJobs)
    .set({
      status: "processing",
      stage: "Preparing stencil files",
      progress: 58,
    })
    .where(eq(stencilJobs.id, id));
}

export async function markJobFailed(id: string, error: string): Promise<void> {
  const db = await databaseOrThrow();
  await db
    .update(stencilJobs)
    .set({
      status: "failed",
      stage: "Failed",
      progress: 100,
      error,
      workerId: null,
    })
    .where(eq(stencilJobs.id, id));
}

export async function saveReadyStencilOptions(
  jobId: string,
  options: InsertStencilOption[],
  readyPrompt?: string,
): Promise<void> {
  const db = await databaseOrThrow();
  await db.transaction(async (tx) => {
    await tx.insert(stencilOptions).values(options);
    await tx
      .update(stencilJobs)
      .set({
        status: "ready",
        stage: "Ready for preview",
        progress: 100,
        workerId: null,
        error: null,
        ...(readyPrompt ? { prompt: readyPrompt } : {}),
      })
      .where(eq(stencilJobs.id, jobId));
  });
}

export async function listStencilOptions(
  jobId: string,
): Promise<StencilOptionRow[]> {
  const db = await databaseOrThrow();
  return db
    .select()
    .from(stencilOptions)
    .where(eq(stencilOptions.jobId, jobId))
    .orderBy(asc(stencilOptions.optionIndex));
}

export async function listQueuedStencilJobs(
  limit = 100,
): Promise<StencilJobRow[]> {
  const db = await databaseOrThrow();
  return db
    .select()
    .from(stencilJobs)
    .where(eq(stencilJobs.status, "queued"))
    .orderBy(asc(stencilJobs.createdAt))
    .limit(limit);
}

/** Single-worker startup runs before accepting requests; all old active rows are orphaned. */
export async function failOrphanedInProcessStencilJobs(): Promise<number> {
  const db = await databaseOrThrow();
  const result = await db
    .update(stencilJobs)
    .set({
      status: "failed",
      stage: "Failed",
      progress: 100,
      error:
        "Catalog selection did not finish. Please create a new request to retry.",
      workerId: null,
    })
    .where(inArray(stencilJobs.status, [...ACTIVE_STATUSES]));
  return Number(result[0]?.affectedRows ?? 0);
}

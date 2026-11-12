import crypto from "node:crypto";
import type { InsertStencilOption } from "../../drizzle/schema";
import {
  DEFAULT_CATALOG_FILTERS,
  catalogDesignSelectionFilters,
  filterCatalogByChoices,
  matchesCatalogFilters,
  type CatalogColorMix,
  type CatalogFilters,
} from "../../shared/catalog-filters";
import {
  isAllowedFamilyArtStyle,
  isFamilyDesignId,
  isUnsafeFamilyTheme,
} from "../../shared/family-designs";
import { findCatalogMatches } from "../../shared/catalog-matching";
import {
  aiFallbackMetadataInput,
  compileAiFallbackGenerationPrompt,
} from "./aiFallback";
import {
  ColorVersionError,
  createColorVersion,
  isColorVersionMode,
  safeColorFailureDetails,
} from "./colorVersion";
import {
  persistActualColorTreatments,
  type ActualColorTreatment,
} from "./colorOutcomes";
import {
  colorModeForCatalogPrompt,
  createCatalogJobPrompt,
  eligibleCatalogRecords,
  fillEnclosedRegionsForCatalogPrompt,
  getValidatedCatalogRecord,
  parseCatalogJobPrompt,
  readCatalogOriginalPng,
  recordsForCatalogPrompt,
  type ValidatedCatalogRecord,
} from "./catalogOutput";
import {
  createAiJobPrompt,
  declaredMetadataMode,
  isVersionedStencilMetadata,
  parseAiJobPrompt,
  type AiJobPromptV1,
} from "./jobMetadata";
import { createMirroredStencilPng, traceStencilSvg } from "./imageProcessor";
import { StencilInputError, type StencilInput } from "./prompt";
import { generateImage, putStencilObject } from "./platform";
import type { PlatformServiceError } from "./platform";
import {
  countClientActiveJobs,
  failOrphanedInProcessStencilJobs,
  findStencilJob,
  findStencilJobByRequest,
  insertStencilJob,
  listQueuedStencilJobs,
  markJobFailed,
  markJobGenerating,
  markJobProcessing,
  saveReadyStencilOptions,
  type StencilJobRow,
} from "./repository";

const GLOBAL_CONCURRENCY = 2;
const CLIENT_CONCURRENCY = 2;
const workerId = `inkflow-${process.pid}-${crypto.randomUUID()}`;
const SAFE_AI_FAILURE =
  "Your AI tattoo ideas could not be prepared. Please create a new request to retry.";
const SAFE_CATALOG_FAILURE =
  "Catalog artwork could not be prepared. Please create a new request to retry.";

type QueueItem = Pick<StencilJobRow, "id" | "clientId">;
type PublicSource = "catalog" | "ai" | "legacy";
type ColorIntent = {
  colorMode?: CatalogColorMix;
  fillEnclosedRegions: boolean;
  /** Parent-owned filter parsing may supply selected inks for a derived color version. */
  inkColors?: CatalogFilters["inkColors"];
};
type NewSourceDecision =
  | {
      source: "catalog";
      records: ValidatedCatalogRecord[];
      filters: CatalogFilters;
    }
  | { source: "ai"; metadata: AiJobPromptV1 };
type StoredSourceDecision =
  | {
      source: "catalog";
      records: ValidatedCatalogRecord[];
      color: ColorIntent;
    }
  | { source: "ai"; metadata: AiJobPromptV1; color: ColorIntent }
  | {
      source: "legacy";
      records: ValidatedCatalogRecord[];
      color: ColorIntent;
    };

export class ClientGenerationLimitError extends Error {
  constructor() {
    super("generation_limit_reached");
    this.name = "ClientGenerationLimitError";
  }
}

export function createCapabilityToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashCapabilityToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function objectKey(
  jobId: string,
  index: number,
  variant: "original" | "stencil" | "vector" | "color",
): string {
  const extension = variant === "vector" ? "svg" : "png";
  return `stencils/${jobId}/${index}-${variant}.${extension}`;
}

const JOB_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** The color object has no DB column: its safe key is derived only from validated stored intent. */
export function colorVersionObjectKey(
  jobId: string,
  index: number,
  colorMode: unknown,
): string {
  if (
    !JOB_ID_PATTERN.test(jobId) ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= 4 ||
    !isColorVersionMode(colorMode)
  ) {
    throw new Error("color_version_key_invalid");
  }
  return objectKey(jobId, index, "color");
}

/**
 * Historical public helper retained for legacy callers/tests. It remains strict and throws on no
 * match; only catalog-first request selection catches that one specific failure for valid free text.
 */
export function matchingCatalogRecords(
  concept: string,
  filters: CatalogFilters = DEFAULT_CATALOG_FILTERS,
): ValidatedCatalogRecord[] {
  const filteredRecords = filterCatalogByChoices(
    eligibleCatalogRecords,
    catalogDesignSelectionFilters(filters),
  );
  const matches = findCatalogMatches(filteredRecords, concept);
  const records = matches
    .map((match) => getValidatedCatalogRecord(match.id))
    .filter((record): record is ValidatedCatalogRecord => Boolean(record));
  if (!records.length) throw new StencilInputError("catalog_no_match");
  return records;
}

/** New event work gets the curated pool; this leaves historical matching/recovery untouched. */
function matchingFamilyCatalogRecords(
  concept: string,
  filters: CatalogFilters,
): ValidatedCatalogRecord[] {
  const filteredRecords = filterCatalogByChoices(
    eligibleCatalogRecords.filter((record) => isFamilyDesignId(record.id)),
    catalogDesignSelectionFilters(filters),
  );
  const matches = findCatalogMatches(filteredRecords, concept);
  const records = matches
    .map((match) => getValidatedCatalogRecord(match.id))
    .filter((record): record is ValidatedCatalogRecord => Boolean(record));
  if (!records.length) throw new StencilInputError("catalog_no_match");
  return records;
}

function inkColorsForFilters(
  filters: CatalogFilters,
): CatalogFilters["inkColors"] {
  return filters.inkColors;
}

/** This guard applies only to requests that did not already recover an owned saved job. */
function assertNewFamilyRequest(input: StencilInput): void {
  const filters = input.filters ?? DEFAULT_CATALOG_FILTERS;
  if (
    !isAllowedFamilyArtStyle(filters.artStyle) ||
    isUnsafeFamilyTheme(input.concept)
  ) {
    throw new StencilInputError("family_design_only");
  }
}

/**
 * An exact gallery ID is a catalog-only path. Valid free text is the only selection route allowed
 * to catch catalog_no_match and choose a persisted AI fallback decision.
 */
function selectCatalogFirstDecision(input: StencilInput): NewSourceDecision {
  const filters = input.filters ?? DEFAULT_CATALOG_FILTERS;
  const sourceFilters = catalogDesignSelectionFilters(filters);
  if (input.catalogId) {
    const selected = getValidatedCatalogRecord(input.catalogId);
    if (
      !selected ||
      !isFamilyDesignId(selected.id) ||
      !matchesCatalogFilters(selected, sourceFilters)
    ) {
      throw new StencilInputError("catalog_no_match");
    }
    return { source: "catalog", records: [selected], filters };
  }

  try {
    return {
      source: "catalog",
      records: matchingFamilyCatalogRecords(input.concept, filters),
      filters,
    };
  } catch (error) {
    if (
      !(error instanceof StencilInputError) ||
      error.message !== "catalog_no_match"
    ) {
      throw error;
    }
    const fallback = aiFallbackMetadataInput(
      input.concept,
      input.style,
      filters,
    );
    return {
      source: "ai",
      metadata: { version: 1, mode: "ai", ...fallback },
    };
  }
}

class InProcessStencilQueue {
  private pending: QueueItem[] = [];
  private pendingIds = new Set<string>();
  private active = 0;
  private activeByClient = new Map<string, number>();

  enqueue(item: QueueItem): void {
    if (this.pendingIds.has(item.id)) return;
    this.pending.push(item);
    this.pendingIds.add(item.id);
    this.drain();
  }

  private drain(): void {
    while (this.active < GLOBAL_CONCURRENCY && this.pending.length) {
      let next: QueueItem | undefined;
      const attempts = this.pending.length;
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        const candidate = this.pending.shift();
        if (!candidate) break;
        const clientActive = this.activeByClient.get(candidate.clientId) ?? 0;
        if (clientActive < CLIENT_CONCURRENCY) {
          next = candidate;
          break;
        }
        this.pending.push(candidate);
      }
      if (!next) return;

      this.pendingIds.delete(next.id);
      this.active += 1;
      this.activeByClient.set(
        next.clientId,
        (this.activeByClient.get(next.clientId) ?? 0) + 1,
      );
      void this.run(next).finally(() => {
        this.active -= 1;
        const remaining = (this.activeByClient.get(next.clientId) ?? 1) - 1;
        if (remaining > 0) this.activeByClient.set(next.clientId, remaining);
        else this.activeByClient.delete(next.clientId);
        this.drain();
      });
    }
  }

  private async run(item: QueueItem): Promise<void> {
    try {
      await runStencilJob(item.id);
    } catch {
      // runStencilJob records a safe guest-facing failure; never expose storage details in logs.
    }
  }
}

const queue = new InProcessStencilQueue();

function recoveredRequest(prior: StencilJobRow, input: StencilInput) {
  const supplied = input.capabilityToken;
  if (
    supplied &&
    crypto.timingSafeEqual(
      Buffer.from(prior.tokenHash, "hex"),
      Buffer.from(hashCapabilityToken(supplied), "hex"),
    )
  ) {
    // Echo the client-supplied credential only after validating it. Never reissue a stored secret.
    return { id: prior.id, token: supplied, reused: false };
  }
  return { id: prior.id, token: "", reused: true };
}

/** Persist the catalog/AI source decision before enqueueing so idempotency never repeats paid work. */
export async function createStencilJob(
  submittedInput: StencilInput,
): Promise<{ id: string; token: string; reused: boolean }> {
  if (submittedInput.requestId) {
    const prior = await findStencilJobByRequest(
      submittedInput.clientId,
      submittedInput.requestId,
    );
    if (prior) return recoveredRequest(prior, submittedInput);
  }

  assertNewFamilyRequest(submittedInput);

  if (
    (await countClientActiveJobs(submittedInput.clientId)) >= CLIENT_CONCURRENCY
  ) {
    throw new ClientGenerationLimitError();
  }

  const input = submittedInput;
  const decision = selectCatalogFirstDecision(input);
  const id = crypto.randomUUID();
  const token = input.capabilityToken ?? createCapabilityToken();
  const prompt =
    decision.source === "catalog"
      ? createCatalogJobPrompt(decision.records, decision.filters)
      : createAiJobPrompt(decision.metadata);
  try {
    await insertStencilJob({
      id,
      tokenHash: hashCapabilityToken(token),
      clientId: input.clientId,
      requestId: input.requestId ?? null,
      concept: input.concept,
      style: input.style,
      medium: input.medium,
      prompt,
      status: "queued",
      stage: "Queued",
      progress: 0,
    });
  } catch (error) {
    // A simultaneous duplicate idempotency request may have won the unique key race.
    if (input.requestId) {
      const prior = await findStencilJobByRequest(
        input.clientId,
        input.requestId,
      );
      if (prior) return recoveredRequest(prior, input);
    }
    throw error;
  }

  queue.enqueue({ id, clientId: input.clientId });
  return { id, token, reused: false };
}

function storedSourceDecision(job: StencilJobRow): StoredSourceDecision {
  const catalogPrompt = parseCatalogJobPrompt(job.prompt);
  if (catalogPrompt) {
    const records = recordsForCatalogPrompt(job.prompt);
    if (!records) throw new Error("catalog_selection_invalid");
    return {
      source: "catalog",
      records,
      color: {
        colorMode: colorModeForCatalogPrompt(job.prompt),
        fillEnclosedRegions: fillEnclosedRegionsForCatalogPrompt(job.prompt),
        inkColors: inkColorsForFilters(catalogPrompt.filters),
      },
    };
  }

  const aiPrompt = parseAiJobPrompt(job.prompt);
  if (aiPrompt) {
    return {
      source: "ai",
      metadata: aiPrompt,
      color: {
        colorMode: aiPrompt.colorMode,
        fillEnclosedRegions: aiPrompt.fillEnclosedRegions,
        inkColors: inkColorsForFilters(aiPrompt.filters),
      },
    };
  }

  // A malformed/unsupported decision must never fall through into legacy matching or new AI work.
  if (isVersionedStencilMetadata(job.prompt)) {
    throw new Error("stored_source_metadata_invalid");
  }

  // Old queued free-form rows retain catalog-only recovery. They never gain AI fallback implicitly.
  return {
    source: "legacy",
    records: matchingCatalogRecords(job.concept),
    color: { fillEnclosedRegions: false },
  };
}

/** Only a typed failed upload of the optional color object is recoverable here. */
function isColorStorageUploadFailure(
  error: unknown,
): error is PlatformServiceError {
  const candidate =
    error && typeof error === "object"
      ? (error as { name?: unknown; message?: unknown })
      : undefined;
  return (
    candidate?.name === "PlatformServiceError" &&
    candidate.message === "storage_upload_failed"
  );
}

function canLeaveOptionalColorUnavailable(
  color: ColorIntent,
  error: unknown,
): boolean {
  return (
    color.fillEnclosedRegions &&
    isColorVersionMode(color.colorMode) &&
    (error instanceof ColorVersionError || isColorStorageUploadFailure(error))
  );
}

async function prepareStencilOption(input: {
  jobId: string;
  index: number;
  original: Buffer;
  color: ColorIntent;
  outcomes?: ActualColorTreatment[];
}): Promise<InsertStencilOption> {
  const originalKey = objectKey(input.jobId, input.index, "original");
  const stencilKey = objectKey(input.jobId, input.index, "stencil");
  await putStencilObject(originalKey, input.original, "image/png");

  if (isColorVersionMode(input.color.colorMode)) {
    try {
      const color = await createColorVersion(
        input.original,
        input.color.colorMode,
        { generateImage },
        {
          fillEnclosedRegions: input.color.fillEnclosedRegions,
          ...(input.color.inkColors === undefined
            ? {}
            : { inkColors: input.color.inkColors }),
        },
      );
      await putStencilObject(
        colorVersionObjectKey(input.jobId, input.index, input.color.colorMode),
        color.png,
        "image/png",
      );
      if (input.outcomes) input.outcomes[input.index] = color.treatment;
    } catch (error) {
      if (!canLeaveOptionalColorUnavailable(input.color, error)) throw error;
      if (input.outcomes) input.outcomes[input.index] = "unavailable";
      console.warn("[color-version-unavailable]", {
        jobId: input.jobId,
        index: input.index,
        ...safeColorFailureDetails(error),
      });
    }
  }

  // Artist preparation always derives from the uncolored normal-orientation original.
  const processed = await createMirroredStencilPng(input.original);
  await putStencilObject(stencilKey, processed.png, "image/png");

  const svg = await traceStencilSvg(processed.png);
  let svgStorageKey: string | null = null;
  if (svg) {
    svgStorageKey = objectKey(input.jobId, input.index, "vector");
    await putStencilObject(
      svgStorageKey,
      Buffer.from(svg, "utf8"),
      "image/svg+xml",
    );
  }

  return {
    id: crypto.randomUUID(),
    jobId: input.jobId,
    optionIndex: input.index,
    originalStorageKey: originalKey,
    stencilStorageKey: stencilKey,
    svgStorageKey,
    width: processed.width,
    height: processed.height,
    mirrored: true,
  };
}

async function prepareCatalogOptions(
  jobId: string,
  records: readonly ValidatedCatalogRecord[],
  color: ColorIntent,
  outcomes?: ActualColorTreatment[],
): Promise<InsertStencilOption[]> {
  const options: InsertStencilOption[] = [];
  for (const [index, record] of records.entries()) {
    const original = await readCatalogOriginalPng(record);
    options.push(
      await prepareStencilOption({ jobId, index, original, color, outcomes }),
    );
  }
  return options;
}

async function prepareAiOptions(
  jobId: string,
  metadata: AiJobPromptV1,
  color: ColorIntent,
  outcomes?: ActualColorTreatment[],
): Promise<InsertStencilOption[]> {
  // Exactly one provider generation produces a native 2x2 contact sheet; no model is hardcoded.
  const generated = await generateImage(
    compileAiFallbackGenerationPrompt({
      concept: metadata.concept,
      style: metadata.style,
      filters: metadata.filters,
    }),
  );
  const { splitContactSheet } = await import("./imageProcessor");
  const quadrants = await splitContactSheet(generated.bytes);
  if (quadrants.length !== 4) throw new Error("contact_sheet_invalid");

  const options: InsertStencilOption[] = [];
  for (const quadrant of quadrants) {
    if (
      !Number.isInteger(quadrant.index) ||
      quadrant.index < 0 ||
      quadrant.index >= 4
    )
      throw new Error("contact_sheet_invalid");
    options.push(
      await prepareStencilOption({
        jobId,
        index: quadrant.index,
        original: quadrant.bytes,
        color,
        outcomes,
      }),
    );
  }
  return options.sort((left, right) => left.optionIndex - right.optionIndex);
}

/** Explicit retry is intentionally a new POST/request; provider work is never retried automatically. */
export async function runStencilJob(jobId: string): Promise<void> {
  let source: PublicSource = "legacy";
  try {
    // The job fields came from our database after request validation, never from a client-supplied URL.
    const job = await findStencilJob(jobId);
    if (!job || job.status !== "queued") return;

    source = declaredMetadataMode(job.prompt) ?? "legacy";
    await markJobGenerating(job.id, workerId);
    const decision = storedSourceDecision(job);
    source = decision.source;
    await markJobProcessing(job.id);

    const outcomes: ActualColorTreatment[] = [];
    const options =
      decision.source === "ai"
        ? await prepareAiOptions(
            job.id,
            decision.metadata,
            decision.color,
            outcomes,
          )
        : await prepareCatalogOptions(
            job.id,
            decision.records,
            decision.color,
            outcomes,
          );
    if (outcomes.length && decision.color.fillEnclosedRegions) {
      await saveReadyStencilOptions(
        job.id,
        options,
        persistActualColorTreatments(job.prompt, outcomes),
      );
    } else {
      await saveReadyStencilOptions(job.id, options);
    }
  } catch (error) {
    try {
      await markJobFailed(
        jobId,
        error instanceof ColorVersionError
          ? error.message
          : source === "ai"
            ? SAFE_AI_FAILURE
            : SAFE_CATALOG_FAILURE,
      );
    } catch {
      // The database may be unavailable; no storage error is ever sent to the guest.
    }
  }
}

/** Called before listening. Queued V1/V2/V3/AI decisions recover safely; old legacy rows stay catalog-only. */
export async function startStencilWorker(): Promise<void> {
  await failOrphanedInProcessStencilJobs();
  const queued = await listQueuedStencilJobs();
  for (const job of queued)
    queue.enqueue({ id: job.id, clientId: job.clientId });
}

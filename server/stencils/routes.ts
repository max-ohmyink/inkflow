import crypto from "node:crypto";
import type { Express, Request, Response } from "express";
import { TATTOO_INKS } from "../../shared/tattoo-inks";
import {
  CATALOG_CATEGORY_OPTIONS,
  CATALOG_COLOR_OPTIONS,
  CATALOG_STYLE_OPTIONS,
} from "../../shared/catalog-filters";
import {
  MEDIUM_OPTIONS,
  STYLE_OPTIONS,
  parseStencilInput,
  StencilInputError,
} from "./prompt";
import {
  getCachedStencilDownloadUrl,
  isStencilPlatformConfigured,
} from "./platform";
import { potraceIsAvailable, stencilProcessingConfig } from "./imageProcessor";
import {
  findStencilJob,
  listStencilOptions,
  type StencilJobRow,
} from "./repository";
import {
  ClientGenerationLimitError,
  colorVersionObjectKey,
  createStencilJob,
  hashCapabilityToken,
} from "./service";
import {
  colorModeForCatalogPrompt,
  colorTreatmentForCatalogPrompt,
  catalogOptionMetadataForPrompt,
  eligibleCatalogCount,
  parseCatalogJobPrompt,
} from "./catalogOutput";
import { isColorVersionMode } from "./colorVersion";
import { aiFallbackOptionTitle } from "./aiFallback";
import { parseAiJobPrompt } from "./jobMetadata";
import { parseActualColorTreatments } from "./colorOutcomes";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readCapabilityToken(req: Request): string | undefined {
  const queryToken = req.query.token;
  if (
    typeof queryToken === "string" &&
    queryToken.length >= 32 &&
    queryToken.length <= 256
  ) {
    return queryToken;
  }
  const authorization = req.header("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || undefined;
}

function constantTimeEqualHash(expected: string, token: string): boolean {
  const supplied = hashCapabilityToken(token);
  const expectedBuffer = Buffer.from(expected, "hex");
  const suppliedBuffer = Buffer.from(supplied, "hex");
  return (
    expectedBuffer.length === suppliedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, suppliedBuffer)
  );
}

async function authorizedJob(
  req: Request,
  res: Response,
): Promise<StencilJobRow | undefined> {
  const id = req.params.id;
  const token = readCapabilityToken(req);
  if (!UUID_PATTERN.test(id) || !token) {
    res.status(401).json({ error: "unauthorized" });
    return undefined;
  }
  try {
    const job = await findStencilJob(id);
    if (!job || !constantTimeEqualHash(job.tokenHash, token)) {
      res.status(401).json({ error: "unauthorized" });
      return undefined;
    }
    return job;
  } catch {
    res.status(503).json({ error: "service_unavailable" });
    return undefined;
  }
}

function tokenizedAssetPath(
  jobId: string,
  index: number,
  suffix: string,
  token: string,
): string {
  return `/api/stencils/${jobId}/options/${index}${suffix}?token=${encodeURIComponent(token)}`;
}

async function publicJobPayload(job: StencilJobRow, token: string) {
  const options = await listStencilOptions(job.id);
  const catalogPrompt = parseCatalogJobPrompt(job.prompt);
  const aiPrompt = parseAiJobPrompt(job.prompt);
  const source = catalogPrompt ? "catalog" : aiPrompt ? "ai" : "legacy";
  const filters = catalogPrompt?.filters ?? aiPrompt?.filters;
  const colorMode = catalogPrompt
    ? colorModeForCatalogPrompt(job.prompt)
    : aiPrompt?.colorMode;
  const hasReadyColorVersion =
    job.status === "ready" && isColorVersionMode(colorMode);
  const actualTreatments = parseActualColorTreatments(job.prompt);

  return {
    id: job.id,
    status: job.status,
    stage: job.stage,
    progress: job.progress,
    concept: job.concept,
    style: job.style,
    medium: job.medium,
    source,
    ...(filters ? { filters } : {}),
    ...(job.error ? { error: job.error } : {}),
    options: options.map((option) => {
      const actualTreatment = hasReadyColorVersion
        ? actualTreatments?.[option.optionIndex]
        : undefined;
      const colorUnavailable = actualTreatment === "unavailable";
      const actualReadyTreatment =
        actualTreatment && actualTreatment !== "unavailable"
          ? actualTreatment
          : undefined;
      // Older ready jobs have no actual-outcome record. Retain their existing color URL behavior.
      const colorTreatment =
        hasReadyColorVersion && !colorUnavailable
          ? (actualReadyTreatment ??
            (source === "catalog"
              ? colorTreatmentForCatalogPrompt(job.prompt, option.optionIndex)
              : colorMode === "monochrome"
                ? "monochrome"
                : undefined))
          : undefined;
      const colorStatus = colorUnavailable
        ? "failed"
        : actualReadyTreatment
          ? "ready"
          : undefined;
      const hasColorAsset = hasReadyColorVersion && !colorUnavailable;
      const metadata =
        source === "catalog"
          ? catalogOptionMetadataForPrompt(job.prompt, option.optionIndex)
          : undefined;
      const title =
        source === "ai" && aiPrompt
          ? aiFallbackOptionTitle(aiPrompt.concept, option.optionIndex)
          : undefined;
      return {
        id: option.id,
        index: option.optionIndex,
        source,
        pngUrl: tokenizedAssetPath(job.id, option.optionIndex, ".png", token),
        originalUrl: tokenizedAssetPath(
          job.id,
          option.optionIndex,
          "-original.png",
          token,
        ),
        ...(colorMode ? { colorMode } : {}),
        ...(colorStatus ? { colorStatus } : {}),
        ...(colorUnavailable
          ? {
              colorWarning:
                "Your design is ready, but its color version could not be completed this time.",
            }
          : {}),
        ...(hasColorAsset
          ? {
              colorUrl: tokenizedAssetPath(
                job.id,
                option.optionIndex,
                "-color.png",
                token,
              ),
              ...(colorTreatment ? { colorTreatment } : {}),
            }
          : {}),
        ...(option.svgStorageKey
          ? {
              svgUrl: tokenizedAssetPath(
                job.id,
                option.optionIndex,
                ".svg",
                token,
              ),
            }
          : {}),
        ...(metadata ?? (title ? { title } : {})),
        width: option.width,
        height: option.height,
        mirrored: true,
      };
    }),
    createdAt: job.createdAt.toISOString(),
  };
}

function parseOptionIndex(raw: string): number | undefined {
  if (!/^\d+$/.test(raw)) return undefined;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 && value < 4 ? value : undefined;
}

async function redirectAsset(
  req: Request,
  res: Response,
  kind: "stencil" | "original" | "svg" | "color",
): Promise<void> {
  const job = await authorizedJob(req, res);
  if (!job) return;
  const index = parseOptionIndex(req.params.index);
  if (index === undefined) {
    res.status(404).json({ error: "asset_not_found" });
    return;
  }
  if (
    kind === "color" &&
    parseActualColorTreatments(job.prompt)?.[index] === "unavailable"
  ) {
    res.status(409).json({ error: "color_version_unavailable" });
    return;
  }
  try {
    const option = (await listStencilOptions(job.id)).find(
      (candidate) => candidate.optionIndex === index,
    );
    const catalogPrompt = parseCatalogJobPrompt(job.prompt);
    const colorMode = catalogPrompt
      ? colorModeForCatalogPrompt(job.prompt)
      : parseAiJobPrompt(job.prompt)?.colorMode;
    const key =
      kind === "stencil"
        ? option?.stencilStorageKey
        : kind === "original"
          ? option?.originalStorageKey
          : kind === "svg"
            ? option?.svgStorageKey
            : job.status === "ready" && isColorVersionMode(colorMode) && option
              ? colorVersionObjectKey(job.id, option.optionIndex, colorMode)
              : undefined;
    if (!key) {
      res.status(404).json({ error: "asset_not_found" });
      return;
    }
    const signedUrl = await getCachedStencilDownloadUrl(key);
    res.set("Cache-Control", "private, no-store");
    res.redirect(307, signedUrl);
  } catch {
    res.status(503).json({ error: "asset_unavailable" });
  }
}

export function registerStencilRoutes(app: Express): void {
  app.get("/api/stencil-config", async (_req, res) => {
    const processing = stencilProcessingConfig();
    res.set("Cache-Control", "no-store");
    res.json({
      styles: STYLE_OPTIONS,
      mediums: MEDIUM_OPTIONS,
      request: {
        method: "POST",
        path: "/api/stencils",
        fields: {
          concept: { type: "string", minLength: 1, maxLength: 240 },
          style: {
            type: "enum",
            values: STYLE_OPTIONS.map((option) => option.id),
          },
          medium: {
            type: "enum",
            values: MEDIUM_OPTIONS.map((option) => option.id),
          },
          catalogId: { type: "string", optional: true },
          filters: {
            type: "object",
            optional: true,
            fields: {
              category: {
                type: "enum",
                values: CATALOG_CATEGORY_OPTIONS.map((option) => option.id),
                default: "all",
                optional: true,
              },
              artStyle: {
                type: "enum",
                values: CATALOG_STYLE_OPTIONS.map((option) => option.id),
                default: "any",
                optional: true,
              },
              colorMix: {
                type: "enum",
                values: CATALOG_COLOR_OPTIONS.map((option) => option.id),
                default: "any",
                optional: true,
              },
              inkColors: {
                type: "array",
                values: TATTOO_INKS.map((ink) => ink.id),
                minItems: 1,
                maxItems: 3,
                uniqueItems: true,
                optional: true,
                requiredForColorMix: "custom",
              },
            },
          },
          clientId: { type: "string", maxLength: 128 },
          requestId: { type: "string", maxLength: 128, optional: true },
          capabilityToken: {
            type: "string",
            pattern: "^[0-9a-f]{64}$",
            optional: true,
          },
        },
      },
      processing: {
        output:
          "catalog or AI original PNG plus mirrored 300-DPI stencil PNG and requested derived color PNG",
        threshold: processing.threshold,
        minimumComponentPixels: processing.minimumComponentPixels,
        mirrored: true,
      },
      capabilities: {
        configured: isStencilPlatformConfigured(),
        imageGeneration: true,
        originalImageGeneration: true,
        colorVersions: true,
        filledColorVersions: true,
        catalogSelection: true,
        catalogFirst: true,
        aiFallback: true,
        sourcePolicy: {
          selection:
            "catalog_first_then_ai_only_for_valid_free_text_with_zero_catalog_matches",
          exactCatalogId: "validated_exact_catalog_only_no_ai_fallback",
          queuedLegacy: "catalog_only_no_implicit_ai_retry",
        },
        guestFilters: true,
        catalogRecordCount: eligibleCatalogCount(),
        durableStorage: isStencilPlatformConfigured(),
        vectorSvg: await potraceIsAvailable(),
      },
    });
  });

  app.post("/api/stencils", async (req, res) => {
    try {
      const input = parseStencilInput(req.body);
      const created = await createStencilJob(input);
      if (created.reused) {
        // Never return/reissue a capability secret after its original response.
        res
          .status(409)
          .json({ error: "idempotency_token_required", id: created.id });
        return;
      }
      res.status(202).json({ id: created.id, token: created.token });
    } catch (error) {
      if (error instanceof StencilInputError) {
        res.status(400).json({
          error:
            error.message === "instant_draw_only" ||
            error.message === "catalog_no_match"
              ? error.message
              : "invalid_request",
        });
      } else if (error instanceof ClientGenerationLimitError) {
        res.status(429).json({ error: "generation_limit_reached" });
      } else {
        res.status(503).json({ error: "service_unavailable" });
      }
    }
  });

  app.get("/api/stencils/:id", async (req, res) => {
    const job = await authorizedJob(req, res);
    if (!job) return;
    try {
      res.set("Cache-Control", "private, no-store");
      res.json(await publicJobPayload(job, readCapabilityToken(req)!));
    } catch {
      res.status(503).json({ error: "service_unavailable" });
    }
  });

  app.get("/api/stencils/:id/options/:index-original.png", (req, res) => {
    void redirectAsset(req, res, "original");
  });
  app.get("/api/stencils/:id/options/:index-color.png", (req, res) => {
    void redirectAsset(req, res, "color");
  });
  app.get("/api/stencils/:id/options/:index.png", (req, res) => {
    void redirectAsset(req, res, "stencil");
  });
  app.get("/api/stencils/:id/options/:index.svg", (req, res) => {
    void redirectAsset(req, res, "svg");
  });
}

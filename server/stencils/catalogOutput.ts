import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import catalogItems from "../../assets/catalog/inspiration/catalog-items.json";
import {
  DEFAULT_CATALOG_FILTERS,
  parseCatalogFilters,
  type CatalogColorMix,
  type CatalogFilters,
} from "../../shared/catalog-filters";
import type { TattooInkId } from "../../shared/tattoo-inks";
import type { PortableCatalogItem } from "../../shared/catalog-matching";
import { isDisallowedInstantDrawConcept } from "../../shared/instant-draw";
import { declaredMetadataMode, parseAiJobPrompt } from "./jobMetadata";
import { parseActualColorTreatments } from "./colorOutcomes";

const CATALOG_DIRECTORY = path.resolve(
  process.cwd(),
  "assets/catalog/inspiration",
);
const PNG_FILENAME = /^[a-z0-9][a-z0-9-]*\.png$/;
const VALID_STYLES = new Set([
  "fine_line",
  "traditional",
  "geometric",
  "cyber",
]);

export type ValidatedCatalogRecord = PortableCatalogItem & {
  sourceXref?: string | number;
  titleIsGenerated?: boolean;
};

export type CatalogOptionMetadata = {
  catalogId: string;
  title: string;
  collection: string;
  page: number;
  titleIsGenerated?: boolean;
};

export type ColorTreatment = "filled" | "ink_only" | "monochrome";

export type CatalogJobPromptV1 = {
  version: 1;
  mode: "catalog";
  catalogIds: string[];
  filters: CatalogFilters;
};

/** Version 2 means colorMix requests an earlier ink-coverage-only derived color version. */
export type CatalogJobPromptV2 = {
  version: 2;
  mode: "catalog";
  catalogIds: string[];
  filters: CatalogFilters;
  colorMode: Exclude<CatalogColorMix, "custom">;
};

/** Version 3 adds the full enclosed-region color treatment for all new catalog jobs. */
export type CatalogJobPromptV3 = {
  version: 3;
  mode: "catalog";
  catalogIds: string[];
  filters: CatalogFilters;
  colorMode: CatalogColorMix;
  /** Mirrors filters.inkColors for retry-safe access to a custom palette. */
  inkColors?: TattooInkId[];
  fillEnclosedRegions: true;
};

export type CatalogJobPrompt =
  | CatalogJobPromptV1
  | CatalogJobPromptV2
  | CatalogJobPromptV3;

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isMandalaValue(value: unknown): boolean {
  return typeof value === "string" && isDisallowedInstantDrawConcept(value);
}

function validatedRecord(value: unknown): ValidatedCatalogRecord | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return undefined;
  const raw = value as Record<string, unknown>;
  const id = nonEmptyString(raw.id);
  const title = nonEmptyString(raw.title);
  const collection = nonEmptyString(raw.collection);
  const category = nonEmptyString(raw.category);
  const filename = nonEmptyString(raw.filename);
  const page = raw.page;
  const rawKeywords = raw.keywords;
  const style = raw.style;
  const sourceXref = raw.sourceXref;
  const titleIsGenerated = raw.titleIsGenerated;
  if (
    !id ||
    !title ||
    !collection ||
    !category ||
    !filename ||
    !PNG_FILENAME.test(filename) ||
    !Number.isInteger(page) ||
    (page as number) < 1 ||
    !Array.isArray(rawKeywords) ||
    !rawKeywords.length ||
    rawKeywords.some((keyword) => !nonEmptyString(keyword)) ||
    (style !== undefined &&
      (typeof style !== "string" || !VALID_STYLES.has(style))) ||
    (sourceXref !== undefined &&
      typeof sourceXref !== "string" &&
      (typeof sourceXref !== "number" || !Number.isFinite(sourceXref))) ||
    (titleIsGenerated !== undefined && typeof titleIsGenerated !== "boolean") ||
    [id, title, collection, category, filename, sourceXref]
      .filter((item): item is string => typeof item === "string")
      .some(isMandalaValue) ||
    rawKeywords.some(isMandalaValue)
  ) {
    return undefined;
  }
  return {
    id,
    title,
    collection,
    category,
    page: page as number,
    filename,
    keywords: rawKeywords.map((keyword) => (keyword as string).trim()),
    ...(style ? { style } : {}),
    ...(sourceXref !== undefined ? { sourceXref } : {}),
    ...(titleIsGenerated !== undefined ? { titleIsGenerated } : {}),
  };
}

const byId = new Map<string, ValidatedCatalogRecord>();
for (const value of catalogItems as unknown[]) {
  const record = validatedRecord(value);
  if (!record || byId.has(record.id)) continue;
  const assetPath = path.resolve(CATALOG_DIRECTORY, record.filename);
  if (path.dirname(assetPath) !== CATALOG_DIRECTORY || !existsSync(assetPath))
    continue;
  byId.set(record.id, record);
}

/** Only records with safe metadata and an existing local PNG are eligible for backend selection. */
export const eligibleCatalogRecords = [...byId.values()];

export function eligibleCatalogCount(): number {
  return eligibleCatalogRecords.length;
}

export function getValidatedCatalogRecord(
  id: string | undefined,
): ValidatedCatalogRecord | undefined {
  return id ? byId.get(id) : undefined;
}

/** This never accepts a client filename: it derives a path from an already validated record. */
export function catalogPngPath(record: ValidatedCatalogRecord): string {
  const current = byId.get(record.id);
  if (!current || current.filename !== record.filename)
    throw new Error("catalog_record_invalid");
  const assetPath = path.resolve(CATALOG_DIRECTORY, current.filename);
  if (path.dirname(assetPath) !== CATALOG_DIRECTORY)
    throw new Error("catalog_record_invalid");
  return assetPath;
}

/** Reads the original catalog PNG unchanged, for byte-for-byte object storage. */
export async function readCatalogOriginalPng(
  record: ValidatedCatalogRecord,
): Promise<Buffer> {
  const bytes = await readFile(catalogPngPath(record));
  if (
    bytes.length < 8 ||
    !bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))
  ) {
    throw new Error("catalog_asset_invalid");
  }
  return bytes;
}

/** New catalog work always records V3 full-region color intent before it is queued. */
export function createCatalogJobPrompt(
  records: readonly ValidatedCatalogRecord[],
  filters?: CatalogFilters,
): string {
  const catalogIds = records.map((record) => record.id);
  if (
    !catalogIds.length ||
    catalogIds.length > 4 ||
    new Set(catalogIds).size !== catalogIds.length ||
    catalogIds.some((id) => !byId.has(id))
  ) {
    throw new Error("catalog_selection_invalid");
  }
  let validatedFilters: CatalogFilters;
  try {
    validatedFilters = parseCatalogFilters(filters ?? DEFAULT_CATALOG_FILTERS);
  } catch {
    throw new Error("catalog_selection_invalid");
  }
  return JSON.stringify({
    version: 3,
    mode: "catalog",
    catalogIds,
    filters: validatedFilters,
    colorMode: validatedFilters.colorMix,
    ...(validatedFilters.inkColors
      ? { inkColors: validatedFilters.inkColors }
      : {}),
    fillEnclosedRegions: true,
  });
}

function validCatalogIds(raw: Record<string, unknown>): string[] | undefined {
  if (
    !Array.isArray(raw.catalogIds) ||
    raw.catalogIds.length < 1 ||
    raw.catalogIds.length > 4 ||
    raw.catalogIds.some((id) => typeof id !== "string")
  ) {
    return undefined;
  }
  const catalogIds = raw.catalogIds as string[];
  return new Set(catalogIds).size === catalogIds.length &&
    catalogIds.every((id) => byId.has(id))
    ? catalogIds
    : undefined;
}

function matchingMetadataInkColors(
  raw: Record<string, unknown>,
  filters: CatalogFilters,
): TattooInkId[] | undefined | false {
  const selected = filters.inkColors;
  if (raw.inkColors === undefined) return selected;
  if (
    !Array.isArray(raw.inkColors) ||
    !selected ||
    raw.inkColors.length !== selected.length ||
    raw.inkColors.some((id, index) => id !== selected[index])
  ) {
    return false;
  }
  return selected;
}

/** Undefined deliberately denotes an old free-form prompt, rather than catalog provenance. */
export function parseCatalogJobPrompt(
  prompt: string,
): CatalogJobPrompt | undefined {
  try {
    const raw = JSON.parse(prompt) as Record<string, unknown>;
    if (!raw || Array.isArray(raw) || raw.mode !== "catalog") return undefined;
    const catalogIds = validCatalogIds(raw);
    if (!catalogIds) return undefined;

    if (raw.version === 1) {
      let filters = DEFAULT_CATALOG_FILTERS;
      if (Object.prototype.hasOwnProperty.call(raw, "filters")) {
        try {
          filters = parseCatalogFilters(raw.filters);
        } catch {
          return undefined;
        }
      }
      return { version: 1, mode: "catalog", catalogIds, filters };
    }

    if (
      (raw.version !== 2 && raw.version !== 3) ||
      !Object.prototype.hasOwnProperty.call(raw, "filters") ||
      !Object.prototype.hasOwnProperty.call(raw, "colorMode")
    ) {
      return undefined;
    }
    let filters: CatalogFilters;
    try {
      filters = parseCatalogFilters(raw.filters);
    } catch {
      return undefined;
    }
    if (typeof raw.colorMode !== "string" || raw.colorMode !== filters.colorMix)
      return undefined;

    if (raw.version === 2) {
      // Custom palettes were introduced with V3; preserve V2's original enum contract.
      if (filters.colorMix === "custom") return undefined;
      return {
        version: 2,
        mode: "catalog",
        catalogIds,
        filters,
        colorMode: filters.colorMix,
      };
    }
    if (raw.fillEnclosedRegions !== true) return undefined;
    const inkColors = matchingMetadataInkColors(raw, filters);
    if (inkColors === false) return undefined;
    return {
      version: 3,
      mode: "catalog",
      catalogIds,
      filters,
      colorMode: filters.colorMix,
      ...(inkColors ? { inkColors } : {}),
      fillEnclosedRegions: true,
    };
  } catch {
    return undefined;
  }
}

/** Identifies a catalog decision envelope even when its stored IDs/version are no longer valid. */
export function isVersionedCatalogPrompt(prompt: string): boolean {
  return declaredMetadataMode(prompt) === "catalog";
}

/** Only V2/V3 catalog jobs have a derived-color request; V1 remains a palette-filtering legacy row. */
export function colorModeForCatalogPrompt(
  prompt: string,
): CatalogColorMix | undefined {
  const selection = parseCatalogJobPrompt(prompt);
  return selection?.version === 2 || selection?.version === 3
    ? selection.colorMode
    : undefined;
}

/** V2 color assets are line/ink-only; V3 color assets may fill validated enclosed regions. */
export function colorTreatmentForCatalogPrompt(
  prompt: string,
  optionIndex = 0,
): ColorTreatment | undefined {
  const selection = parseCatalogJobPrompt(prompt);
  if (!selection || selection.version === 1 || selection.colorMode === "any")
    return undefined;
  if (selection.colorMode === "monochrome") return "monochrome";
  const actual = parseActualColorTreatments(prompt)?.[optionIndex];
  return selection.version === 3
    ? actual === "unavailable"
      ? undefined
      : actual
    : "ink_only";
}

export function fillEnclosedRegionsForCatalogPrompt(prompt: string): boolean {
  return parseCatalogJobPrompt(prompt)?.version === 3;
}

export function recordsForCatalogPrompt(
  prompt: string,
): ValidatedCatalogRecord[] | undefined {
  const selection = parseCatalogJobPrompt(prompt);
  if (!selection) return undefined;
  const records = selection.catalogIds.map((id) => byId.get(id));
  return records.every((record): record is ValidatedCatalogRecord =>
    Boolean(record),
  )
    ? records
    : undefined;
}

export function catalogPayloadSource(
  prompt: string,
): "catalog" | "ai" | "legacy" {
  if (parseCatalogJobPrompt(prompt)) return "catalog";
  if (parseAiJobPrompt(prompt)) return "ai";
  return "legacy";
}

/** Resolves public provenance from the stored catalog ID at the persisted option index. */
export function catalogOptionMetadataForPrompt(
  prompt: string,
  optionIndex: number,
): CatalogOptionMetadata | undefined {
  const record = recordsForCatalogPrompt(prompt)?.[optionIndex];
  if (!record) return undefined;
  return {
    catalogId: record.id,
    title: record.title,
    collection: record.collection,
    page: record.page,
    ...(record.titleIsGenerated !== undefined
      ? { titleIsGenerated: record.titleIsGenerated }
      : {}),
  };
}

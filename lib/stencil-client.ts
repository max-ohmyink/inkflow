import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { getApiBaseUrl } from "../constants/api";
import { INSTANT_DRAW_MESSAGE } from "../shared/instant-draw";
import type { StyleId, MediumId } from "./studio-theme";
import {
  DEFAULT_CATALOG_FILTERS,
  type CatalogFilters,
  type CatalogColorMix,
} from "../shared/catalog-filters";

export type ArtworkSource = "ai";
export type StencilOption = {
  id: string;
  index: number;
  pngUrl: string;
  originalUrl: string;
  colorUrl?: string;
  colorMode?: CatalogColorMix;
  colorTreatment?: "filled" | "ink_only" | "monochrome";
  colorStatus?: "ready" | "failed";
  colorWarning?: string;
  svgUrl?: string;
  width: number;
  height: number;
  mirrored: true;
  title?: string;
  source?: ArtworkSource;
};
export type StencilJob = {
  id: string;
  status: "queued" | "generating" | "processing" | "ready" | "failed";
  stage: string;
  progress: number;
  concept: string;
  style: StyleId;
  medium: MediumId;
  prompt?: string;
  source?: ArtworkSource;
  filters?: CatalogFilters;
  error?: string;
  options: StencilOption[];
  createdAt: string;
};
export type SavedJob = {
  id: string;
  token: string;
  concept: string;
  style: StyleId;
  medium: MediumId;
  createdAt: string;
  filters?: CatalogFilters;
};
export type PendingRequest = {
  concept: string;
  style: StyleId;
  medium: MediumId;
  clientId: string;
  requestId: string;
  capabilityToken: string;
  createdAt: string;
  filters?: CatalogFilters;
};
const LIBRARY_KEY = "ohmyink:stencil-library:v1";
const CLIENT_KEY = "ohmyink:device-id:v1";
const PENDING_KEY = "ohmyink:pending-request:v1";

export function absoluteAsset(url: string): string {
  if (/^https?:\/\//.test(url)) return url;
  return `${getApiBaseUrl()}${url.startsWith("/") ? url : `/${url}`}`;
}
export function randomId(): string {
  return Crypto.randomUUID();
}
export class StudioRequestError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
  }
}
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  const json = await response.json().catch(() => ({
    error: "The studio is temporarily unavailable. Please try again.",
  }));
  if (!response.ok) {
    const messages: Record<string, string> = {
      invalid_request:
        "Please enter a valid tattoo idea and try again.",
      instant_draw_only: INSTANT_DRAW_MESSAGE,
      generation_limit_reached:
        "Two designs are already in progress on this device. Open My designs and wait for them to finish.",
      service_unavailable:
        "The studio is temporarily unavailable. Please reconnect and try again.",
      unauthorized: "This device no longer has access to that design.",
      idempotency_token_required:
        "This request was already accepted, but its saved access credential does not match.",
      asset_unavailable:
        "The stencil file is temporarily unavailable. Please try again.",
      family_design_only:
        "We keep designs family-friendly. Please try a different theme or pick a design below.",
      origin_not_allowed:
        "This page can’t reach the studio from here. Please open the studio from its main address.",
      not_found: "That design could not be found. Please start a new search.",
      color_version_unavailable:
        "The color version isn’t ready yet. Showing the original design instead.",
      pending_request_unresolved:
        "An earlier request still needs confirmation. Please reconnect first.",
    };
    throw new StudioRequestError(
      messages[json.error] ||
        "Unable to complete this request. Please try again.",
      json.error || "unknown_error",
      response.status,
    );
  }
  return json as T;
}
export async function loadPendingRequest(): Promise<PendingRequest | null> {
  try {
    return JSON.parse((await AsyncStorage.getItem(PENDING_KEY)) || "null");
  } catch {
    return null;
  }
}
export async function createStencil(
  concept: string,
  style: StyleId,
  medium: MediumId,
  requestId: string,
  filters: CatalogFilters = DEFAULT_CATALOG_FILTERS,
): Promise<SavedJob> {
  let clientId = await AsyncStorage.getItem(CLIENT_KEY);
  if (!clientId) {
    clientId = randomId();
    await AsyncStorage.setItem(CLIENT_KEY, clientId);
  }
  let pending = await loadPendingRequest();
  if (pending && pending.requestId !== requestId) {
    throw new StudioRequestError(
      "An earlier request still needs confirmation. Reconnect to recover it before starting another search.",
      "pending_request_unresolved",
      409,
    );
  }
  if (!pending) {
    const bytes = await Crypto.getRandomBytesAsync(32);
    const capabilityToken = Array.from(bytes, (value) =>
      value.toString(16).padStart(2, "0"),
    ).join("");
    pending = {
      concept,
      style,
      medium,
      clientId,
      requestId,
      capabilityToken,
      createdAt: new Date().toISOString(),
      filters: { ...filters },
    };
    // Persist before the first network call. Retries can prove ownership without reissuing secrets.
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  }
  let created: { id: string; token: string };
  try {
    created = await request<{ id: string; token: string }>("/api/stencils", {
      method: "POST",
      body: JSON.stringify(pending),
    });
  } catch (failure) {
    // Definitive server rejections never created a job, so nothing is left to recover.
    if (
      failure instanceof StudioRequestError &&
      [400, 409, 429].includes(failure.status)
    )
      await AsyncStorage.removeItem(PENDING_KEY);
    throw failure;
  }
  const saved: SavedJob = {
    id: created.id,
    token: pending.capabilityToken,
    concept: pending.concept,
    style: pending.style,
    medium: pending.medium,
    createdAt: pending.createdAt,
    filters: pending.filters || { ...DEFAULT_CATALOG_FILTERS },
  };
  const list = await loadLibrary();
  await AsyncStorage.setItem(
    LIBRARY_KEY,
    JSON.stringify(
      [saved, ...list.filter((item) => item.id !== saved.id)].slice(0, 40),
    ),
  );
  await AsyncStorage.removeItem(PENDING_KEY);
  return saved;
}
export async function getStencil(saved: SavedJob): Promise<StencilJob> {
  return request(
    `/api/stencils/${encodeURIComponent(saved.id)}?token=${encodeURIComponent(saved.token)}`,
  );
}
export async function loadLibrary(): Promise<SavedJob[]> {
  try {
    return JSON.parse((await AsyncStorage.getItem(LIBRARY_KEY)) || "[]");
  } catch {
    return [];
  }
}
export async function checkStudio(): Promise<boolean> {
  try {
    const result = await request<{ ok: boolean }>("/api/health");
    return result.ok;
  } catch {
    return false;
  }
}
export async function removeLocalHistory(): Promise<void> {
  await AsyncStorage.multiRemove([LIBRARY_KEY, PENDING_KEY]);
}

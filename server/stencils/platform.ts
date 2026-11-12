import { BlockList, isIP } from "node:net";
import { lookup } from "node:dns/promises";

const MAX_GENERATED_IMAGE_BYTES = 20 * 1024 * 1024;
const SIGNED_URL_CACHE_MS = 50 * 60 * 1000;

type ImageServiceResponse = {
  image?: {
    url?: unknown;
    b64Json?: unknown;
    mimeType?: unknown;
  };
  error?: unknown;
};

export type ImageServiceOriginalImage =
  | {
      url: string;
      mimeType: "image/png";
    }
  | {
      b64Json: string;
      mimeType: "image/png";
    };

type CachedUrl = { url: string; expiresAt: number };
const signedUrlCache = new Map<string, CachedUrl>();

export type SafeProviderFailure = {
  httpStatus?: number;
  providerCode?: string;
  reason:
    | "quota_or_credits"
    | "rate_limited"
    | "access_denied"
    | "provider_unavailable"
    | "invalid_request"
    | "unknown";
};
export function classifyProviderFailure(
  status: number,
  body: unknown,
): SafeProviderFailure {
  const raw =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const code =
    typeof raw.code === "string" && /^[a-zA-Z_0-9-]{1,60}$/.test(raw.code)
      ? raw.code
      : undefined;
  // Text is used only for closed-category classification and never logged, persisted or returned.
  const message =
    typeof raw.message === "string" ? raw.message.toLowerCase() : "";
  const reason: SafeProviderFailure["reason"] =
    /credit|quota|balance|budget|payment|usage limit|usage.{0,30}exhaust/.test(
      message,
    )
      ? "quota_or_credits"
      : status === 429 || /rate limit|too many requests/.test(message)
        ? "rate_limited"
        : status === 401 || status === 403
          ? "access_denied"
          : status >= 500
            ? "provider_unavailable"
            : status === 400 && code !== "failed_precondition"
              ? "invalid_request"
              : "unknown";
  return {
    httpStatus: status,
    ...(code ? { providerCode: code } : {}),
    reason,
  };
}
export class PlatformServiceError extends Error {
  constructor(
    message = "platform_service_unavailable",
    readonly diagnostics?: SafeProviderFailure,
  ) {
    super(message);
    this.name = "PlatformServiceError";
  }
}

function platformConfig(): { baseUrl: string; apiKey: string } {
  const baseUrl = process.env.MANUS_API_URL?.trim();
  const apiKey = process.env.MANUS_API_KEY?.trim();
  if (!baseUrl || !apiKey)
    throw new PlatformServiceError("platform_not_configured");
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

export function isStencilPlatformConfigured(): boolean {
  return Boolean(
    process.env.MANUS_API_URL?.trim() && process.env.MANUS_API_KEY?.trim(),
  );
}

function platformUrl(path: string): URL {
  const { baseUrl } = platformConfig();
  return new URL(path, `${baseUrl}/`);
}

async function readError(response: Response): Promise<void> {
  // Consume error bodies for connection reuse, but never return a remote body to guests or logs.
  await response.text().catch(() => "");
}

async function platformFetch(
  url: URL,
  init: RequestInit = {},
): Promise<Response> {
  const { apiKey } = platformConfig();
  try {
    return await fetch(url, {
      ...init,
      headers: {
        accept: "application/json",
        authorization: `Bearer ${apiKey}`,
        ...init.headers,
      },
    });
  } catch {
    throw new PlatformServiceError();
  }
}

function validMimeType(value: unknown): string {
  if (typeof value === "string" && /^image\/(png|jpeg|webp)$/i.test(value))
    return value;
  return "image/png";
}

function decodeImageBase64(value: unknown): Buffer | undefined {
  if (
    typeof value !== "string" ||
    !value ||
    value.length > Math.ceil(MAX_GENERATED_IMAGE_BYTES * 1.4)
  ) {
    return undefined;
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return undefined;
  const buffer = Buffer.from(value, "base64");
  return buffer.length > 0 && buffer.length <= MAX_GENERATED_IMAGE_BYTES
    ? buffer
    : undefined;
}

const PRIVATE_IPS = new BlockList();
PRIVATE_IPS.addSubnet("0.0.0.0", 8, "ipv4");
PRIVATE_IPS.addSubnet("10.0.0.0", 8, "ipv4");
PRIVATE_IPS.addSubnet("100.64.0.0", 10, "ipv4");
PRIVATE_IPS.addSubnet("127.0.0.0", 8, "ipv4");
PRIVATE_IPS.addSubnet("169.254.0.0", 16, "ipv4");
PRIVATE_IPS.addSubnet("172.16.0.0", 12, "ipv4");
PRIVATE_IPS.addSubnet("192.0.0.0", 24, "ipv4");
PRIVATE_IPS.addSubnet("192.0.2.0", 24, "ipv4");
PRIVATE_IPS.addSubnet("192.168.0.0", 16, "ipv4");
PRIVATE_IPS.addSubnet("198.18.0.0", 15, "ipv4");
PRIVATE_IPS.addSubnet("198.51.100.0", 24, "ipv4");
PRIVATE_IPS.addSubnet("203.0.113.0", 24, "ipv4");
PRIVATE_IPS.addSubnet("224.0.0.0", 4, "ipv4");
PRIVATE_IPS.addSubnet("::", 128, "ipv6");
PRIVATE_IPS.addSubnet("::1", 128, "ipv6");
PRIVATE_IPS.addSubnet("fc00::", 7, "ipv6");
PRIVATE_IPS.addSubnet("fe80::", 10, "ipv6");

function isPrivateAddress(address: string): boolean {
  const family = isIP(address);
  return (
    family !== 0 && PRIVATE_IPS.check(address, family === 4 ? "ipv4" : "ipv6")
  );
}

/** A generated service URL is the only URL this module downloads; it is never client supplied. */
async function downloadServiceGeneratedImage(rawUrl: unknown): Promise<Buffer> {
  if (typeof rawUrl !== "string")
    throw new PlatformServiceError("invalid_image_result");

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new PlatformServiceError("invalid_image_result");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hostname === "localhost"
  ) {
    throw new PlatformServiceError("unsafe_image_result");
  }

  try {
    const addresses = await lookup(url.hostname, { all: true, verbatim: true });
    if (
      !addresses.length ||
      addresses.some((address) => isPrivateAddress(address.address))
    ) {
      throw new PlatformServiceError("unsafe_image_result");
    }
  } catch (error) {
    if (error instanceof PlatformServiceError) throw error;
    throw new PlatformServiceError("unsafe_image_result");
  }

  let response: Response;
  try {
    response = await fetch(url, {
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      headers: { accept: "image/png,image/jpeg,image/webp" },
    });
  } catch {
    throw new PlatformServiceError("image_download_failed");
  }
  if (
    !response.ok ||
    !response.headers.get("content-type")?.toLowerCase().startsWith("image/")
  ) {
    await readError(response);
    throw new PlatformServiceError("image_download_failed");
  }
  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_GENERATED_IMAGE_BYTES) {
    await response.body?.cancel().catch(() => undefined);
    throw new PlatformServiceError("image_too_large");
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_GENERATED_IMAGE_BYTES) {
    throw new PlatformServiceError("image_too_large");
  }
  return bytes;
}

/** Makes exactly one ImageService generation/edit request and returns its result bytes. */
export async function generateImage(
  prompt: string,
  originalImages: ImageServiceOriginalImage[] = [],
): Promise<{ bytes: Buffer; mimeType: string }> {
  const response = await platformFetch(
    platformUrl("images.v1.ImageService/GenerateImage"),
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "connect-protocol-version": "1",
      },
      // Omit model so ImageService selects the currently supported project default.
      body: JSON.stringify({
        prompt,
        ...(originalImages.length ? { originalImages } : {}),
      }),
    },
  );

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new PlatformServiceError(
      "image_generation_failed",
      classifyProviderFailure(response.status, body),
    );
  }

  let result: ImageServiceResponse;
  try {
    result = (await response.json()) as ImageServiceResponse;
  } catch {
    throw new PlatformServiceError("invalid_image_result");
  }
  if (result.error || !result.image)
    throw new PlatformServiceError("image_generation_failed");

  const bytes =
    decodeImageBase64(result.image.b64Json) ??
    (await downloadServiceGeneratedImage(result.image.url));
  return { bytes, mimeType: validMimeType(result.image.mimeType) };
}

/** Backward-compatible name for the legacy contact-sheet caller. */
export async function generateContactSheet(
  prompt: string,
  originalImages: ImageServiceOriginalImage[] = [],
): Promise<{ bytes: Buffer; mimeType: string }> {
  return generateImage(prompt, originalImages);
}

function requireAsciiKey(key: string): void {
  if (
    !key ||
    !/^[\x20-\x7E]+$/.test(key) ||
    key.includes("..") ||
    key.startsWith("/")
  ) {
    throw new PlatformServiceError("invalid_storage_key");
  }
}

async function getPresignedUrl(
  kind: "put" | "get",
  key: string,
): Promise<string> {
  requireAsciiKey(key);
  const url = platformUrl(`v1/storage/presign/${kind}`);
  url.searchParams.set("path", key);
  const response = await platformFetch(url);
  if (!response.ok) {
    await readError(response);
    throw new PlatformServiceError("storage_presign_failed");
  }
  const result = (await response.json().catch(() => null)) as {
    url?: unknown;
  } | null;
  if (
    !result ||
    typeof result.url !== "string" ||
    !/^https:\/\//.test(result.url)
  ) {
    throw new PlatformServiceError("storage_presign_failed");
  }
  return result.url;
}

/** Stores an explicitly named, stable application key; callers persist this key in the database. */
export async function putStencilObject(
  key: string,
  bytes: Buffer,
  contentType: string,
): Promise<void> {
  const uploadUrl = await getPresignedUrl("put", key);
  let response: Response;
  try {
    response = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "content-type": contentType },
      // Node's fetch accepts Buffer, while the DOM lib declaration only exposes BodyInit.
      body: bytes as unknown as BodyInit,
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new PlatformServiceError("storage_upload_failed");
  }
  if (!response.ok) {
    await readError(response);
    throw new PlatformServiceError("storage_upload_failed");
  }
}

/** Returns a short-lived CDN URL without persisting it; cached to avoid needless presign calls. */
export async function getCachedStencilDownloadUrl(
  key: string,
): Promise<string> {
  const now = Date.now();
  const cached = signedUrlCache.get(key);
  if (cached && cached.expiresAt > now) return cached.url;
  const url = await getPresignedUrl("get", key);
  signedUrlCache.set(key, { url, expiresAt: now + SIGNED_URL_CACHE_MS });
  return url;
}

import { BlockList, isIP } from "node:net";
import { lookup } from "node:dns/promises";
import fs from "node:fs";
import path from "node:path";

const MAX_GENERATED_IMAGE_BYTES = 20 * 1024 * 1024;
const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");

export type ImageServiceOriginalImage =
  | {
      url: string;
      mimeType: "image/png";
    }
  | {
      b64Json: string;
      mimeType: "image/png";
    };


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
  const message =
    typeof raw.message === "string" ? raw.message.toLowerCase() : "";
  const reason: SafeProviderFailure["reason"] =
    /credit|quota|balance|budget|payment|usage limit|usage.{0,30}exhaust|arrearage/.test(
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

/** Check if Qwen / DashScope / OpenAI compatible provider is configured */
function hasQwenConfig(): boolean {
  return Boolean(
    (process.env.AI_API_KEY?.trim() || process.env.DASHSCOPE_API_KEY?.trim()) &&
      (process.env.AI_BASE_URL?.trim() || process.env.AI_IMAGE_MODEL?.trim()),
  );
}

function qwenConfig(): {
  apiKey: string;
  baseUrl: string;
  model: string;
  size: string;
} {
  const apiKey =
    process.env.AI_API_KEY?.trim() ||
    process.env.DASHSCOPE_API_KEY?.trim() ||
    "";
  const baseUrl = (
    process.env.AI_BASE_URL?.trim() ||
    "https://dashscope.aliyuncs.com/compatible-mode/v1"
  ).replace(/\/+$/, "");
  const model =
    process.env.AI_IMAGE_MODEL?.trim() || "qwen-image-2.0-pro-2026-03-03";
  const size = process.env.AI_IMAGE_SIZE?.trim() || "1024x1024";

  if (!apiKey) {
    throw new PlatformServiceError("platform_not_configured");
  }
  return { apiKey, baseUrl, model, size };
}

/**
 * Always true: images are stored on local disk, so "configured" never gated startup.
 * Kept as a function because the capabilities route reports it.
 */
export function isStencilPlatformConfigured(): boolean {
  return true;
}

async function readError(response: Response): Promise<void> {
  await response.text().catch(() => "");
}

function decodeImageBase64(value: unknown): Buffer | undefined {
  if (
    typeof value !== "string" ||
    !value ||
    value.length > Math.ceil(MAX_GENERATED_IMAGE_BYTES * 1.4)
  ) {
    return undefined;
  }
  const clean = value.replace(/^data:image\/[a-z]+;base64,/i, "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(clean)) return undefined;
  const buffer = Buffer.from(clean, "base64");
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
      signal: AbortSignal.timeout(60_000),
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

/** Generates an image using Qwen (DashScope / OpenAI compatible endpoint) */
async function generateQwenImage(
  prompt: string,
  originalImages: ImageServiceOriginalImage[] = [],
): Promise<{ bytes: Buffer; mimeType: string }> {
  const { apiKey, baseUrl, model, size } = qwenConfig();

  let response: Response;
  try {
    // Qwen image models are only served by DashScope's native multimodal endpoint; the
    // OpenAI-style /images/generations route does not exist on compatible-mode (404).
    const useNative =
      /dashscope/i.test(process.env.AI_VENDOR ?? "") ||
      /dashscope|\/compatible-mode\//i.test(baseUrl);
    if (useNative) {
      const firstImg = originalImages[0];
      const base64Data = !firstImg
        ? undefined
        : "b64Json" in firstImg && firstImg.b64Json
          ? `data:${firstImg.mimeType};base64,${firstImg.b64Json}`
          : "url" in firstImg
            ? firstImg.url
            : undefined;
      const nativeUrl = baseUrl.replace(
        /\/compatible-mode\/v1$/i,
        "/api/v1/services/aigc/multimodal-generation/generation",
      );
      response = await fetch(nativeUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          input: {
            messages: [
              {
                role: "user",
                content: [
                  ...(base64Data ? [{ image: base64Data }] : []),
                  { text: prompt },
                ],
              },
            ],
          },
          parameters: {
            n: 1,
            size: size.replace(/x/gi, "*"),
            watermark: false,
          },
        }),
      });
    } else {
      response = await fetch(`${baseUrl}/images/generations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          prompt,
          size,
          n: 1,
        }),
      });
    }
  } catch (error) {
    throw new PlatformServiceError("platform_service_unavailable");
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    // Server log only (never sent to guests): provider's own error code/message, no secrets.
    console.error("[qwen-image-error]", {
      status: response.status,
      model,
      url: response.url,
      body,
    });
    throw new PlatformServiceError(
      "image_generation_failed",
      classifyProviderFailure(response.status, body),
    );
  }

  let result: any;
  try {
    result = await response.json();
  } catch {
    throw new PlatformServiceError("invalid_image_result");
  }

  // Handle standard OpenAI style ({ data: [{ url, b64_json }] })
  if (Array.isArray(result?.data) && result.data[0]) {
    const item = result.data[0];
    const bytes =
      decodeImageBase64(item.b64_json) ??
      (await downloadServiceGeneratedImage(item.url));
    return { bytes, mimeType: "image/png" };
  }

  // Handle DashScope multimodal style
  const choices = result?.output?.choices;
  if (Array.isArray(choices) && choices[0]?.message?.content) {
    const contents = choices[0].message.content;
    const imgItem = Array.isArray(contents)
      ? contents.find((c: any) => c.image || c.url)
      : undefined;
    if (imgItem?.image || imgItem?.url) {
      const target = imgItem.image || imgItem.url;
      const bytes =
        decodeImageBase64(target) ??
        (await downloadServiceGeneratedImage(target));
      return { bytes, mimeType: "image/png" };
    }
  }

  throw new PlatformServiceError("invalid_image_result");
}

/** Generates an image with the configured Qwen / OpenAI-compatible provider. */
export async function generateImage(
  prompt: string,
  originalImages: ImageServiceOriginalImage[] = [],
): Promise<{ bytes: Buffer; mimeType: string }> {
  if (!hasQwenConfig()) {
    throw new PlatformServiceError("platform_not_configured");
  }
  return generateQwenImage(prompt, originalImages);
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

/** Local storage file path resolver */
function localStoragePath(key: string): string {
  requireAsciiKey(key);
  return path.join(UPLOADS_DIR, key);
}

export function getLocalFilePath(key: string): string | null {
  const filePath = localStoragePath(key);
  return fs.existsSync(filePath) ? filePath : null;
}

/** Stores an explicitly named, stable application key on local disk. */
export async function putStencilObject(
  key: string,
  bytes: Buffer,
  _contentType: string,
): Promise<void> {
  try {
    const filePath = localStoragePath(key);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    await fs.promises.writeFile(filePath, bytes);
  } catch (err) {
    throw new PlatformServiceError("storage_upload_failed");
  }
}

/** Returns the local `/uploads` URL for a stored key. */
export async function getCachedStencilDownloadUrl(
  key: string,
): Promise<string> {
  requireAsciiKey(key);
  return `/uploads/${key.replace(/\\/g, "/")}`;
}

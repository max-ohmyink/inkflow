import { afterEach, describe, expect, it, vi } from "vitest";
import {
  classifyProviderFailure,
  generateImage,
  PlatformServiceError,
} from "../server/stencils/platform";
import {
  createColorVersion,
  safeColorFailureDetails,
} from "../server/stencils/colorVersion";
import sharp from "sharp";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("safe image error diagnostics", () => {
  it("classifies provider credit/quota rejection without exposing remote text or credentials", () => {
    const failure = classifyProviderFailure(400, {
      code: "failed_precondition",
      message:
        "Insufficient credits. Private details and credential SECRET_VALUE",
    });
    expect(failure).toEqual({
      httpStatus: 400,
      providerCode: "failed_precondition",
      reason: "quota_or_credits",
    });
    expect(JSON.stringify(failure)).not.toContain("SECRET_VALUE");
  });
  it("recognizes the actual account usage exhausted rejection", () => {
    expect(
      classifyProviderFailure(400, {
        code: "failed_precondition",
        message: "your account has hit a usage exhausted",
      }),
    ).toEqual({
      httpStatus: 400,
      providerCode: "failed_precondition",
      reason: "quota_or_credits",
    });
  });
  it("distinguishes rate/access/service failures and does not guess a quota from precondition alone", () => {
    expect(
      classifyProviderFailure(400, { code: "failed_precondition" }).reason,
    ).toBe("unknown");
    expect(classifyProviderFailure(429, {}).reason).toBe("rate_limited");
    expect(classifyProviderFailure(401, {}).reason).toBe("access_denied");
    expect(classifyProviderFailure(503, {}).reason).toBe(
      "provider_unavailable",
    );
    expect(
      classifyProviderFailure(400, {
        code: "bad https://private.test/token=secret",
      }),
    ).not.toHaveProperty("providerCode");
  });
  it("retains HTTP rejection metadata on the real adapter without automatic retry or response leakage", async () => {
    vi.stubEnv("MANUS_API_URL", "https://example.test/");
    vi.stubEnv("MANUS_API_KEY", "private-test-key");
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "failed_precondition",
          message: "Insufficient credits for PRIVATE_ACCOUNT",
        }),
        { status: 400 },
      ),
    );
    vi.stubGlobal("fetch", fetch);
    let caught: unknown;
    try {
      await generateImage("a tattoo");
    } catch (error) {
      caught = error;
    }
    expect(fetch).toHaveBeenCalledOnce();
    expect(caught).toBeInstanceOf(PlatformServiceError);
    expect((caught as PlatformServiceError).diagnostics?.reason).toBe(
      "quota_or_credits",
    );
    expect(
      JSON.stringify((caught as PlatformServiceError).diagnostics),
    ).not.toContain("PRIVATE_ACCOUNT");
  });
  it("preserves the provider rejection cause through color editing rather than discarding it", async () => {
    const source = await sharp({
      create: { width: 4, height: 4, channels: 3, background: "#fff" },
    })
      .png()
      .toBuffer();
    const error = new PlatformServiceError("image_generation_failed", {
      httpStatus: 400,
      providerCode: "failed_precondition",
      reason: "quota_or_credits",
    });
    let caught: unknown;
    try {
      await createColorVersion(source, "mixed_color", {
        generateImage: vi.fn().mockRejectedValue(error),
      });
    } catch (failure) {
      caught = failure;
    }
    expect(safeColorFailureDetails(caught)).toEqual(error.diagnostics);
  });
});

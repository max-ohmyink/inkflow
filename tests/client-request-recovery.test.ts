import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CATALOG_FILTERS } from "../shared/catalog-filters";
const mocks = vi.hoisted(() => ({
  store: new Map<string, string>(),
  fetch: vi.fn(),
  random: vi.fn(),
}));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (key: string) => mocks.store.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      mocks.store.set(key, value);
    },
    removeItem: async (key: string) => {
      mocks.store.delete(key);
    },
    multiRemove: async (keys: string[]) => {
      keys.forEach((key) => mocks.store.delete(key));
    },
  },
}));
vi.mock("expo-crypto", () => ({
  randomUUID: () => "test-device",
  getRandomBytesAsync: mocks.random,
}));
vi.mock("../constants/api", () => ({ getApiBaseUrl: () => "" }));
import { createStencil, loadPendingRequest } from "../lib/stencil-client";
const key = "ohmyink:pending-request:v1";
const filters = {
  ...DEFAULT_CATALOG_FILTERS,
  artStyle: "fine_line" as const,
  colorMix: "monochrome" as const,
};
beforeEach(() => {
  mocks.store.clear();
  vi.clearAllMocks();
  mocks.random.mockResolvedValue(new Uint8Array(32).fill(6));
  vi.stubGlobal("fetch", mocks.fetch);
});
describe("client pending credential protection", () => {
  it("keeps an uncertain request intact instead of overwriting it with a new search", async () => {
    mocks.fetch.mockRejectedValueOnce(new Error("lost response"));
    await expect(
      createStencil(
        "flower",
        "fine_line",
        "blackwork",
        "first",
        filters,
      ),
    ).rejects.toThrow("lost response");
    const pending = mocks.store.get(key);
    await expect(
      createStencil("cat", "fine_line", "blackwork", "second"),
    ).rejects.toMatchObject({
      code: "pending_request_unresolved",
      status: 409,
    });
    expect(mocks.store.get(key)).toBe(pending);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(mocks.random).toHaveBeenCalledTimes(1);
  });
  it("reconnects with the same token, prompt and choices even if the new call arguments differ", async () => {
    mocks.fetch.mockRejectedValueOnce(new Error("lost response"));
    await expect(
      createStencil(
        "flower",
        "fine_line",
        "blackwork",
        "first",
        filters,
      ),
    ).rejects.toThrow();
    const pending = await loadPendingRequest();
    mocks.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: "accepted-job",
        token: pending!.capabilityToken,
      }),
    });
    const saved = await createStencil(
      "different prompt",
      "traditional",
      "jagua",
      "first",
    );
    const submitted = JSON.parse(mocks.fetch.mock.calls[1][1].body);
    expect(submitted).toMatchObject({
      concept: "flower",
      requestId: "first",
      filters,
      capabilityToken: pending!.capabilityToken,
    });
    expect(saved.filters).toEqual(filters);
    expect(saved.token).toBe(pending!.capabilityToken);
    expect(await loadPendingRequest()).toBeNull();
    expect(mocks.random).toHaveBeenCalledTimes(1);
  });
  it("allows a new search after a definite validation rejection without blocking the guest", async () => {
    mocks.fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: "invalid_request" }),
    });
    await expect(
      createStencil("unmatched", "fine_line", "blackwork", "first"),
    ).rejects.toMatchObject({ status: 400 });
    expect(await loadPendingRequest()).toBeNull();
    mocks.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "next-job" }),
    });
    const saved = await createStencil(
      "heart",
      "fine_line",
      "blackwork",
      "second",
    );
    expect(saved.id).toBe("next-job");
    expect(mocks.random).toHaveBeenCalledTimes(2);
  });
});

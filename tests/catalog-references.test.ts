import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ readFile: vi.fn(), sign: vi.fn() }));
vi.mock("node:fs/promises", () => ({ readFile: mocks.readFile }));
vi.mock("../server/stencils/platform", () => ({
  getCachedStencilDownloadUrl: mocks.sign,
}));
import { selectedStyleReference } from "../server/stencils/catalogReferences";

beforeEach(() => {
  mocks.readFile.mockReset();
  mocks.sign
    .mockReset()
    .mockResolvedValue("https://example.test/authorized-reference.png");
});
describe("simple-line catalog reference safety", () => {
  it("never sends an old mandala object to the image model", async () => {
    mocks.readFile.mockResolvedValue(
      JSON.stringify({ geometric: "mandala-v1_old.png" }),
    );
    expect(await selectedStyleReference("geometric")).toBeUndefined();
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it("reads replacement bindings fresh instead of retaining a retired mapping", async () => {
    mocks.readFile
      .mockResolvedValueOnce(
        JSON.stringify({ geometric: "mandala-v1_old.png" }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({ geometric: "heart-shaped-clip_new.png" }),
      );
    expect(await selectedStyleReference("geometric")).toBeUndefined();
    expect(await selectedStyleReference("geometric")).toEqual({
      url: "https://example.test/authorized-reference.png",
      mimeType: "image/png",
    });
    expect(mocks.sign).toHaveBeenCalledWith("heart-shaped-clip_new.png");
  });
});

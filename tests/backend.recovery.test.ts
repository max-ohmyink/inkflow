import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findRequest: vi.fn(),
  failOrphans: vi.fn(),
  queued: vi.fn(),
  insert: vi.fn(),
  generate: vi.fn(),
}));
vi.mock("../server/stencils/repository", () => ({
  countClientActiveJobs: vi.fn().mockResolvedValue(0),
  failOrphanedInProcessStencilJobs: mocks.failOrphans,
  findStencilJob: vi.fn(),
  findStencilJobByRequest: mocks.findRequest,
  insertStencilJob: mocks.insert,
  listQueuedStencilJobs: mocks.queued,
  markJobFailed: vi.fn(),
  markJobGenerating: vi.fn(),
  markJobProcessing: vi.fn(),
  saveReadyStencilOptions: vi.fn(),
}));
vi.mock("../server/stencils/platform", () => ({
  generateImage: mocks.generate,
  generateContactSheet: mocks.generate,
  putStencilObject: vi.fn(),
  getCachedStencilDownloadUrl: vi.fn(),
}));
import {
  createStencilJob,
  hashCapabilityToken,
  startStencilWorker,
} from "../server/stencils/service";

const token = "a".repeat(64);
const input = {
  concept: "Lotus",
  style: "fine_line" as const,
  medium: "blackwork" as const,
  clientId: "ipad",
  requestId: "request-1",
  capabilityToken: token,
};
beforeEach(() => {
  vi.clearAllMocks();
});
describe("recoverable stencil work", () => {
  it("returns the existing job after a lost response when the pre-saved token proves ownership", async () => {
    mocks.findRequest.mockResolvedValue({
      id: "existing-job",
      tokenHash: hashCapabilityToken(token),
    });
    expect(await createStencilJob(input)).toEqual({
      id: "existing-job",
      token,
      reused: false,
    });
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("does not disclose a capability when a duplicate request has the wrong token", async () => {
    mocks.findRequest.mockResolvedValue({
      id: "existing-job",
      tokenHash: hashCapabilityToken("b".repeat(64)),
    });
    expect(await createStencilJob(input)).toEqual({
      id: "existing-job",
      token: "",
      reused: true,
    });
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("finishes orphan cleanup before looking up queued jobs on single-worker startup", async () => {
    mocks.failOrphans.mockResolvedValue(1);
    mocks.queued.mockResolvedValue([]);
    await startStencilWorker();
    expect(mocks.failOrphans).toHaveBeenCalledOnce();
    expect(mocks.failOrphans.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.queued.mock.invocationCallOrder[0],
    );
    expect(mocks.generate).not.toHaveBeenCalled();
  });
});

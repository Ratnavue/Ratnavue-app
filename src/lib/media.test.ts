import { describe, it, expect, vi, beforeEach } from "vitest";
import { HeadBucketCommand, CreateBucketCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { looksLikeVideo, saveUploadedMedia } from "@/lib/media";

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ storageClient: () => ({ send: sendMock }), MEDIA_BUCKET: "test-bucket" }));
vi.mock("@/lib/media-cache", () => ({ writeCached: vi.fn(), readCached: vi.fn(), deleteCached: vi.fn() }));

function fakeFile(bytes: number[], type: string, name = "test"): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

function validVideoFile(): File {
  const bytes = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftyp", "ascii"), Buffer.alloc(4)]);
  return fakeFile(Array.from(bytes), "video/mp4", "clip.mp4");
}

describe("looksLikeVideo", () => {
  it("accepts a real WebM magic number", () => {
    expect(looksLikeVideo(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0]), "video/webm")).toBe(true);
  });

  it("rejects arbitrary bytes claiming to be WebM", () => {
    expect(looksLikeVideo(Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]), "video/webm")).toBe(false);
  });

  it("accepts a real MP4/ISO-BMFF ftyp box", () => {
    // [size(4 bytes)] "ftyp" [rest]
    const buf = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftyp", "ascii"), Buffer.alloc(4)]);
    expect(looksLikeVideo(buf, "video/mp4")).toBe(true);
  });

  it("accepts a QuickTime .mov starting with a moov box", () => {
    const buf = Buffer.concat([Buffer.from([0, 0, 0, 0x08]), Buffer.from("moov", "ascii")]);
    expect(looksLikeVideo(buf, "video/quicktime")).toBe(true);
  });

  it("rejects arbitrary bytes claiming to be MP4 (the exact gap this closes)", () => {
    expect(looksLikeVideo(Buffer.from("this is just some text pretending to be a video file"), "video/mp4")).toBe(false);
  });

  it("rejects a buffer too short to contain a box header", () => {
    expect(looksLikeVideo(Buffer.from([1, 2, 3]), "video/mp4")).toBe(false);
  });

  it("returns false for an unrecognized mime type", () => {
    expect(looksLikeVideo(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), "video/x-flv")).toBe(false);
  });
});

describe("saveUploadedMedia — validation guards (all throw before any storage/S3 call)", () => {
  it("rejects an unsupported file type", async () => {
    await expect(saveUploadedMedia(fakeFile([1, 2, 3], "application/zip"))).rejects.toThrow(/unsupported file type/i);
  });

  it("rejects an empty file", async () => {
    await expect(saveUploadedMedia(fakeFile([], "image/jpeg"))).rejects.toThrow(/empty/i);
  });

  it("rejects a file over the explicit action-upload size cap", async () => {
    const big = new File([new Uint8Array(5 * 1024 * 1024)], "big.mp4", { type: "video/mp4" });
    await expect(saveUploadedMedia(big)).rejects.toThrow(/at most/i);
  });

  it("rejects a video file whose content doesn't match its claimed type", async () => {
    const fakeVideo = fakeFile(Array.from(Buffer.from("not actually a video")), "video/mp4");
    await expect(saveUploadedMedia(fakeVideo)).rejects.toThrow(/doesn't look like a valid video/i);
  });
});

// Regression coverage for the real production bug: Supabase Storage's
// S3-compatible gateway doesn't always return a cleanly-parseable
// "BucketAlreadyExists" XML error, so ensureBucket (lib/media.ts) can't
// just match the error's `name` — it has to verify ground truth with a
// follow-up HeadBucket call. Each test re-imports the module fresh
// (vi.resetModules) since ensureBucket memoizes its result at module
// scope.
describe("ensureBucket (exercised through saveUploadedMedia's upload path)", () => {
  beforeEach(() => {
    vi.resetModules();
    sendMock.mockReset();
  });

  it("uploads straight through when the bucket already exists", async () => {
    sendMock.mockImplementation(async (command: unknown) => {
      if (command instanceof HeadBucketCommand) return {};
      if (command instanceof PutObjectCommand) return {};
      throw new Error(`unexpected command: ${(command as { constructor: { name: string } }).constructor.name}`);
    });

    const { saveUploadedMedia: freshSave } = await import("@/lib/media");
    const result = await freshSave(validVideoFile());

    expect(result.type).toBe("VIDEO");
  });

  it("recovers when CreateBucket fails with an unparseable error but the bucket turns out to already exist — the exact gap this closes", async () => {
    let headCalls = 0;
    sendMock.mockImplementation(async (command: unknown) => {
      if (command instanceof HeadBucketCommand) {
        headCalls++;
        if (headCalls === 1) throw new Error("NotFound"); // first HEAD: genuinely looks absent
        return {}; // second HEAD (the new verify-after-create step): it's actually there
      }
      if (command instanceof CreateBucketCommand) {
        // Mimics the real failure: a response the AWS SDK's XML parser
        // can't make sense of, so `err.name` never matches a recognizable
        // S3 error code.
        throw new Error("Deserialization error: XML parse error: unexpected content");
      }
      if (command instanceof PutObjectCommand) return {};
      throw new Error(`unexpected command: ${(command as { constructor: { name: string } }).constructor.name}`);
    });

    const { saveUploadedMedia: freshSave } = await import("@/lib/media");
    const result = await freshSave(validVideoFile());

    expect(result.type).toBe("VIDEO");
    expect(headCalls).toBe(2);
  });

  it("still fails cleanly when the bucket genuinely can't be created or found", async () => {
    sendMock.mockImplementation(async (command: unknown) => {
      if (command instanceof HeadBucketCommand) throw new Error("NotFound");
      if (command instanceof CreateBucketCommand) throw new Error("AccessDenied");
      throw new Error("unexpected command");
    });

    const { saveUploadedMedia: freshSave } = await import("@/lib/media");
    await expect(freshSave(validVideoFile())).rejects.toThrow(/could not create storage bucket/i);
  });

  it("doesn't permanently poison later uploads after a transient failure", async () => {
    let headCalls = 0;
    sendMock.mockImplementation(async (command: unknown) => {
      if (command instanceof HeadBucketCommand) {
        headCalls++;
        if (headCalls <= 2) throw new Error("NotFound"); // both HEAD calls in the first (failing) attempt
        return {}; // the retry's HEAD call succeeds
      }
      if (command instanceof CreateBucketCommand) throw new Error("AccessDenied");
      if (command instanceof PutObjectCommand) return {};
      throw new Error("unexpected command");
    });

    const { saveUploadedMedia: freshSave } = await import("@/lib/media");
    await expect(freshSave(validVideoFile())).rejects.toThrow(/could not create storage bucket/i);

    // Same warm module instance, second upload attempt — must retry fresh
    // rather than re-awaiting the first attempt's cached, rejected promise.
    const result = await freshSave(validVideoFile());
    expect(result.type).toBe("VIDEO");
  });
});

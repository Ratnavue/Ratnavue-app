import sharp from "sharp";
import { randomUUID } from "crypto";
import {
  HeadBucketCommand,
  CreateBucketCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { storageClient, MEDIA_BUCKET } from "@/lib/supabase";
import { writeCached, deleteCached } from "@/lib/media-cache";

// All uploads go to Supabase Storage (not local disk) so a file uploaded
// through the admin panel is readable from any environment that has these
// two env vars — local dev and a deployed host alike — rather than only
// the machine/instance that happened to receive the upload request. A
// serverless host's filesystem is ephemeral and not shared across
// instances, so local-disk storage worked in dev but silently broke (or
// lost files) once deployed.

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

// This path is routed through a Server Action, capped at 4MB by
// next.config.ts's bodySizeLimit — but that cap is incidental (it exists
// for every action's request body, not specifically for this function),
// so relying on it alone means a change to that config would silently
// change this function's behavior too. Checked explicitly here instead.
// A real product photo/video gallery upload bypasses Server Actions
// entirely (see the direct-upload section below, MAX_IMAGE_BYTES/
// MAX_VIDEO_BYTES) — this cap is specifically for the smaller
// customer-facing uploads that still go through saveUploadedMedia
// (custom-design reference photos, lab logos, certificate scans).
const MAX_ACTION_UPLOAD_BYTES = 4 * 1024 * 1024;

// A minimal content sniff — not a full parser, just enough to reject
// arbitrary bytes wearing a video Content-Type label, which
// saveUploadedMedia previously trusted outright (images are incidentally
// protected because sharp() below throws on non-image bytes; nothing
// equivalent existed for video). MP4 and QuickTime .mov are both
// ISO-base-media-file-format containers: a 4-byte box size followed by a
// 4-byte ASCII box type at offset 4, and real files start with one of a
// handful of common top-level box types. WebM is EBML-based and always
// starts with the same 4-byte magic number.
export function looksLikeVideo(buffer: Buffer, mimeType: string): boolean {
  if (mimeType === "video/webm") {
    return buffer.length >= 4 && buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3;
  }
  if (mimeType === "video/mp4" || mimeType === "video/quicktime") {
    if (buffer.length < 8) return false;
    const boxType = buffer.subarray(4, 8).toString("ascii");
    return ["ftyp", "moov", "mdat", "free", "skip", "wide"].includes(boxType);
  }
  return false;
}

// Self-provisioning: create the bucket on first use rather than requiring
// a manual dashboard step per environment — a fresh Supabase project (or a
// second one for a new deployment) works out of the box. Memoized per
// process so it's only attempted once; "already exists" from a previous
// run (or a concurrent request) is expected and ignored. Left private —
// nothing needs it public, since every read goes through our own
// /media/[filename] route (app/media/[filename]/route.ts) using this same
// S3 client, never a direct Supabase Storage URL.
let bucketReady: Promise<void> | null = null;
function ensureBucket(): Promise<void> {
  if (!bucketReady) {
    bucketReady = (async () => {
      const client = storageClient();
      try {
        await client.send(new HeadBucketCommand({ Bucket: MEDIA_BUCKET }));
        return;
      } catch {
        // Not found (or a transient error) — fall through and try to create it.
      }
      try {
        await client.send(new CreateBucketCommand({ Bucket: MEDIA_BUCKET }));
      } catch (err) {
        const name = (err as { name?: string; Code?: string })?.name ?? "";
        if (!/BucketAlreadyExists|BucketAlreadyOwnedByYou/i.test(name)) {
          throw new Error(`Could not create storage bucket: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    })();
  }
  return bucketReady;
}

async function upload(filename: string, buffer: Buffer, contentType: string): Promise<string> {
  const client = storageClient();
  await ensureBucket();

  // Storage is the durable copy — required, throws on failure. The local
  // cache write is a best-effort mirror on top of it (see lib/media-cache),
  // so it never blocks or fails an upload.
  await client.send(
    new PutObjectCommand({
      Bucket: MEDIA_BUCKET,
      Key: filename,
      Body: buffer,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  await writeCached(filename, buffer);

  // Served by our own route, not a Supabase Storage URL — see lib/supabase.ts.
  return `/media/${filename}`;
}

// Best-effort cleanup for a replaced/removed upload — takes the stored
// media URL (as saved on the row) and deletes the matching object from
// both Storage and the local cache. Callers already treat this as
// non-critical (swallow errors with .catch(() => {})), same as the old
// local-disk unlink() calls did.
export async function deleteUploadedFile(url: string): Promise<void> {
  const filename = url.split("/").pop();
  if (!filename) return;
  const client = storageClient();
  await client.send(new DeleteObjectCommand({ Bucket: MEDIA_BUCKET, Key: filename }));
  await deleteCached(filename);
}

export interface SavedMedia {
  url: string;
  type: "IMAGE" | "VIDEO";
}

export async function saveUploadedMedia(file: File): Promise<SavedMedia> {
  const isImage = IMAGE_TYPES.has(file.type);
  const isVideo = VIDEO_TYPES.has(file.type);
  if (!isImage && !isVideo) {
    throw new Error("Unsupported file type. Please upload a JPEG/PNG/WEBP image or an MP4/WEBM video.");
  }
  if (file.size <= 0) throw new Error("That file is empty.");
  if (file.size > MAX_ACTION_UPLOAD_BYTES) {
    throw new Error(`Files here can be at most ${MAX_ACTION_UPLOAD_BYTES / (1024 * 1024)}MB.`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (isVideo && !looksLikeVideo(buffer, file.type)) {
    throw new Error("That file doesn't look like a valid video — please check it isn't corrupted and try again.");
  }

  const id = randomUUID();

  if (isImage) {
    const filename = `${id}.webp`;
    const optimized = await sharp(buffer)
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    const url = await upload(filename, optimized, "image/webp");
    return { url, type: "IMAGE" };
  }

  const ext = file.type === "video/webm" ? "webm" : file.type === "video/quicktime" ? "mov" : "mp4";
  const filename = `${id}.${ext}`;
  const url = await upload(filename, buffer, file.type);
  return { url, type: "VIDEO" };
}

// ---------- Direct-to-storage uploads (product photos & videos) ----------
//
// Routing a file through a Server Action caps it at the action body limit
// (1MB by default, ~4.5MB on Vercel regardless) — fine for a logo, but a
// phone photo is several MB and a product video is tens. So for the gallery
// the browser uploads straight to Storage with a short-lived presigned PUT
// URL; the server only signs the request (admin-only) and afterwards
// verifies the object actually landed before recording it.

// Supabase's per-object limit on the free tier is 50MB.
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const DIRECT_IMAGE_EXT: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg" };
const DIRECT_VIDEO_EXT: Record<string, string> = { "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" };

// Only keys this module itself would generate — registering an arbitrary
// key would let a caller attach some *other* stored file to a product.
const DIRECT_KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg|mp4|webm|mov)$/;

export function isDirectUploadKey(key: string): boolean {
  return DIRECT_KEY.test(key);
}

export async function createDirectUpload(
  contentType: string,
  size: number,
): Promise<{ key: string; uploadUrl: string; type: "IMAGE" | "VIDEO" }> {
  const imageExt = DIRECT_IMAGE_EXT[contentType];
  const videoExt = DIRECT_VIDEO_EXT[contentType];
  if (!imageExt && !videoExt) {
    throw new Error("Unsupported file type. Please upload a JPEG/PNG/WEBP image or an MP4/WEBM/MOV video.");
  }
  const type = imageExt ? "IMAGE" : "VIDEO";
  if (size <= 0) throw new Error("The file is empty.");
  if (type === "IMAGE" && size > MAX_IMAGE_BYTES) throw new Error("That image is still too large after compression.");
  if (type === "VIDEO" && size > MAX_VIDEO_BYTES) {
    throw new Error(`Videos can be at most ${MAX_VIDEO_BYTES / 1024 / 1024}MB — trim or compress it and try again.`);
  }

  await ensureBucket();
  const key = `${randomUUID()}.${imageExt ?? videoExt}`;
  const uploadUrl = await getSignedUrl(
    storageClient(),
    new PutObjectCommand({ Bucket: MEDIA_BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: 600 },
  );
  return { key, uploadUrl, type };
}

// Confirms a direct upload really exists in Storage (and re-checks its
// size server-side, since the client-reported size was only a claim).
export async function inspectDirectUpload(key: string): Promise<{ url: string; type: "IMAGE" | "VIDEO" }> {
  if (!isDirectUploadKey(key)) throw new Error("Invalid upload reference.");
  const head = await storageClient().send(new HeadObjectCommand({ Bucket: MEDIA_BUCKET, Key: key }));
  const type = /\.(mp4|webm|mov)$/.test(key) ? "VIDEO" : "IMAGE";
  const size = head.ContentLength ?? 0;
  if (size <= 0) throw new Error("The upload didn't complete — please try again.");
  if (type === "VIDEO" && size > MAX_VIDEO_BYTES) throw new Error("Video is too large.");
  if (type === "IMAGE" && size > MAX_IMAGE_BYTES) throw new Error("Image is too large.");
  return { url: `/media/${key}`, type };
}

// Videos are served by redirecting to a short-lived signed Storage URL:
// /media/[filename] otherwise buffers the whole object into one response,
// which a serverless host caps at ~4.5MB and which can't do Range requests
// (seeking) at all. Storage itself handles both natively.
export async function signedReadUrl(filename: string, expiresIn = 3600): Promise<string> {
  return getSignedUrl(storageClient(), new GetObjectCommand({ Bucket: MEDIA_BUCKET, Key: filename }), { expiresIn });
}

const CERT_DOCUMENT_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

// Certification files (lab report scans) are a single attachment on the
// Gemstone itself, not a MediaAsset gallery entry — so this is deliberately
// separate from saveUploadedMedia rather than shoehorning a PDF through the
// IMAGE/VIDEO MediaType enum.
export async function saveCertificateFile(file: File): Promise<{ url: string }> {
  if (!CERT_DOCUMENT_TYPES.has(file.type)) {
    throw new Error("Unsupported file type. Please upload a PDF, JPEG, PNG, or WEBP certificate.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const id = randomUUID();

  if (file.type === "application/pdf") {
    const filename = `${id}.pdf`;
    const url = await upload(filename, buffer, "application/pdf");
    return { url };
  }

  // Scanned/photographed certificates: optimize like any other image, but
  // keep more headroom than product photos so fine print stays legible.
  const filename = `${id}.webp`;
  const optimized = await sharp(buffer)
    .rotate()
    .resize({ width: 2200, height: 2200, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 90 })
    .toBuffer();
  const url = await upload(filename, optimized, "image/webp");
  return { url };
}

// Certification lab logos: small, square-ish trust-badge marks shown on the
// public gem page. WEBP keeps transparency (most lab marks are transparent
// PNG/SVG originals) and a much smaller cap than product photos, since this
// is an icon-sized badge, not a gallery image.
export async function saveLabLogo(file: File): Promise<{ url: string }> {
  if (!IMAGE_TYPES.has(file.type)) {
    throw new Error("Unsupported file type. Please upload a JPEG, PNG, or WEBP logo.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = `${randomUUID()}.webp`;
  const optimized = await sharp(buffer)
    .resize({ width: 400, height: 400, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 90 })
    .toBuffer();
  const url = await upload(filename, optimized, "image/webp");
  return { url };
}

// AR try-on 3D models (JewelryPiece.arModelUrl) — one GLB per piece,
// uploaded through a Server Action the same way everything else above is
// (not the direct-upload bypass product photos/videos use), so it's
// bound by next.config.ts's 4MB server-action body cap same as any other
// action — generous for a simple procedural necklace/pendant mesh, but a
// real detailed 3D scan might need the direct-upload path instead; revisit
// if that becomes the real constraint.
const MAX_AR_MODEL_BYTES = 3.5 * 1024 * 1024;

// Browsers inconsistently report .glb files as `model/gltf-binary`,
// `application/octet-stream`, or nothing at all — unlike images/video,
// there's no second library (sharp, looksLikeVideo) incidentally
// validating the bytes here, so the magic number check below is the only
// real check. A valid .glb always starts with the ASCII bytes "glTF"
// (the glTF 2.0 binary container's magic number) followed by a uint32
// version field — see https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#glb-file-format-specification.
function looksLikeGlb(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer[0] === 0x67 && buffer[1] === 0x6c && buffer[2] === 0x54 && buffer[3] === 0x46; // "glTF"
}

export async function saveArModelFile(file: File): Promise<{ url: string }> {
  if (file.size <= 0) throw new Error("That file is empty.");
  if (file.size > MAX_AR_MODEL_BYTES) {
    throw new Error(`3D models here can be at most ${MAX_AR_MODEL_BYTES / (1024 * 1024)}MB.`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!looksLikeGlb(buffer)) {
    throw new Error("That doesn't look like a valid .glb (glTF binary) 3D model file.");
  }

  const filename = `${randomUUID()}.glb`;
  const url = await upload(filename, buffer, "model/gltf-binary");
  return { url };
}

import { GetObjectCommand } from "@aws-sdk/client-s3";
import { storageClient, MEDIA_BUCKET } from "@/lib/supabase";
import { readCached, writeCached } from "@/lib/media-cache";
import { signedReadUrl } from "@/lib/media";

// Every uploaded image/video/PDF is served through here rather than a
// direct Supabase Storage URL (see lib/supabase.ts and lib/media.ts) —
// local cache first (instant, the common case), falling back to Storage
// (the durable source of truth) on a miss and repopulating the cache for
// next time. This is also what lets the "media" bucket stay private: only
// this server-side S3 client ever reads it.

const CONTENT_TYPES: Record<string, string> = {
  webp: "image/webp",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  avif: "image/avif",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  pdf: "application/pdf",
  glb: "model/gltf-binary",
};

function contentTypeFor(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

function fileResponse(buffer: Buffer, filename: string): Response {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentTypeFor(filename),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

const VIDEO_EXT = /\.(mp4|webm|mov)$/i;

export async function GET(_req: Request, ctx: RouteContext<"/media/[filename]">) {
  const { filename } = await ctx.params;

  // Video: redirect to a short-lived signed Storage URL instead of
  // buffering it here — a serverless response tops out around 4.5MB, and
  // this route can't do Range requests, which is what makes a <video>
  // seekable. Cached for less than the signature's own 1h lifetime, so a
  // cached redirect never outlives the URL it points at.
  if (VIDEO_EXT.test(filename)) {
    try {
      return new Response(null, {
        status: 302,
        headers: { Location: await signedReadUrl(filename, 3600), "Cache-Control": "public, max-age=1800" },
      });
    } catch (err) {
      console.error(`Could not sign video URL for ${filename}:`, err);
      return new Response("Storage error", { status: 502 });
    }
  }

  const cached = await readCached(filename);
  if (cached) return fileResponse(cached, filename);

  try {
    const result = await storageClient().send(new GetObjectCommand({ Bucket: MEDIA_BUCKET, Key: filename }));
    const bytes = await result.Body?.transformToByteArray();
    if (!bytes) return new Response("Not found", { status: 404 });

    const buffer = Buffer.from(bytes);
    void writeCached(filename, buffer);
    return fileResponse(buffer, filename);
  } catch (err) {
    const name = (err as { name?: string })?.name ?? "";
    if (/NoSuchKey|NotFound/i.test(name)) return new Response("Not found", { status: 404 });
    console.error(`Media fetch failed for ${filename}:`, err);
    return new Response("Storage error", { status: 502 });
  }
}

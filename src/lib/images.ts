import "server-only";

import sharp from "sharp";

import { RECIPE_IMAGE_MAX_BYTES } from "@/lib/validation/recipe";

// Decoding and rotating allocate width x height x channels x bytes per channel, and a small
// file can describe a very large image. The pixel count is capped at what a 24 megapixel
// camera produces, and each side is capped for display sanity.
const MAX_INPUT_PIXELS = 25_000_000;
export const IMAGE_MAX_DIMENSION = 8000;

// libvips keeps its own operation cache and spreads one image across several threads. Both
// multiply memory use, so they are turned down for a process that handles many users' uploads.
sharp.cache(false);
sharp.concurrency(1);

// Re-encoding a large image takes hundreds of megabytes briefly, so only one runs at a time
// and only a few uploads may wait. Anything beyond that is refused rather than queued without
// bound.
const MAX_CONCURRENT_REENCODES = 1;
const MAX_WAITING_REENCODES = 10;
let activeReencodes = 0;
const waitingReencodes: Array<() => void> = [];

async function acquireReencodeSlot(): Promise<boolean> {
  if (activeReencodes < MAX_CONCURRENT_REENCODES) {
    activeReencodes++;
    return true;
  }
  if (waitingReencodes.length >= MAX_WAITING_REENCODES) return false;
  // A released slot is handed straight to the next waiter, so the active count stays put.
  await new Promise<void>((resolve) => waitingReencodes.push(resolve));
  return true;
}

function releaseReencodeSlot(): void {
  const next = waitingReencodes.shift();
  if (next) next();
  else activeReencodes--;
}

export type ImageKind = {
  contentType: "image/jpeg" | "image/png" | "image/webp";
  ext: "jpg" | "png" | "webp";
};

export const IMAGE_EXTENSIONS: Record<ImageKind["ext"], ImageKind["contentType"]> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function startsWith(bytes: Uint8Array, offset: number, expected: readonly number[]): boolean {
  return bytes.length >= offset + expected.length && expected.every((b, i) => bytes[offset + i] === b);
}

function ascii(text: string): number[] {
  return [...text].map((char) => char.charCodeAt(0));
}

/**
 * Identifies an image from its leading bytes. Only JPEG, PNG and WebP are accepted; the
 * type the browser declared is never consulted, and SVG (which can carry script) is not
 * on the list.
 */
export function sniffImage(bytes: Uint8Array): ImageKind | null {
  if (startsWith(bytes, 0, [0xff, 0xd8, 0xff])) {
    return { contentType: "image/jpeg", ext: "jpg" };
  }

  // PNG: signature, then the IHDR chunk header (length 13, type "IHDR").
  if (
    startsWith(bytes, 0, PNG_SIGNATURE) &&
    startsWith(bytes, 8, [0x00, 0x00, 0x00, 0x0d, ...ascii("IHDR")])
  ) {
    return { contentType: "image/png", ext: "png" };
  }

  // WebP: RIFF container whose form type is WEBP and whose first chunk is a known image chunk.
  if (
    startsWith(bytes, 0, ascii("RIFF")) &&
    startsWith(bytes, 8, ascii("WEBP")) &&
    bytes.length >= 20 &&
    (startsWith(bytes, 12, ascii("VP8 ")) ||
      startsWith(bytes, 12, ascii("VP8L")) ||
      startsWith(bytes, 12, ascii("VP8X")))
  ) {
    const declared = (bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24)) >>> 0;
    // The RIFF size counts everything after its own 8 bytes; a file shorter than that is truncated.
    if (declared + 8 <= bytes.length) return { contentType: "image/webp", ext: "webp" };
  }

  return null;
}

export type ImageCheck =
  | { ok: true; bytes: Uint8Array; kind: ImageKind }
  | { ok: false; error: string };

export const IMAGE_TYPE_ERROR = "Choose a JPEG, PNG or WebP image.";
export const IMAGE_DIMENSION_ERROR = `This image is too large. It can be at most ${IMAGE_MAX_DIMENSION} pixels on a side and ${MAX_INPUT_PIXELS / 1_000_000} megapixels in total.`;
export const IMAGE_BUSY_ERROR = "Image processing is busy. Try again in a moment.";
export const IMAGE_UNREADABLE_ERROR = "This image could not be read.";
export const IMAGE_SIZE_ERROR = `The image must be ${RECIPE_IMAGE_MAX_BYTES / (1024 * 1024)} MB or smaller.`;

/**
 * Decodes the image and encodes it again in the same format. The output carries no EXIF,
 * GPS or other metadata, has the camera orientation applied, and contains only pixel data,
 * so anything else hidden in the upload (a polyglot, trailing bytes) is dropped.
 */
async function reencode(bytes: Uint8Array, kind: ImageKind): Promise<ImageCheck> {
  try {
    const input = () => sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS });

    const { width, height } = await input().metadata();
    if (!width || !height) return { ok: false, error: IMAGE_UNREADABLE_ERROR };
    if (
      width > IMAGE_MAX_DIMENSION ||
      height > IMAGE_MAX_DIMENSION ||
      width * height > MAX_INPUT_PIXELS
    ) {
      return { ok: false, error: IMAGE_DIMENSION_ERROR };
    }

    const oriented = input().rotate();
    const encoded =
      kind.ext === "jpg"
        ? oriented.jpeg({ quality: 90 })
        : kind.ext === "png"
          ? oriented.png()
          : oriented.webp({ quality: 90 });
    const output = await encoded.toBuffer();
    return { ok: true, bytes: new Uint8Array(output), kind };
  } catch (error) {
    if (error instanceof Error && /pixel limit/i.test(error.message)) {
      return { ok: false, error: IMAGE_DIMENSION_ERROR };
    }
    return { ok: false, error: IMAGE_UNREADABLE_ERROR };
  }
}

/**
 * Checks an uploaded file by size and content and returns the re-encoded image to store.
 * Reads nothing when the size is already too large.
 */
export async function checkImageUpload(file: File): Promise<ImageCheck> {
  if (file.size > RECIPE_IMAGE_MAX_BYTES) return { ok: false, error: IMAGE_SIZE_ERROR };

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length > RECIPE_IMAGE_MAX_BYTES) return { ok: false, error: IMAGE_SIZE_ERROR };

  const kind = sniffImage(bytes);
  if (!kind) return { ok: false, error: IMAGE_TYPE_ERROR };
  if (!(await acquireReencodeSlot())) return { ok: false, error: IMAGE_BUSY_ERROR };
  try {
    return await reencode(bytes, kind);
  } finally {
    releaseReencodeSlot();
  }
}

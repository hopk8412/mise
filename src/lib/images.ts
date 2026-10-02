import { RECIPE_IMAGE_MAX_BYTES } from "@/lib/validation/recipe";

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
export const IMAGE_SIZE_ERROR = `The image must be ${RECIPE_IMAGE_MAX_BYTES / (1024 * 1024)} MB or smaller.`;

/** Checks an uploaded file by size and content. Reads nothing when the size is already too large. */
export async function checkImageUpload(file: File): Promise<ImageCheck> {
  if (file.size > RECIPE_IMAGE_MAX_BYTES) return { ok: false, error: IMAGE_SIZE_ERROR };

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length > RECIPE_IMAGE_MAX_BYTES) return { ok: false, error: IMAGE_SIZE_ERROR };

  const kind = sniffImage(bytes);
  if (!kind) return { ok: false, error: IMAGE_TYPE_ERROR };
  return { ok: true, bytes, kind };
}

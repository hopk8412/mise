import { isRecipeImageKey, storage } from "@/lib/storage";

function notFound() {
  return new Response("Not found", {
    status: 404,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

/**
 * Serves an uploaded recipe image. Keys are random and never reused, so a response can be
 * cached forever. Anyone holding a key can fetch the file, drafts included; the keys are
 * unguessable and the route lists nothing.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const key = path.join("/");
  if (!isRecipeImageKey(key)) return notFound();

  let file;
  try {
    file = await storage.get(key);
  } catch (error) {
    console.error("Reading an uploaded image failed", error);
    return new Response("Could not read the image", {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    });
  }
  if (!file) return notFound();

  return new Response(file.bytes as BodyInit, {
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(file.bytes.byteLength),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}

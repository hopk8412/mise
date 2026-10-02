import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { IMAGE_EXTENSIONS, type ImageKind } from "@/lib/images";

export interface Storage {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<{ bytes: Uint8Array; contentType: string } | null>;
  delete(key: string): Promise<void>;
}

// Lowercase path segments of [a-z0-9._-], none starting with a dot, so no ".." or hidden names.
const KEY_PATTERN = /^[a-z0-9_-][a-z0-9._-]*(?:\/[a-z0-9_-][a-z0-9._-]*)*$/;
const MAX_KEY_LENGTH = 200;

// The only keys this application creates: recipes/<uuid>.<ext>.
const RECIPE_IMAGE_KEY_PATTERN =
  /^recipes\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

/** True when a key is safe to map onto a path: no traversal, no absolute path, no odd characters. */
export function isValidStorageKey(key: unknown): key is string {
  return typeof key === "string" && key.length <= MAX_KEY_LENGTH && KEY_PATTERN.test(key);
}

/** True for a key shaped like one this application generates for a recipe image. */
export function isRecipeImageKey(key: unknown): key is string {
  return typeof key === "string" && RECIPE_IMAGE_KEY_PATTERN.test(key);
}

/** A fresh key for a recipe image. Keys are never reused or derived from user input. */
export function newRecipeImageKey(kind: ImageKind): string {
  return `recipes/${randomUUID()}.${kind.ext}`;
}

function contentTypeForKey(key: string): string | null {
  const ext = key.slice(key.lastIndexOf(".") + 1);
  return Object.hasOwn(IMAGE_EXTENSIONS, ext) ? IMAGE_EXTENSIONS[ext as ImageKind["ext"]] : null;
}

class LocalDiskStorage implements Storage {
  constructor(private readonly rootDir: () => string) {}

  /** Maps a key to a file path and confirms it stays inside the root. */
  private resolve(key: string): string {
    if (!isValidStorageKey(key)) throw new Error("Invalid storage key.");
    const root = path.resolve(this.rootDir());
    const target = path.resolve(root, key);
    if (!target.startsWith(root + path.sep)) throw new Error("Invalid storage key.");
    return target;
  }

  async put(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
    const expected = contentTypeForKey(key);
    if (!expected || expected !== contentType) {
      throw new Error("The content type does not match the storage key.");
    }
    const target = this.resolve(key);
    await mkdir(path.dirname(target), { recursive: true });
    // Write beside the destination and rename, so a reader never sees half a file.
    const temporary = `${target}.${randomUUID()}.partial`;
    try {
      await writeFile(temporary, bytes, { flag: "wx" });
      await rename(temporary, target);
    } catch (error) {
      await unlink(temporary).catch(() => undefined);
      throw error;
    }
  }

  async get(key: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
    const contentType = isValidStorageKey(key) ? contentTypeForKey(key) : null;
    if (!contentType) return null;
    try {
      return { bytes: await readFile(this.resolve(key)), contentType };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.resolve(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}

export const storage: Storage = new LocalDiskStorage(
  () => process.env.UPLOADS_DIR || path.join(process.cwd(), "var", "uploads"),
);

import { randomInt } from "node:crypto";

const SUFFIX_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const SUFFIX_LENGTH = 6;
const MAX_BASE_LENGTH = 60;

/** Lowercase ASCII words from a title, joined by hyphens and cut at a word boundary where possible. */
export function slugBase(title: string): string {
  const ascii = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!ascii) return "recipe";
  if (ascii.length <= MAX_BASE_LENGTH) return ascii;
  const cut = ascii.slice(0, MAX_BASE_LENGTH);
  const lastHyphen = cut.lastIndexOf("-");
  const trimmed = lastHyphen > MAX_BASE_LENGTH / 2 ? cut.slice(0, lastHyphen) : cut;
  return trimmed.replace(/-+$/g, "");
}

/** A slug for a new recipe: the title's base plus a random suffix so titles need not be unique. */
export function createSlug(title: string): string {
  let suffix = "";
  for (let i = 0; i < SUFFIX_LENGTH; i++) {
    suffix += SUFFIX_ALPHABET[randomInt(SUFFIX_ALPHABET.length)];
  }
  return `${slugBase(title)}-${suffix}`;
}

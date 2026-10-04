// Server-only. Tiny JSON file store on top of Vercel Blob.

import { list, put } from "@vercel/blob";

/** Older stores use a read/write token; newer ones give the project a store id instead. */
export function storageConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

/** Returns the parsed file, or null if it hasn't been saved yet. Throws on errors. */
export async function readJson(path: string): Promise<unknown | null> {
  const { blobs } = await list({ prefix: path, limit: 5 });
  const hit = blobs.find((b) => b.pathname === path);
  if (!hit) return null;
  // The query string keeps a stale CDN copy from being served after an edit.
  const res = await fetch(`${hit.url}?t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Blob read failed (${res.status})`);
  return res.json();
}

export async function writeJson(path: string, data: unknown) {
  if (!storageConfigured()) throw new Error("STORAGE_NOT_SET_UP");
  await put(path, JSON.stringify(data), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
  });
}

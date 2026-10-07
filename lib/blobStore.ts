// Server-only. Tiny JSON file store on top of Vercel Blob.

import { del, get, list, put } from "@vercel/blob";

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

// ---- Private store (admin list) -------------------------------------------
// A second Blob store, set to Private, so its files can't be fetched by URL.
// Set PRIVATE_BLOB_STORE_ID to that store's id (the app signs in with Vercel's
// automatic login). If the store is connected another way, a static token can be
// supplied in PRIVATE_BLOB_READ_WRITE_TOKEN instead.

const privateStoreId = () => process.env.PRIVATE_BLOB_STORE_ID?.trim() || "";

export function privateStorageConfigured() {
  return Boolean(privateStoreId() || process.env.PRIVATE_BLOB_READ_WRITE_TOKEN?.trim());
}

function privateAuth() {
  const token = process.env.PRIVATE_BLOB_READ_WRITE_TOKEN?.trim();
  return token ? { token } : { storeId: privateStoreId() };
}

/** Parsed file from the private store, or null if it hasn't been saved. Throws on errors. */
export async function readPrivateJson(path: string): Promise<unknown | null> {
  const result = await get(path, { access: "private", useCache: false, ...privateAuth() });
  if (!result) return null;
  if (result.statusCode !== 200 || !result.stream) {
    throw new Error(`Private blob read failed (${result.statusCode})`);
  }
  return new Response(result.stream).json();
}

export async function writePrivateJson(path: string, data: unknown) {
  await put(path, JSON.stringify(data), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    ...privateAuth(),
  });
}

/** Removes a file from the public store (used after moving it to the private one). */
export async function deletePublicJson(path: string) {
  const { blobs } = await list({ prefix: path, limit: 5 });
  const urls = blobs.filter((b) => b.pathname === path).map((b) => b.url);
  if (urls.length > 0) await del(urls);
}

/** Settings files: the private store when it is set up, otherwise the public one. */
export async function readSecure(path: string): Promise<unknown | null> {
  return privateStorageConfigured() ? readPrivateJson(path) : readJson(path);
}

export async function writeSecure(path: string, data: unknown) {
  return privateStorageConfigured() ? writePrivateJson(path, data) : writeJson(path, data);
}

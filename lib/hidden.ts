// Server-only. People an admin has hidden from the dashboard (the Hide link on a person's
// row). Their progress in Planning Center is untouched; they're just left out of the
// dashboard and spreadsheet unless "Show hidden" is on.

import { privateStorageConfigured, readSecure, storageConfigured, writeSecure } from "./blobStore";

export type HiddenEntry = { id: string; name: string };

const PATH = "pathway/hidden.json";
const CACHE_MS = 30_000;
let cache: { at: number; list: HiddenEntry[] } | null = null;

function clean(data: unknown): HiddenEntry[] {
  if (!Array.isArray(data)) return [];
  const out: HiddenEntry[] = [];
  for (const row of data as Record<string, unknown>[]) {
    const id = String(row?.id ?? "");
    if (/^\d+$/.test(id) && !out.some((s) => s.id === id)) {
      out.push({ id, name: String(row?.name ?? "").slice(0, 100) });
    }
  }
  return out;
}

/**
 * The hidden list. Each server keeps its own short memory of it, so another server can
 * hold an older copy for up to 30 seconds. Anything that changes the list, and the
 * dashboard itself, asks for `fresh` so a click shows up right away. A fresh read that
 * fails throws, so a failed read can never be saved back as an empty list.
 */
export async function getHidden(opts: { fresh?: boolean } = {}): Promise<HiddenEntry[]> {
  if (!storageConfigured() && !privateStorageConfigured()) return [];
  if (!opts.fresh && cache && Date.now() - cache.at < CACHE_MS) return cache.list;
  try {
    const list = clean(await readSecure(PATH));
    cache = { at: Date.now(), list };
    return list;
  } catch (err) {
    console.error("Could not load the hidden list:", err);
    if (opts.fresh) throw err;
    return [];
  }
}

export async function saveHidden(list: HiddenEntry[]) {
  const next = clean(list);
  await writeSecure(PATH, next);
  cache = { at: Date.now(), list: next };
}

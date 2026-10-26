// Server-only. People marked as staff (Admin > Staff). Their progress is hidden from the
// dashboard and spreadsheet by default, like admins', with a toggle to include them.

import { privateStorageConfigured, readSecure, storageConfigured, writeSecure } from "./blobStore";

export type StaffEntry = { id: string; name: string };

const PATH = "pathway/staff.json";
const CACHE_MS = 30_000;
let cache: { at: number; list: StaffEntry[] } | null = null;

function clean(data: unknown): StaffEntry[] {
  if (!Array.isArray(data)) return [];
  const out: StaffEntry[] = [];
  for (const row of data as Record<string, unknown>[]) {
    const id = String(row?.id ?? "");
    if (/^\d+$/.test(id) && !out.some((s) => s.id === id)) {
      out.push({ id, name: String(row?.name ?? "").slice(0, 100) });
    }
  }
  return out;
}

export async function getStaff(): Promise<StaffEntry[]> {
  if (!storageConfigured() && !privateStorageConfigured()) return [];
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.list;
  try {
    const list = clean(await readSecure(PATH));
    cache = { at: Date.now(), list };
    return list;
  } catch (err) {
    console.error("Could not load the staff list:", err);
    return [];
  }
}

export async function saveStaff(list: StaffEntry[]) {
  const next = clean(list);
  await writeSecure(PATH, next);
  cache = { at: Date.now(), list: next };
}

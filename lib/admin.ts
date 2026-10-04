// Server-only. Who counts as an admin.
//
// Owners are listed by Planning Center person id in the ADMIN_PERSON_IDS
// environment variable (comma-separated). They can't be removed in the app, so
// there is always a way in. Owners and other admins can add more admins; those
// are saved in Vercel Blob.

import type { Session } from "./session";
import { readJson, storageConfigured, writeJson } from "./blobStore";

export type AdminEntry = { id: string; name: string };

const PATH = "pathway/admins.json";
const CACHE_MS = 30_000;
let cache: { at: number; list: AdminEntry[] } | null = null;

export function ownerIds(): string[] {
  return (process.env.ADMIN_PERSON_IDS ?? "")
    .split(",")
    .map((s) => s.trim().replace(/^AC/i, ""))
    .filter(Boolean);
}

function clean(data: unknown): AdminEntry[] {
  if (!Array.isArray(data)) return [];
  const out: AdminEntry[] = [];
  for (const row of data as Record<string, unknown>[]) {
    const id = String(row?.id ?? "");
    if (/^\d+$/.test(id) && !out.some((a) => a.id === id)) {
      out.push({ id, name: String(row?.name ?? "").slice(0, 100) });
    }
  }
  return out;
}

/** Admins added in the app (not the owners from ADMIN_PERSON_IDS). */
export async function getAddedAdmins(): Promise<AdminEntry[]> {
  if (!storageConfigured()) return [];
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.list;
  try {
    const list = clean(await readJson(PATH));
    cache = { at: Date.now(), list };
    return list;
  } catch (err) {
    console.error("Could not load admin list:", err);
    return [];
  }
}

export async function saveAddedAdmins(list: AdminEntry[]) {
  const next = clean(list);
  await writeJson(PATH, next);
  cache = { at: Date.now(), list: next };
}

export async function isAdmin(session: Session | null): Promise<boolean> {
  if (!session) return false;
  if (ownerIds().includes(session.personId)) return true;
  return (await getAddedAdmins()).some((a) => a.id === session.personId);
}

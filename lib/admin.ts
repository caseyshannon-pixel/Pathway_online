// Server-only. Who counts as an admin.
//
// Owners are listed by Planning Center person id in the ADMIN_PERSON_IDS
// environment variable (comma-separated). They can't be removed in the app, so
// there is always a way in. Owners and other admins can add more admins; those
// are saved in Vercel Blob.

import type { Session } from "./session";
import {
  deletePublicJson,
  privateStorageConfigured,
  readJson,
  readPrivateJson,
  storageConfigured,
  writeJson,
  writePrivateJson,
} from "./blobStore";

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

async function loadAdmins(): Promise<unknown | null> {
  if (!privateStorageConfigured()) return readJson(PATH);

  const saved = await readPrivateJson(PATH);
  if (saved !== null) return saved;

  // One-time move: copy the list from the old public file, then delete that file.
  let legacy: unknown | null = null;
  try {
    legacy = await readJson(PATH);
  } catch {
    /* no public store, or nothing there */
  }
  if (legacy !== null) {
    await writePrivateJson(PATH, legacy);
    try {
      await deletePublicJson(PATH);
    } catch (err) {
      console.error("Moved the admin list but could not delete the public copy:", err);
    }
  }
  return legacy;
}

/** Admins added in the app (not the owners from ADMIN_PERSON_IDS). */
export async function getAddedAdmins(): Promise<AdminEntry[]> {
  if (!storageConfigured() && !privateStorageConfigured()) return [];
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.list;
  try {
    const list = clean(await loadAdmins());
    cache = { at: Date.now(), list };
    return list;
  } catch (err) {
    console.error("Could not load admin list:", err);
    return [];
  }
}

export async function saveAddedAdmins(list: AdminEntry[]) {
  const next = clean(list);
  if (privateStorageConfigured()) {
    await writePrivateJson(PATH, next);
    try {
      await deletePublicJson(PATH); // make sure no public copy lingers
    } catch {
      /* nothing to delete, or no public store */
    }
  } else {
    await writeJson(PATH, next);
  }
  cache = { at: Date.now(), list: next };
}

export async function isAdmin(session: Session | null): Promise<boolean> {
  if (!session) return false;
  if (ownerIds().includes(session.personId)) return true;
  return (await getAddedAdmins()).some((a) => a.id === session.personId);
}

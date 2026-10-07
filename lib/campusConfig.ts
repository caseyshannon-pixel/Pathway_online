// Server-only. Which Planning Center workflow each campus uses.
// Saved as { [campusId]: workflowId }. Campuses not listed use the original
// workflow (PATHWAY_WORKFLOW_ID).

import { privateStorageConfigured, readSecure, storageConfigured, writeSecure } from "./blobStore";

const PATH = "pathway/campuses.json";
const CACHE_MS = 30_000;
let cache: { at: number; map: Record<string, string> } | null = null;

function clean(data: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (data && typeof data === "object" && !Array.isArray(data)) {
    for (const [campus, workflow] of Object.entries(data as Record<string, unknown>)) {
      if (/^\d+$/.test(campus) && /^\d+$/.test(String(workflow))) out[campus] = String(workflow);
    }
  }
  return out;
}

export async function getCampusMap(): Promise<Record<string, string>> {
  if (!storageConfigured() && !privateStorageConfigured()) return {};
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.map;
  try {
    const map = clean(await readSecure(PATH));
    cache = { at: Date.now(), map };
    return map;
  } catch (err) {
    console.error("Could not load campus workflow settings, using the original workflow:", err);
    return {};
  }
}

export async function saveCampusMap(map: Record<string, string>) {
  const next = clean(map);
  await writeSecure(PATH, next);
  cache = { at: Date.now(), map: next };
}

// ---- A person's own campus choice (for people with no primary campus in Planning Center)

const choicePath = (personId: string) => `pathway/campus-choice/${personId}.json`;

export async function getCampusChoice(personId: string): Promise<string | null> {
  if (!/^\d+$/.test(personId)) return null;
  if (!storageConfigured() && !privateStorageConfigured()) return null;
  try {
    const data = (await readSecure(choicePath(personId))) as { campusId?: unknown } | null;
    const id = String(data?.campusId ?? "");
    return /^\d+$/.test(id) ? id : null;
  } catch (err) {
    console.error("Could not read campus choice:", err);
    return null;
  }
}

export async function saveCampusChoice(personId: string, campusId: string) {
  if (!/^\d+$/.test(personId) || !/^\d+$/.test(campusId)) throw new Error("Invalid id");
  await writeSecure(choicePath(personId), { campusId });
}

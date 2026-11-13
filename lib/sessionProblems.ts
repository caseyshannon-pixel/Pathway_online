// Server-only. A short log of sessions that couldn't be marked finished, for the
// dashboard. Keeps the last 300 problems from the last 30 days. Best effort: it
// never blocks or breaks saving progress.

import { privateStorageConfigured, readSecure, storageConfigured, writeSecure } from "./blobStore";

export type SessionProblemReason = "not_watched" | "save_failed";

export type SessionProblem = {
  at: string;
  reason: SessionProblemReason;
  personId: string;
  name: string;
  session: number;
  /** Seconds of watch time counted, and needed (not_watched only). */
  watched: number;
  required: number;
};

const PATH = "pathway/session-problems.json";
const MAX = 300;
const KEEP_MS = 30 * 86_400_000;
const available = () => storageConfigured() || privateStorageConfigured();

function clean(data: unknown): SessionProblem[] {
  if (!Array.isArray(data)) return [];
  const cutoff = Date.now() - KEEP_MS;
  return (data as Record<string, unknown>[])
    .map((r) => ({
      at: String(r?.at ?? ""),
      reason: String(r?.reason ?? "") as SessionProblemReason,
      personId: String(r?.personId ?? ""),
      name: String(r?.name ?? "").slice(0, 100),
      session: Number(r?.session) || 0,
      watched: Number(r?.watched) || 0,
      required: Number(r?.required) || 0,
    }))
    .filter((r) => Date.parse(r.at) > cutoff && (r.reason === "not_watched" || r.reason === "save_failed"));
}

export async function getSessionProblems(): Promise<SessionProblem[]> {
  if (!available()) return [];
  try {
    return clean(await readSecure(PATH));
  } catch (err) {
    console.error("Could not read the session problems log:", err);
    return [];
  }
}

export async function recordSessionProblem(problem: Omit<SessionProblem, "at">) {
  if (!available()) return;
  try {
    const list = clean(await readSecure(PATH));
    list.push({ at: new Date().toISOString(), ...problem });
    await writeSecure(PATH, list.slice(-MAX));
  } catch (err) {
    console.error("Could not record a session problem:", err);
  }
}

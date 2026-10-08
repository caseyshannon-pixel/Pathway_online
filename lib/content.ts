// Server-only. Reads and writes the course content.
//
// Saved content is one JSON file in Vercel Blob. If nothing has been saved yet
// (or Blob isn't set up), the defaults in ./course are used.

import { readJson, writeJson } from "./blobStore";
import { DEFAULT_SESSIONS, type Session, type SessionForm, type SessionLink } from "./course";

const PATH = "pathway/course.json";
export const MAX_SESSIONS = 20;
export const MAX_FORMS = 5;

/** Accepts a bare 11-character id or any common YouTube link. Returns "" if neither. */
export function parseYoutubeId(input: string): string {
  const s = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s);
    const host = u.hostname.replace(/^www\./, "");
    let id = "";
    if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
    else if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
      id = u.searchParams.get("v") ?? u.pathname.split("/").filter(Boolean)[1] ?? "";
    }
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : "";
  } catch {
    return "";
  }
}

/** Only Church Center people forms, e.g. https://x.churchcenter.com/people/forms/123 */
export function parseFormUrl(input: string): string {
  const s = input.trim();
  if (!s) return "";
  try {
    const u = new URL(s);
    if (
      u.protocol === "https:" &&
      u.hostname.endsWith(".churchcenter.com") &&
      /^\/people\/forms\/\d+\/?$/.test(u.pathname)
    ) {
      return u.origin + u.pathname.replace(/\/$/, "");
    }
  } catch {
    /* fall through */
  }
  return "";
}

function str(v: unknown, max: number) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export type Validated = { ok: true; sessions: Session[] } | { ok: false; error: string };

/** Checks untrusted input and returns clean, renumbered sessions. */
export function validateSessions(input: unknown): Validated {
  if (!Array.isArray(input) || input.length < 1) {
    return { ok: false, error: "There must be at least one session." };
  }
  if (input.length > MAX_SESSIONS) {
    return { ok: false, error: `There can be at most ${MAX_SESSIONS} sessions.` };
  }
  const sessions: Session[] = [];
  for (let i = 0; i < input.length; i++) {
    const raw = (input[i] ?? {}) as Record<string, unknown>;
    const n = i + 1;
    const title = str(raw.title, 100);
    if (!title) return { ok: false, error: `Session ${n} needs a title.` };

    const videoText = str(raw.youtubeId, 300);
    const youtubeId = videoText ? parseYoutubeId(videoText) : "";
    if (videoText && !youtubeId) {
      return { ok: false, error: `Session ${n}: that doesn't look like a YouTube link or video ID.` };
    }

    // Forms: a list. Content saved before this was a list has a single formUrl/formTitle,
    // which is carried over as the first form.
    const rawForms: unknown[] = Array.isArray(raw.forms)
      ? raw.forms
      : str(raw.formUrl, 300)
        ? [{ title: raw.formTitle, url: raw.formUrl }]
        : [];
    const forms: SessionForm[] = [];
    for (const f of rawForms.slice(0, MAX_FORMS) as Record<string, unknown>[]) {
      const urlText = str(f?.url, 300);
      const title = str(f?.title, 100);
      if (!urlText && !title) continue; // ignore empty rows
      const url = parseFormUrl(urlText);
      if (!url) {
        return {
          ok: false,
          error: `Session ${n}: each form needs a Church Center form link, like https://yourchurch.churchcenter.com/people/forms/123.`,
        };
      }
      forms.push({ title, url });
    }

    // Thumbnails must be ones uploaded through the editor (they live in our Blob store).
    const thumbText = str(raw.thumbnailUrl, 500);
    let thumbnailUrl = "";
    if (thumbText) {
      try {
        const u = new URL(thumbText);
        if (u.protocol === "https:" && u.hostname.endsWith(".public.blob.vercel-storage.com")) {
          thumbnailUrl = u.toString();
        }
      } catch {
        /* invalid */
      }
      if (!thumbnailUrl) {
        return { ok: false, error: `Session ${n}: the thumbnail must be uploaded with the Upload button.` };
      }
    }

    const rawLength = Number(raw.lengthSeconds);
    const lengthSeconds =
      Number.isFinite(rawLength) && rawLength > 0 ? Math.min(Math.round(rawLength), 36_000) : 0;

    const links: SessionLink[] = [];
    const rawLinks = Array.isArray(raw.links) ? raw.links.slice(0, 10) : [];
    for (const l of rawLinks as Record<string, unknown>[]) {
      const url = str(l?.url, 500);
      const label = str(l?.label, 100);
      if (!url && !label) continue; // ignore empty rows
      let ok = false;
      try {
        ok = ["http:", "https:"].includes(new URL(url).protocol);
      } catch {
        /* invalid */
      }
      if (!ok) return { ok: false, error: `Session ${n}: "${label || url}" needs a full link starting with https://.` };
      links.push({ label: label || url, url });
    }

    sessions.push({
      number: n,
      title,
      youtubeId,
      description: str(raw.description, 2000),
      notes: str(raw.notes, 5000),
      links,
      forms,
      lengthSeconds,
      thumbnailUrl,
      afterText: str(raw.afterText, 500),
    });
  }
  return { ok: true, sessions };
}

export { storageConfigured } from "./blobStore";

/** Current course content: saved copy if there is one, otherwise the defaults. */
export async function getSessions(): Promise<Session[]> {
  try {
    const data = await readJson(PATH);
    if (data === null) return DEFAULT_SESSIONS;
    const checked = validateSessions(data);
    return checked.ok ? checked.sessions : DEFAULT_SESSIONS;
  } catch (err) {
    console.error("Could not load saved course content, using defaults:", err);
    return DEFAULT_SESSIONS;
  }
}

export async function saveSessions(sessions: Session[]) {
  await writeJson(PATH, sessions);
}

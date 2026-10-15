// Server-only. Reads and writes the course page's welcome section.

import { privateStorageConfigured, readSecure, storageConfigured, writeSecure } from "./blobStore";
import { DEFAULT_WELCOME, type WelcomeContent } from "./welcomeDefaults";

const PATH = "pathway/welcome.json";
const CACHE_MS = 30_000;
let cache: { at: number; value: WelcomeContent } | null = null;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export type ValidatedWelcome = { ok: true; content: WelcomeContent } | { ok: false; error: string };

export function validateWelcome(input: unknown): ValidatedWelcome {
  const raw = (input ?? {}) as Record<string, unknown>;
  const cleanPoints = (v: unknown) =>
    (Array.isArray(v) ? v : [])
      .map((p) => str(p, 600))
      .filter(Boolean)
      .slice(0, 6);
  return {
    ok: true,
    content: {
      thankYouTitle: str(raw.thankYouTitle, 60) || DEFAULT_WELCOME.thankYouTitle,
      thankYou: str(raw.thankYou, 2000),
      expectTitle: str(raw.expectTitle, 60) || DEFAULT_WELCOME.expectTitle,
      expectPoints: cleanPoints(raw.expectPoints),
      whatNowTitle: str(raw.whatNowTitle, 60) || DEFAULT_WELCOME.whatNowTitle,
      whatNow: str(raw.whatNow, 2000),
      whatNowPoints: cleanPoints(raw.whatNowPoints),
      hideAfterStart: raw.hideAfterStart === true,
    },
  };
}

export async function getWelcome(): Promise<WelcomeContent> {
  if (!storageConfigured() && !privateStorageConfigured()) return DEFAULT_WELCOME;
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  try {
    const data = await readSecure(PATH);
    const checked = data === null ? null : validateWelcome(data);
    const value = checked?.ok ? checked.content : DEFAULT_WELCOME;
    cache = { at: Date.now(), value };
    return value;
  } catch (err) {
    console.error("Could not load the welcome section, leaving it empty:", err);
    return DEFAULT_WELCOME;
  }
}

export async function saveWelcome(content: WelcomeContent) {
  await writeSecure(PATH, content);
  cache = { at: Date.now(), value: content };
}

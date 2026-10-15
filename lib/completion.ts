// Server-only. Reads and writes the congratulations screen.

import { privateStorageConfigured, readSecure, storageConfigured, writeSecure } from "./blobStore";
import { DEFAULT_COMPLETION, type CompletionAction, type CompletionContent } from "./completionDefaults";

const PATH = "pathway/completion.json";
const CACHE_MS = 30_000;
let cache: { at: number; value: CompletionContent } | null = null;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export type ValidatedCompletion = { ok: true; content: CompletionContent } | { ok: false; error: string };

export function validateCompletion(input: unknown): ValidatedCompletion {
  const raw = (input ?? {}) as Record<string, unknown>;

  const imageText = str(raw.imageUrl, 500);
  let imageUrl = "";
  if (imageText) {
    try {
      const u = new URL(imageText);
      if (u.protocol === "https:" && u.hostname.endsWith(".public.blob.vercel-storage.com")) {
        imageUrl = u.toString();
      }
    } catch {
      /* invalid */
    }
    if (!imageUrl) return { ok: false, error: "The picture must be uploaded with the Upload button." };
  }

  const actions: CompletionAction[] = [];
  for (const a of (Array.isArray(raw.actions) ? raw.actions : []).slice(0, 3) as Record<string, unknown>[]) {
    const label = str(a?.label, 40);
    const urlText = str(a?.url, 500);
    if (!label && !urlText) continue; // ignore empty rows
    let url = "";
    try {
      if (["http:", "https:"].includes(new URL(urlText).protocol)) url = urlText;
    } catch {
      /* invalid */
    }
    if (!label || !url) {
      return { ok: false, error: "Each button needs text and a full link starting with https://." };
    }
    actions.push({ label, url });
  }

  return {
    ok: true,
    content: {
      heading: str(raw.heading, 80) || DEFAULT_COMPLETION.heading,
      message: str(raw.message, 2000),
      imageUrl,
      actions,
    },
  };
}

export async function getCompletion(): Promise<CompletionContent> {
  if (!storageConfigured() && !privateStorageConfigured()) return DEFAULT_COMPLETION;
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  try {
    const data = await readSecure(PATH);
    const checked = data === null ? null : validateCompletion(data);
    const value = checked?.ok ? checked.content : DEFAULT_COMPLETION;
    cache = { at: Date.now(), value };
    return value;
  } catch (err) {
    console.error("Could not load the congratulations screen, using the default:", err);
    return DEFAULT_COMPLETION;
  }
}

export async function saveCompletion(content: CompletionContent) {
  await writeSecure(PATH, content);
  cache = { at: Date.now(), value: content };
}

// Server-only. Reads and writes the sign-in page text.

import { privateStorageConfigured, readSecure, storageConfigured, writeSecure } from "./blobStore";
import { DEFAULT_SIGNIN, type SignInContent } from "./signinDefaults";

const PATH = "pathway/signin.json";
const CACHE_MS = 30_000;
let cache: { at: number; value: SignInContent } | null = null;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export type ValidatedSignIn = { ok: true; content: SignInContent } | { ok: false; error: string };

export function validateSignIn(input: unknown): ValidatedSignIn {
  const raw = (input ?? {}) as Record<string, unknown>;
  const heading = str(raw.heading, 80);
  const buttonLabel = str(raw.buttonLabel, 40);
  if (!heading) return { ok: false, error: "The page needs a heading." };
  if (!buttonLabel) return { ok: false, error: "The sign-in button needs a label." };

  const bullets = (Array.isArray(raw.bullets) ? raw.bullets : [])
    .map((b) => str(b, 100))
    .filter(Boolean)
    .slice(0, 5);

  // A picture must be one uploaded through the editor (it lives in our Blob store).
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

  return {
    ok: true,
    content: {
      eyebrow: str(raw.eyebrow, 40),
      heading,
      intro: str(raw.intro, 600),
      bullets,
      buttonLabel,
      helpText: str(raw.helpText, 300),
      imageUrl,
    },
  };
}

export async function getSignIn(): Promise<SignInContent> {
  if (!storageConfigured() && !privateStorageConfigured()) return DEFAULT_SIGNIN;
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  try {
    const data = await readSecure(PATH);
    const checked = data === null ? null : validateSignIn(data);
    const value = checked?.ok ? checked.content : DEFAULT_SIGNIN;
    cache = { at: Date.now(), value };
    return value;
  } catch (err) {
    console.error("Could not load the sign-in page text, using the defaults:", err);
    return DEFAULT_SIGNIN;
  }
}

export async function saveSignIn(content: SignInContent) {
  await writeSecure(PATH, content);
  cache = { at: Date.now(), value: content };
}

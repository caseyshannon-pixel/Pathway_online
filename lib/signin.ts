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

  // Pictures must be ones uploaded through the editor (they live in our Blob store).
  const ownImage = (value: unknown): string => {
    const text = str(value, 500);
    if (!text) return "";
    try {
      const u = new URL(text);
      if (u.protocol === "https:" && u.hostname.endsWith(".public.blob.vercel-storage.com")) return u.toString();
    } catch {
      /* invalid */
    }
    return "invalid";
  };
  const imageUrl = ownImage(raw.imageUrl);
  const logoUrl = ownImage(raw.logoUrl);
  if (imageUrl === "invalid" || logoUrl === "invalid") {
    return { ok: false, error: "Pictures must be uploaded with the Upload button." };
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
      logoUrl,
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

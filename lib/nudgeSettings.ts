// The automatic "nudge" email for people who have gone quiet (Admin > Nudges).
// Safe by default: off, and it can only be turned on after a test email was sent.

import { privateStorageConfigured, readSecure, storageConfigured, writeSecure } from "./blobStore";

export type NudgeSettings = {
  enabled: boolean;
  subject: string;
  message: string;
  /** Hours without activity before the first nudge. */
  inactiveHours: number;
  /** Most nudges one person can get in a row. */
  maxNudges: number;
  /** Days between nudges to the same person. */
  spacingDays: number;
  /** Only send between these hours, Eastern time (24-hour clock, end exclusive). */
  sendFromHour: number;
  sendToHour: number;
  /** When an admin last sent themselves a test. Set by the server only. */
  testedAt: string;
};

export const DEFAULT_NUDGE: NudgeSettings = {
  enabled: false,
  subject: "Your next step in Pathway Online",
  message:
    "Hi {firstName},\n\nYou've started Pathway Online, and {sessionTitle} is ready whenever you are. Pick up where you left off here:\n{link}\n\nIf you get stuck or have a question, email info@rockc3.com.\n\nThe Rock",
  inactiveHours: 12,
  maxNudges: 3,
  spacingDays: 3,
  sendFromHour: 9,
  sendToHour: 20,
  testedAt: "",
};

const PATH = "pathway/nudge-settings.json";
const CACHE_MS = 30_000;
let cache: { at: number; value: NudgeSettings } | null = null;

const clamp = (v: unknown, lo: number, hi: number, fallback: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(Math.max(n, lo), hi) : fallback;
};
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export type ValidatedNudge = { ok: true; settings: NudgeSettings } | { ok: false; error: string };

/** Cleans untrusted input. `testedAt` always comes from what is already saved, never from the browser. */
export function validateNudge(input: unknown, current: NudgeSettings): ValidatedNudge {
  const raw = (input ?? {}) as Record<string, unknown>;
  const subject = str(raw.subject, 150);
  const message = str(raw.message, 3000);
  if (!subject) return { ok: false, error: "The email needs a subject." };
  if (!message) return { ok: false, error: "The email needs a message." };
  const from = clamp(raw.sendFromHour, 0, 23, DEFAULT_NUDGE.sendFromHour);
  const to = clamp(raw.sendToHour, 1, 24, DEFAULT_NUDGE.sendToHour);
  if (to <= from) return { ok: false, error: "The sending window must end after it starts." };
  const enabled = raw.enabled === true;
  if (enabled && !current.testedAt) {
    return { ok: false, error: "Send yourself a test email before turning nudges on." };
  }
  return {
    ok: true,
    settings: {
      enabled,
      subject,
      message,
      inactiveHours: clamp(raw.inactiveHours, 1, 168, DEFAULT_NUDGE.inactiveHours),
      maxNudges: clamp(raw.maxNudges, 1, 5, DEFAULT_NUDGE.maxNudges),
      spacingDays: clamp(raw.spacingDays, 1, 14, DEFAULT_NUDGE.spacingDays),
      sendFromHour: from,
      sendToHour: to,
      testedAt: current.testedAt,
    },
  };
}

export async function getNudgeSettings(): Promise<NudgeSettings> {
  if (!storageConfigured() && !privateStorageConfigured()) return DEFAULT_NUDGE;
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  try {
    const data = await readSecure(PATH);
    let value = DEFAULT_NUDGE;
    if (data !== null) {
      const saved = data as Partial<NudgeSettings>;
      const checked = validateNudge(saved, { ...DEFAULT_NUDGE, testedAt: String(saved.testedAt ?? "") });
      // A saved "enabled" without a test on record is treated as off.
      value = checked.ok ? checked.settings : { ...DEFAULT_NUDGE };
      if (!value.testedAt) value = { ...value, enabled: false };
    }
    cache = { at: Date.now(), value };
    return value;
  } catch (err) {
    console.error("Could not load nudge settings, leaving nudges off:", err);
    return DEFAULT_NUDGE;
  }
}

export async function saveNudgeSettings(settings: NudgeSettings) {
  await writeSecure(PATH, settings);
  cache = { at: Date.now(), value: settings };
}

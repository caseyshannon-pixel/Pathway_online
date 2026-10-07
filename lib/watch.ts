// Server-only. Tracks how long someone has really been playing a session video.
//
// The player sends a "beat" every few seconds while the video is playing. The
// server credits the time since the previous beat (never more than a few
// seconds' worth, and nothing across a long gap), and keeps the running total in
// a signed cookie so it can't be edited. Finishing a session requires enough
// credited time, so marking it done instantly no longer works.

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { key } from "./session";

const COOKIE = "pathway_watch";
const MAX_CREDIT_SECONDS = 20; // most time one beat can add
const MAX_GAP_MS = 45_000; // a longer gap means paused or closed: nothing credited
const REQUIRED_FRACTION = 0.85; // same bar the player uses
const MIN_REQUIRED_SECONDS = 60; // floor when the video's length isn't known

type Watch = { pid: string; s: number; w: number; t: number; d: number };

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);

async function read(personId: string, session: number): Promise<Watch | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    const w: Watch = {
      pid: String(payload.pid),
      s: Number(payload.s),
      w: Number(payload.w),
      t: Number(payload.t),
      d: Number(payload.d),
    };
    return w.pid === personId && w.s === session && [w.w, w.t, w.d].every(Number.isFinite) ? w : null;
  } catch {
    return null;
  }
}

async function write(w: Watch) {
  const token = await new SignJWT({ ...w })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("6h")
    .sign(key());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/progress",
    maxAge: 60 * 60 * 6,
  });
}

/**
 * Credits playing time. `rate` is the playback speed (credited up to 2x, so
 * people watching faster aren't blocked); `duration` is the length the player
 * reports, kept only as a fallback when the session has no length set.
 */
export async function recordBeat(personId: string, session: number, rate: number, duration: number) {
  const now = Date.now();
  const prev = await read(personId, session);
  let watched = prev?.w ?? 0;
  if (prev) {
    const gap = now - prev.t;
    if (gap > 0 && gap <= MAX_GAP_MS) {
      watched += Math.min(gap / 1000, MAX_CREDIT_SECONDS) * clamp(Number.isFinite(rate) ? rate : 1, 1, 2);
    }
  }
  const reported = Number.isFinite(duration) && duration >= 60 && duration <= 14_400 ? Math.round(duration) : 0;
  await write({ pid: personId, s: session, w: Math.round(watched), t: now, d: reported || prev?.d || 0 });
  return Math.round(watched);
}

/** Checks the credited time against what finishing needs. */
export async function hasWatchedEnough(personId: string, session: number, knownLengthSeconds: number) {
  const prev = await read(personId, session);
  const watched = prev?.w ?? 0;
  const length = knownLengthSeconds > 0 ? knownLengthSeconds : prev?.d ?? 0;
  const required = Math.max(MIN_REQUIRED_SECONDS, Math.round(length * REQUIRED_FRACTION) - 10);
  return { ok: watched >= required, watched, required };
}

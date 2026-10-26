// Server-only. One-time email codes for signing in without a Planning Center login.
//
// A "challenge" is saved with a random id (kept in a cookie). The code itself is never
// stored: only an HMAC of it, keyed with SESSION_SECRET. Each challenge allows a few
// wrong guesses and then locks.

import { createHmac, randomBytes, randomInt, timingSafeEqual } from "crypto";
import { readSecure, writeSecure } from "./blobStore";
import { findPeopleByEmail, type LoginPerson } from "./pcoWorkflow";
import { sendMail } from "./mail";

export const LOGIN_COOKIE = "pathway_login";
const TTL_MS = 10 * 60_000;
const MAX_TRIES = 5;

type Challenge = {
  hash: string;
  exp: number;
  tries: number;
  verified: boolean;
  used: boolean;
  people: LoginPerson[];
};

const pathFor = (id: string) => `pathway/login/${id}.json`;
const validId = (id: string) => /^[a-f0-9]{32}$/.test(id);

function hmac(id: string, code: string) {
  const secret = process.env.SESSION_SECRET ?? "";
  return createHmac("sha256", secret).update(`${id}:${code}`).digest("hex");
}

async function load(id: string): Promise<Challenge | null> {
  if (!validId(id)) return null;
  const data = (await readSecure(pathFor(id))) as Challenge | null;
  return data && typeof data.hash === "string" ? data : null;
}

export const normalizeEmail = (v: string) => v.trim().toLowerCase();
export const looksLikeEmail = (v: string) => v.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

/**
 * Starts a sign-in. Always returns a challenge id, whether or not the email is on file,
 * so the page can't be used to find out who is in Planning Center. The email is only
 * sent when someone matches.
 */
export async function startLogin(email: string): Promise<{ id: string; sent: boolean }> {
  const id = randomBytes(16).toString("hex");
  const people = await findPeopleByEmail(email);
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const challenge: Challenge = {
    hash: hmac(id, code),
    exp: Date.now() + TTL_MS,
    tries: 0,
    verified: false,
    used: false,
    people,
  };
  await writeSecure(pathFor(id), challenge);

  let sent = false;
  if (people.length > 0) {
    sent = await sendMail(
      email,
      "Your Pathway Online sign-in code",
      `Your Pathway Online sign-in code is ${code}\n\nIt works for 10 minutes. If you didn't ask for it, you can ignore this email.\n\nThe Rock`,
    );
  }
  return { id, sent };
}

export type CodeResult =
  | { ok: true; people: LoginPerson[] }
  | { ok: false; reason: "bad" | "expired" | "locked" };

export async function checkCode(id: string, code: string): Promise<CodeResult> {
  const c = await load(id);
  if (!c || c.used || c.exp < Date.now()) return { ok: false, reason: "expired" };
  if (c.tries >= MAX_TRIES) return { ok: false, reason: "locked" };

  c.tries += 1;
  const a = Buffer.from(hmac(id, code.trim()));
  const b = Buffer.from(c.hash);
  const match = a.length === b.length && timingSafeEqual(a, b) && c.people.length > 0;
  if (!match) {
    await writeSecure(pathFor(id), c);
    return { ok: false, reason: c.tries >= MAX_TRIES ? "locked" : "bad" };
  }
  c.verified = true;
  c.exp = Date.now() + TTL_MS;
  await writeSecure(pathFor(id), c);
  return { ok: true, people: c.people };
}

/** After a correct code: the people this email can sign in as (the list is only given once verified). */
export async function verifiedPeople(id: string): Promise<LoginPerson[] | null> {
  const c = await load(id);
  if (!c || !c.verified || c.used || c.exp < Date.now()) return null;
  return c.people;
}

/** Marks the challenge as spent so a code can't be used twice. */
export async function finishLogin(id: string) {
  const c = await load(id);
  if (!c) return;
  c.used = true;
  c.people = [];
  await writeSecure(pathFor(id), c);
}

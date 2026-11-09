// Server-only. One-time email codes (and sign-in links) for signing in without a
// Planning Center login.
//
// Pending sign-ins are saved per email address, not per browser tab, so someone can
// leave to check their email, come back in another tab or app, and still finish.
// The file name is an HMAC of the email, and the codes are never stored: only HMACs
// of them, keyed with SESSION_SECRET. Up to three recent codes stay valid, so asking
// twice doesn't break the first email.

import { createHmac, randomBytes, randomInt, timingSafeEqual } from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { readSecure, writeSecure } from "./blobStore";
import { findPeopleByEmail, type LoginPerson } from "./pcoWorkflow";
import { sendMail } from "./mail";
import { cookies } from "next/headers";
import { createSession, key as sessionKey } from "./session";
import { safeNext } from "./nextPath";

/** The email a code was last sent to, so the code screen still knows it after a reload. */
export const EMAIL_COOKIE = "pathway_login_email";
/** After a correct code for a shared email: the people to choose from (signed, short-lived). */
export const PICK_COOKIE = "pathway_pick";

const TTL_MS = 10 * 60_000;
const MAX_TRIES = 6;
const KEEP_CODES = 3;

type Code = { hash: string; link: string; exp: number };
type Pending = { codes: Code[]; tries: number; people: LoginPerson[] };

export type FailReason = "bad" | "expired" | "locked";
export type LoginResult = { ok: true; people: LoginPerson[] } | { ok: false; reason: FailReason };

const secret = () => process.env.SESSION_SECRET ?? "";
const hmac = (value: string) => createHmac("sha256", secret()).update(value).digest("hex");
const pathFor = (k: string) => `pathway/login-email/${k}.json`;

export const validKey = (k: string) => /^[a-f0-9]{32}$/.test(k);
export const validLinkToken = (t: string) => /^[a-f0-9]{48}$/.test(t);
export const normalizeEmail = (v: string) => v.trim().toLowerCase();
export const looksLikeEmail = (v: string) => v.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

/** A stable, non-reversible name for an email's pending sign-in. */
export const emailKey = (email: string) => hmac(`email:${normalizeEmail(email)}`).slice(0, 32);

const live = (p: Pending | null) => (p?.codes ?? []).filter((c) => c.exp > Date.now());

function same(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

async function load(k: string): Promise<Pending | null> {
  if (!validKey(k)) return null;
  const data = (await readSecure(pathFor(k))) as Pending | null;
  return data && Array.isArray(data.codes) ? data : null;
}

const save = (k: string, p: Pending) => writeSecure(pathFor(k), p);

/** Logs why a sign-in try failed, without the email, so support can trace reports. */
function logFail(where: "code" | "link", reason: FailReason, p: Pending | null) {
  const newest = p?.codes.reduce((m, c) => Math.max(m, c.exp), 0) ?? 0;
  console.warn(`Email sign-in failed (${where}): ${reason}`, {
    liveCodes: live(p).length,
    tries: p?.tries ?? 0,
    secondsSinceNewestCode: newest ? Math.round((Date.now() - (newest - TTL_MS)) / 1000) : null,
  });
}

/**
 * Starts a sign-in. Callers treat every address the same, so the page can't be used
 * to find out who is in Planning Center. The email is only sent when someone matches.
 */
export async function startLogin(email: string, origin: string): Promise<{ sent: boolean }> {
  const people = await findPeopleByEmail(email);
  if (people.length === 0) {
    console.info("Email sign-in: no People profile has that email; nothing sent.");
    return { sent: false };
  }

  const k = emailKey(email);
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const token = randomBytes(24).toString("hex");
  const previous = live(await load(k).catch(() => null)).slice(-(KEEP_CODES - 1));
  await save(k, {
    codes: [...previous, { hash: hmac(`${k}:code:${code}`), link: hmac(`${k}:link:${token}`), exp: Date.now() + TTL_MS }],
    tries: 0,
    people,
  });

  const link = `${origin}/signin/link?k=${k}&t=${token}`;
  const sent = await sendMail(
    email,
    "Your Pathway Online sign-in code",
    `Your Pathway Online sign-in code is ${code}\n\n` +
      `Or tap this link to sign in:\n${link}\n\n` +
      `Both work for 10 minutes. If you didn't ask for this, you can ignore this email.\n\nThe Rock`,
  );
  return { sent };
}

/** Checks a typed code against the email's pending sign-in. A match uses it up. */
export async function checkCode(email: string, code: string): Promise<LoginResult> {
  const k = emailKey(email);
  const p = await load(k);
  const codes = live(p);
  if (!p || codes.length === 0 || p.people.length === 0) return fail("code", "expired", p);
  if (p.tries >= MAX_TRIES) return fail("code", "locked", p);

  const hash = hmac(`${k}:code:${code.trim()}`);
  if (!codes.some((c) => same(c.hash, hash))) {
    p.tries += 1;
    await save(k, p);
    return fail("code", p.tries >= MAX_TRIES ? "locked" : "bad", p);
  }
  return finish(k, p);
}

/** Checks a sign-in link from the email. A match uses it up. */
export async function checkLink(k: string, token: string): Promise<LoginResult> {
  if (!validKey(k) || !validLinkToken(token)) return fail("link", "expired", null);
  const p = await load(k);
  const codes = live(p);
  if (!p || codes.length === 0 || p.people.length === 0) return fail("link", "expired", p);
  const hash = hmac(`${k}:link:${token}`);
  if (!codes.some((c) => same(c.link, hash))) return fail("link", "expired", p);
  return finish(k, p);
}

function fail(where: "code" | "link", reason: FailReason, p: Pending | null): LoginResult {
  logFail(where, reason, p);
  return { ok: false, reason };
}

async function finish(k: string, p: Pending): Promise<LoginResult> {
  await save(k, { codes: [], tries: 0, people: [] });
  return { ok: true, people: p.people };
}

// ---- Shared emails: "Who is signing in?" --------------------------------------
// The list travels in a signed cookie, so showing it never needs a second storage read.

const PICK_AUDIENCE = "pathway-pick";

export async function signPick(people: LoginPerson[]): Promise<string> {
  return new SignJWT({ people })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(PICK_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${TTL_MS / 1000}s`)
    .sign(sessionKey());
}

export async function readPick(token: string | undefined): Promise<LoginPerson[] | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionKey(), {
      algorithms: ["HS256"],
      audience: PICK_AUDIENCE,
    });
    const people = payload.people;
    if (!Array.isArray(people) || people.length === 0) return null;
    return people.map((p) => ({
      id: String(p.id),
      name: String(p.name),
      firstName: String(p.firstName),
      avatar: typeof p.avatar === "string" ? p.avatar : "",
    }));
  } catch {
    return null;
  }
}

const shortCookie = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge,
});

/** Remembers which email a code went to, for the code screen (20 minutes). */
export async function rememberEmail(email: string) {
  (await cookies()).set(EMAIL_COOKIE, email, shortCookie(1200));
}

/** Signs in as one person and returns where to go next. */
export async function signInAs(person: LoginPerson): Promise<string> {
  await createSession({
    personId: person.id,
    name: person.name,
    firstName: person.firstName,
    avatar: person.avatar,
    via: "email",
  });
  const jar = await cookies();
  jar.delete(EMAIL_COOKIE);
  jar.delete(PICK_COOKIE);
  const next = safeNext(jar.get("pathway_next")?.value) ?? "/course";
  jar.delete("pathway_next");
  return next;
}

/**
 * After a correct code or link: signs in right away for one person, or keeps the
 * list for a shared email and returns the "Who is signing in?" screen.
 */
export async function afterVerified(people: LoginPerson[]): Promise<string> {
  if (people.length === 1) return signInAs(people[0]);
  (await cookies()).set(PICK_COOKIE, await signPick(people), shortCookie(TTL_MS / 1000));
  return "/?step=who";
}

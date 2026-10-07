import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

const COOKIE = "pathway_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export type Session = {
  personId: string;
  name: string;
  firstName: string;
  avatar?: string; // PCO photo URL; missing on sessions created before this was added
};

export function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET is missing or too short.");
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(session: Session) {
  const token = await new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(key());

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (!/^\d+$/.test(String(payload.personId))) return null;
    return {
      personId: String(payload.personId),
      name: String(payload.name),
      firstName: String(payload.firstName),
      avatar: payload.avatar ? String(payload.avatar) : "",
    };
  } catch {
    return null;
  }
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

// Server-only request guards: same-origin check for state-changing requests
// and a small per-instance rate limiter.

import { NextRequest, NextResponse } from "next/server";
import { appOrigin } from "./pco";

/**
 * True unless the request came from another website. Browsers send Origin on
 * form posts and fetches; compare its host to the hosts this app is served on.
 * (Cookies are already SameSite=Lax, so this is a second layer.)
 */
export function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (origin) {
    let host: string;
    try {
      host = new URL(origin).host;
    } catch {
      return false;
    }
    const allowed = new Set(
      [
        req.headers.get("host"),
        req.headers.get("x-forwarded-host"),
        new URL(appOrigin(req.nextUrl.origin)).host,
      ].filter((h): h is string => Boolean(h)),
    );
    return allowed.has(host);
  }
  const site = req.headers.get("sec-fetch-site");
  return !site || site === "same-origin" || site === "none";
}

export function forbidden() {
  return NextResponse.json({ error: "Not allowed" }, { status: 403 });
}

const buckets = new Map<string, { count: number; resetAt: number }>();

/**
 * Allows `limit` calls per `windowMs` for a key. Best effort only: counts live in
 * one server instance's memory, so it blunts bursts but is not a hard global limit.
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  b.count += 1;
  return b.count <= limit;
}

export function tooMany() {
  return NextResponse.json(
    { error: "Too many requests. Please slow down and try again in a minute." },
    { status: 429, headers: { "Retry-After": "60" } },
  );
}

export function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { appOrigin } from "@/lib/pco";
import { LOGIN_COOKIE, looksLikeEmail, normalizeEmail, startLogin } from "@/lib/emailLogin";
import { safeNext } from "@/lib/nextPath";
import { clientIp, forbidden, rateLimit, sameOrigin } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return forbidden();
  const origin = appOrigin(req.nextUrl.origin);
  const back = (query: string) => NextResponse.redirect(new URL(`/?${query}`, origin), 303);

  const form = await req.formData();
  const email = normalizeEmail(String(form.get("email") ?? ""));
  const next = safeNext(String(form.get("next") ?? ""));
  const nextQuery = next ? `&next=${encodeURIComponent(next)}` : "";

  if (!looksLikeEmail(email)) return back(`error=email${nextQuery}`);
  if (!rateLimit(`email-send-ip:${clientIp(req)}`, 10, 10 * 60_000) || !rateLimit(`email-send:${email}`, 3, 10 * 60_000)) {
    return back(`error=slow${nextQuery}`);
  }

  try {
    const { id, sent } = await startLogin(email);
    if (!sent && process.env.NODE_ENV !== "production") console.warn("No sign-in email sent.");
    const jar = await cookies();
    jar.set(LOGIN_COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
      maxAge: 1200,
    });
    if (next) {
      jar.set("pathway_next", next, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
        maxAge: 1200,
      });
    }
  } catch (err) {
    console.error("Could not start email sign-in:", err);
    return back(`error=send${nextQuery}`);
  }
  return back(`step=code${nextQuery}`);
}

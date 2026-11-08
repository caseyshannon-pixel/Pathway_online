import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { appOrigin } from "@/lib/pco";
import { checkCode, finishLogin, LOGIN_COOKIE, PICK_COOKIE, PICK_MAX_AGE, signPick } from "@/lib/emailLogin";
import { createSession } from "@/lib/session";
import { safeNext } from "@/lib/nextPath";
import { clientIp, forbidden, rateLimit, sameOrigin } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return forbidden();
  const origin = appOrigin(req.nextUrl.origin);
  const go = (query: string) => NextResponse.redirect(new URL(`/?${query}`, origin), 303);

  const jar = await cookies();
  const id = jar.get(LOGIN_COOKIE)?.value ?? "";
  const code = String((await req.formData()).get("code") ?? "").replace(/\s/g, "");
  // No sign-in in progress in this browser (e.g. the code page was opened in another app).
  if (!id) return go("error=nologin");
  if (!/^\d{6}$/.test(code)) return go("step=code&error=code");
  if (!rateLimit(`email-verify-ip:${clientIp(req)}`, 30, 10 * 60_000)) return go("step=code&error=slow");

  try {
    const result = await checkCode(id, code);
    if (!result.ok) {
      if (result.reason === "expired") {
        jar.delete(LOGIN_COOKIE);
        return go("error=expired");
      }
      return go(`step=code&error=${result.reason}`);
    }

    if (result.people.length > 1) {
      // Shared email: carry the list to the "Who is signing in?" step in a signed cookie.
      jar.set(PICK_COOKIE, await signPick(result.people), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: PICK_MAX_AGE,
      });
      await finishLogin(id);
      jar.delete(LOGIN_COOKIE);
      return go("step=who");
    }

    const person = result.people[0];
    await createSession({
      personId: person.id,
      name: person.name,
      firstName: person.firstName,
      avatar: person.avatar,
      via: "email",
    });
    await finishLogin(id);
    jar.delete(LOGIN_COOKIE);
  } catch (err) {
    console.error("Email sign-in failed:", err);
    return go("step=code&error=send");
  }
  const next = safeNext(jar.get("pathway_next")?.value) ?? "/course";
  jar.delete("pathway_next");
  return NextResponse.redirect(new URL(next, origin), 303);
}

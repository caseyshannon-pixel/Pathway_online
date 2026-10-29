import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { appOrigin } from "@/lib/pco";
import { afterVerified, checkCode, EMAIL_COOKIE, looksLikeEmail, normalizeEmail, rememberEmail } from "@/lib/emailLogin";
import { clientIp, forbidden, rateLimit, sameOrigin } from "@/lib/security";

export const dynamic = "force-dynamic";

// Every failure goes back to the code screen with a message, never to the start.
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return forbidden();
  const origin = appOrigin(req.nextUrl.origin);
  const go = (path: string) => NextResponse.redirect(new URL(path, origin), 303);
  const retry = (error: string) => go(`/?step=code&error=${error}`);

  const form = await req.formData();
  const jar = await cookies();
  // The code form carries the email, so this works in a new tab or app too.
  const email = normalizeEmail(String(form.get("email") ?? "") || (jar.get(EMAIL_COOKIE)?.value ?? ""));
  const code = String(form.get("code") ?? "").replace(/\s/g, "");
  if (!looksLikeEmail(email)) return retry("needemail");
  await rememberEmail(email);
  if (!/^\d{6}$/.test(code)) return retry("code");
  if (!rateLimit(`email-verify-ip:${clientIp(req)}`, 30, 10 * 60_000)) return retry("slow");

  try {
    const result = await checkCode(email, code);
    if (!result.ok) return retry(result.reason);
    return go(await afterVerified(result.people));
  } catch (err) {
    console.error("Email sign-in failed:", err);
    return retry("signin");
  }
}

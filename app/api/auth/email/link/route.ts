import { NextRequest, NextResponse } from "next/server";
import { appOrigin } from "@/lib/pco";
import { afterVerified, checkLink } from "@/lib/emailLogin";
import { clientIp, forbidden, rateLimit, sameOrigin } from "@/lib/security";

export const dynamic = "force-dynamic";

// The sign-in link's Continue button posts here. (Opening the link only shows the
// button, so email scanners that open links can't use it up.)
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return forbidden();
  const origin = appOrigin(req.nextUrl.origin);
  const go = (path: string) => NextResponse.redirect(new URL(path, origin), 303);

  const form = await req.formData();
  const k = String(form.get("k") ?? "");
  const t = String(form.get("t") ?? "");
  if (!rateLimit(`email-link-ip:${clientIp(req)}`, 30, 10 * 60_000)) return go("/?step=email&error=slow");

  try {
    const result = await checkLink(k, t);
    if (!result.ok) return go("/?step=email&error=link");
    return go(await afterVerified(result.people));
  } catch (err) {
    console.error("Email sign-in link failed:", err);
    return go("/?step=email&error=link");
  }
}

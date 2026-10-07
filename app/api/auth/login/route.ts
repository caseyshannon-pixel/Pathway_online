import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { appOrigin, buildAuthorizeUrl } from "@/lib/pco";
import { clientIp, rateLimit, tooMany } from "@/lib/security";
import { safeNext } from "@/lib/nextPath";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!rateLimit(`login:${clientIp(req)}`, 30, 60_000)) return tooMany();
  const origin = appOrigin(req.nextUrl.origin);
  const state = randomBytes(16).toString("hex");

  const jar = await cookies();
  jar.set("pathway_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  const next = safeNext(req.nextUrl.searchParams.get("next"));
  if (next) {
    jar.set("pathway_next", next, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
  }

  return NextResponse.redirect(buildAuthorizeUrl(origin, state));
}

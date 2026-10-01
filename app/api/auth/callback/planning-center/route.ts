import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { appOrigin, exchangeCode, fetchMe } from "@/lib/pco";
import { createSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const origin = appOrigin(req.nextUrl.origin);
  const params = req.nextUrl.searchParams;
  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/?error=${reason}`, origin));

  if (params.get("error")) return fail("denied");

  const code = params.get("code");
  const state = params.get("state");
  const jar = await cookies();
  const expected = jar.get("pathway_oauth_state")?.value;
  jar.delete("pathway_oauth_state");

  if (!code || !state || !expected || state !== expected) return fail("state");

  try {
    const accessToken = await exchangeCode(origin, code);
    const me = await fetchMe(accessToken);
    await createSession(me);
  } catch (err) {
    console.error("Planning Center sign-in failed:", err);
    return fail("signin");
  }

  return NextResponse.redirect(new URL("/course", origin));
}

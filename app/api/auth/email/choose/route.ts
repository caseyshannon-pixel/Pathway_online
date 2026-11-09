import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { appOrigin } from "@/lib/pco";
import { PICK_COOKIE, readPick, signInAs } from "@/lib/emailLogin";
import { forbidden, sameOrigin } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return forbidden();
  const origin = appOrigin(req.nextUrl.origin);
  const go = (path: string) => NextResponse.redirect(new URL(path, origin), 303);
  const personId = String((await req.formData()).get("personId") ?? "");

  try {
    const people = await readPick((await cookies()).get(PICK_COOKIE)?.value);
    const person = people?.find((p) => p.id === personId);
    if (!person) {
      console.warn("Email sign-in failed (choose): the list expired or didn't include that person");
      return go("/?step=code&error=expired");
    }
    return go(await signInAs(person));
  } catch (err) {
    console.error("Email sign-in failed:", err);
    return go("/?step=code&error=signin");
  }
}

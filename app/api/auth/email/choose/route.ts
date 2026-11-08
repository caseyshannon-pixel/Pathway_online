import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { appOrigin } from "@/lib/pco";
import { PICK_COOKIE, readPick } from "@/lib/emailLogin";
import { createSession } from "@/lib/session";
import { safeNext } from "@/lib/nextPath";
import { forbidden, sameOrigin } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return forbidden();
  const origin = appOrigin(req.nextUrl.origin);
  const jar = await cookies();
  const personId = String((await req.formData()).get("personId") ?? "");

  try {
    const people = await readPick(jar.get(PICK_COOKIE)?.value);
    const person = people?.find((p) => p.id === personId);
    if (!person) return NextResponse.redirect(new URL("/?error=expired", origin), 303);
    await createSession({
      personId: person.id,
      name: person.name,
      firstName: person.firstName,
      avatar: person.avatar,
      via: "email",
    });
  } catch (err) {
    console.error("Email sign-in failed:", err);
    return NextResponse.redirect(new URL("/?error=signin", origin), 303);
  }
  jar.delete(PICK_COOKIE);
  const next = safeNext(jar.get("pathway_next")?.value) ?? "/course";
  jar.delete("pathway_next");
  return NextResponse.redirect(new URL(next, origin), 303);
}

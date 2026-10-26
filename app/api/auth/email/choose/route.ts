import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { appOrigin } from "@/lib/pco";
import { finishLogin, LOGIN_COOKIE, verifiedPeople } from "@/lib/emailLogin";
import { createSession } from "@/lib/session";
import { safeNext } from "@/lib/nextPath";
import { forbidden, sameOrigin } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return forbidden();
  const origin = appOrigin(req.nextUrl.origin);
  const jar = await cookies();
  const id = jar.get(LOGIN_COOKIE)?.value ?? "";
  const personId = String((await req.formData()).get("personId") ?? "");

  try {
    const people = await verifiedPeople(id);
    const person = people?.find((p) => p.id === personId);
    if (!person) return NextResponse.redirect(new URL("/?error=expired", origin), 303);
    await createSession({ ...person, via: "email" });
    await finishLogin(id);
  } catch (err) {
    console.error("Email sign-in failed:", err);
    return NextResponse.redirect(new URL("/?error=signin", origin), 303);
  }
  jar.delete(LOGIN_COOKIE);
  const next = safeNext(jar.get("pathway_next")?.value) ?? "/course";
  jar.delete("pathway_next");
  return NextResponse.redirect(new URL(next, origin), 303);
}

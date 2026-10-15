import { NextRequest, NextResponse } from "next/server";
import { appOrigin } from "@/lib/pco";
import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import { resetProgress } from "@/lib/pcoWorkflow";
import { forbidden, rateLimit, sameOrigin, tooMany } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return forbidden();
  const session = await getSession();
  if (!(await isAdmin(session))) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  if (!rateLimit(`admin-reset:${session!.personId}`, 20, 60_000)) return tooMany();

  const form = await req.formData();
  const personId = String(form.get("personId") ?? "");
  const q = String(form.get("q") ?? "");
  if (!/^\d+$/.test(personId)) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const back = new URL("/admin", appOrigin(req.nextUrl.origin));
  back.searchParams.set("q", q);
  try {
    const removed = await resetProgress(personId);
    console.log(`Admin ${session!.personId} restarted person ${personId} (${removed} card(s) removed).`);
    back.searchParams.set("reset", personId);
  } catch (err) {
    console.error("Restart failed:", err);
    back.searchParams.set("error", "1");
  }
  return NextResponse.redirect(back, 303);
}

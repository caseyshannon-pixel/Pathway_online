import { NextRequest, NextResponse } from "next/server";
import { appOrigin } from "@/lib/pco";
import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import { advanceOneStep } from "@/lib/pcoWorkflow";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!isAdmin(session)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const form = await req.formData();
  const personId = String(form.get("personId") ?? "");
  const q = String(form.get("q") ?? "");
  if (!/^\d+$/.test(personId)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const back = new URL("/admin", appOrigin(req.nextUrl.origin));
  back.searchParams.set("q", q);
  try {
    await advanceOneStep(personId);
    back.searchParams.set("done", personId);
  } catch (err) {
    console.error("Admin advance failed:", err);
    back.searchParams.set("error", "1");
  }
  return NextResponse.redirect(back, 303);
}

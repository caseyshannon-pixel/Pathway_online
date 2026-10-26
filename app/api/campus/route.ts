import { NextRequest, NextResponse } from "next/server";
import { appOrigin } from "@/lib/pco";
import { getSession } from "@/lib/session";
import { saveCampusChoice } from "@/lib/campusConfig";
import { listCampuses } from "@/lib/pcoWorkflow";
import { forbidden, rateLimit, sameOrigin, tooMany } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return forbidden();
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!rateLimit(`campus:${session.personId}`, 10, 60_000)) return tooMany();

  const form = await req.formData();
  const campusId = String(form.get("campusId") ?? "");
  const origin = appOrigin(req.nextUrl.origin);

  try {
    const campuses = await listCampuses();
    if (!campuses.some((c) => c.id === campusId)) {
      return NextResponse.json({ error: "Unknown campus" }, { status: 400 });
    }
    await saveCampusChoice(session.personId, campusId);
  } catch (err) {
    console.error("Could not save campus choice:", err);
    return NextResponse.redirect(new URL("/choose-campus?error=1", origin), 303);
  }
  return NextResponse.redirect(new URL("/course", origin), 303);
}

import { NextRequest, NextResponse } from "next/server";
import { appOrigin } from "@/lib/pco";
import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import { saveCampusMap } from "@/lib/campusConfig";
import { listCampuses, listWorkflows } from "@/lib/pcoWorkflow";
import { forbidden, rateLimit, sameOrigin, tooMany } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return forbidden();
  const session = await getSession();
  if (!(await isAdmin(session))) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  if (!rateLimit(`admin-campuses:${session!.personId}`, 20, 60_000)) return tooMany();

  const form = await req.formData();
  const back = new URL("/admin/campuses", appOrigin(req.nextUrl.origin));
  try {
    const [campuses, workflows] = await Promise.all([listCampuses(), listWorkflows()]);
    const validWorkflows = new Set(workflows.map((w) => w.id));
    const map: Record<string, string> = {};
    for (const c of campuses) {
      const chosen = String(form.get(`campus_${c.id}`) ?? "");
      if (chosen && validWorkflows.has(chosen)) map[c.id] = chosen;
    }
    await saveCampusMap(map);
    back.searchParams.set("saved", "1");
  } catch (err) {
    if (err instanceof Error && err.message === "STORAGE_NOT_SET_UP") {
      back.searchParams.set("error", "storage");
    } else {
      console.error("Could not save campus settings:", err);
      back.searchParams.set("error", "1");
    }
  }
  return NextResponse.redirect(back, 303);
}

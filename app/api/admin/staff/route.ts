import { NextRequest, NextResponse } from "next/server";
import { appOrigin } from "@/lib/pco";
import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import { getStaff, saveStaff } from "@/lib/staff";
import { getPersonName } from "@/lib/pcoWorkflow";
import { forbidden, rateLimit, sameOrigin, tooMany } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return forbidden();
  const session = await getSession();
  if (!(await isAdmin(session))) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  if (!rateLimit(`admin-staff:${session!.personId}`, 30, 60_000)) return tooMany();

  const form = await req.formData();
  const action = String(form.get("action") ?? "");
  const personId = String(form.get("personId") ?? "");
  const q = String(form.get("q") ?? "");
  if (!/^\d+$/.test(personId) || !["add", "remove"].includes(action)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const back = new URL("/admin/staff", appOrigin(req.nextUrl.origin));
  if (q) back.searchParams.set("q", q);
  try {
    const current = await getStaff();
    if (action === "add") {
      if (!current.some((s) => s.id === personId)) {
        const name = await getPersonName(personId);
        await saveStaff([...current, { id: personId, name }]);
      }
      back.searchParams.set("added", personId);
    } else {
      await saveStaff(current.filter((s) => s.id !== personId));
      back.searchParams.set("removed", personId);
    }
  } catch (err) {
    if (err instanceof Error && err.message === "STORAGE_NOT_SET_UP") {
      back.searchParams.set("error", "storage");
    } else {
      console.error("Staff list update failed:", err);
      back.searchParams.set("error", "1");
    }
  }
  return NextResponse.redirect(back, 303);
}

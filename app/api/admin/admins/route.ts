import { NextRequest, NextResponse } from "next/server";
import { appOrigin } from "@/lib/pco";
import { getSession } from "@/lib/session";
import { getAddedAdmins, isAdmin, ownerIds, saveAddedAdmins } from "@/lib/admin";
import { getPersonName } from "@/lib/pcoWorkflow";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!(await isAdmin(session))) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const form = await req.formData();
  const action = String(form.get("action") ?? "");
  const personId = String(form.get("personId") ?? "");
  const q = String(form.get("q") ?? "");
  if (!/^\d+$/.test(personId) || !["add", "remove"].includes(action)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const back = new URL("/admin/admins", appOrigin(req.nextUrl.origin));
  if (q) back.searchParams.set("q", q);
  try {
    const current = await getAddedAdmins();
    if (action === "add") {
      if (!ownerIds().includes(personId) && !current.some((a) => a.id === personId)) {
        const name = await getPersonName(personId);
        await saveAddedAdmins([...current, { id: personId, name }]);
      }
      back.searchParams.set("added", personId);
    } else {
      if (ownerIds().includes(personId)) {
        return NextResponse.json({ error: "Owners can only be changed in Vercel." }, { status: 400 });
      }
      await saveAddedAdmins(current.filter((a) => a.id !== personId));
      back.searchParams.set("removed", personId);
    }
  } catch (err) {
    if (err instanceof Error && err.message === "STORAGE_NOT_SET_UP") {
      back.searchParams.set("error", "storage");
    } else {
      console.error("Admin list update failed:", err);
      back.searchParams.set("error", "1");
    }
  }
  return NextResponse.redirect(back, 303);
}

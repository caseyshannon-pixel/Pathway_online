import { NextRequest, NextResponse } from "next/server";
import { appOrigin } from "@/lib/pco";
import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import { getHidden, saveHidden } from "@/lib/hidden";
import { getPersonName } from "@/lib/pcoWorkflow";
import { forbidden, rateLimit, sameOrigin, tooMany } from "@/lib/security";

export const dynamic = "force-dynamic";

// Only ever send people back to a dashboard address.
const DASHBOARD = /^\/admin\/dashboard(\?[A-Za-z0-9=&_.%-]*)?(#[a-z]+)?$/;

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return forbidden();
  const session = await getSession();
  if (!(await isAdmin(session))) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  if (!rateLimit(`admin-hidden:${session!.personId}`, 60, 60_000)) return tooMany();

  const form = await req.formData();
  const action = String(form.get("action") ?? "");
  const personId = String(form.get("personId") ?? "");
  const returnTo = String(form.get("returnTo") ?? "");
  if (!/^\d+$/.test(personId) || !["hide", "show"].includes(action)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const back = new URL(DASHBOARD.test(returnTo) ? returnTo : "/admin/dashboard", appOrigin(req.nextUrl.origin));

  let ok = true;
  try {
    const current = await getHidden({ fresh: true });
    if (action === "hide") {
      if (!current.some((h) => h.id === personId)) {
        const name = await getPersonName(personId).catch(() => "");
        await saveHidden([...current, { id: personId, name }]);
      }
    } else {
      await saveHidden(current.filter((h) => h.id !== personId));
    }
  } catch (err) {
    console.error("Hidden list update failed:", err);
    ok = false;
  }
  // Tell the dashboard what just changed, so it shows even if storage is a moment behind.
  if (ok) back.searchParams.set("just", `${action}:${personId}`);
  return NextResponse.redirect(back, 303);
}

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import { getSessions } from "@/lib/content";
import { getProgress, sendCardEmail } from "@/lib/pcoWorkflow";
import { getNudgeSettings, saveNudgeSettings, validateNudge } from "@/lib/nudgeSettings";
import { courseLink, renderNudge } from "@/lib/nudge";
import { forbidden, rateLimit, sameOrigin, tooMany } from "@/lib/security";

export const dynamic = "force-dynamic";

// Sends the nudge email to the admin who clicked, using the wording currently on screen.
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return forbidden();
  const session = await getSession();
  if (!(await isAdmin(session))) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  if (!rateLimit(`admin-nudge-test:${session!.personId}`, 5, 60_000)) return tooMany();

  let body: { settings?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const current = await getNudgeSettings();
  const checked = validateNudge({ ...(body.settings as object), enabled: false }, current);
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });

  try {
    const progress = await getProgress(session!.personId, { create: false });
    if (!progress.cardId) {
      return NextResponse.json(
        { error: "You need a Pathway card first. Open the course page once as yourself, then try again." },
        { status: 400 },
      );
    }
    const sessions = await getSessions();
    const next = sessions[progress.completed]?.title ?? "your next session";
    const vars = { firstName: session!.firstName || "there", sessionTitle: next, link: courseLink() };
    await sendCardEmail(
      session!.personId,
      progress.cardId,
      `[Test] ${renderNudge(checked.settings.subject, vars)}`,
      renderNudge(checked.settings.message, vars),
    );
    // A successful test is what allows nudges to be turned on.
    await saveNudgeSettings({ ...current, testedAt: new Date().toISOString() });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Nudge test failed:", err);
    return NextResponse.json({ error: "The test email couldn't be sent. Planning Center may not allow it for this account." }, { status: 502 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSessions } from "@/lib/content";
import { forbidden, rateLimit, sameOrigin, tooMany } from "@/lib/security";
import { hasWatchedEnough } from "@/lib/watch";
import { completeSession } from "@/lib/pcoWorkflow";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return forbidden();
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!rateLimit(`progress:${session.personId}`, 20, 60_000)) return tooMany();

  let number = 0;
  try {
    const body = (await req.json()) as { session?: unknown };
    number = Number(body.session);
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const sessions = await getSessions();
  if (!Number.isInteger(number) || number < 1 || number > sessions.length) {
    return NextResponse.json({ error: "Unknown session" }, { status: 400 });
  }

  // The browser's say-so isn't enough: the server must have counted enough playing time.
  const watch = await hasWatchedEnough(session.personId, number, sessions[number - 1].lengthSeconds);
  if (!watch.ok) return NextResponse.json({ error: "not_watched" }, { status: 400 });

  try {
    const progress = await completeSession(session.personId, number);
    return NextResponse.json({ completed: progress.completed });
  } catch (err) {
    console.error("Could not save progress:", err);
    return NextResponse.json({ error: "Could not save progress" }, { status: 500 });
  }
}

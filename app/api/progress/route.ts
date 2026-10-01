import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { SESSIONS } from "@/lib/course";
import { completeSession } from "@/lib/pcoWorkflow";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  let number = 0;
  try {
    const body = (await req.json()) as { session?: unknown };
    number = Number(body.session);
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (!Number.isInteger(number) || number < 1 || number > SESSIONS.length) {
    return NextResponse.json({ error: "Unknown session" }, { status: 400 });
  }

  try {
    const progress = await completeSession(session.personId, number);
    return NextResponse.json({ completed: progress.completed });
  } catch (err) {
    console.error("Could not save progress:", err);
    return NextResponse.json({ error: "Could not save progress" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSessions } from "@/lib/content";
import { forbidden, rateLimit, sameOrigin, tooMany } from "@/lib/security";
import { recordBeat } from "@/lib/watch";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return forbidden();
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!rateLimit(`beat:${session.personId}`, 30, 60_000)) return tooMany();

  let body: { session?: unknown; rate?: unknown; duration?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const number = Number(body.session);
  if (!Number.isInteger(number) || number < 1 || number > (await getSessions()).length) {
    return NextResponse.json({ error: "Unknown session" }, { status: 400 });
  }

  const watched = await recordBeat(session.personId, number, Number(body.rate), Number(body.duration));
  return NextResponse.json({ watched });
}

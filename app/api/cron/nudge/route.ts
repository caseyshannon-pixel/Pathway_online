import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { runNudges } from "@/lib/nudge";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Called by Vercel's scheduler (see vercel.json). Vercel sends "Authorization: Bearer <CRON_SECRET>".
// Without CRON_SECRET set, this endpoint refuses to run, so it can't be triggered by the public.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  }

  try {
    return NextResponse.json(await runNudges());
  } catch (err) {
    console.error("Nudge run failed:", err);
    return NextResponse.json({ error: "Run failed" }, { status: 500 });
  }
}

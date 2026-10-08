import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import { saveSignIn, validateSignIn } from "@/lib/signin";
import { forbidden, rateLimit, sameOrigin, tooMany } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest) {
  if (!sameOrigin(req)) return forbidden();
  const session = await getSession();
  if (!(await isAdmin(session))) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  if (!rateLimit(`admin-signin:${session!.personId}`, 30, 60_000)) return tooMany();

  let body: { content?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const checked = validateSignIn(body.content);
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });

  try {
    await saveSignIn(checked.content);
  } catch (err) {
    if (err instanceof Error && err.message === "STORAGE_NOT_SET_UP") {
      return NextResponse.json(
        { error: "Saving isn't set up yet. Connect a Blob store to this project in Vercel first." },
        { status: 503 },
      );
    }
    console.error("Could not save the sign-in page:", err);
    return NextResponse.json({ error: "Could not save. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ content: checked.content });
}

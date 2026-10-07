import { NextRequest, NextResponse } from "next/server";
import { appOrigin } from "@/lib/pco";
import { destroySession } from "@/lib/session";
import { forbidden, sameOrigin } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return forbidden();
  await destroySession();
  return NextResponse.redirect(new URL("/", appOrigin(req.nextUrl.origin)), 303);
}

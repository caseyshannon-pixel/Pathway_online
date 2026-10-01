import { NextRequest, NextResponse } from "next/server";
import { appOrigin } from "@/lib/pco";
import { destroySession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  await destroySession();
  return NextResponse.redirect(new URL("/", appOrigin(req.nextUrl.origin)), 303);
}

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import { searchLinks, type ProductKey } from "@/lib/pcoLinks";
import { rateLimit, tooMany } from "@/lib/security";

export const dynamic = "force-dynamic";

const PRODUCTS = ["all", "people", "registrations", "groups", "publishing", "general"];

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!(await isAdmin(session))) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  if (!rateLimit(`admin-links:${session!.personId}`, 90, 60_000)) return tooMany();

  const product = req.nextUrl.searchParams.get("product") ?? "all";
  if (!PRODUCTS.includes(product)) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const q = (req.nextUrl.searchParams.get("q") ?? "").slice(0, 100);

  try {
    return NextResponse.json(await searchLinks(product as ProductKey | "all", q));
  } catch (err) {
    console.error("Link search failed:", err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}

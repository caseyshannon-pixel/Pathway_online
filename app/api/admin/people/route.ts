import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import { getProgressMany, searchPeople } from "@/lib/pcoWorkflow";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!(await isAdmin(session))) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
  const withProgress = req.nextUrl.searchParams.get("mode") === "advance";
  if (q.length < 2) return NextResponse.json({ people: [] });

  try {
    const people = await searchPeople(q);
    const progress = withProgress ? await getProgressMany(people.map((p) => p.id)) : null;
    return NextResponse.json({
      people: people.map((p) => ({ ...p, ...(progress?.get(p.id) ?? {}) })),
    });
  } catch (err) {
    console.error("Admin people search failed:", err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}

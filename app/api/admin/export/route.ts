import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import { rateLimit, tooMany } from "@/lib/security";
import { getWorkflowSnapshot } from "@/lib/pcoWorkflow";

export const dynamic = "force-dynamic";

// Stops spreadsheet apps from running a cell that starts with = + - @ as a formula.
function cell(value: string) {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const day = (iso: string) => (iso ? iso.slice(0, 10) : "");

export async function GET() {
  const session = await getSession();
  if (!(await isAdmin(session))) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  if (!rateLimit(`admin-export:${session!.personId}`, 6, 60_000)) return tooMany();

  try {
    const { total, cards, workflows } = await getWorkflowSnapshot();
    const campusOf = new Map(workflows.map((w) => [w.id, w.label]));
    const rows = [["Name", "Person ID", "Campus workflow", "Sessions finished", "Status", "Joined", "Last moved"]];
    for (const c of cards) {
      rows.push([
        c.name,
        c.personId,
        campusOf.get(c.workflowId) ?? "",
        `${c.completed} of ${total}`,
        c.completed >= total ? "Completed" : "In progress",
        day(c.createdAt),
        day(c.movedAt),
      ]);
    }
    const csv = rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="pathway-progress-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Export failed:", err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}

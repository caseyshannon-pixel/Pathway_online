import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import { getProgress, searchPeople, type PersonResult } from "@/lib/pcoWorkflow";
import TopBar from "@/components/TopBar";

export const dynamic = "force-dynamic";

type Row = PersonResult & { completed: number; total: number };

export default async function Admin({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; done?: string; error?: string }>;
}) {
  const session = await getSession();
  if (!isAdmin(session)) notFound();

  const { q = "", done, error } = await searchParams;
  const query = q.trim();

  let rows: Row[] = [];
  let failed = false;
  if (query) {
    try {
      const people = await searchPeople(query);
      rows = await Promise.all(
        people.map(async (p) => {
          const pr = await getProgress(p.id, { create: false });
          return { ...p, completed: pr.completed, total: pr.total };
        }),
      );
    } catch (err) {
      console.error("Admin search failed:", err);
      failed = true;
    }
  }

  return (
    <>
      <TopBar />
      <main className="page">
        <div className="card">
          <h1>Admin</h1>
          <p className="muted">Find a person and move them to their next session.</p>

          {(error || failed) && (
            <p className="notice" role="alert">Something went wrong. Please try again.</p>
          )}

          <form className="admin-search" action="/admin" method="get">
            <input name="q" defaultValue={query} placeholder="Search by name" aria-label="Search by name" />
            <button className="btn" type="submit">Search</button>
          </form>

          {query && !failed && rows.length === 0 && <p className="muted">No one found.</p>}

          <ul className="chapters">
            {rows.map((r) => {
              const finished = r.completed >= r.total;
              return (
                <li key={r.id} className="chapter">
                  <span className="chapter-title">
                    {r.name}
                    {done === r.id && <span className="status-done"> · Moved forward</span>}
                  </span>
                  <span className="status">
                    {finished ? "Completed" : `${r.completed} of ${r.total} done`}
                  </span>
                  {!finished && (
                    <form action="/api/admin/advance" method="post">
                      <input type="hidden" name="personId" value={r.id} />
                      <input type="hidden" name="q" value={query} />
                      <button className="btn" type="submit">
                        Finish session {r.completed + 1}
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </main>
    </>
  );
}

import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import { getStaff } from "@/lib/staff";
import { privateStorageConfigured, storageConfigured } from "@/lib/blobStore";
import TopBar from "@/components/TopBar";
import PersonSearch from "@/components/PersonSearch";

export const dynamic = "force-dynamic";

export default async function AdminStaff({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; added?: string; removed?: string; error?: string }>;
}) {
  const session = await getSession();
  if (!(await isAdmin(session))) notFound();

  const { q = "", added, removed, error } = await searchParams;
  const staff = await getStaff();

  return (
    <>
      <TopBar />
      <main className="page">
        <p><a className="back" href="/admin">&larr; Admin</a></p>
        <div className="card">
          <h1>Staff</h1>
          <p className="muted">
            People marked as staff are left out of the dashboard and the spreadsheet unless you click{" "}
            <strong>Show staff</strong> there. It's just a label for your own reports. It doesn't change what
            they can see or do on the site.
          </p>

          {!storageConfigured() && !privateStorageConfigured() && (
            <p className="notice" role="alert">
              Saving isn't set up yet. Connect a Blob store to this project in Vercel first.
            </p>
          )}
          {error && (
            <p className="notice" role="alert">
              {error === "storage" ? "Saving isn't set up yet." : "Something went wrong. Please try again."}
            </p>
          )}
          {added && <p className="saved">Marked as staff.</p>}
          {removed && <p className="saved">Removed from staff.</p>}

          <h2>Current staff ({staff.length})</h2>
          {staff.length === 0 ? (
            <p className="muted">No one yet.</p>
          ) : (
            <ul className="chapters">
              {staff.map((s) => (
                <li key={s.id} className="chapter">
                  <span className="chapter-title">{s.name || `Person ${s.id}`}</span>
                  <form action="/api/admin/staff" method="post">
                    <input type="hidden" name="action" value="remove" />
                    <input type="hidden" name="personId" value={s.id} />
                    <button className="link-btn danger" type="submit">Remove</button>
                  </form>
                </li>
              ))}
            </ul>
          )}

          <h2>Mark someone as staff</h2>
          <PersonSearch mode="staff" initialQuery={q.trim()} staffIds={staff.map((s) => s.id)} highlightId={added} />
        </div>
      </main>
    </>
  );
}

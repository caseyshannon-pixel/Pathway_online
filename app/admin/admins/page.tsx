import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { getAddedAdmins, isAdmin, ownerIds } from "@/lib/admin";
import { storageConfigured } from "@/lib/blobStore";
import { searchPeople, type PersonResult } from "@/lib/pcoWorkflow";
import TopBar from "@/components/TopBar";
import PersonAvatar from "@/components/PersonAvatar";

export const dynamic = "force-dynamic";

export default async function AdminAdmins({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; added?: string; removed?: string; error?: string }>;
}) {
  const session = await getSession();
  if (!(await isAdmin(session))) notFound();

  const { q = "", added, removed, error } = await searchParams;
  const query = q.trim();
  const owners = ownerIds();
  const added_ = await getAddedAdmins();
  const adminIds = new Set([...owners, ...added_.map((a) => a.id)]);

  let results: PersonResult[] = [];
  let searchFailed = false;
  if (query) {
    try {
      results = await searchPeople(query);
    } catch (err) {
      console.error("Admin search failed:", err);
      searchFailed = true;
    }
  }

  return (
    <>
      <TopBar />
      <main className="page">
        <p><a className="back" href="/admin">&larr; Admin</a></p>
        <div className="card">
          <h1>Admins</h1>
          <p className="muted">
            Admins can move people between sessions, edit session content, and add or remove other
            admins.
          </p>

          {!storageConfigured() && (
            <p className="notice" role="alert">
              Saving isn't set up yet, so admins can't be added or removed. Connect a Blob store to
              this project in Vercel first.
            </p>
          )}
          {(error || searchFailed) && (
            <p className="notice" role="alert">
              {error === "storage"
                ? "Saving isn't set up yet. Connect a Blob store to this project in Vercel first."
                : "Something went wrong. Please try again."}
            </p>
          )}
          {added && <p className="saved">Admin added.</p>}
          {removed && <p className="saved">Admin removed.</p>}

          <h2>Current admins</h2>
          <ul className="chapters">
            {owners.map((id) => (
              <li key={`o${id}`} className="chapter">
                <span className="chapter-title">
                  {id === session?.personId ? `${session.name} (you)` : `Person ${id}`}
                </span>
                <span className="status">Owner · set in Vercel</span>
              </li>
            ))}
            {added_.map((a) => (
              <li key={a.id} className="chapter">
                <span className="chapter-title">
                  {a.name || `Person ${a.id}`}
                  {a.id === session?.personId && " (you)"}
                </span>
                <form action="/api/admin/admins" method="post">
                  <input type="hidden" name="action" value="remove" />
                  <input type="hidden" name="personId" value={a.id} />
                  <input type="hidden" name="q" value={query} />
                  <button className="link-btn danger" type="submit">Remove</button>
                </form>
              </li>
            ))}
          </ul>

          <h2>Add an admin</h2>
          <form className="admin-search" action="/admin/admins" method="get">
            <input name="q" defaultValue={query} placeholder="Search by name" aria-label="Search by name" />
            <button className="btn" type="submit">Search</button>
          </form>

          {query && !searchFailed && results.length === 0 && <p className="muted">No one found.</p>}

          <ul className="chapters">
            {results.map((p) => (
              <li key={p.id} className="chapter">
                <PersonAvatar name={p.name} src={p.avatar} />
                <span className="chapter-title">{p.name}</span>
                {adminIds.has(p.id) ? (
                  <span className="status status-done">Already an admin</span>
                ) : (
                  <form action="/api/admin/admins" method="post">
                    <input type="hidden" name="action" value="add" />
                    <input type="hidden" name="personId" value={p.id} />
                    <input type="hidden" name="q" value={query} />
                    <button className="btn" type="submit">Make admin</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </div>
      </main>
    </>
  );
}

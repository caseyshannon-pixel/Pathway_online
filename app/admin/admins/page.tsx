import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { getAddedAdmins, isAdmin, ownerIds } from "@/lib/admin";
import { privateStorageConfigured, storageConfigured } from "@/lib/blobStore";
import TopBar from "@/components/TopBar";
import PersonSearch from "@/components/PersonSearch";

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

          {!storageConfigured() && !privateStorageConfigured() && (
            <p className="notice" role="alert">
              Saving isn't set up yet, so admins can't be added or removed. Connect a Blob store to
              this project in Vercel first.
            </p>
          )}
          {error && (
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
          <PersonSearch
            mode="admin"
            initialQuery={query}
            adminIds={[...adminIds]}
            highlightId={added}
          />
        </div>
      </main>
    </>
  );
}

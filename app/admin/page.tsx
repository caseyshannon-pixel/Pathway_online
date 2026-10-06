import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import TopBar from "@/components/TopBar";
import PersonSearch from "@/components/PersonSearch";

export const dynamic = "force-dynamic";

export default async function Admin({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; done?: string; error?: string }>;
}) {
  const session = await getSession();
  if (!(await isAdmin(session))) notFound();

  const { q = "", done, error } = await searchParams;
  const query = q.trim();

  return (
    <>
      <TopBar />
      <main className="page">
        <div className="card">
          <h1>Admin</h1>
          <div className="admin-nav">
            <a className="btn btn-dark" href="/admin/dashboard">Dashboard</a>
            <a className="btn btn-dark" href="/admin/content">Edit session content</a>
            <a className="btn btn-dark" href="/admin/admins">Manage admins</a>
          </div>
          <h2>Move someone forward</h2>
          <p className="muted">Find a person and move them to their next session.</p>

          {error && <p className="notice" role="alert">Something went wrong. Please try again.</p>}

          <PersonSearch mode="advance" initialQuery={query} highlightId={done} />
        </div>
      </main>
    </>
  );
}

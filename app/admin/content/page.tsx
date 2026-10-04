import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import { getSessions, storageConfigured } from "@/lib/content";
import TopBar from "@/components/TopBar";
import ContentEditor from "@/components/ContentEditor";

export const dynamic = "force-dynamic";

export default async function AdminContent() {
  const session = await getSession();
  if (!isAdmin(session)) notFound();

  const sessions = await getSessions();

  return (
    <>
      <TopBar />
      <main className="page">
        <p><a className="back" href="/admin">&larr; Admin</a></p>
        <div className="card">
          <h1>Session content</h1>
          <p className="muted">
            Edit what people see on each session page. Changes show up within a minute of saving.
          </p>
          {!storageConfigured() && (
            <p className="notice" role="alert">
              Saving isn't set up yet, so you can look around but not save. Connect a Blob store to
              this project in Vercel (Storage tab), then redeploy.
            </p>
          )}
          <ContentEditor initial={sessions} />
        </div>
      </main>
    </>
  );
}

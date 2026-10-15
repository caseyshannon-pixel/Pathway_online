import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import { getWelcome } from "@/lib/welcome";
import { privateStorageConfigured, storageConfigured } from "@/lib/blobStore";
import TopBar from "@/components/TopBar";
import WelcomeEditor from "@/components/WelcomeEditor";

export const dynamic = "force-dynamic";

export default async function AdminWelcome() {
  const session = await getSession();
  if (!(await isAdmin(session))) notFound();
  const content = await getWelcome();

  return (
    <>
      <TopBar />
      <main className="page page-wide">
        <p><a className="back" href="/admin">&larr; Admin</a></p>
        <div className="card">
          <h1>Welcome section</h1>
          <p className="muted">
            A thank-you message and a "what to expect" list, shown on the course page right under
            "Welcome, [name]". Nothing shows until you fill something in.
          </p>
          {!storageConfigured() && !privateStorageConfigured() && (
            <p className="notice" role="alert">
              Saving isn't set up yet, so you can look around but not save. Connect a Blob store to
              this project in Vercel first.
            </p>
          )}
          <WelcomeEditor initial={content} firstName={session?.firstName ?? "Friend"} />
        </div>
      </main>
    </>
  );
}

import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import { getNudgeSettings } from "@/lib/nudgeSettings";
import { getLastRun } from "@/lib/nudge";
import { privateStorageConfigured, storageConfigured } from "@/lib/blobStore";
import TopBar from "@/components/TopBar";
import NudgesEditor from "@/components/NudgesEditor";

export const dynamic = "force-dynamic";

export default async function AdminNudges() {
  const session = await getSession();
  if (!(await isAdmin(session))) notFound();
  const [settings, lastRun] = await Promise.all([getNudgeSettings(), getLastRun()]);

  return (
    <>
      <TopBar />
      <main className="page">
        <p><a className="back" href="/admin">&larr; Admin</a></p>
        <div className="card">
          <h1>Nudges</h1>
          <p className="muted">
            An automatic email to people who haven't moved forward in a while. It goes through Planning Center,
            is checked every hour, and only sends during the hours you choose. Admins are never nudged.
          </p>
          {!storageConfigured() && !privateStorageConfigured() && (
            <p className="notice" role="alert">
              Saving isn't set up yet, so you can look around but not save. Connect a Blob store to this project
              in Vercel first.
            </p>
          )}
          <NudgesEditor initial={settings} lastRun={lastRun} />
        </div>
      </main>
    </>
  );
}

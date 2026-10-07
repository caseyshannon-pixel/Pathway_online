import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import { getSessions } from "@/lib/content";
import TopBar from "@/components/TopBar";
import SessionCard from "@/components/SessionCard";

export const dynamic = "force-dynamic";

export default async function PreviewSession({
  params,
}: {
  params: Promise<{ session: string }>;
}) {
  const user = await getSession();
  if (!(await isAdmin(user))) notFound();

  const { session: raw } = await params;
  const number = Number(raw);
  const sessions = await getSessions();
  const session = sessions.find((s) => s.number === number);
  if (!session) notFound();

  return (
    <>
      <TopBar />
      <div className="preview-banner" role="note">
        <strong>Preview</strong>
        <span>
          This is what people see. Nothing here is saved, and your own progress isn't touched.
        </span>
        <nav aria-label="Preview another session" className="preview-chips">
          {sessions.map((s) => (
            <a
              key={s.number}
              href={`/admin/preview/${s.number}`}
              className={s.number === number ? "is-current" : undefined}
              aria-current={s.number === number ? "page" : undefined}
            >
              {s.number}
            </a>
          ))}
        </nav>
        <a href="/admin/content">Back to editor</a>
      </div>
      <main className="page">
        <SessionCard
          session={session}
          isLast={number === sessions.length}
          alreadyCompleted={false}
          basePath="/admin/preview"
          preview
        />
      </main>
    </>
  );
}

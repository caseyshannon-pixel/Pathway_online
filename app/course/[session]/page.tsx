import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import { getSessions } from "@/lib/content";
import { getProgress, type Progress } from "@/lib/pcoWorkflow";
import { helpHref } from "@/lib/help";
import HelpLink from "@/components/HelpLink";
import TopBar from "@/components/TopBar";
import SessionCard from "@/components/SessionCard";

export const dynamic = "force-dynamic";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ session: string }>;
}) {
  const { session: raw } = await params;
  const number = Number(raw);

  const user = await getSession();
  if (!user) redirect(`/?next=${encodeURIComponent(`/course/${Number.isInteger(number) ? number : ""}`)}`);
  const sessions = await getSessions();
  const session = sessions.find((s) => s.number === number);
  if (!session) notFound();

  let progress: Progress;
  try {
    progress = await getProgress(user.personId);
  } catch (err) {
    console.error("Could not load progress:", err);
    return (
      <>
        <TopBar />
        <main className="page">
          <div className="card">
            <p className="notice" role="alert">
              We couldn't load your progress right now. Please try again in a moment.
            </p>
            <div className="error-actions">
              <a className="btn" href={`/course/${number}`}>Try Again</a>
              <a className="btn btn-secondary" href="/course">Back to sessions</a>
            </div>
            <HelpLink href={helpHref({ name: user.name, path: `/course/${number}` })} />
          </div>
        </main>
      </>
    );
  }

  if (number > progress.completed + 1) redirect("/course");

  const isLast = number === sessions.length;
  const alreadyCompleted = number <= progress.completed;

  return (
    <>
      <TopBar />
      <main className="page">
        <p><a className="back" href="/course">&larr; All sessions</a></p>
        <SessionCard
          session={session}
          isLast={isLast}
          alreadyCompleted={alreadyCompleted}
          basePath="/course"
          adminShortcut={await isAdmin(user)}
          helpHref={helpHref({ name: user.name, path: `/course/${number}` })}
        />
      </main>
    </>
  );
}

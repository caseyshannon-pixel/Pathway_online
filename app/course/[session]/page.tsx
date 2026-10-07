import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getSessions } from "@/lib/content";
import { getProgress, type Progress } from "@/lib/pcoWorkflow";
import TopBar from "@/components/TopBar";
import SessionCard from "@/components/SessionCard";

export const dynamic = "force-dynamic";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ session: string }>;
}) {
  const user = await getSession();
  if (!user) redirect("/");

  const { session: raw } = await params;
  const number = Number(raw);
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
              We couldn't load your progress right now. Please go back and try again in a minute.
            </p>
            <a className="btn" href="/course">Back to sessions</a>
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
        />
      </main>
    </>
  );
}

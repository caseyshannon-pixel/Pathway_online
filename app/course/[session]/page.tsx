import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getSessions } from "@/lib/content";
import { CampusRequiredError, getProgress, type Progress } from "@/lib/pcoWorkflow";
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
    progress = await getProgress(user.personId, { askCampus: true });
  } catch (err) {
    if (err instanceof CampusRequiredError) redirect("/choose-campus");
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

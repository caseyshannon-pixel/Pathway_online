import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getSessions } from "@/lib/content";
import { CampusRequiredError, getProgress, type Progress } from "@/lib/pcoWorkflow";
import TopBar from "@/components/TopBar";

export const dynamic = "force-dynamic";

export default async function Course() {
  const session = await getSession();
  if (!session) redirect("/");

  const sessions = await getSessions();

  let progress: Progress | null = null;
  try {
    progress = await getProgress(session.personId, { askCampus: true });
  } catch (err) {
    if (err instanceof CampusRequiredError) redirect("/choose-campus");
    console.error("Could not load progress:", err);
  }

  const completed = progress?.completed ?? 0;
  const finished = progress !== null && completed >= sessions.length;

  return (
    <>
      <TopBar />
      <main className="page">
        <div className="card">
          <h1>Welcome, {session.firstName}</h1>
          {progress === null ? (
            <p className="notice" role="alert">
              We couldn't load your progress right now. Please refresh in a minute.
            </p>
          ) : finished ? (
            <p className="muted">You've finished Pathway. You can rewatch any session below.</p>
          ) : (
            <p className="muted">
              {completed === 0
                ? "Start with Session 1 whenever you're ready."
                : `You've finished ${completed} of ${sessions.length} sessions.`}
            </p>
          )}

          {progress !== null && (
            <div
              className="progress"
              role="progressbar"
              aria-label="Pathway progress"
              aria-valuemin={0}
              aria-valuemax={sessions.length}
              aria-valuenow={Math.min(completed, sessions.length)}
              aria-valuetext={`${Math.min(completed, sessions.length)} of ${sessions.length} sessions completed`}
            >
              {sessions.map((s) => (
                <div key={s.number} className="progress-segment">
                  <span className={`progress-fill${s.number <= completed ? " is-done" : ""}`} />
                  <span className="progress-label" aria-hidden="true">{s.number}</span>
                </div>
              ))}
            </div>
          )}

          <ol className="chapters">
            {sessions.map((s) => {
              const isDone = s.number <= completed;
              const isNext = progress !== null && s.number === completed + 1;
              const open = progress !== null && s.number <= completed + 1;
              const status = isDone ? "Completed" : isNext ? "Up next" : "Locked";
              const inner = (
                <>
                  <span className={`chapter-num${isDone ? " is-done" : ""}`}>
                    {isDone ? "✓" : s.number}
                  </span>
                  <span className="chapter-title">{s.title}</span>
                  <span className={`status status-${isDone ? "done" : isNext ? "next" : "locked"}`}>
                    {status}
                  </span>
                </>
              );
              return (
                <li key={s.number}>
                  {open ? (
                    <a className="chapter chapter-link" href={`/course/${s.number}`}>
                      {inner}
                    </a>
                  ) : (
                    <div className="chapter chapter-locked" aria-disabled="true">
                      {inner}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </main>
    </>
  );
}

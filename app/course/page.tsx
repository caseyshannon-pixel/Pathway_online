import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getSessions } from "@/lib/content";
import { CampusRequiredError, getProgress, type Progress } from "@/lib/pcoWorkflow";
import TopBar from "@/components/TopBar";
import { formatLength } from "@/lib/duration";
import Prose from "@/components/Prose";

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

  // Only quote a total when every session's length is known.
  const totalSeconds = sessions.every((s) => s.lengthSeconds > 0)
    ? sessions.reduce((sum, s) => sum + s.lengthSeconds, 0)
    : 0;

  const completed = progress?.completed ?? 0;
  const finished = progress !== null && completed >= sessions.length;

  return (
    <>
      <TopBar />
      <main className="page">
        <div className="card">
          <h1>Welcome, {session.firstName}</h1>
          {progress === null ? (
            <>
              <p className="notice" role="alert">
                We couldn't load your progress right now. Please try again in a moment.
              </p>
              <a className="btn" href="/course">Try Again</a>
            </>
          ) : finished ? (
            <>
              <p className="muted">You've finished Pathway. You can rewatch any session below.</p>
              {sessions[sessions.length - 1]?.afterText && (
                <Prose text={sessions[sessions.length - 1].afterText} />
              )}
            </>
          ) : (
            <p className="muted">
              {completed === 0
                ? "Start with Session 1 whenever you're ready."
                : `You've finished ${completed} of ${sessions.length} sessions.`}
            </p>
          )}

          {totalSeconds > 0 && (
            <p className="muted">
              {sessions.length} sessions · about {formatLength(totalSeconds)} in total
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
                  <span className="chapter-title">
                    {isNext && <small className="chapter-eyebrow">Up next</small>}
                    {s.title}
                    {(() => {
                      const hint = [
                        formatLength(s.lengthSeconds),
                        !open && progress !== null ? `Finish session ${s.number - 1} first` : "",
                      ].filter(Boolean);
                      return hint.length > 0 ? (
                        <small className="chapter-hint">{hint.join(" · ")}</small>
                      ) : null;
                    })()}
                  </span>
                  {isNext ? (
                    <span className="chapter-cta">{completed === 0 ? "Start" : "Continue"}</span>
                  ) : (
                    <span className={`status status-${isDone ? "done" : "locked"}`}>{status}</span>
                  )}
                </>
              );
              return (
                <li key={s.number}>
                  {open ? (
                    <a className={`chapter chapter-link${isNext ? " chapter-next" : ""}`} href={`/course/${s.number}`}>
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

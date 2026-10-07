import type { Session } from "@/lib/course";
import SessionPlayer from "./SessionPlayer";
import Prose from "./Prose";
import { formatLength } from "@/lib/duration";

// The session page as people see it. Used by the real course page and by the
// admin preview, so the two always match.
export default function SessionCard({
  session,
  isLast,
  alreadyCompleted,
  basePath,
  preview = false,
}: {
  session: Session;
  isLast: boolean;
  alreadyCompleted: boolean;
  /** "/course" for people, "/admin/preview" for the admin preview */
  basePath: string;
  preview?: boolean;
}) {
  return (
    <div className="card">
      <h1>{session.title}</h1>
      {session.lengthSeconds > 0 && (
        <p className="muted session-length">{formatLength(session.lengthSeconds)} video</p>
      )}
      <Prose text={session.description} className="session-intro" />
      {session.youtubeId ? (
        <SessionPlayer
          session={session.number}
          youtubeId={session.youtubeId}
          alreadyCompleted={alreadyCompleted}
          thumbnailUrl={session.thumbnailUrl}
          nextHref={isLast ? basePath : `${basePath}/${session.number + 1}`}
          nextLabel={isLast ? "Back to sessions" : `Start Session ${session.number + 1}`}
          preview={preview}
        />
      ) : (
        <p className="muted">This session's video isn't ready yet. Please check back soon.</p>
      )}

      {(session.notes || session.links.length > 0) && (
        <section className="session-section">
          <h2>Notes</h2>
          <Prose text={session.notes} />
          {session.links.length > 0 && (
            <ul className="session-links">
              {session.links.map((l, i) => (
                <li key={i}>
                  <a href={l.url} target="_blank" rel="noopener noreferrer">{l.label}</a>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {session.formUrl && (
        <section className="session-section">
          <h2>{session.formTitle || "Next step"}</h2>
          <p className="muted">
            This form opens in Church Center. Sign in with your Planning Center login and
            your information will be filled in for you.
          </p>
          <a className="btn btn-dark" href={session.formUrl} target="_blank" rel="noopener noreferrer">
            Open The Form
          </a>
        </section>
      )}
    </div>
  );
}

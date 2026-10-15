import { DEFAULT_FORM_NOTE, type Session } from "@/lib/course";
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
  const notesPart =
    session.notes || session.links.length > 0 ? (
      <section className="after-part" key="notes">
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
    ) : null;

  const formParts = session.forms.map((form, i) => (
    <section className="after-part" key={`${form.url}-${i}`}>
      <h2>{form.title || (session.forms.length > 1 ? `Form ${i + 1}` : "Next step")}</h2>
      {!form.hideNote && (form.note || i === 0) && (
        <p className="muted">
          {form.note ||
            (session.forms.length > 1
              ? DEFAULT_FORM_NOTE.replace("This form opens", "These forms open")
              : DEFAULT_FORM_NOTE)}
        </p>
      )}
      <a className="btn btn-cta" href={form.url} target="_blank" rel="noopener noreferrer">
        {form.buttonLabel || "Open The Form"}
      </a>
    </section>
  ));

  const resourcesPart =
    session.resources.length > 0 ? (
      <section className="after-part" key="resources">
        <h2>Additional resources</h2>
        <ul className="resource-grid">
          {session.resources.map((r, i) => (
            <li key={`${r.imageUrl}-${i}`}>
              <a href={r.url || r.imageUrl} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.imageUrl} alt={r.title || `Resource ${i + 1}`} loading="lazy" />
                {r.title && <span>{r.title}</span>}
              </a>
            </li>
          ))}
        </ul>
      </section>
    ) : null;

  // Completion message, notes, links, forms and resources live together in one box under the video.
  const afterContent = notesPart || formParts.length > 0 || resourcesPart ? (
    <>
      {notesPart}
      {formParts}
      {resourcesPart}
    </>
  ) : null;

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
          afterText={session.afterText}
          nextHref={isLast ? basePath : `${basePath}/${session.number + 1}`}
          nextLabel={isLast ? "Finish Pathway" : `Start Session ${session.number + 1}`}
          preview={preview}
        >
          {afterContent}
        </SessionPlayer>
      ) : (
        <>
          <p className="muted">This session's video isn't ready yet. Please check back soon.</p>
          {afterContent && <div className="after-box">{afterContent}</div>}
        </>
      )}
    </div>
  );
}

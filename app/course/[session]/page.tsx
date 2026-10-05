import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getSessions } from "@/lib/content";
import { getPrimaryEmail, getProgress, type Progress } from "@/lib/pcoWorkflow";
import TopBar from "@/components/TopBar";
import SessionPlayer from "@/components/SessionPlayer";
import Prose from "@/components/Prose";
import FormEmbed from "@/components/FormEmbed";

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

  // Church Center fills in the email field from ?email= (it ignores name parameters).
  let formUrl = session.formUrl;
  if (formUrl) {
    const email = await getPrimaryEmail(user.personId);
    if (email) {
      const u = new URL(formUrl);
      u.searchParams.set("email", email);
      formUrl = u.toString();
    }
  }

  const isLast = number === sessions.length;
  const alreadyCompleted = number <= progress.completed;

  return (
    <>
      <TopBar />
      <main className="page">
        <p><a className="back" href="/course">&larr; All sessions</a></p>
        <div className="card">
          <h1>{session.title}</h1>
          <Prose text={session.description} className="session-intro" />
          {session.youtubeId ? (
            <SessionPlayer
              session={session.number}
              youtubeId={session.youtubeId}
              alreadyCompleted={alreadyCompleted}
              nextHref={isLast ? "/course" : `/course/${session.number + 1}`}
              nextLabel={isLast ? "Back to sessions" : `Start Session ${session.number + 1}`}
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

          {formUrl && (
            <section className="session-section">
              <h2>{session.formTitle || "Next step"}</h2>
              <FormEmbed src={formUrl} title={session.formTitle || `Form for ${session.title}`} />
              <p className="muted form-fallback">
                Trouble with the form?{" "}
                <a href={formUrl} target="_blank" rel="noopener noreferrer">
                  Open it in a new tab
                </a>.
              </p>
            </section>
          )}
        </div>
      </main>
    </>
  );
}

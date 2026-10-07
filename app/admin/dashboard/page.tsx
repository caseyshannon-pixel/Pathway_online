import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import { getWorkflowSnapshot, type CardInfo } from "@/lib/pcoWorkflow";
import { buildStats } from "@/lib/dashboard";
import TopBar from "@/components/TopBar";
import PersonAvatar from "@/components/PersonAvatar";

export const dynamic = "force-dynamic";

const STALL_CHOICES = [7, 14, 30];

const fmt = (iso: string) =>
  iso
    ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
    : "";

function PersonRow({ c, detail }: { c: CardInfo; detail: string }) {
  return (
    <li className="chapter">
      <PersonAvatar name={c.name} src={c.avatar} />
      <span className="chapter-title">{c.name}</span>
      <span className="status">{detail}</span>
      <a className="link-btn" href={`/admin?q=${encodeURIComponent(c.name)}`}>Move forward</a>
    </li>
  );
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; session?: string; wf?: string }>;
}) {
  const session = await getSession();
  if (!(await isAdmin(session))) notFound();

  const params = await searchParams;
  const days = STALL_CHOICES.includes(Number(params.days)) ? Number(params.days) : 14;

  let snapshot;
  try {
    snapshot = await getWorkflowSnapshot();
  } catch (err) {
    console.error("Dashboard failed to load:", err);
    return (
      <>
        <TopBar />
        <main className="page">
          <p><a className="back" href="/admin">&larr; Admin</a></p>
          <div className="card">
            <h1>Dashboard</h1>
            <p className="notice" role="alert">
              We couldn't load progress from Planning Center. Please refresh in a minute.
            </p>
          </div>
        </main>
      </>
    );
  }

  const { total, titles, workflows } = snapshot;
  const wf = workflows.some((w) => w.id === params.wf) ? (params.wf as string) : "";
  const cards = wf ? snapshot.cards.filter((c) => c.workflowId === wf) : snapshot.cards;
  const stats = buildStats(cards, titles, days);
  const wfQuery = wf ? `&wf=${wf}` : "";
  const picked = Number(params.session);
  const detail = Number.isInteger(picked) && picked >= 1 && picked <= total ? picked : null;
  const maxWeek = Math.max(1, ...stats.weeks.map((w) => Math.max(w.joined, w.moved)));

  return (
    <>
      <TopBar />
      <main className="page">
        <p><a className="back" href="/admin">&larr; Admin</a></p>
        <div className="card">
          <div className="dash-head">
            <h1>Dashboard</h1>
            <a className="btn btn-dark" href="/api/admin/export">Download Spreadsheet</a>
          </div>
          <p className="muted">Live from your Pathway workflow in Planning Center. Refreshes every minute.</p>

          {workflows.length > 1 && (
            <nav className="dash-filter" aria-label="Filter by campus">
              <a href={`/admin/dashboard?days=${days}`} className={wf === "" ? "is-current" : undefined}>All</a>
              {workflows.map((w) => (
                <a
                  key={w.id}
                  href={`/admin/dashboard?wf=${w.id}&days=${days}`}
                  className={wf === w.id ? "is-current" : undefined}
                >
                  {w.label}
                </a>
              ))}
            </nav>
          )}

          <div className="dash-tiles">
            <div className="dash-tile"><strong>{stats.started}</strong><span>Started</span></div>
            <div className="dash-tile"><strong>{stats.inProgress}</strong><span>In progress</span></div>
            <div className="dash-tile"><strong>{stats.finishedAll}</strong><span>Completed Pathway</span></div>
            <div className="dash-tile"><strong>{stats.stalled.length}</strong><span>Stalled {days}+ days</span></div>
          </div>

          <h2>Sessions</h2>
          <p className="muted">People who finished each session. Click a session to see who.</p>
          <ul className="dash-sessions">
            {stats.sessions.map((s) => (
              <li key={s.number}>
                <a
                  className={`dash-session${detail === s.number ? " is-open" : ""}`}
                  href={`/admin/dashboard?session=${s.number}&days=${days}${wfQuery}#people`}
                >
                  <span className="dash-session-title">{s.title}</span>
                  <span className="dash-bar" aria-hidden="true">
                    <span style={{ width: `${s.pctOfStarted}%` }} />
                  </span>
                  <span className="dash-session-nums">
                    <strong>{s.finished}</strong> finished · {s.pctOfStarted}% of started
                    {s.pctOfPrevious !== null && s.number > 1 && ` · ${s.pctOfPrevious}% continued`}
                    {s.onNow > 0 && ` · ${s.onNow} on it now`}
                  </span>
                </a>
              </li>
            ))}
          </ul>

          {detail !== null && (
            <section id="people" className="session-section">
              <h2>{titles[detail - 1]}</h2>
              <h3>Finished ({stats.sessions[detail - 1].finished})</h3>
              <ul className="chapters">
                {cards
                  .filter((c) => c.completed >= detail)
                  .slice(0, 100)
                  .map((c) => (
                    <PersonRow key={c.cardId} c={c} detail={`${c.completed} of ${total} done`} />
                  ))}
              </ul>
              <h3>On it now ({stats.sessions[detail - 1].onNow})</h3>
              <ul className="chapters">
                {cards
                  .filter((c) => c.completed === detail - 1)
                  .slice(0, 100)
                  .map((c) => (
                    <PersonRow key={c.cardId} c={c} detail={c.movedAt ? `since ${fmt(c.movedAt)}` : ""} />
                  ))}
              </ul>
            </section>
          )}

          <h2>Activity</h2>
          <p className="muted">
            This week: <strong>{stats.thisWeek.joined}</strong> joined,{" "}
            <strong>{stats.thisWeek.moved}</strong> moved to a new session. The "moved" bars count each
            person's most recent move, so older weeks understate past activity.
          </p>
          <div className="dash-weeks" role="img" aria-label="Weekly joined and moved counts for the last 12 weeks">
            {stats.weeks.map((w) => (
              <div className="dash-week" key={w.label}>
                <div className="dash-week-bars">
                  <span className="bar-joined" style={{ height: `${(w.joined / maxWeek) * 100}%` }} title={`${w.joined} joined`} />
                  <span className="bar-moved" style={{ height: `${(w.moved / maxWeek) * 100}%` }} title={`${w.moved} moved`} />
                </div>
                <span className="dash-week-label">{w.label}</span>
              </div>
            ))}
          </div>
          <p className="dash-legend">
            <span className="swatch swatch-joined" /> Joined <span className="swatch swatch-moved" /> Moved forward
          </p>

          <h2>Stalled</h2>
          <p className="muted">
            People who haven't moved in{" "}
            {STALL_CHOICES.map((d, i) => (
              <span key={d}>
                {i > 0 && " · "}
                {d === days ? (
                  <strong>{d} days</strong>
                ) : (
                  <a href={`/admin/dashboard?days=${d}${detail ? `&session=${detail}` : ""}${wfQuery}`}>{d} days</a>
                )}
              </span>
            ))}
            .
          </p>
          {stats.stalled.length === 0 ? (
            <p className="muted">No one is stalled. 🎉</p>
          ) : (
            <ul className="chapters">
              {stats.stalled.slice(0, 50).map((c) => (
                <PersonRow
                  key={c.cardId}
                  c={c}
                  detail={`Session ${Math.min(c.completed + 1, total)} · ${c.days} days`}
                />
              ))}
            </ul>
          )}
          {stats.stalled.length > 50 && (
            <p className="muted">Showing the 50 longest. Download the spreadsheet for everyone.</p>
          )}
        </div>
      </main>
    </>
  );
}

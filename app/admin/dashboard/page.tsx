import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { getAddedAdmins, isAdmin, ownerIds } from "@/lib/admin";
import { getWorkflowSnapshot, type CardInfo } from "@/lib/pcoWorkflow";
import { getStaff } from "@/lib/staff";
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
  searchParams: Promise<{ days?: string; session?: string; wf?: string; admins?: string; staff?: string; view?: string }>;
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
  // Admins' own cards are mostly test runs, so they're left out unless asked for.
  const showAdmins = params.admins === "1";
  const adminIds = new Set([...ownerIds(), ...(await getAddedAdmins()).map((a) => a.id)]);
  // Staff are hidden the same way, with their own switch.
  const showStaff = params.staff === "1";
  const staffIds = new Set((await getStaff()).map((s) => s.id));
  const visible = snapshot.cards.filter(
    (c) => !((!showAdmins && adminIds.has(c.personId)) || (!showStaff && staffIds.has(c.personId))),
  );
  const hiddenCount = showAdmins ? 0 : snapshot.cards.filter((c) => adminIds.has(c.personId)).length;
  const hiddenStaff = showStaff
    ? 0
    : snapshot.cards.filter((c) => staffIds.has(c.personId) && !adminIds.has(c.personId)).length;
  const toggleHref = (admins: boolean, staff: boolean) =>
    `/admin/dashboard?days=${days}${wf ? `&wf=${wf}` : ""}${admins ? "&admins=1" : ""}${staff ? "&staff=1" : ""}`;
  const exportQuery = [showAdmins && "admins=1", showStaff && "staff=1"].filter(Boolean).join("&");
  const cards = wf ? visible.filter((c) => c.workflowId === wf) : visible;
  const adminQuery = (showAdmins ? "&admins=1" : "") + (showStaff ? "&staff=1" : "");
  const stats = buildStats(cards, titles, days);
  const wfQuery = (wf ? `&wf=${wf}` : "") + adminQuery;
  // Clicking one of the four boxes at the top lists the people behind that number.
  const VIEWS = ["started", "progress", "completed", "stalled"] as const;
  type View = (typeof VIEWS)[number];
  const view: View | null = VIEWS.find((v) => v === params.view) ?? null;
  const picked = Number(params.session);
  const detail = !view && Number.isInteger(picked) && picked >= 1 && picked <= total ? picked : null;

  const DAY = 86_400_000;
  const now = Date.now();
  const quietDays = (c: CardInfo) => Math.max(0, Math.floor((now - Date.parse(c.movedAt || c.createdAt)) / DAY));
  const byTime = (a: CardInfo, b: CardInfo, key: "createdAt" | "movedAt", dir: 1 | -1) =>
    dir * ((Date.parse(a[key]) || 0) - (Date.parse(b[key]) || 0));
  const viewRows: { c: CardInfo; detail: string }[] =
    view === "started"
      ? [...cards].sort((a, b) => byTime(b, a, "createdAt", 1)).map((c) => ({
          c,
          detail: `${c.completed >= total ? "Finished" : `On session ${c.completed + 1}`} · joined ${fmt(c.createdAt)}`,
        }))
      : view === "progress"
        ? cards
            .filter((c) => c.completed < total)
            .sort((a, b) => byTime(a, b, "movedAt", 1)) // quiet the longest first
            .map((c) => ({ c, detail: `Session ${c.completed + 1} · quiet ${quietDays(c)} ${quietDays(c) === 1 ? "day" : "days"}` }))
        : view === "completed"
          ? cards
              .filter((c) => c.completed >= total)
              .sort((a, b) => byTime(b, a, "movedAt", 1))
              .map((c) => ({ c, detail: `Finished ${fmt(c.movedAt || c.createdAt)}` }))
          : view === "stalled"
            ? stats.stalled.map((c) => ({ c, detail: `Session ${Math.min(c.completed + 1, total)} · ${c.days} days` }))
            : [];
  const VIEW_LIMIT = 200;
  const viewTitle: Record<View, string> = {
    started: "Everyone who started",
    progress: "In progress",
    completed: "Completed Pathway",
    stalled: `Stalled ${days}+ days`,
  };
  const tileHref = (v: View) => `/admin/dashboard?view=${v}&days=${days}${wfQuery}#people`;
  const maxWeek = Math.max(1, ...stats.weeks.map((w) => Math.max(w.joined, w.moved)));

  return (
    <>
      <TopBar />
      <main className="page">
        <p><a className="back" href="/admin">&larr; Admin</a></p>
        <div className="card">
          <div className="dash-head">
            <h1>Dashboard</h1>
            <a className="btn btn-dark" href={`/api/admin/export${exportQuery ? `?${exportQuery}` : ""}`}>Download Spreadsheet</a>
          </div>
          <p className="muted">Live from your Pathway workflow in Planning Center. Refreshes every minute.</p>
          <p className="muted">
            {showAdmins ? (
              <>
                Including admins. <a href={toggleHref(false, showStaff)}>Hide admins</a>
              </>
            ) : (
              <>
                Admins are hidden{hiddenCount > 0 ? ` (${hiddenCount} left out)` : ""}.{" "}
                <a href={toggleHref(true, showStaff)}>Show admins</a>
              </>
            )}
            <br />
            {showStaff ? (
              <>
                Including staff. <a href={toggleHref(showAdmins, false)}>Hide staff</a>
              </>
            ) : (
              <>
                Staff are hidden{hiddenStaff > 0 ? ` (${hiddenStaff} left out)` : ""}.{" "}
                <a href={toggleHref(showAdmins, true)}>Show staff</a>
              </>
            )}
          </p>

          {workflows.length > 1 && (
            <nav className="dash-filter" aria-label="Filter by campus">
              <a href={`/admin/dashboard?days=${days}${adminQuery}`} className={wf === "" ? "is-current" : undefined}>All</a>
              {workflows.map((w) => (
                <a
                  key={w.id}
                  href={`/admin/dashboard?wf=${w.id}&days=${days}${adminQuery}`}
                  className={wf === w.id ? "is-current" : undefined}
                >
                  {w.label}
                </a>
              ))}
            </nav>
          )}

          <div className="dash-tiles">
            <a className={`dash-tile${view === "started" ? " is-open" : ""}`} href={tileHref("started")} aria-current={view === "started" ? "true" : undefined}>
              <strong>{stats.started}</strong><span>Started</span>
            </a>
            <a className={`dash-tile${view === "progress" ? " is-open" : ""}`} href={tileHref("progress")} aria-current={view === "progress" ? "true" : undefined}>
              <strong>{stats.inProgress}</strong><span>In progress</span>
            </a>
            <a className={`dash-tile${view === "completed" ? " is-open" : ""}`} href={tileHref("completed")} aria-current={view === "completed" ? "true" : undefined}>
              <strong>{stats.finishedAll}</strong><span>Completed Pathway</span>
            </a>
            <a className={`dash-tile${view === "stalled" ? " is-open" : ""}`} href={tileHref("stalled")} aria-current={view === "stalled" ? "true" : undefined}>
              <strong>{stats.stalled.length}</strong><span>Stalled {days}+ days</span>
            </a>
          </div>
          <p className="muted dash-tiles-hint">Click a box to see who is in it.</p>

          {view && (
            <section id="people" className="session-section dash-view">
              <div className="dash-view-head">
                <h2>{viewTitle[view]} ({viewRows.length})</h2>
                <a className="link-btn" href={`/admin/dashboard?days=${days}${wfQuery}`}>Close</a>
              </div>
              {viewRows.length === 0 ? (
                <p className="muted">No one here right now.</p>
              ) : (
                <ul className="chapters">
                  {viewRows.slice(0, VIEW_LIMIT).map(({ c, detail: d }) => (
                    <PersonRow key={c.cardId} c={c} detail={d} />
                  ))}
                </ul>
              )}
              {viewRows.length > VIEW_LIMIT && (
                <p className="muted">Showing the first {VIEW_LIMIT}. Download the spreadsheet for everyone.</p>
              )}
            </section>
          )}

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

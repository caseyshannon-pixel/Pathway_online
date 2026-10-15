"use client";

import { useEffect, useRef, useState } from "react";
import PersonAvatar from "./PersonAvatar";

type Person = {
  id: string;
  name: string;
  avatar: string;
  status: string;
  membership: string;
  age: number | null;
  grade: string;
  campus: string;
  email: string;
  phone: string;
  // advance mode only
  hasCard?: boolean;
  completed?: number;
  total?: number;
};

type Props = {
  mode: "advance" | "admin";
  initialQuery: string;
  /** admin mode: ids that are already admins */
  adminIds?: string[];
  /** a person to mark as just changed ("Moved forward" / "Admin added") */
  highlightId?: string;
  /** What to say next to the highlighted person (default: "Moved forward" / "Admin added"). */
  highlightLabel?: string;
};

export default function PersonSearch({
  mode,
  initialQuery,
  adminIds = [],
  highlightId,
  highlightLabel,
}: Props) {
  // Restarting someone asks first, in a pop-up. Nothing happens until they confirm.
  const [resetTarget, setResetTarget] = useState<Person | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (resetTarget && !dialog.open) dialog.showModal();
    if (!resetTarget && dialog.open) dialog.close();
  }, [resetTarget]);

  const [query, setQuery] = useState(initialQuery);
  const [people, setPeople] = useState<Person[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setPeople([]);
      setState("idle");
      return;
    }
    setState("loading");
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/people?mode=${mode}&q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error("search failed");
        const json = (await res.json()) as { people: Person[] };
        setPeople(json.people);
        setState("done");
      } catch (err) {
        if ((err as Error).name !== "AbortError") setState("error");
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query, mode]);

  return (
    <div className="psearch">
      <div className="psearch-box">
        <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            d="M8.5 15a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Zm5-1.5L18 18"
          />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, email or phone"
          aria-label="Search people"
          autoComplete="off"
        />
      </div>

      <div aria-live="polite" className="psearch-state">
        {state === "loading" && <p className="muted">Searching…</p>}
        {state === "error" && (
          <p className="notice" role="alert">Search didn't work. Please try again.</p>
        )}
        {state === "done" && people.length === 0 && <p className="muted">No one found.</p>}
      </div>

      <ul className="psearch-results">
        {people.map((p) => {
          const meta = [
            p.membership,
            p.age !== null ? `Age ${p.age}` : "",
            p.grade,
            p.campus,
          ].filter(Boolean);
          const contact = [p.email, p.phone].filter(Boolean);
          const finished = (p.completed ?? 0) >= (p.total ?? 0);
          return (
            <li key={p.id} className="psearch-row">
              <PersonAvatar name={p.name} src={p.avatar} />
              <div className="psearch-main">
                <div className="psearch-name">
                  {p.name}
                  {p.status && (
                    <span className={`badge${p.status === "active" ? " badge-active" : ""}`}>
                      {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                    </span>
                  )}
                  {highlightId === p.id && (
                    <span className="status-done">
                      {highlightLabel ?? (mode === "advance" ? "Moved forward" : "Admin added")}
                    </span>
                  )}
                </div>
                {meta.length > 0 && <div className="psearch-meta">{meta.join(" · ")}</div>}
                {contact.length > 0 && <div className="psearch-meta">{contact.join(" · ")}</div>}
                {mode === "advance" && (
                  <div className="psearch-meta">
                    {finished ? "Completed Pathway" : `${p.completed} of ${p.total} sessions done`}
                  </div>
                )}
              </div>

              {mode === "advance" ? (
                <div className="psearch-actions">
                  {!finished && (
                    <form action="/api/admin/advance" method="post">
                      <input type="hidden" name="personId" value={p.id} />
                      <input type="hidden" name="q" value={query} />
                      <button className="btn btn-dark" type="submit">
                        Finish session {(p.completed ?? 0) + 1}
                      </button>
                    </form>
                  )}
                  {p.hasCard && (
                    <button type="button" className="link-btn danger" onClick={() => setResetTarget(p)}>
                      Restart from scratch
                    </button>
                  )}
                </div>
              ) : adminIds.includes(p.id) ? (
                <span className="status status-done">Already an admin</span>
              ) : (
                <form action="/api/admin/admins" method="post">
                  <input type="hidden" name="action" value="add" />
                  <input type="hidden" name="personId" value={p.id} />
                  <input type="hidden" name="q" value={query} />
                  <button className="btn btn-dark" type="submit">Make admin</button>
                </form>
              )}
            </li>
          );
        })}
      </ul>

      <dialog
        ref={dialogRef}
        className="confirm-dialog"
        aria-labelledby="confirm-reset-title"
        aria-describedby="confirm-reset-text"
        onClose={() => setResetTarget(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setResetTarget(null);
        }}
      >
        <h2 id="confirm-reset-title">Restart from scratch?</h2>
        <p id="confirm-reset-text">
          <strong>{resetTarget?.name}</strong> will go back to the start of Pathway and have to watch every
          session again. Their Pathway card is removed in Planning Center. It isn't deleted for good: it can be
          restored there.
        </p>
        <p className="muted">Their campus choice, if they made one, is kept.</p>
        <form action="/api/admin/reset" method="post" className="confirm-actions">
          <input type="hidden" name="personId" value={resetTarget?.id ?? ""} />
          <input type="hidden" name="q" value={query} />
          <button type="button" className="btn btn-secondary" autoFocus onClick={() => setResetTarget(null)}>
            Cancel
          </button>
          <button type="submit" className="btn btn-danger">
            Yes, Restart
          </button>
        </form>
      </dialog>
    </div>
  );
}

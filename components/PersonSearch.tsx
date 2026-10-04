"use client";

import { useEffect, useState } from "react";
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
};

export default function PersonSearch({ mode, initialQuery, adminIds = [], highlightId }: Props) {
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
                      {mode === "advance" ? "Moved forward" : "Admin added"}
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
                !finished && (
                  <form action="/api/admin/advance" method="post">
                    <input type="hidden" name="personId" value={p.id} />
                    <input type="hidden" name="q" value={query} />
                    <button className="btn btn-dark" type="submit">
                      Finish session {(p.completed ?? 0) + 1}
                    </button>
                  </form>
                )
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
    </div>
  );
}

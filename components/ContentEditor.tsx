"use client";

import { useState } from "react";
import type { Session } from "@/lib/course";

const MAX_SESSIONS = 20;

const emptySession = (): Session => ({
  number: 0,
  title: "",
  youtubeId: "",
  description: "",
  notes: "",
  links: [],
  formUrl: "",
  formTitle: "",
  lengthSeconds: 0,
});

export default function ContentEditor({ initial }: { initial: Session[] }) {
  const [sessions, setSessions] = useState<Session[]>(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const update = (i: number, patch: Partial<Session>) => {
    setMessage(null);
    setSessions((all) => all.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= sessions.length) return;
    setMessage(null);
    setSessions((all) => {
      const next = all.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const remove = (i: number) => {
    const name = sessions[i].title || `Session ${i + 1}`;
    if (!window.confirm(`Remove "${name}"? Remember to also remove a step from your Planning Center workflow.`)) return;
    setMessage(null);
    setSessions((all) => all.filter((_, j) => j !== i));
  };

  const add = () => {
    setMessage(null);
    setSessions((all) => [...all, { ...emptySession(), title: `Session ${all.length + 1}` }]);
  };

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessions }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not save.");
      setSessions(json.sessions);
      setMessage({ kind: "ok", text: "Saved." });
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Could not save." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="editor">
      {sessions.map((s, i) => (
        <details key={i} className="editor-session" open={i === 0}>
          <summary>
            <span className="editor-num">{i + 1}</span>
            <span className="editor-summary-title">{s.title || "Untitled session"}</span>
            <span className="status">{s.youtubeId ? "Video added" : "No video yet"}</span>
          </summary>

          <div className="editor-body">
            <label className="field">
              <span>Title</span>
              <input value={s.title} maxLength={100} onChange={(e) => update(i, { title: e.target.value })} />
            </label>

            <label className="field">
              <span>YouTube video</span>
              <input
                value={s.youtubeId}
                placeholder="Paste the video link or ID"
                onChange={(e) => update(i, { youtubeId: e.target.value })}
              />
              <small className="muted">Leave empty to show "coming soon".</small>
            </label>

            <label className="field">
              <span>Video length in minutes (optional)</span>
              <input
                type="number"
                min={0}
                max={600}
                step={0.5}
                inputMode="decimal"
                value={s.lengthSeconds ? s.lengthSeconds / 60 : ""}
                placeholder="For example 28"
                onChange={(e) =>
                  update(i, { lengthSeconds: Math.round((parseFloat(e.target.value) || 0) * 60) })
                }
              />
              <small className="muted">
                Used to check that people really watched it. Without a length, the server can only
                require about a minute of playing time.
              </small>
            </label>

            <label className="field">
              <span>Intro text</span>
              <textarea
                rows={3}
                value={s.description}
                maxLength={2000}
                placeholder="A short welcome shown above the video"
                onChange={(e) => update(i, { description: e.target.value })}
              />
            </label>

            <label className="field">
              <span>Notes</span>
              <textarea
                rows={5}
                value={s.notes}
                maxLength={5000}
                placeholder="Discussion questions, key points, etc. Leave a blank line between paragraphs."
                onChange={(e) => update(i, { notes: e.target.value })}
              />
            </label>

            <fieldset className="field">
              <legend>Links</legend>
              {s.links.map((l, k) => (
                <div className="link-row" key={k}>
                  <input
                    aria-label="Link text"
                    placeholder="Link text"
                    value={l.label}
                    onChange={(e) =>
                      update(i, { links: s.links.map((x, m) => (m === k ? { ...x, label: e.target.value } : x)) })
                    }
                  />
                  <input
                    aria-label="Link address"
                    placeholder="https://"
                    value={l.url}
                    onChange={(e) =>
                      update(i, { links: s.links.map((x, m) => (m === k ? { ...x, url: e.target.value } : x)) })
                    }
                  />
                  <button
                    type="button"
                    className="link-btn"
                    aria-label="Remove link"
                    onClick={() => update(i, { links: s.links.filter((_, m) => m !== k) })}
                  >
                    Remove
                  </button>
                </div>
              ))}
              {s.links.length < 10 && (
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => update(i, { links: [...s.links, { label: "", url: "" }] })}
                >
                  + Add a link
                </button>
              )}
            </fieldset>

            <label className="field">
              <span>Church Center form (optional)</span>
              <input
                value={s.formUrl}
                placeholder="https://yourchurch.churchcenter.com/people/forms/123"
                onChange={(e) => update(i, { formUrl: e.target.value })}
              />
              <small className="muted">
                When filled in, the form appears below the video. Empty means no form section.
              </small>
            </label>

            {s.formUrl.trim() && (
              <label className="field">
                <span>Form heading</span>
                <input
                  value={s.formTitle}
                  maxLength={100}
                  placeholder="Next step"
                  onChange={(e) => update(i, { formTitle: e.target.value })}
                />
              </label>
            )}

            <div className="editor-actions">
              <a className="link-btn" href={`/admin/preview/${i + 1}`} target="_blank" rel="noopener noreferrer">
                Preview (saved version)
              </a>
              <button type="button" className="link-btn" onClick={() => move(i, -1)} disabled={i === 0}>
                Move up
              </button>
              <button
                type="button"
                className="link-btn"
                onClick={() => move(i, 1)}
                disabled={i === sessions.length - 1}
              >
                Move down
              </button>
              <button type="button" className="link-btn danger" onClick={() => remove(i)} disabled={sessions.length <= 1}>
                Remove session
              </button>
            </div>
          </div>
        </details>
      ))}

      <p className="muted editor-hint">
        Your Planning Center workflow needs one step per session, in order, plus a final "Completed"
        step. Add or remove a step there whenever you add or remove a session here.
      </p>

      <div className="editor-footer">
        {sessions.length < MAX_SESSIONS && (
          <button type="button" className="btn btn-secondary" onClick={add}>
            Add a session
          </button>
        )}
        <button type="button" className="btn" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>

      <div aria-live="polite">
        {message && (
          <p className={message.kind === "error" ? "notice" : "saved"} role={message.kind === "error" ? "alert" : "status"}>
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}

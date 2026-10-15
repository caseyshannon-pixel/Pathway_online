"use client";

import { useState } from "react";
import WelcomeSection from "./WelcomeSection";
import { DEFAULT_WELCOME, type WelcomeContent } from "@/lib/welcomeDefaults";

export default function WelcomeEditor({
  initial,
  firstName,
}: {
  initial: WelcomeContent;
  firstName: string;
}) {
  const [c, setC] = useState<WelcomeContent>(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const set = (patch: Partial<WelcomeContent>) => {
    setMessage(null);
    setC((prev) => ({ ...prev, ...patch }));
  };

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/welcome", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: c }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not save.");
      setC(json.content);
      setMessage({ kind: "ok", text: "Saved. The course page is updated." });
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Could not save." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="signin-editor">
      <div className="editor">
        <label className="field">
          <span>Thank-you heading</span>
          <input value={c.thankYouTitle} maxLength={60} onChange={(e) => set({ thankYouTitle: e.target.value })} />
        </label>
        <label className="field">
          <span>Thank-you message</span>
          <textarea
            rows={4}
            value={c.thankYou}
            maxLength={800}
            placeholder="For example: Thank you for taking this step. We're glad you're here."
            onChange={(e) => set({ thankYou: e.target.value })}
          />
          <small className="muted">Leave a blank line between paragraphs. Leave it empty to hide this part.</small>
        </label>

        <label className="field">
          <span>"What to expect" heading</span>
          <input value={c.expectTitle} maxLength={60} onChange={(e) => set({ expectTitle: e.target.value })} />
        </label>
        <div className="field" role="group" aria-labelledby="welcome-points-heading">
          <span id="welcome-points-heading">What to expect (up to 6 short points)</span>
          {c.expectPoints.map((p, i) => (
            <div className="link-row bullet-row" key={i}>
              <input
                aria-label={`Point ${i + 1}`}
                value={p}
                maxLength={160}
                onChange={(e) => set({ expectPoints: c.expectPoints.map((x, j) => (j === i ? e.target.value : x)) })}
              />
              <button
                type="button"
                className="link-btn"
                onClick={() => set({ expectPoints: c.expectPoints.filter((_, j) => j !== i) })}
              >
                Remove
              </button>
            </div>
          ))}
          {c.expectPoints.length < 6 && (
            <button type="button" className="link-btn" onClick={() => set({ expectPoints: [...c.expectPoints, ""] })}>
              + Add a point
            </button>
          )}
          <small className="muted">Leave the list empty to hide this part.</small>
        </div>

        <label className="check-row">
          <input
            type="checkbox"
            checked={c.hideAfterStart}
            onChange={(e) => set({ hideAfterStart: e.target.checked })}
          />
          <span>Hide this section once someone finishes their first session</span>
        </label>

        <div className="editor-footer">
          <button type="button" className="link-btn" onClick={() => set({ ...DEFAULT_WELCOME })}>
            Clear everything
          </button>
          <button type="button" className="btn" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save Changes"}
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

      <div className="signin-preview" aria-label="Preview of the course page">
        <p className="muted signin-preview-label">Preview</p>
        <div className="signin-preview-frame welcome-preview">
          <div className="card">
            <h1>Welcome, {firstName}</h1>
            <WelcomeSection content={c} />
            {c.thankYou === "" && c.expectPoints.length === 0 && (
              <p className="muted">Nothing will show until you add a message or a point.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

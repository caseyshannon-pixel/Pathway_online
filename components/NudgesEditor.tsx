"use client";

import { useState } from "react";
import type { NudgeSettings } from "@/lib/nudgeSettings";

type Due = { personId: string; name: string; sessionTitle: string; hoursQuiet: number; nudgeNumber: number };
type LastRun = { at: string; sent: number; failed: number; dueNow: number } | null;

const hourLabel = (h: number) => (h === 0 || h === 24 ? "12 am" : h === 12 ? "12 pm" : h < 12 ? `${h} am` : `${h - 12} pm`);

export default function NudgesEditor({ initial, lastRun }: { initial: NudgeSettings; lastRun: LastRun }) {
  const [s, setS] = useState<NudgeSettings>(initial);
  const [busy, setBusy] = useState<"" | "save" | "test" | "due">("");
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [due, setDue] = useState<{ windowOpen: boolean; due: Due[] } | null>(null);

  const set = (patch: Partial<NudgeSettings>) => {
    setMessage(null);
    setS((prev) => ({ ...prev, ...patch }));
  };
  const num = (v: string, fallback: number) => (Number.isFinite(parseInt(v, 10)) ? parseInt(v, 10) : fallback);

  async function call(kind: "save" | "test", url: string, method: string, okText: string) {
    setBusy(kind);
    setMessage(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: s }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Something went wrong.");
      if (json.settings) setS(json.settings);
      if (kind === "test") setS((prev) => ({ ...prev, testedAt: new Date().toISOString() }));
      setMessage({ kind: "ok", text: okText });
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setBusy("");
    }
  }

  async function seeDue() {
    setBusy("due");
    setMessage(null);
    try {
      const res = await fetch("/api/admin/nudges/due");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not load.");
      setDue(json);
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Could not load." });
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="editor">
      <label className="check-row">
        <input
          type="checkbox"
          checked={s.enabled}
          disabled={!s.testedAt}
          onChange={(e) => set({ enabled: e.target.checked })}
        />
        <span>
          <strong>Send nudges automatically</strong>
          {!s.testedAt && <small className="muted"> Send yourself a test email first (below) to unlock this.</small>}
        </span>
      </label>

      <label className="field">
        <span>Subject</span>
        <input value={s.subject} maxLength={150} onChange={(e) => set({ subject: e.target.value })} />
      </label>
      <label className="field">
        <span>Message</span>
        <textarea rows={9} value={s.message} maxLength={3000} onChange={(e) => set({ message: e.target.value })} />
        <small className="muted">
          These fill in automatically: <code>{"{firstName}"}</code> their first name, <code>{"{sessionTitle}"}</code>{" "}
          the session they're on next, and <code>{"{link}"}</code> the course page.
        </small>
      </label>

      <div className="nudge-grid">
        <label className="field">
          <span>Hours without activity</span>
          <input type="number" min={1} max={168} value={s.inactiveHours} onChange={(e) => set({ inactiveHours: num(e.target.value, 12) })} />
        </label>
        <label className="field">
          <span>Most nudges per person</span>
          <input type="number" min={1} max={5} value={s.maxNudges} onChange={(e) => set({ maxNudges: num(e.target.value, 3) })} />
        </label>
        <label className="field">
          <span>Days between nudges</span>
          <input type="number" min={1} max={14} value={s.spacingDays} onChange={(e) => set({ spacingDays: num(e.target.value, 3) })} />
        </label>
        <label className="field">
          <span>Send from (Eastern)</span>
          <select value={s.sendFromHour} onChange={(e) => set({ sendFromHour: num(e.target.value, 9) })}>
            {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Until (Eastern)</span>
          <select value={s.sendToHour} onChange={(e) => set({ sendToHour: num(e.target.value, 20) })}>
            {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
          </select>
        </label>
      </div>
      <p className="muted">
        Activity means joining Pathway or finishing a session. Someone who moves forward starts fresh.
      </p>

      <div className="nudge-actions">
        <button type="button" className="btn btn-dark" disabled={busy !== ""} onClick={() => call("test", "/api/admin/nudges/test", "POST", "Test email sent. Check your inbox, then you can turn nudges on.")}>
          {busy === "test" ? "Sending…" : "Send Me A Test Email"}
        </button>
        <button type="button" className="btn btn-secondary" disabled={busy !== ""} onClick={seeDue}>
          {busy === "due" ? "Checking…" : "See Who's Due Now"}
        </button>
        <button type="button" className="btn" disabled={busy !== ""} onClick={() => call("save", "/api/admin/nudges", "PUT", "Saved.")}>
          {busy === "save" ? "Saving…" : "Save Changes"}
        </button>
      </div>

      <div aria-live="polite">
        {message && (
          <p className={message.kind === "error" ? "notice" : "saved"} role={message.kind === "error" ? "alert" : "status"}>
            {message.text}
          </p>
        )}
      </div>

      {s.testedAt && <p className="muted">Last test email: {new Date(s.testedAt).toLocaleString()}.</p>}
      {lastRun && (
        <p className="muted">
          Last automatic check: {new Date(lastRun.at).toLocaleString()}: {lastRun.sent} sent
          {lastRun.failed > 0 ? `, ${lastRun.failed} failed` : ""}.
        </p>
      )}

      {due && (
        <section className="after-box nudge-due" aria-label="Who is due for a nudge">
          <div className="after-part">
            <h2>Due right now: {due.due.length}</h2>
            <p className="muted">
              {due.windowOpen ? "The sending window is open." : "The sending window is closed, so nothing would send right now."}{" "}
              {s.enabled ? "" : "Nudges are off, so nothing will send."}
            </p>
            {due.due.length === 0 ? (
              <p className="muted">No one is due.</p>
            ) : (
              <ul className="nudge-list">
                {due.due.map((d) => (
                  <li key={d.personId}>
                    <strong>{d.name}</strong> · quiet {d.hoursQuiet} hours · next: {d.sessionTitle} · nudge {d.nudgeNumber}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

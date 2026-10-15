"use client";

import { useState } from "react";
import CongratsCard from "./CongratsCard";
import { shrinkImage } from "@/lib/shrinkImage";
import PcoLinkFinder from "./PcoLinkFinder";
import { DEFAULT_COMPLETION, type CompletionContent } from "@/lib/completionDefaults";

const MAX_GIF_BYTES = 4_000_000;

export default function CompletionEditor({ initial }: { initial: CompletionContent }) {
  const [c, setC] = useState<CompletionContent>(initial);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const set = (patch: Partial<CompletionContent>) => {
    setMessage(null);
    setC((prev) => ({ ...prev, ...patch }));
  };

  async function upload(file: File) {
    setUploading(true);
    setMessage(null);
    try {
      // A GIF is sent as it is: shrinking would turn it into a still picture.
      const isGif = file.type === "image/gif";
      if (isGif && file.size > MAX_GIF_BYTES) {
        throw new Error("That GIF is too large. Try one under 4 MB (a shorter or smaller GIF).");
      }
      const toSend = isGif ? file : await shrinkImage(file);
      const form = new FormData();
      form.append("file", toSend, isGif ? "congratulations.gif" : "congratulations.jpg");
      const res = await fetch("/api/admin/thumbnail", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed.");
      set({ imageUrl: json.url });
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Upload failed." });
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/completion", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: c }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not save.");
      setC(json.content);
      setMessage({ kind: "ok", text: "Saved. People who finish will see this." });
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
          <span>Heading</span>
          <input value={c.heading} maxLength={80} onChange={(e) => set({ heading: e.target.value })} />
        </label>
        <label className="field">
          <span>Message</span>
          <textarea
            rows={5}
            value={c.message}
            maxLength={2000}
            placeholder="Congratulate them and say what happens next."
            onChange={(e) => set({ message: e.target.value })}
          />
          <small className="muted">Leave a blank line between paragraphs.</small>
        </label>

        <div className="field">
          <span>Picture (optional)</span>
          <div className="thumb-actions">
            <label className="btn btn-secondary thumb-upload">
              {uploading ? "Uploading…" : c.imageUrl ? "Replace Picture" : "Upload Picture"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                hidden
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void upload(file);
                }}
              />
            </label>
            {c.imageUrl && (
              <button type="button" className="link-btn danger" onClick={() => set({ imageUrl: "" })}>
                Remove
              </button>
            )}
          </div>
          <small className="muted">
            <strong>Suggested size: 1280 × 720 pixels</strong> (16:9). It fills the width of the screen and
            shows whole without scrolling. JPG, PNG, WebP and animated GIFs all work. A GIF must be under 4 MB
            and is shown as you uploaded it, so keep it a sensible size.
          </small>
        </div>

        <div className="field" role="group" aria-labelledby="completion-actions-heading">
          <span id="completion-actions-heading">Buttons (optional, up to 3)</span>
          {c.actions.map((a, i) => (
            <div className="link-row" key={i}>
              <input
                aria-label={`Button ${i + 1} text`}
                placeholder="Button text, like Join a group"
                maxLength={40}
                value={a.label}
                onChange={(e) => set({ actions: c.actions.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })}
              />
              <input
                aria-label={`Button ${i + 1} link`}
                placeholder="https://"
                value={a.url}
                onChange={(e) => set({ actions: c.actions.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })}
              />
              <PcoLinkFinder
                onPick={(item) =>
                  set({
                    actions: c.actions.map((x, j) =>
                      j === i ? { ...x, url: item.url, label: x.label || item.name.slice(0, 40) } : x,
                    ),
                  })
                }
              />
              <button
                type="button"
                className="link-btn"
                aria-label={`Remove button ${i + 1}`}
                onClick={() => set({ actions: c.actions.filter((_, j) => j !== i) })}
              >
                Remove
              </button>
            </div>
          ))}
          {c.actions.length < 3 && (
            <button type="button" className="link-btn" onClick={() => set({ actions: [...c.actions, { label: "", url: "" }] })}>
              + Add a button
            </button>
          )}
          <small className="muted">Buttons open in a new tab. Type a link, or use Find in Planning Center to search People forms and Registrations.</small>
        </div>

        <div className="editor-footer">
          <button type="button" className="link-btn" onClick={() => set({ ...DEFAULT_COMPLETION })}>
            Reset to the original text
          </button>
          <button type="button" className="btn" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save Congratulations Screen"}
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

      <div className="signin-preview" aria-label="Preview of the congratulations screen">
        <p className="muted signin-preview-label">Preview</p>
        <div className="signin-preview-frame">
          <CongratsCard content={c} />
        </div>
      </div>
    </div>
  );
}

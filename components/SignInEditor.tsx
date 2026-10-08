"use client";

import { useState } from "react";
import SignInCard from "./SignInCard";
import { shrinkImage } from "@/lib/shrinkImage";
import { DEFAULT_SIGNIN, type SignInContent } from "@/lib/signinDefaults";

export default function SignInEditor({ initial }: { initial: SignInContent }) {
  const [c, setC] = useState<SignInContent>(initial);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const set = (patch: Partial<SignInContent>) => {
    setMessage(null);
    setC((prev) => ({ ...prev, ...patch }));
  };

  async function upload(file: File) {
    setUploading(true);
    setMessage(null);
    try {
      const small = await shrinkImage(file);
      const form = new FormData();
      form.append("file", small, "signin.jpg");
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
      const res = await fetch("/api/admin/signin", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: c }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not save.");
      setC(json.content);
      setMessage({ kind: "ok", text: "Saved. The sign-in page is updated." });
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
          <span>Small line above the heading</span>
          <input value={c.eyebrow} maxLength={40} onChange={(e) => set({ eyebrow: e.target.value })} />
        </label>
        <label className="field">
          <span>Heading</span>
          <input value={c.heading} maxLength={80} onChange={(e) => set({ heading: e.target.value })} />
        </label>
        <label className="field">
          <span>Welcome text</span>
          <textarea rows={4} value={c.intro} maxLength={600} onChange={(e) => set({ intro: e.target.value })} />
        </label>

        <fieldset className="field">
          <legend>What to expect (optional, up to 5 short points)</legend>
          {c.bullets.map((b, i) => (
            <div className="link-row bullet-row" key={i}>
              <input
                aria-label={`Point ${i + 1}`}
                value={b}
                maxLength={100}
                onChange={(e) => set({ bullets: c.bullets.map((x, j) => (j === i ? e.target.value : x)) })}
              />
              <button
                type="button"
                className="link-btn"
                onClick={() => set({ bullets: c.bullets.filter((_, j) => j !== i) })}
              >
                Remove
              </button>
            </div>
          ))}
          {c.bullets.length < 5 && (
            <button type="button" className="link-btn" onClick={() => set({ bullets: [...c.bullets, ""] })}>
              + Add a point
            </button>
          )}
        </fieldset>

        <label className="field">
          <span>Button label</span>
          <input value={c.buttonLabel} maxLength={40} onChange={(e) => set({ buttonLabel: e.target.value })} />
        </label>
        <label className="field">
          <span>Small note under the button</span>
          <textarea rows={3} value={c.helpText} maxLength={300} onChange={(e) => set({ helpText: e.target.value })} />
        </label>

        <div className="field">
          <span>Picture (optional)</span>
          <div className="thumb-actions">
            <label className="btn btn-secondary thumb-upload">
              {uploading ? "Uploading…" : c.imageUrl ? "Replace Picture" : "Upload Picture"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
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
          <small className="muted">Shown across the top of the card. A wide picture (about 16:9) fits best.</small>
        </div>

        <div className="editor-footer">
          <button type="button" className="link-btn" onClick={() => set({ ...DEFAULT_SIGNIN })}>
            Reset to the original text
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

      <div className="signin-preview" aria-label="Preview of the sign-in page">
        <p className="muted signin-preview-label">Preview</p>
        <div className="signin-preview-frame">
          <SignInCard content={c} signInHref="#" />
        </div>
      </div>
    </div>
  );
}

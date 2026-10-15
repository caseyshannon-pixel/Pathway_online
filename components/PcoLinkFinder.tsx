"use client";

import { useEffect, useRef, useState } from "react";

type Item = {
  id: string;
  product: string;
  productLabel: string;
  name: string;
  url: string;
  detail: string;
};

const PRODUCTS = [
  { key: "all", label: "All" },
  { key: "people", label: "People" },
  { key: "registrations", label: "Registrations" },
];

// A button that opens a pop-up where you search Planning Center for a link
// (People forms, Registrations, Groups...) instead of pasting an address.
export default function PcoLinkFinder({ onPick }: { onPick: (item: { name: string; url: string }) => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [product, setProduct] = useState("all");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [failed, setFailed] = useState<string[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setState("loading");
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/pco-links?product=${product}&q=${encodeURIComponent(query)}`, {
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error("search failed");
        const json = (await res.json()) as { items: Item[]; failed: string[] };
        setItems(json.items);
        setFailed(json.failed);
        setState("done");
      } catch (err) {
        if ((err as Error).name !== "AbortError") setState("error");
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [open, product, query]);

  return (
    <>
      <button type="button" className="btn btn-dark finder-trigger" onClick={() => setOpen(true)}>
        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            d="M8.5 15a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Zm5-1.5L18 18"
          />
        </svg>
        <span>Find in Planning Center</span>
      </button>
      <dialog
        ref={dialogRef}
        className="confirm-dialog finder-dialog"
        aria-labelledby="finder-title"
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }}
      >
        <h2 id="finder-title">Find a Planning Center link</h2>
        <div className="finder-chips" role="group" aria-label="Filter by product">
          {PRODUCTS.map((p) => (
            <button
              key={p.key}
              type="button"
              className={`finder-chip${product === p.key ? " is-current" : ""}`}
              aria-pressed={product === p.key}
              onClick={() => setProduct(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <input
          className="finder-search"
          type="search"
          autoFocus
          placeholder="Search by name"
          aria-label="Search Planning Center"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div aria-live="polite" className="finder-state">
          {state === "loading" && <p className="muted">Searching…</p>}
          {state === "error" && <p className="notice" role="alert">Search didn't work. Please try again.</p>}
          {failed.length > 0 && (
            <p className="notice notice-info">Couldn't load: {failed.join(", ")}.</p>
          )}
          {state === "done" && items.length === 0 && <p className="muted">Nothing found.</p>}
        </div>
        <ul className="finder-results">
          {items.map((it) => (
            <li key={it.id}>
              <button
                type="button"
                className="finder-item"
                onClick={() => {
                  onPick({ name: it.name, url: it.url });
                  setOpen(false);
                }}
              >
                <span className="finder-name">{it.name}</span>
                <span className="finder-meta">
                  <span className="badge">{it.productLabel}</span>
                  {it.detail && <span> {it.detail}</span>}
                </span>
                <span className="finder-url">{it.url}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="confirm-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
            Close
          </button>
        </div>
      </dialog>
    </>
  );
}

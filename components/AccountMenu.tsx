"use client";

import { useEffect, useRef, useState } from "react";

// The photo button in the top bar: opens a small menu with the person's name
// and Sign out, so one mis-tap can't sign them out.
export default function AccountMenu({
  name,
  avatar,
  initial,
}: {
  name: string;
  avatar: string;
  initial: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="account-menu" ref={ref}>
      <button
        type="button"
        className="avatar-btn"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span aria-hidden="true">{initial}</span>
        )}
      </button>
      {open && (
        <div className="account-popover" role="menu">
          {name && <p className="account-name">{name}</p>}
          <form action="/api/auth/logout" method="post">
            <button type="submit" role="menuitem" className="account-signout">
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

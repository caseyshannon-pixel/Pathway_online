"use client";

import { useId, useMemo, useRef, useState } from "react";

export type Option = { value: string; label: string };

// A dropdown you can type into to narrow the list. It posts its choice in a hidden
// field with the given name, so it works inside an ordinary form.
export default function SearchableSelect({
  name,
  label,
  options,
  defaultValue = "",
  children,
}: {
  name: string;
  label: string;
  options: Option[];
  defaultValue?: string;
  /** Anything to show under the box, such as a warning. */
  children?: React.ReactNode;
}) {
  const uid = useId();
  const listId = `${uid}-list`;
  const labelId = `${uid}-label`;
  const inputRef = useRef<HTMLInputElement>(null);

  const [value, setValue] = useState(defaultValue);
  const selected = options.find((o) => o.value === value) ?? options[0];
  const [text, setText] = useState(selected?.label ?? "");
  const [typed, setTyped] = useState(false); // true once the person has typed to search
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  // Show everything until the person types; then narrow by what they typed.
  const shown = useMemo(() => {
    const q = text.trim().toLowerCase();
    return typed && q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, text, typed]);

  const choose = (o: Option) => {
    setValue(o.value);
    setText(o.label);
    setTyped(false);
    setOpen(false);
  };

  const close = () => {
    setOpen(false);
    setTyped(false);
    setText(selected?.label ?? ""); // put the chosen name back if they typed something else
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, shown.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      if (open && shown[active]) {
        e.preventDefault(); // choose the option, don't submit the form
        choose(shown[active]);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        close();
      }
    }
  };

  return (
    <div className="field">
      <span id={labelId}>{label}</span>
      <div className="ss">
        <input type="hidden" name={name} value={value} />
        <input
          ref={inputRef}
          className="ss-input"
          role="combobox"
          aria-labelledby={labelId}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && shown[active] ? `${uid}-opt-${active}` : undefined}
          autoComplete="off"
          placeholder="Type to search"
          value={text}
          onFocus={(e) => {
            setOpen(true);
            setActive(Math.max(0, options.findIndex((o) => o.value === value)));
            e.currentTarget.select();
          }}
          onChange={(e) => {
            setText(e.target.value);
            setTyped(true);
            setOpen(true);
            setActive(0);
          }}
          onBlur={close}
          onKeyDown={onKeyDown}
        />
        {open && (
          <ul className="ss-list" id={listId} role="listbox" aria-labelledby={labelId}>
            {shown.length === 0 && <li className="ss-empty">No workflows match "{text.trim()}"</li>}
            {shown.map((o, i) => (
              <li
                key={o.value || "default"}
                id={`${uid}-opt-${i}`}
                role="option"
                aria-selected={o.value === value}
                className={`ss-option${i === active ? " is-active" : ""}${o.value === value ? " is-selected" : ""}`}
                // mousedown (not click) so the input doesn't lose focus and close the list first
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(o);
                }}
                onMouseEnter={() => setActive(i)}
              >
                {o.label}
              </li>
            ))}
          </ul>
        )}
      </div>
      {children}
    </div>
  );
}

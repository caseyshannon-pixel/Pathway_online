"use client";

import { useEffect, useRef, useState } from "react";

// The Church Center form needs about 480px of width to lay out cleanly; narrower
// than that it spills past the edge (this is what cut it off on phones). So it is
// always drawn this wide, then scaled down to fit the space available.
const NATURAL_WIDTH = 490;
const SCALED_HEIGHT = 2300; // the form is ~2,040px tall at this width, plus room for extra questions

export default function FormEmbed({ src, title }: { src: string; title: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setScale(Math.min(1, el.clientWidth / NATURAL_WIDTH));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scaled = scale < 1;
  return (
    <div
      ref={wrapRef}
      className="form-embed"
      style={scaled ? { height: SCALED_HEIGHT * scale } : undefined}
    >
      <iframe
        className="form-frame"
        src={src}
        title={title}
        loading="lazy"
        style={
          scaled
            ? {
                width: NATURAL_WIDTH,
                height: SCALED_HEIGHT,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
              }
            : undefined
        }
      />
    </div>
  );
}

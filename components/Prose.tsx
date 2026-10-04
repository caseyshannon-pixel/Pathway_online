// Plain text from the admin editor: a blank line starts a new paragraph.
// Rendered as text only (React escapes it), never as HTML.
export default function Prose({ text, className }: { text: string; className?: string }) {
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length === 0) return null;
  return (
    <div className={`prose${className ? ` ${className}` : ""}`}>
      {paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}

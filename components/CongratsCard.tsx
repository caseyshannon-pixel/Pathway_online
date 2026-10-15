import Prose from "./Prose";
import type { CompletionContent } from "@/lib/completionDefaults";

// The congratulations screen. Pure display, so the real page and the admin preview match.
export default function CongratsCard({
  content,
  afterText = "",
}: {
  content: CompletionContent;
  /** The last session's "after they finish" message, shown under the main one. */
  afterText?: string;
}) {
  return (
    <section className="congrats-card" aria-label="Congratulations">
      {content.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="congrats-image" src={content.imageUrl} alt="" />
      )}
      <div className="congrats-body">
        <h2>{content.heading}</h2>
        {content.message && <Prose text={content.message} />}
        {afterText && <Prose text={afterText} />}
        {content.actions.length > 0 && (
          <div className="congrats-actions">
            {content.actions.map((a, i) => (
              <a key={i} className="btn btn-cta" href={a.url} target="_blank" rel="noopener noreferrer">
                {a.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

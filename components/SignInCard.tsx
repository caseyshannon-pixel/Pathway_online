import type { SignInContent } from "@/lib/signinDefaults";

// The sign-in card. Pure display, so the real page and the admin's live preview match.
export default function SignInCard({
  content,
  signInHref,
  message,
  note,
}: {
  content: SignInContent;
  signInHref: string;
  message?: string | null;
  note?: string | null;
}) {
  return (
    <div className="signin-card">
      {content.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="signin-image" src={content.imageUrl} alt="" />
      )}
      <div className="signin-body">
        {content.eyebrow && <p className="signin-eyebrow">{content.eyebrow}</p>}
        <h1>{content.heading}</h1>
        {content.intro && <p className="signin-intro">{content.intro}</p>}
        {content.bullets.length > 0 && (
          <ul className="signin-bullets">
            {content.bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        )}
        {note && <p className="muted">{note}</p>}
        {message && <p className="notice" role="alert">{message}</p>}
        <a className="btn signin-btn" href={signInHref}>
          {content.buttonLabel}
        </a>
        {content.helpText && <p className="signin-help">{content.helpText}</p>}
      </div>
    </div>
  );
}

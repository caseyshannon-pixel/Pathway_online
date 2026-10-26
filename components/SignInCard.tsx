import type { SignInContent } from "@/lib/signinDefaults";
import { helpHref } from "@/lib/help";

// The sign-in card. Pure display, so the real page and the admin's live preview match.
export default function SignInCard({
  content,
  signInHref,
  message,
  note,
  action,
}: {
  content: SignInContent;
  signInHref: string;
  message?: string | null;
  note?: string | null;
  /** Replaces the sign-in button (the real page puts the email sign-in here). */
  action?: React.ReactNode;
}) {
  return (
    <div className="signin-card">
      {content.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="signin-image" src={content.imageUrl} alt="" />
      )}
      <div className="signin-body">
        {content.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="signin-logo" src={content.logoUrl} alt="" />
        )}
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
        {action ?? (
          <a className="btn signin-btn" href={signInHref}>
            {content.buttonLabel}
          </a>
        )}
        {action && (
          <p className="signin-help">
            Church staff and admins: <a href={signInHref}>{content.buttonLabel}</a>
          </p>
        )}
        {content.helpText && <p className="signin-help">{content.helpText}</p>}
        <p className="signin-help">
          Trouble signing in? <a href={helpHref({ path: "/" })}>Email us</a>
        </p>
      </div>
    </div>
  );
}

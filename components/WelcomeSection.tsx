import Prose from "./Prose";
import { hasWelcomeContent, type WelcomeContent } from "@/lib/welcomeDefaults";

// Thank-you message and "what to expect" list under the course page's welcome.
// Pure display, so the real page and the admin preview match.
export default function WelcomeSection({ content }: { content: WelcomeContent }) {
  if (!hasWelcomeContent(content)) return null;
  return (
    <section className="welcome-section">
      {content.thankYou && (
        <div className="welcome-block">
          <h2>{content.thankYouTitle}</h2>
          <Prose text={content.thankYou} />
        </div>
      )}
      {content.expectPoints.length > 0 && (
        <div className="welcome-block">
          <h2>{content.expectTitle}</h2>
          <ul className="signin-bullets welcome-points">
            {content.expectPoints.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      )}
      {(content.whatNow || content.whatNowPoints.length > 0) && (
        <div className="welcome-block">
          <h2>{content.whatNowTitle}</h2>
          {content.whatNow && <Prose text={content.whatNow} />}
          {content.whatNowPoints.length > 0 && (
            <ul className="signin-bullets welcome-points">
              {content.whatNowPoints.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

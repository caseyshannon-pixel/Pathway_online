import type { LoginPerson } from "@/lib/pcoWorkflow";

// The email-link sign-in steps shown inside the sign-in card.
export default function EmailSignIn({
  step,
  next,
  people = [],
  email = "",
  justSent = false,
}: {
  step: "email" | "sent" | "who";
  next?: string | null;
  people?: LoginPerson[];
  /** The email a link was sent to, when this browser knows it. */
  email?: string;
  justSent?: boolean;
}) {
  if (step === "who") {
    return (
      <div>
        <p className="signin-intro">Who is signing in?</p>
        <div className="campus-choices">
          {people.map((p) => (
            <form key={p.id} action="/api/auth/email/choose" method="post">
              <input type="hidden" name="personId" value={p.id} />
              <button className="btn signin-btn" type="submit">{p.name}</button>
            </form>
          ))}
        </div>
      </div>
    );
  }

  if (step === "sent") {
    return (
      <div className="signin-form">
        <p className="signin-intro">
          {email ? (
            <>
              {justSent ? "We sent a sign-in link to " : "Your sign-in link went to "}
              <strong>{email}</strong>.
            </>
          ) : (
            "Check your email for your sign-in link."
          )}
        </p>
        <p className="signin-help">
          Open the email and tap the link. You can switch to your email app and it will sign you in there.
          The link works for 30 minutes. Didn't get it? Check your spam folder.
        </p>
        {email && (
          <form action="/api/auth/email/send" method="post" className="signin-form signin-resend">
            <input type="hidden" name="email" value={email} />
            {next && <input type="hidden" name="next" value={next} />}
            <button className="btn btn-secondary signin-btn" type="submit">Send a New Link</button>
          </form>
        )}
        <p className="signin-help"><a href="/?step=email">Use a different email</a></p>
      </div>
    );
  }

  return (
    <form action="/api/auth/email/send" method="post" className="signin-form">
      {next && <input type="hidden" name="next" value={next} />}
      <label htmlFor="email">Your email address</label>
      <input id="email" name="email" type="email" autoComplete="email" maxLength={200} required placeholder="you@example.com" />
      <button className="btn signin-btn" type="submit">Email Me a Sign-In Link</button>
      <p className="signin-help">
        Use the email you gave The Rock. We'll email you a link that signs you in. No password needed.
      </p>
    </form>
  );
}

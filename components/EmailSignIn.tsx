import type { LoginPerson } from "@/lib/pcoWorkflow";

// The email-code sign-in steps shown inside the sign-in card.
export default function EmailSignIn({
  step,
  next,
  people = [],
  email = "",
  justSent = false,
}: {
  step: "email" | "code" | "who";
  next?: string | null;
  people?: LoginPerson[];
  /** The email a code was sent to, when this browser knows it. */
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

  if (step === "code") {
    return (
      <div>
        <form action="/api/auth/email/verify" method="post" className="signin-form">
          {email ? (
            <>
              <input type="hidden" name="email" value={email} />
              <p className="signin-help">
                {justSent ? "We sent a code to " : "Your code went to "}
                <strong>{email}</strong>. <a href="/?step=email">Use a different email</a>
              </p>
            </>
          ) : (
            <>
              <label htmlFor="email">Your email address</label>
              <input id="email" name="email" type="email" autoComplete="email" maxLength={200} required placeholder="you@example.com" />
            </>
          )}
          <label htmlFor="code">Enter the 6-digit code we emailed you</label>
          <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]*" maxLength={8} required autoFocus={Boolean(email)} />
          <button className="btn signin-btn" type="submit">Sign In</button>
          <p className="signin-help">
            You can switch to your email app and come back. The code works for 10 minutes, or tap the
            link in the email instead. Didn't get it? Check your spam folder.
          </p>
        </form>
        {email && (
          <form action="/api/auth/email/send" method="post" className="signin-form signin-resend">
            <input type="hidden" name="email" value={email} />
            {next && <input type="hidden" name="next" value={next} />}
            <button className="btn btn-secondary signin-btn" type="submit">Send a New Code</button>
          </form>
        )}
      </div>
    );
  }

  return (
    <form action="/api/auth/email/send" method="post" className="signin-form">
      {next && <input type="hidden" name="next" value={next} />}
      <label htmlFor="email">Your email address</label>
      <input id="email" name="email" type="email" autoComplete="email" maxLength={200} required placeholder="you@example.com" />
      <button className="btn signin-btn" type="submit">Email Me a Code</button>
      <p className="signin-help">
        Use the email you gave The Rock. We'll send you a 6-digit code. No password needed.{" "}
        <a href="/?step=code">Already have a code?</a>
      </p>
    </form>
  );
}

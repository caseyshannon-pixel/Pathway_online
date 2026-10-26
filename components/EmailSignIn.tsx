import type { LoginPerson } from "@/lib/pcoWorkflow";

// The email-code sign-in steps shown inside the sign-in card.
export default function EmailSignIn({
  step,
  next,
  people = [],
}: {
  step: "email" | "code" | "who";
  next?: string | null;
  people?: LoginPerson[];
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
      <form action="/api/auth/email/verify" method="post" className="signin-form">
        <label htmlFor="code">Enter the 6-digit code we emailed you</label>
        <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]*" maxLength={8} required autoFocus />
        <button className="btn signin-btn" type="submit">Sign In</button>
        <p className="signin-help">
          Didn't get it? Check your spam folder, or <a href="/">try again</a>. The code works for 10 minutes.
        </p>
      </form>
    );
  }

  return (
    <form action="/api/auth/email/send" method="post" className="signin-form">
      {next && <input type="hidden" name="next" value={next} />}
      <label htmlFor="email">Your email address</label>
      <input id="email" name="email" type="email" autoComplete="email" maxLength={200} required placeholder="you@example.com" />
      <button className="btn signin-btn" type="submit">Email Me a Code</button>
      <p className="signin-help">Use the email you gave The Rock. We'll send you a 6-digit code. No password needed.</p>
    </form>
  );
}

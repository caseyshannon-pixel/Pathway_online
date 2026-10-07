import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { safeNext } from "@/lib/nextPath";

const MESSAGES: Record<string, string> = {
  denied: "Sign-in was cancelled. You can try again whenever you're ready.",
  state: "That sign-in link expired. Please try again.",
  signin: "We couldn't finish signing you in with Planning Center. Please try again.",
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const back = safeNext(next);

  const session = await getSession();
  if (session) redirect(back ?? "/course");

  const message = error ? MESSAGES[error] ?? MESSAGES.signin : null;
  const signInHref = back ? `/api/auth/login?next=${encodeURIComponent(back)}` : "/api/auth/login";

  return (
    <main className="page">
      <div className="card narrow">
        <h1>Pathway Online</h1>
        <p>
          Welcome to Pathway. Watch a short video each session, at your own pace and on any device.
          Your progress is saved, so you can stop and pick up later.
        </p>
        {back && <p className="muted">Sign in again to get back to where you were.</p>}
        {message && <p className="notice" role="alert">{message}</p>}
        <a className="btn" href={signInHref}>Sign in with Planning Center</a>
        <p className="muted home-help">
          Use the email address The Rock has for you. If you're asked to create a Planning Center
          login, use that same email.
        </p>
      </div>
    </main>
  );
}

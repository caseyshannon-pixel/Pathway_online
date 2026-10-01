import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

const MESSAGES: Record<string, string> = {
  denied: "Sign-in was cancelled. You can try again whenever you're ready.",
  state: "That sign-in link expired. Please try again.",
  signin: "We couldn't finish signing you in with Planning Center. Please try again.",
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  if (session) redirect("/course");

  const { error } = await searchParams;
  const message = error ? MESSAGES[error] ?? MESSAGES.signin : null;

  return (
    <main className="page">
      <div className="card narrow">
        <h1>Pathway Online</h1>
        <p className="muted">
          Sign in with your Planning Center account to start or continue the course.
        </p>
        {message && <p className="notice" role="alert">{message}</p>}
        <a className="btn" href="/api/auth/login">Sign in with Planning Center</a>
      </div>
    </main>
  );
}

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { safeNext } from "@/lib/nextPath";
import { getSignIn } from "@/lib/signin";
import SignInCard from "@/components/SignInCard";

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

  const content = await getSignIn();
  const message = error ? MESSAGES[error] ?? MESSAGES.signin : null;
  const signInHref = back ? `/api/auth/login?next=${encodeURIComponent(back)}` : "/api/auth/login";

  return (
    <main className="page signin-page">
      <SignInCard
        content={content}
        signInHref={signInHref}
        message={message}
        note={back ? "Sign in again to get back to where you were." : null}
      />
    </main>
  );
}

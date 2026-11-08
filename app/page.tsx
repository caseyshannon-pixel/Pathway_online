import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { safeNext } from "@/lib/nextPath";
import { getSignIn } from "@/lib/signin";
import SignInCard from "@/components/SignInCard";
import EmailSignIn from "@/components/EmailSignIn";
import { cookies } from "next/headers";
import { PICK_COOKIE, readPick } from "@/lib/emailLogin";

const MESSAGES: Record<string, string> = {
  denied: "Sign-in was cancelled. You can try again whenever you're ready.",
  state: "That sign-in link expired. Please try again.",
  email: "That doesn't look like an email address. Please check it and try again.",
  slow: "Too many tries. Please wait a few minutes and try again.",
  send: "We couldn't send that right now. Please try again in a moment.",
  code: "Please enter the 6-digit code from the email.",
  bad: "That code isn't right. Please check it and try again.",
  locked: "Too many wrong codes. Please start again to get a new one.",
  expired: "That code expired. Please start again to get a new one.",
  nologin: "We couldn't find your sign-in on this browser. Please enter your email here to get a new code.",
  signin: "We couldn't finish signing you in with Planning Center. Please try again.",
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string; step?: string }>;
}) {
  const { error, next, step } = await searchParams;
  const back = safeNext(next);

  const session = await getSession();
  if (session) redirect(back ?? "/course");

  const content = await getSignIn();
  let message = error ? MESSAGES[error] ?? MESSAGES.signin : null;
  const signInHref = back ? `/api/auth/login?next=${encodeURIComponent(back)}` : "/api/auth/login";

  let stage: "email" | "code" | "who" = step === "code" ? "code" : "email";
  let people: Awaited<ReturnType<typeof readPick>> = null;
  if (step === "who") {
    people = await readPick((await cookies()).get(PICK_COOKIE)?.value);
    if (people && people.length > 0) stage = "who";
    else message = MESSAGES.expired; // never drop back to the email box without saying why
  }

  return (
    <main className="page signin-page">
      <SignInCard
        content={content}
        signInHref={signInHref}
        message={message}
        action={<EmailSignIn step={stage} next={back} people={people ?? []} />}
        note={back ? "Sign in again to get back to where you were." : null}
      />
    </main>
  );
}

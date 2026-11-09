import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { safeNext } from "@/lib/nextPath";
import { getSignIn } from "@/lib/signin";
import SignInCard from "@/components/SignInCard";
import EmailSignIn from "@/components/EmailSignIn";
import { cookies } from "next/headers";
import { EMAIL_COOKIE, looksLikeEmail, PICK_COOKIE, readPick } from "@/lib/emailLogin";

const MESSAGES: Record<string, string> = {
  denied: "Sign-in was cancelled. You can try again whenever you're ready.",
  state: "That sign-in link expired. Please try again.",
  email: "That doesn't look like an email address. Please check it and try again.",
  slow: "Too many tries. Please wait a few minutes and try again.",
  send: "We couldn't send that right now. Please try again in a moment.",
  code: "Please enter the 6-digit code from the email.",
  needemail: "Please enter your email address along with the code.",
  bad: "That code isn't right. Please check it and try again. Any code from the last 10 minutes works.",
  locked: "Too many wrong codes. Tap Send a New Code below to get a fresh one.",
  expired: "That code has expired. Tap Send a New Code below to get a fresh one.",
  link: "That sign-in link has expired or was already used. Enter your email to get a new one.",
  signin: "We couldn't finish signing you in with Planning Center. Please try again.",
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string; step?: string; sent?: string }>;
}) {
  const { error, next, step, sent } = await searchParams;
  const back = safeNext(next);

  const session = await getSession();
  if (session) redirect(back ?? "/course");

  const content = await getSignIn();
  let message = error ? MESSAGES[error] ?? MESSAGES.signin : null;
  const signInHref = back ? `/api/auth/login?next=${encodeURIComponent(back)}` : "/api/auth/login";

  // Someone with a code on the way goes straight back to the code box, even if they
  // reopened the link or reloaded, unless they asked to use a different email.
  const jar = await cookies();
  const savedEmail = jar.get(EMAIL_COOKIE)?.value ?? "";
  const email = looksLikeEmail(savedEmail) ? savedEmail : "";
  let stage: "email" | "code" | "who" = step === "code" || (email && step !== "email") ? "code" : "email";
  let people: Awaited<ReturnType<typeof readPick>> = null;
  if (step === "who") {
    people = await readPick(jar.get(PICK_COOKIE)?.value);
    if (people) {
      stage = "who";
    } else {
      // The list timed out: say so and keep the code box up instead of starting over.
      stage = "code";
      message = MESSAGES.expired;
    }
  }

  return (
    <main className="page signin-page">
      <SignInCard
        content={content}
        signInHref={signInHref}
        message={message}
        action={<EmailSignIn step={stage} next={back} people={people ?? []} email={email} justSent={sent === "1"} />}
        note={back ? "Sign in again to get back to where you were." : null}
      />
    </main>
  );
}

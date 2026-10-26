import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { safeNext } from "@/lib/nextPath";
import { getSignIn } from "@/lib/signin";
import SignInCard from "@/components/SignInCard";
import EmailSignIn from "@/components/EmailSignIn";
import { cookies } from "next/headers";
import { LOGIN_COOKIE, verifiedPeople } from "@/lib/emailLogin";

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
  const message = error ? MESSAGES[error] ?? MESSAGES.signin : null;
  const signInHref = back ? `/api/auth/login?next=${encodeURIComponent(back)}` : "/api/auth/login";

  let stage: "email" | "code" | "who" = step === "code" ? "code" : "email";
  let people: Awaited<ReturnType<typeof verifiedPeople>> = null;
  if (step === "who") {
    const id = (await cookies()).get(LOGIN_COOKIE)?.value ?? "";
    people = await verifiedPeople(id).catch(() => null);
    if (people && people.length > 0) stage = "who";
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

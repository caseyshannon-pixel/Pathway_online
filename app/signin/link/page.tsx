import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getSignIn } from "@/lib/signin";
import { validKey, validLinkToken } from "@/lib/emailLogin";
import SignInCard from "@/components/SignInCard";

export const dynamic = "force-dynamic";

// Where the sign-in link in the code email lands. It only shows a button: the
// button's post is what signs in, so a mail scanner opening the link changes nothing.
export default async function SignInLink({
  searchParams,
}: {
  searchParams: Promise<{ k?: string; t?: string }>;
}) {
  if (await getSession()) redirect("/course");
  const { k = "", t = "" } = await searchParams;
  if (!validKey(k) || !validLinkToken(t)) redirect("/?step=email&error=link");
  const content = await getSignIn();

  return (
    <main className="page signin-page">
      <SignInCard
        content={content}
        signInHref="/api/auth/login"
        action={
          <form action="/api/auth/email/link" method="post" className="signin-form">
            <input type="hidden" name="k" value={k} />
            <input type="hidden" name="t" value={t} />
            <button className="btn signin-btn" type="submit">Continue to Pathway Online</button>
          </form>
        }
      />
    </main>
  );
}

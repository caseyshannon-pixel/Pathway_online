import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import { getSignIn } from "@/lib/signin";
import { privateStorageConfigured, storageConfigured } from "@/lib/blobStore";
import TopBar from "@/components/TopBar";
import SignInEditor from "@/components/SignInEditor";

export const dynamic = "force-dynamic";

export default async function AdminSignIn() {
  const session = await getSession();
  if (!(await isAdmin(session))) notFound();
  const content = await getSignIn();

  return (
    <>
      <TopBar />
      <main className="page page-wide">
        <p><a className="back" href="/admin">&larr; Admin</a></p>
        <div className="card">
          <h1>Sign-in page</h1>
          <p className="muted">
            Edit what people see before they sign in. The preview on the right updates as you type.
          </p>
          {!storageConfigured() && !privateStorageConfigured() && (
            <p className="notice" role="alert">
              Saving isn't set up yet, so you can look around but not save. Connect a Blob store to
              this project in Vercel first.
            </p>
          )}
          <SignInEditor initial={content} />
        </div>
      </main>
    </>
  );
}

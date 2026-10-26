import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { CampusRequiredError, getProgress, listCampuses } from "@/lib/pcoWorkflow";
import TopBar from "@/components/TopBar";

export const dynamic = "force-dynamic";

export default async function ChooseCampus({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getSession();
  if (!user) redirect("/");

  // If a campus is already known (or none is needed), carry on to the course.
  let needsCampus = false;
  try {
    await getProgress(user.personId, { askCampus: true });
  } catch (err) {
    if (err instanceof CampusRequiredError) needsCampus = true;
    else console.error("Could not check campus:", err);
  }
  if (!needsCampus) redirect("/course");

  let campuses: Awaited<ReturnType<typeof listCampuses>> = [];
  try {
    campuses = await listCampuses();
  } catch (err) {
    console.error("Could not load campuses:", err);
  }
  const { error } = await searchParams;

  return (
    <>
      <TopBar />
      <main className="page">
        <div className="card narrow">
          <h1>Choose your campus</h1>
          <p className="muted">Which campus are you part of? This helps us place you in the right group.</p>
          {error && (
            <p className="notice" role="alert">Something went wrong. Please try again.</p>
          )}
          {campuses.length === 0 ? (
            <p className="notice" role="alert">
              We couldn't load the campuses right now. Please refresh in a minute.
            </p>
          ) : (
            <form className="campus-choices" action="/api/campus" method="post">
              {campuses.map((c) => (
                <button key={c.id} className="btn" type="submit" name="campusId" value={c.id}>
                  {c.name}
                </button>
              ))}
            </form>
          )}
        </div>
      </main>
    </>
  );
}

import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import { getSessions } from "@/lib/content";
import { getCampusMap } from "@/lib/campusConfig";
import { privateStorageConfigured, storageConfigured } from "@/lib/blobStore";
import { defaultWorkflowId, getOnlineCampus, listCampuses, listWorkflows } from "@/lib/pcoWorkflow";
import TopBar from "@/components/TopBar";
import SearchableSelect from "@/components/SearchableSelect";

export const dynamic = "force-dynamic";

export default async function AdminCampuses({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const session = await getSession();
  if (!(await isAdmin(session))) notFound();
  const { saved, error } = await searchParams;

  const loaded = await load().catch((err) => {
    console.error("Campus settings failed to load:", err);
    return null;
  });

  return (
    <>
      <TopBar />
      <main className="page">
        <p><a className="back" href="/admin">&larr; Admin</a></p>
        <div className="card">
          <h1>Campus workflows</h1>
          <p className="muted">
            New people start in the workflow for their Primary Campus in Planning Center. People with no
            Primary Campus go to the Online campus's workflow. Campuses without a workflow use the original
            Pathway workflow. Anyone who already has a card stays where they are.
          </p>

          {!storageConfigured() && !privateStorageConfigured() && (
            <p className="notice" role="alert">
              Saving isn't set up yet. Connect a Blob store to this project in Vercel first.
            </p>
          )}
          {error && (
            <p className="notice" role="alert">
              {error === "storage" ? "Saving isn't set up yet." : "Something went wrong. Please try again."}
            </p>
          )}
          {saved && <p className="saved">Saved.</p>}

          {!loaded ? (
            <p className="notice" role="alert">
              We couldn't load campuses and workflows from Planning Center. Please refresh in a minute.
            </p>
          ) : (
            <form action="/api/admin/campuses" method="post" className="editor">
              {loaded.online ? (
                loaded.map[loaded.online.id] ? (
                  <p className="saved">
                    People with no Primary Campus go to <strong>{loaded.online.name}</strong>'s workflow.
                  </p>
                ) : (
                  <p className="notice">
                    People with no Primary Campus are meant to go to <strong>{loaded.online.name}</strong>, but it
                    has no workflow chosen below, so they'll use the original workflow until you pick one.
                  </p>
                )
              ) : (
                <p className="notice">
                  No campus with "Online" in its name was found, so people with no Primary Campus use the
                  original workflow. Add a campus named Online in Planning Center to change that.
                </p>
              )}
              <p className="muted">
                Each Pathway workflow needs <strong>{loaded.expected} steps</strong>: one per session
                ({loaded.expected - 1}) plus a final "Completed" step, in order.
              </p>
              {loaded.campuses.map((c) => {
                const chosen = loaded!.map[c.id] ?? "";
                const wf = loaded!.workflows.find((w) => w.id === chosen);
                return (
                  <SearchableSelect
                    key={c.id}
                    name={`campus_${c.id}`}
                    label={c.name}
                    defaultValue={chosen}
                    options={[
                      { value: "", label: "Original Pathway workflow" },
                      ...loaded!.workflows.map((w) => ({ value: w.id, label: `${w.name} (${w.steps} steps)` })),
                    ]}
                  >
                    {wf && wf.steps !== loaded!.expected && (
                      <small className="notice">
                        This workflow has {wf.steps} steps but Pathway needs {loaded!.expected}.
                        Progress will be wrong until they match.
                      </small>
                    )}
                  </SearchableSelect>
                );
              })}
              <p className="muted">
                Original workflow: {loaded.workflows.find((w) => w.id === loaded!.defaultId)?.name ?? `#${loaded.defaultId}`}
                {" "}
                {(() => {
                  const d = loaded.workflows.find((w) => w.id === loaded!.defaultId);
                  return d && d.steps !== loaded.expected ? (
                    <span className="notice">({d.steps} steps, needs {loaded.expected})</span>
                  ) : null;
                })()}
              </p>
              <div className="editor-footer">
                <span />
                <button className="btn" type="submit">Save Changes</button>
              </div>
            </form>
          )}
        </div>
      </main>
    </>
  );
}

async function load() {
  const [campuses, workflows, map, sessions, online] = await Promise.all([
    listCampuses(),
    listWorkflows(),
    getCampusMap(),
    getSessions(),
    getOnlineCampus(),
  ]);
  return { campuses, workflows, map, online, expected: sessions.length + 1, defaultId: defaultWorkflowId() };
}

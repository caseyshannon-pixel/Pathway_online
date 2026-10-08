import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import { getSessions } from "@/lib/content";
import { getCampusMap } from "@/lib/campusConfig";
import { privateStorageConfigured, storageConfigured } from "@/lib/blobStore";
import { defaultWorkflowId, listCampuses, listWorkflows } from "@/lib/pcoWorkflow";
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
            New people start in the workflow for their Primary Campus in Planning Center. If they
            don't have one, they choose a campus in the app first. Campuses without a workflow use the
            original Pathway workflow. Anyone who already has a card stays where they are.
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
  const [campuses, workflows, map, sessions] = await Promise.all([
    listCampuses(),
    listWorkflows(),
    getCampusMap(),
    getSessions(),
  ]);
  return { campuses, workflows, map, expected: sessions.length + 1, defaultId: defaultWorkflowId() };
}

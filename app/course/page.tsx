import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

// Placeholder chapters. Replace with your real Pathway chapters and videos.
const CHAPTERS = [
  "Chapter 1",
  "Chapter 2",
  "Chapter 3",
  "Chapter 4",
];

export default async function Course() {
  const session = await getSession();
  if (!session) redirect("/");

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <span className="brand">Pathway Online</span>
          <form action="/api/auth/logout" method="post">
            <button className="link-btn" type="submit">Sign out</button>
          </form>
        </div>
      </header>
      <main className="page">
        <div className="card">
          <h1>Welcome, {session.firstName}</h1>
          <p className="muted">
            You're signed in. Your course chapters will appear here.
          </p>
          <ol className="chapters">
            {CHAPTERS.map((title, i) => (
              <li className="chapter" key={title}>
                <span className="chapter-num">{i + 1}</span>
                <span className="chapter-title">{title}</span>
              </li>
            ))}
          </ol>
        </div>
      </main>
    </>
  );
}

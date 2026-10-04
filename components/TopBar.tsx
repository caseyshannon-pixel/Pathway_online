import { getSession } from "@/lib/session";

export default async function TopBar() {
  const session = await getSession();
  const initial = (session?.firstName || session?.name || "?").charAt(0).toUpperCase();

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <a className="brand" href="/course">Pathway Online</a>
        <form action="/api/auth/logout" method="post">
          <button className="avatar-btn" type="submit" aria-label="Sign out" title="Sign out">
            {session?.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={session.avatar} alt="" referrerPolicy="no-referrer" />
            ) : (
              <span aria-hidden="true">{initial}</span>
            )}
          </button>
        </form>
      </div>
    </header>
  );
}

export default function TopBar() {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <a className="brand" href="/course">Pathway Online</a>
        <form action="/api/auth/logout" method="post">
          <button className="link-btn" type="submit">Sign out</button>
        </form>
      </div>
    </header>
  );
}

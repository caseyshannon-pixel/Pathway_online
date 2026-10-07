import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import AccountMenu from "./AccountMenu";

export default async function TopBar() {
  const session = await getSession();
  const initial = (session?.firstName || session?.name || "?").charAt(0).toUpperCase();

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <a className="brand" href="/course">Pathway Online</a>
        <div className="topbar-right">
          {(await isAdmin(session)) && <a className="back" href="/admin">Admin</a>}
          <AccountMenu name={session?.name ?? ""} avatar={session?.avatar ?? ""} initial={initial} />
        </div>
      </div>
    </header>
  );
}

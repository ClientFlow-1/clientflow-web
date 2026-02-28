"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function NavItem({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link href={href} className={`ds-nav-item ${active ? "active" : ""}`}>
      <span className="ds-nav-dot" aria-hidden="true" />
      <span className="ds-nav-label">{label}</span>
    </Link>
  );
}

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="ds-root">
      <aside className="ds-sidebar">
        <div className="ds-brand">
          <div className="ds-logo" />
          <div>
            <div className="ds-brand-title">CLIENTFLOW</div>
            <div className="ds-brand-sub">My Workspace</div>
          </div>
        </div>

        <nav className="ds-nav">
          <NavItem href="/dashboard/import" label="Import" />
          <NavItem href="/dashboard/clients" label="Clients" />
        </nav>
      </aside>

      <div className="ds-main">
        <div className="ds-topbar">
          <button className="ds-profile" type="button" aria-label="Profil">
            E
          </button>
        </div>

        <main className="ds-content">{children}</main>
      </div>
    </div>
  );
}
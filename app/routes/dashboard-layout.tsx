import { Form, Link, NavLink, Outlet, redirect, useLoaderData } from "react-router";

import type { Route } from "./+types/dashboard-layout";

export async function loader({ request }: Route.LoaderArgs) {
  const { getAuthenticatedUser } = await import("~/lib/auth.server");
  const user = await getAuthenticatedUser(request);

  if (!user) {
    throw redirect("/login");
  }

  return { user };
}

const sidebarNav = [
  {
    to: "/dashboard",
    label: "Dashboard",
    end: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    to: "#",
    label: "Projects",
    end: false,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    to: "#",
    label: "Team",
    end: false,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    to: "#",
    label: "Settings",
    end: false,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

export default function DashboardLayout() {
  const { user } = useLoaderData<typeof loader>();
  const initials = (user.displayName ?? user.email).slice(0, 2).toUpperCase();

  return (
    <div className="dash-shell">
      {/* ── Sidebar ── */}
      <aside className="dash-sidebar">
        <div className="dash-sidebar-brand">
          <Link to="/" className="brand-lockup" aria-label="Unihelper home">
            <span className="brand-mark">U</span>
            <span className="type-brand text-white">Unihelper</span>
          </Link>
        </div>

        <nav className="dash-sidebar-nav" aria-label="Dashboard navigation">
          {sidebarNav.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              end={item.end}
              className="dash-nav-link"
            >
              <span className="dash-nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="dash-sidebar-footer">
          <div className="dash-user-row">
            <div className="dash-avatar" aria-hidden="true">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="type-body-sm truncate text-white">
                {user.displayName ?? user.email}
              </p>
              <p className="type-caption truncate text-slate-400">{user.email}</p>
            </div>
          </div>
          <Form action="/logout" method="post">
            <button type="submit" className="dash-signout-btn">
              Sign out
            </button>
          </Form>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="dash-body">
        <header className="dash-topbar">
          <div className="flex items-center gap-3">
            <div className="dash-topbar-badge" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
              </svg>
            </div>
            <span className="type-nav text-white">Dashboard</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden rounded-2xl border border-white/10 bg-white/5 px-4 py-1.5 sm:block">
              <span className="type-caption text-slate-400">Signed in as </span>
              <span className="type-caption text-slate-200">
                {user.displayName ?? user.email}
              </span>
            </div>
          </div>
        </header>

        <main className="dash-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

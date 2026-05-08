import { useState } from "react";
import { Form, Link, NavLink, Outlet, redirect, useLoaderData } from "react-router";
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  UserCircle,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Bell,
} from "lucide-react";

import type { Route } from "./+types/dashboard-layout";

export async function loader({ request }: Route.LoaderArgs) {
  const { getAuthenticatedUser } = await import("~/lib/auth.server");
  const user = await getAuthenticatedUser(request);

  if (!user) {
    throw redirect("/login");
  }

  return { user };
}

const sidebarSections = [
  {
    label: "Overview",
    items: [
      { to: "/dashboard", label: "Dashboard", end: true, Icon: LayoutDashboard },
    ],
  },
  {
    label: "Workspace",
    items: [
      { to: "#", label: "Projects", end: false, Icon: FolderKanban, disabled: true },
      { to: "#", label: "Team", end: false, Icon: Users, disabled: true },
    ],
  },
  {
    label: "Account",
    items: [
      { to: "/dashboard/profile", label: "Profile", end: false, Icon: UserCircle },
      { to: "#", label: "Settings", end: false, Icon: Settings, disabled: true },
    ],
  },
];

export default function DashboardLayout() {
  const { user } = useLoaderData<typeof loader>();
  const [collapsed, setCollapsed] = useState(false);
  const initials = (user.displayName ?? user.email).slice(0, 2).toUpperCase();

  const sidebarW = collapsed ? "5.5rem" : "17rem";

  return (
    <div className="dash-shell">
      {/* ── Sidebar ── */}
      <aside className="dash-sidebar" style={{ width: sidebarW }}>
        <div className="dash-sidebar-panel">
          {/* Brand */}
          <div className="dash-sidebar-brand">
            <Link
              to="/"
              className="brand-lockup min-w-0 overflow-hidden"
              aria-label="Unihelper home"
            >
              <span className="brand-mark dash-brand-mark shrink-0">U</span>
              {!collapsed && (
                <span className="dash-brand-copy">
                  <span className="type-brand block truncate text-slate-900">Unihelper</span>
                  <span className="dash-brand-meta">Campus workspace</span>
                </span>
              )}
            </Link>

            <button
              type="button"
              className="dash-sidebar-toggle shrink-0"
              onClick={() => setCollapsed((currentValue) => !currentValue)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
          </div>

          {/* Nav sections */}
          <nav className="dash-sidebar-nav" aria-label="Dashboard navigation">
            {sidebarSections.map((section) => (
              <div key={section.label} className="dash-nav-section">
                {!collapsed && (
                  <p className="dash-nav-section-label">{section.label}</p>
                )}

                <div className="space-y-1">
                  {section.items.map((item) => (
                    <NavLink
                      key={item.label}
                      to={item.to}
                      end={item.end}
                      onClick={item.disabled ? (event) => event.preventDefault() : undefined}
                      aria-disabled={item.disabled || undefined}
                      className={({ isActive }) =>
                        `dash-nav-link${isActive && item.to !== "#" ? " active" : ""}${item.disabled ? " disabled" : ""}${collapsed ? " justify-center" : ""}`
                      }
                      title={collapsed ? item.label : undefined}
                    >
                      <span className="dash-nav-icon-wrap" aria-hidden="true">
                        <item.Icon size={16} className="dash-nav-icon" />
                      </span>

                      {!collapsed && (
                        <span className="dash-nav-link-content">
                          <span className="dash-nav-link-label">{item.label}</span>
                          {item.disabled ? <span className="dash-nav-badge">Soon</span> : null}
                        </span>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          {/* Footer: user + sign out */}
          <div className="dash-sidebar-footer">
            <div className={`dash-sidebar-profile-card${collapsed ? " items-center p-2.5" : ""}`}>
              <NavLink
                to="/dashboard/profile"
                className={({ isActive }) =>
                  `dash-user-row-link${isActive ? " active" : ""}${collapsed ? " justify-center" : ""}`
                }
                title={collapsed ? (user.displayName ?? user.email) : undefined}
              >
                <div className="dash-avatar shrink-0" aria-hidden="true">
                  {initials}
                </div>
                {!collapsed && (
                  <div className="min-w-0 flex-1">
                    <p className="type-body-sm truncate font-semibold text-slate-800">
                      {user.displayName ?? user.email}
                    </p>
                    <p className="type-caption truncate text-slate-500">{user.email}</p>
                  </div>
                )}
              </NavLink>

              {!collapsed && <div className="dash-sidebar-divider" aria-hidden="true" />}

              <Form action="/logout" method="post">
                <button
                  type="submit"
                  className={collapsed ? "dash-signout-icon-btn" : "dash-signout-btn"}
                  title="Sign out"
                  aria-label="Sign out"
                >
                  {collapsed ? (
                    <LogOut size={16} />
                  ) : (
                    <>
                      <LogOut size={15} />
                      <span>Sign out</span>
                    </>
                  )}
                </button>
              </Form>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="dash-body" style={{ marginLeft: sidebarW }}>
        <header className="dash-topbar" style={{ left: sidebarW }}>
          <div className="flex items-center gap-3">
            <div className="dash-topbar-badge" aria-hidden="true">
              <LayoutDashboard size={15} />
            </div>
            <span className="type-nav text-slate-900">Dashboard</span>
          </div>

          <div className="flex items-center gap-2">
            <button className="dash-topbar-icon-btn" aria-label="Notifications">
              <Bell size={16} />
            </button>
            <NavLink
              to="/dashboard/profile"
              className="dash-topbar-avatar-btn"
              aria-label="View profile"
            >
              <span className="dash-avatar-sm" aria-hidden="true">
                {initials}
              </span>
              <span className="hidden sm:block">
                <span className="type-caption block text-right text-slate-700">
                  {user.displayName ?? user.email}
                </span>
              </span>
            </NavLink>
          </div>
        </header>

        <main className="dash-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

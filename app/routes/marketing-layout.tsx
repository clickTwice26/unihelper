import { Form, Link, Outlet, useRouteLoaderData } from "react-router";

import type { loader as rootLoader } from "~/root";

const navItems = [
  { href: "/#features", label: "Features" },
  { href: "/#buddies", label: "Buddies" },
  { href: "/#more", label: "More" },
];

export default function MarketingLayout() {
  const rootData = useRouteLoaderData<typeof rootLoader>("root");
  const user = rootData?.user ?? null;

  return (
    <div className="app-shell">
      <div className="nav-frame">
        <header className="nav-shell">
          <Link to="/" className="brand-lockup" aria-label="UniBuddy home">
            <span className="brand-mark">U</span>
            <span>
              <span className="type-brand block text-slate-900">UniBuddy</span>
              <span className="type-caption block text-slate-500">
                Your university life, organised
              </span>
            </span>
          </Link>

          <nav className="nav-links" aria-label="Primary">
            {navItems.map((item) => (
              <a key={item.href} href={item.href} className="nav-link">
                {item.label}
              </a>
            ))}
          </nav>

          <div className="nav-actions">
            {user ? (
              <>
                <Link to="/dashboard" className="nav-pill nav-pill-secondary">
                  Dashboard
                </Link>
                <Form action="/logout" method="post">
                  <button className="nav-pill nav-pill-secondary" type="submit">
                    Sign Out
                  </button>
                </Form>
              </>
            ) : (
              <>
                <Link to="/login" className="nav-pill nav-pill-secondary">
                  Sign In
                </Link>
                <Link to="/register" className="nav-pill nav-pill-primary">
                  Create Account
                </Link>
              </>
            )}
          </div>
        </header>
      </div>

      <div className="page-shell">
        <Outlet />
      </div>
    </div>
  );
}

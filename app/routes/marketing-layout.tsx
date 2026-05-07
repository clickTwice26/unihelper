import { Form, Link, Outlet, useRouteLoaderData } from "react-router";

import type { loader as rootLoader } from "~/root";

const navItems = [
  { href: "/#overview", label: "Overview" },
  { href: "/#runtime", label: "Runtime" },
  { href: "/#next-steps", label: "Next Steps" },
];

export default function MarketingLayout() {
  const rootData = useRouteLoaderData<typeof rootLoader>("root");
  const user = rootData?.user ?? null;

  return (
    <div className="app-shell">
      <div className="nav-frame">
        <header className="nav-shell">
          <Link to="/" className="brand-lockup" aria-label="Unihelper home">
            <span className="brand-mark">U</span>
            <span>
              <span className="type-brand block text-white">Unihelper</span>
              <span className="type-caption block text-slate-400">
                Remix-style full-stack workspace
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

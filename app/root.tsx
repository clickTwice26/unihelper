import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";

const navItems = [
  { href: "/#overview", label: "Overview" },
  { href: "/#runtime", label: "Runtime" },
  { href: "/#next-steps", label: "Next Steps" },
];

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="app-shell">
        <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
          <header className="nav-shell">
            <a href="/" className="brand-lockup" aria-label="Unihelper home">
              <span className="brand-mark">U</span>
              <span>
                <span className="type-brand block text-white">
                  Unihelper
                </span>
                <span className="type-caption block text-slate-400">
                  Remix-style full-stack workspace
                </span>
              </span>
            </a>

            <nav className="nav-links" aria-label="Primary">
              {navItems.map((item) => (
                <a key={item.href} href={item.href} className="nav-link">
                  {item.label}
                </a>
              ))}
            </nav>

            <div className="nav-actions">
              <a href="/health" className="nav-pill nav-pill-secondary">
                Health
              </a>
              <a href="/#overview" className="nav-pill nav-pill-primary">
                Launch Build
              </a>
            </div>
          </header>
        </div>

        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl items-center px-6 py-16">
      <section className="surface-panel w-full space-y-4 p-8">
        <p className="eyebrow">Application Error</p>
        <h1 className="type-heading-lg">{message}</h1>
        <p className="type-body-md max-w-2xl text-slate-300">{details}</p>
        {stack && (
          <pre className="type-body-sm max-h-96 w-full overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/80 p-4 text-slate-200">
            <code>{stack}</code>
          </pre>
        )}
      </section>
    </main>
  );
}

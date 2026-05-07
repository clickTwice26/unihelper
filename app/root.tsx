import { useEffect, useState } from "react";
import {
  data,
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap",
  },
];

export async function loader({ request }: Route.LoaderArgs) {
  const { getAuthenticatedUser } = await import("~/lib/auth.server");
  const { parseFlash, clearFlash } = await import("~/lib/flash.server");

  const [user, toast] = await Promise.all([
    getAuthenticatedUser(request),
    parseFlash(request),
  ]);

  const headers = new Headers();
  if (toast) {
    headers.append("Set-Cookie", await clearFlash());
  }

  return data(
    {
      user: user
        ? {
            id: user.id,
            email: user.email,
            displayName: user.displayName,
          }
        : null,
      toast,
    },
    { headers }
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  const { user, toast } = useLoaderData<typeof loader>();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!toast) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <>
      <div className="sr-only" aria-live="polite">
        {user ? `Signed in as ${user.displayName ?? user.email}` : "Not signed in"}
      </div>
      {visible && toast && (
        <div
          className="fixed bottom-6 right-6 z-[9999] flex max-w-xs items-center gap-2.5 rounded-2xl border border-emerald-400/30 bg-[rgba(7,17,31,0.92)] px-4 py-3 text-sm font-medium text-emerald-100 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-md"
          style={{ animation: "toast-in 0.35s ease-out" }}
          role="status"
          aria-live="polite"
        >
          <span className="size-2 shrink-0 rounded-full bg-emerald-400" />
          <span className="flex-1">{toast}</span>
          <button
            className="ml-1 cursor-pointer border-none bg-transparent pl-1 text-xs text-slate-400 transition-colors hover:text-slate-200"
            onClick={() => setVisible(false)}
            aria-label="Dismiss notification"
            type="button"
          >
            ✕
          </button>
        </div>
      )}
      <Outlet />
    </>
  );
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

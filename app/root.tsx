import { useEffect, useRef, useState } from "react";
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
import { CheckCircle, XCircle, AlertTriangle, X } from "lucide-react";

import type { Route } from "./+types/root";
import type { FlashMessage } from "~/lib/flash.server";
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
  const [current, setCurrent] = useState<FlashMessage | null>(null);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!toast) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setCurrent(toast);
    setVisible(true);
    timerRef.current = setTimeout(() => setVisible(false), 5000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [toast]);

  const variants = {
    success: {
      icon: CheckCircle,
      bar: "bg-emerald-500",
      iconClass: "text-emerald-500",
      title: "text-emerald-900",
      msg: "text-emerald-700",
      border: "border-emerald-100",
      bg: "bg-emerald-50",
    },
    error: {
      icon: XCircle,
      bar: "bg-rose-500",
      iconClass: "text-rose-500",
      title: "text-rose-900",
      msg: "text-rose-700",
      border: "border-rose-100",
      bg: "bg-rose-50",
    },
    warning: {
      icon: AlertTriangle,
      bar: "bg-amber-400",
      iconClass: "text-amber-500",
      title: "text-amber-900",
      msg: "text-amber-700",
      border: "border-amber-100",
      bg: "bg-amber-50",
    },
  };

  const v = current ? variants[current.type] : null;
  const Icon = v ? v.icon : null;

  return (
    <>
      <div className="sr-only" aria-live="polite">
        {user ? `${user.displayName ?? user.email}` : "Not signed in"}
      </div>

      {/* ── Floating alert toast ── */}
      {visible && current && v && Icon && (
        <div
          role="alert"
          aria-live="assertive"
          className={`fixed bottom-6 right-6 z-[9999] flex w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border shadow-xl ${v.border} bg-white`}
          style={{ animation: "toast-in 0.3s cubic-bezier(0.34,1.56,0.64,1)" }}
        >
          {/* Colored left bar */}
          <div className={`w-1 shrink-0 ${v.bar}`} />

          {/* Content */}
          <div className="flex flex-1 items-start gap-3 px-4 py-3.5">
            <Icon size={20} className={`mt-0.5 shrink-0 ${v.iconClass}`} />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold leading-snug ${v.title}`}>
                {current.type === "success" ? "Success" : current.type === "error" ? "Error" : "Warning"}
              </p>
              <p className={`text-sm mt-0.5 leading-snug ${v.msg}`}>{current.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setVisible(false)}
              aria-label="Dismiss"
              className="mt-0.5 shrink-0 rounded-md p-0.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Auto-dismiss progress bar */}
          <div
            className={`absolute bottom-0 left-1 right-0 h-0.5 ${v.bar} opacity-30 origin-left`}
            style={{ animation: "toast-progress 5s linear forwards" }}
          />
        </div>
      )}

      <Outlet />
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const is404 = isRouteErrorResponse(error) && error.status === 404;

  if (is404) {
    return (
      <Layout>
        <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 py-16 text-center">
          {/* Big number */}
          <p className="select-none text-[9rem] font-black leading-none text-indigo-100 sm:text-[13rem] drop-shadow-sm">
            404
          </p>

          <div className="-mt-4 space-y-3">
            <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl tracking-tight">
              Page not found
            </h1>
            <p className="mx-auto max-w-sm text-base text-slate-500 leading-relaxed">
              The page you're looking for doesn't exist or has been moved.
            </p>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <a
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              Go to Dashboard
            </a>
            <a
              href="/"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Back to Home
            </a>
          </div>
        </main>
      </Layout>
    );
  }

  // ── Generic error ────────────────────────────────────────────────────────
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    details = error.statusText || details;
  } else if (import.meta.env.DEV && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <Layout>
      <main className="mx-auto flex min-h-screen max-w-5xl items-center px-6 py-16">
        <section className="surface-panel w-full space-y-4 p-8">
          <p className="eyebrow">Something went wrong</p>
          <h1 className="type-heading-lg">Unexpected Error</h1>
          <p className="type-body-md max-w-2xl text-slate-600">{details}</p>
          {stack && (
            <pre className="type-body-sm max-h-96 w-full overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-700">
              <code>{stack}</code>
            </pre>
          )}
        </section>
      </main>
    </Layout>
  );
}

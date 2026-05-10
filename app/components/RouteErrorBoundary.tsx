import { isRouteErrorResponse, useRouteError } from "react-router";

export function RouteErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-6xl font-bold text-slate-200">{error.status}</p>
        <h1 className="text-2xl font-semibold text-slate-800">
          {error.status === 404
            ? "Page not found"
            : error.status === 401
              ? "Unauthorized"
              : error.status === 403
                ? "Forbidden"
                : "Something went wrong"}
        </h1>
        <p className="max-w-md text-slate-500">
          {error.data ?? "An unexpected error occurred. Please try again."}
        </p>
        <a
          href="/dashboard"
          className="mt-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Back to dashboard
        </a>
      </div>
    );
  }

  const message =
    error instanceof Error ? error.message : "An unexpected error occurred.";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-6xl font-bold text-slate-200">500</p>
      <h1 className="text-2xl font-semibold text-slate-800">Unexpected error</h1>
      <p className="max-w-md text-slate-500">{message}</p>
      <a
        href="/dashboard"
        className="mt-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
      >
        Back to dashboard
      </a>
    </div>
  );
}

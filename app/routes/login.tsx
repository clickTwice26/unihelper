import { Form, Link, useActionData, useNavigation } from "react-router";

import type { Route } from "./+types/login";

type ActionData = {
  fields?: {
    email: string;
  };
  message: string;
  status: "error";
};

export function meta() {
  return [
    { title: "Sign In | Unihelper" },
    {
      name: "description",
      content: "Access your Unihelper workspace from the login page.",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { redirectIfAuthenticated } = await import("~/lib/auth.server");

  await redirectIfAuthenticated(request);

  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const { rateLimit, getClientIp } = await import("~/lib/ratelimit.server");
  // 10 attempts per 15 minutes per IP
  await rateLimit({ key: `login:${getClientIp(request)}`, limit: 10, windowSec: 900 });

  const { createUserSession, findUserByEmail, verifyPassword, getDummyHash } = await import("~/lib/auth.server");
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();
  // Do NOT trim passwords — whitespace may be intentional and trimming silently
  // changes the credential, reducing effective keyspace.
  const password = String(formData.get("password") ?? "");

  // Validate redirectTo is a relative path to prevent open-redirect attacks
  const rawRedirect = String(formData.get("redirectTo") ?? "").trim();
  const redirectTo =
    rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")
      ? rawRedirect
      : "/dashboard";

  if (!email || !password) {
    return {
      status: "error" as const,
      fields: { email },
      message: "Email and password are required.",
    } satisfies ActionData;
  }

  try {
    const user = await findUserByEmail(email);

    // Always call verifyPassword regardless of whether the user exists.
    // This makes the response time constant and prevents username enumeration
    // via timing side-channel (scrypt takes ~100 ms; skipping it is measurable).
    const hashToVerify = user?.passwordHash ?? (await getDummyHash());
    const passwordValid = await verifyPassword(password, hashToVerify);

    if (!user || !passwordValid) {
      return {
        status: "error" as const,
        fields: { email },
        message: "Incorrect email or password.",
      } satisfies ActionData;
    }

    return createUserSession(
      user.id,
      redirectTo,
      `Welcome back, ${user.displayName ?? user.email}!`
    );
  } catch (err) {
    if (err instanceof Response) throw err;
    const { logger } = await import("~/lib/logger.server");
    logger.error({ err }, "Login error");
    return {
      status: "error" as const,
      fields: { email },
      message: "Sign in failed. Please try again.",
    } satisfies ActionData;
  }
}

export default function Login() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <main className="auth-shell">
      <section className="auth-grid">
        <div className="surface-panel auth-panel">
          <div className="space-y-4">
            <p className="eyebrow">Welcome Back</p>
            <h1 className="type-heading-lg max-w-xl text-slate-900">Sign in to continue building inside Unihelper.</h1>
            <p className="type-body-md max-w-2xl text-slate-600">
              Use this page as the foundation for password auth, magic links, SSO,
              or any external identity provider you attach later.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <article className="feature-card">
              Centralize session handling in route actions and server modules.
            </article>
            <article className="feature-card">
              Keep protected layouts, org switching, and audit trails behind auth.
            </article>
          </div>

          <div className="auth-link-row">
            <Link to="/register" className="nav-pill nav-pill-primary">
              Create an account
            </Link>
            <Link to="/" className="nav-pill nav-pill-secondary">
              Back home
            </Link>
          </div>
        </div>

        <section className="surface-panel auth-panel">
          <div className="space-y-2">
            <p className="eyebrow">Sign In</p>
            <p className="type-body-md text-slate-600">
              Enter your account credentials to access your workspace.
            </p>
          </div>

          {actionData && (
            <div className="status-banner status-error">
              {actionData.message}
            </div>
          )}

          <Form method="post" className="auth-form">
            <input name="redirectTo" type="hidden" value="/dashboard" />
            <label className="auth-field">
              <span className="field-label">Email Address</span>
              <input
                autoComplete="email"
                autoFocus
                className="field-input"
                defaultValue={actionData?.fields?.email ?? ""}
                name="email"
                placeholder="founder@unihelper.app"
                type="email"
              />
            </label>

            <label className="auth-field">
              <span className="field-label">Password</span>
              <input
                autoComplete="current-password"
                className="field-input"
                name="password"
                placeholder="Enter your password"
                type="password"
              />
              <span className="field-helper">
                Password auth is active. On success, this route creates a persisted session cookie.
              </span>
            </label>

            <button className="auth-submit" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Signing In..." : "Sign In"}
            </button>
          </Form>
        </section>
      </section>
    </main>
  );
}
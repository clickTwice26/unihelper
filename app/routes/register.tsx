import { Form, Link, useActionData, useNavigation } from "react-router";

import type { Route } from "./+types/register";

type ActionData = {
  fields?: {
    email: string;
    fullName: string;
  };
  message: string;
  status: "error";
};

export function meta() {
  return [
    { title: "Create Account | Unihelper" },
    {
      name: "description",
      content: "Create a Unihelper account from the registration page.",
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
  // 5 registrations per hour per IP
  await rateLimit({ key: `register:${getClientIp(request)}`, limit: 5, windowSec: 3600 });

  const { createUserSession, findUserByEmail, isValidEmail, isValidPassword, isValidDisplayName, registerUser } = await import("~/lib/auth.server");
  const formData = await request.formData();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  // Do NOT trim passwords — whitespace may be intentional.
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!fullName || !email || !password || !confirmPassword) {
    return {
      status: "error" as const,
      fields: { email, fullName },
      message: "All fields are required to create an account.",
    } satisfies ActionData;
  }

  if (!isValidDisplayName(fullName)) {
    return {
      status: "error" as const,
      fields: { email, fullName },
      message: "Full name must be 100 characters or fewer.",
    } satisfies ActionData;
  }

  if (!isValidEmail(email)) {
    return {
      status: "error" as const,
      fields: { email, fullName },
      message: "Enter a valid email address.",
    } satisfies ActionData;
  }

  if (!isValidPassword(password)) {
    return {
      status: "error" as const,
      fields: { email, fullName },
      message: "Password must be between 8 and 128 characters.",
    } satisfies ActionData;
  }

  if (password !== confirmPassword) {
    return {
      status: "error" as const,
      fields: { email, fullName },
      message: "Passwords must match.",
    } satisfies ActionData;
  }

  try {
    const existingUser = await findUserByEmail(email);

    if (existingUser) {
      return {
        status: "error" as const,
        fields: { email, fullName },
        message: "An account with this email already exists.",
      } satisfies ActionData;
    }

    const user = await registerUser({
      email,
      displayName: fullName,
      password,
    });

    return createUserSession(
      user.id,
      "/dashboard",
      `Welcome, ${user.displayName ?? user.email}! Your account is ready.`
    );
  } catch (err) {
    if (err instanceof Response) throw err;
    const { logger } = await import("~/lib/logger.server");
    logger.error({ err }, "Registration error");
    return {
      status: "error" as const,
      fields: { email, fullName },
      message: "Account creation failed. Please try again.",
    } satisfies ActionData;
  }
}

export default function Register() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <main className="auth-shell">
      <section className="auth-grid">
        <div className="surface-panel auth-panel">
          <div className="space-y-4">
            <p className="eyebrow">Create Account</p>
            <h1 className="type-heading-lg max-w-xl text-slate-900">Open a fresh workspace and start shipping faster.</h1>
            <p className="type-body-md max-w-2xl text-slate-600">
              Registration is set up as a route-driven form so you can layer in email
              verification, workspace creation, onboarding, and invitations without
              restructuring the page.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <article className="feature-card">
              Attach onboarding, roles, and organization setup directly after account creation.
            </article>
            <article className="feature-card">
              Keep validation and side effects in one server-side action boundary.
            </article>
          </div>

          <div className="auth-link-row">
            <Link to="/login" className="nav-pill nav-pill-secondary">
              Already have an account?
            </Link>
            <Link to="/" className="nav-pill nav-pill-primary">
              Back home
            </Link>
          </div>
        </div>

        <section className="surface-panel auth-panel">
          <div className="space-y-2">
            <p className="eyebrow">Registration</p>
            <p className="type-body-md text-slate-600">
              Create your account scaffold now and attach the real identity flow after.
            </p>
          </div>

          {actionData && (
            <div className="status-banner status-error">
              {actionData.message}
            </div>
          )}

          <Form method="post" className="auth-form">
            <label className="auth-field">
              <span className="field-label">Full Name</span>
              <input
                autoComplete="name"
                autoFocus
                className="field-input"
                defaultValue={actionData?.fields?.fullName ?? ""}
                name="fullName"
                placeholder="Amina Rahman"
                type="text"
              />
            </label>

            <label className="auth-field">
              <span className="field-label">Email Address</span>
              <input
                autoComplete="email"
                className="field-input"
                defaultValue={actionData?.fields?.email ?? ""}
                name="email"
                placeholder="amina@unihelper.app"
                type="email"
              />
            </label>

            <label className="auth-field">
              <span className="field-label">Password</span>
              <input
                autoComplete="new-password"
                className="field-input"
                name="password"
                placeholder="Create a secure password"
                type="password"
              />
            </label>

            <label className="auth-field">
              <span className="field-label">Confirm Password</span>
              <input
                autoComplete="new-password"
                className="field-input"
                name="confirmPassword"
                placeholder="Repeat your password"
                type="password"
              />
              <span className="field-helper">
                Registration now creates a user record, hashes the password, and issues a session cookie.
              </span>
            </label>

            <button className="auth-submit" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Creating Account..." : "Create Account"}
            </button>
          </Form>
        </section>
      </section>
    </main>
  );
}
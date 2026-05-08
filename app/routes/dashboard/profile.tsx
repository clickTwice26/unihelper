import { Form, useActionData, useLoaderData, useNavigation } from "react-router";

import type { Route } from "./+types/home";

export function meta() {
  return [{ title: "Profile | Unihelper" }];
}

// ── Loader ──────────────────────────────────────────────────────────────────

export async function loader({ request }: Route.LoaderArgs) {
  const { getAuthenticatedUser, getUserById } = await import("~/lib/auth.server");
  const session = await getAuthenticatedUser(request);
  if (!session) throw new Response("Unauthorized", { status: 401 });

  const user = await getUserById(session.id);
  if (!user) throw new Response("Not found", { status: 404 });

  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      memberSince: user.createdAt.toISOString(),
    },
  };
}

// ── Action ───────────────────────────────────────────────────────────────────

type ActionResult =
  | { intent: "profile"; status: "ok" | "error"; message: string }
  | { intent: "password"; status: "ok" | "error"; message: string };

export async function action({ request }: Route.ActionArgs) {
  const {
    getAuthenticatedUser,
    isValidEmail,
    isValidPassword,
    updateUserProfile,
    updateUserPassword,
  } = await import("~/lib/auth.server");
  const { logger } = await import("~/lib/logger.server");

  const session = await getAuthenticatedUser(request);
  if (!session) throw new Response("Unauthorized", { status: 401 });

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  // ── Update profile ───────────────────────────────────────────────────────
  if (intent === "profile") {
    const displayName = String(formData.get("displayName") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();

    if (!email) {
      return { intent: "profile", status: "error", message: "Email is required." } satisfies ActionResult;
    }

    if (!isValidEmail(email)) {
      return { intent: "profile", status: "error", message: "Enter a valid email address." } satisfies ActionResult;
    }

    try {
      await updateUserProfile(session.id, { displayName, email });
      return { intent: "profile", status: "ok", message: "Profile updated successfully." } satisfies ActionResult;
    } catch (err) {
      if (err instanceof Error && err.message === "EMAIL_TAKEN") {
        return { intent: "profile", status: "error", message: "That email is already used by another account." } satisfies ActionResult;
      }
      logger.error({ err }, "Profile update error");
      return { intent: "profile", status: "error", message: "Failed to update profile. Please try again." } satisfies ActionResult;
    }
  }

  // ── Change password ──────────────────────────────────────────────────────
  if (intent === "password") {
    const currentPassword = String(formData.get("currentPassword") ?? "");
    const newPassword = String(formData.get("newPassword") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (!currentPassword || !newPassword || !confirmPassword) {
      return { intent: "password", status: "error", message: "All password fields are required." } satisfies ActionResult;
    }

    if (!isValidPassword(newPassword)) {
      return { intent: "password", status: "error", message: "New password must be at least 8 characters." } satisfies ActionResult;
    }

    if (newPassword !== confirmPassword) {
      return { intent: "password", status: "error", message: "New passwords do not match." } satisfies ActionResult;
    }

    try {
      await updateUserPassword(session.id, { currentPassword, newPassword });
      return { intent: "password", status: "ok", message: "Password changed successfully." } satisfies ActionResult;
    } catch (err) {
      if (err instanceof Error && err.message === "WRONG_PASSWORD") {
        return { intent: "password", status: "error", message: "Current password is incorrect." } satisfies ActionResult;
      }
      logger.error({ err }, "Password change error");
      return { intent: "password", status: "error", message: "Failed to change password. Please try again." } satisfies ActionResult;
    }
  }

  return { intent: "profile", status: "error", message: "Unknown action." } satisfies ActionResult;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const initials = (user.displayName ?? user.email).slice(0, 2).toUpperCase();

  const profileFeedback = actionData?.intent === "profile" ? actionData : null;
  const passwordFeedback = actionData?.intent === "password" ? actionData : null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-6">
        <div className="profile-avatar-lg" aria-hidden="true">
          {initials}
        </div>
        <div className="space-y-0.5">
          <p className="eyebrow">Profile</p>
          <h1 className="type-heading-lg text-slate-900">
            {user.displayName ?? user.email}
          </h1>
          <p className="type-body-sm text-slate-500">{user.email}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Update profile ── */}
        <section className="surface-panel space-y-6 p-6">
          <div className="space-y-0.5">
            <p className="eyebrow">Account Details</p>
            <p className="type-body-sm text-slate-400">Update your name and email address.</p>
          </div>

          {profileFeedback && (
            <div className={`status-banner ${profileFeedback.status === "ok" ? "status-success" : "status-error"}`}>
              {profileFeedback.message}
            </div>
          )}

          <Form method="post" className="auth-form">
            <input type="hidden" name="intent" value="profile" />

            <label className="auth-field">
              <span className="field-label">Display Name</span>
              <input
                className="field-input"
                name="displayName"
                type="text"
                defaultValue={user.displayName ?? ""}
                placeholder="Your full name"
                autoComplete="name"
              />
            </label>

            <label className="auth-field">
              <span className="field-label">Email Address</span>
              <input
                className="field-input"
                name="email"
                type="email"
                defaultValue={user.email}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </label>

            <button
              type="submit"
              className="auth-submit"
              disabled={isSubmitting && navigation.formData?.get("intent") === "profile"}
            >
              {isSubmitting && navigation.formData?.get("intent") === "profile"
                ? "Saving…"
                : "Save Changes"}
            </button>
          </Form>
        </section>

        {/* ── Change password ── */}
        <section className="surface-panel space-y-6 p-6">
          <div className="space-y-0.5">
            <p className="eyebrow">Security</p>
            <p className="type-body-sm text-slate-400">Change your account password.</p>
          </div>

          {passwordFeedback && (
            <div className={`status-banner ${passwordFeedback.status === "ok" ? "status-success" : "status-error"}`}>
              {passwordFeedback.message}
            </div>
          )}

          <Form method="post" className="auth-form">
            <input type="hidden" name="intent" value="password" />

            <label className="auth-field">
              <span className="field-label">Current Password</span>
              <input
                className="field-input"
                name="currentPassword"
                type="password"
                placeholder="Your current password"
                autoComplete="current-password"
                required
              />
            </label>

            <label className="auth-field">
              <span className="field-label">New Password</span>
              <input
                className="field-input"
                name="newPassword"
                type="password"
                placeholder="At least 8 characters"
                autoComplete="new-password"
                required
              />
            </label>

            <label className="auth-field">
              <span className="field-label">Confirm New Password</span>
              <input
                className="field-input"
                name="confirmPassword"
                type="password"
                placeholder="Repeat new password"
                autoComplete="new-password"
                required
              />
            </label>

            <button
              type="submit"
              className="auth-submit"
              disabled={isSubmitting && navigation.formData?.get("intent") === "password"}
            >
              {isSubmitting && navigation.formData?.get("intent") === "password"
                ? "Updating…"
                : "Update Password"}
            </button>
          </Form>
        </section>
      </div>
    </div>
  );
}

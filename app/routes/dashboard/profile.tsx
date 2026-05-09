import { Form, Link, useLoaderData, useNavigation } from "react-router";
import { Camera, KeyRound, Mail, Shield, User } from "lucide-react";

import type { Route } from "./+types/home";

export function meta() {
  return [{ title: "Profile | UniBuddy" }];
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
      isPublic: user.isPublic,
      acceptRequests: user.acceptRequests,
    },
  };
}

// ── Action ───────────────────────────────────────────────────────────────────

export async function action({ request }: Route.ActionArgs) {
  const {
    getAuthenticatedUser,
    isValidEmail,
    isValidPassword,
    updateUserProfile,
    updateUserPassword,
    updateUserSettings,
  } = await import("~/lib/auth.server");
  const { serializeFlash } = await import("~/lib/flash.server");
  const { rateLimit } = await import("~/lib/ratelimit.server");
  const { logger } = await import("~/lib/logger.server");
  const { redirect } = await import("react-router");

  const session = await getAuthenticatedUser(request);
  if (!session) throw new Response("Unauthorized", { status: 401 });

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  const flash = async (type: "success" | "error" | "warning", message: string) => {
    const headers = new Headers();
    headers.append("Set-Cookie", await serializeFlash({ type, message }));
    return redirect("/dashboard/profile", { headers });
  };

  // Per-intent rate limits (keyed by user ID)
  const limits: Record<string, { limit: number; windowSec: number }> = {
    profile:  { limit: 20, windowSec: 3600 },   // 20 profile updates / hour
    password: { limit: 5,  windowSec: 900  },   // 5 password changes / 15 min
    settings: { limit: 30, windowSec: 3600 },   // 30 settings saves / hour
  };
  if (limits[intent]) {
    try {
      await rateLimit({ key: `profile:${intent}:${session.id}`, ...limits[intent] });
    } catch (err) {
      if (err instanceof Response && err.status === 429) {
        throw await flash("error", "Too many requests. Please wait a moment and try again.");
      }
    }
  }

  // ── Update profile ───────────────────────────────────────────────────────
  if (intent === "profile") {
    const displayName = String(formData.get("displayName") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();

    if (!email) throw await flash("error", "Email is required.");
    if (!isValidEmail(email)) throw await flash("error", "Enter a valid email address.");
    if (displayName && displayName.length > 100) throw await flash("error", "Display name must be 100 characters or fewer.");

    try {
      await updateUserProfile(session.id, { displayName, email });
      throw await flash("success", "Profile updated successfully.");
    } catch (err) {
      if (err instanceof Response) throw err;
      if (err instanceof Error && err.message === "EMAIL_TAKEN") {
        throw await flash("error", "That email is already used by another account.");
      }
      logger.error({ err }, "Profile update error");
      throw await flash("error", "Failed to update profile. Please try again.");
    }
  }

  // ── Change password ──────────────────────────────────────────────────────
  if (intent === "password") {
    const currentPassword = String(formData.get("currentPassword") ?? "");
    const newPassword = String(formData.get("newPassword") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (!currentPassword || !newPassword || !confirmPassword) {
      throw await flash("warning", "All password fields are required.");
    }
    if (!isValidPassword(newPassword)) {
      throw await flash("warning", "New password must be between 8 and 128 characters.");
    }
    if (newPassword !== confirmPassword) {
      throw await flash("warning", "New passwords do not match.");
    }

    try {
      await updateUserPassword(session.id, { currentPassword, newPassword });
      throw await flash("success", "Password changed successfully.");
    } catch (err) {
      if (err instanceof Response) throw err;
      if (err instanceof Error && err.message === "WRONG_PASSWORD") {
        throw await flash("error", "Current password is incorrect.");
      }
      logger.error({ err }, "Password change error");
      throw await flash("error", "Failed to change password. Please try again.");
    }
  }

  // ── Update settings ──────────────────────────────────────────────────────
  if (intent === "settings") {
    const isPublic = formData.get("isPublic") === "on";
    const acceptRequests = formData.get("acceptRequests") === "on";
    try {
      await updateUserSettings(session.id, { isPublic, acceptRequests });
      throw await flash("success", "Privacy settings saved.");
    } catch (err) {
      if (err instanceof Response) throw err;
      logger.error({ err }, "Settings update error");
      throw await flash("error", "Failed to save settings. Please try again.");
    }
  }

  throw await flash("error", "Unknown action.");
}

// ── Reusable toggle component ────────────────────────────────────────────────

function Toggle({ checked, name }: { checked: boolean; name: string }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        name={name}
        value="on"
        defaultChecked={checked}
        className="sr-only peer"
      />
      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-400 rounded-full peer peer-checked:bg-indigo-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5" />
    </label>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const initials = (user.displayName ?? user.email).slice(0, 2).toUpperCase();

  const memberSince = new Date(user.memberSince).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-8 max-w-5xl">
  

      {/* ── Avatar + identity card ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center gap-6">
        {/* Avatar */}
        <div className="relative shrink-0 self-start">
          <div className="h-20 w-20 rounded-full bg-indigo-50 border-2 border-indigo-100 flex items-center justify-center text-2xl font-bold text-indigo-600 shadow-sm select-none">
            {initials}
          </div>
          <div className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-white border border-slate-200 shadow flex items-center justify-center text-slate-400">
            <Camera size={14} />
          </div>
        </div>

        {/* Identity */}
        <div className="flex-1 min-w-0 space-y-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 leading-tight">
              {user.displayName ?? user.email}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">{user.email}</p>
          </div>

          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <User size={13} className="text-slate-400" />
              <span>Member since {memberSince}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Shield size={13} className="text-slate-400" />
              <span>Password authentication</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Two-column forms ── */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* ── Update profile ── */}
        <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          {/* Card header */}
          <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
              <User size={17} className="text-indigo-600" />
            </div>
            <div>
              <p className="text-[0.9rem] font-semibold text-slate-900 leading-tight">Account Details</p>
              <p className="text-xs text-slate-500 mt-0.5">Update your name and email address.</p>
            </div>
          </div>

          {/* Card body */}
          <div className="px-6 py-6 space-y-5">
            <Form method="post" className="space-y-4" preventScrollReset>
              <input type="hidden" name="intent" value="profile" />

              <div className="flex flex-col gap-1.5">
                <label htmlFor="displayName" className="text-xs font-semibold text-slate-600 tracking-wide uppercase">
                  Display Name
                </label>
                <input
                  id="displayName"
                  name="displayName"
                  type="text"
                  defaultValue={user.displayName ?? ""}
                  placeholder="Your full name"
                  autoComplete="name"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-xs font-semibold text-slate-600 tracking-wide uppercase">
                  Email Address
                </label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    defaultValue={user.email}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting && navigation.formData?.get("intent") === "profile"}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl px-4 py-2.5 transition-colors"
              >
                {isSubmitting && navigation.formData?.get("intent") === "profile"
                  ? "Saving…"
                  : "Save Changes"}
              </button>
            </Form>
          </div>
        </section>

        {/* ── Change password ── */}
        <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          {/* Card header */}
          <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
              <KeyRound size={17} className="text-amber-600" />
            </div>
            <div>
              <p className="text-[0.9rem] font-semibold text-slate-900 leading-tight">Security</p>
              <p className="text-xs text-slate-500 mt-0.5">Change your account password.</p>
            </div>
          </div>

          {/* Card body */}
          <div className="px-6 py-6 space-y-5">
            <Form method="post" className="space-y-4" preventScrollReset>
              <input type="hidden" name="intent" value="password" />

              {[
                { id: "currentPassword", label: "Current Password", name: "currentPassword", auto: "current-password", placeholder: "Your current password" },
                { id: "newPassword", label: "New Password", name: "newPassword", auto: "new-password", placeholder: "At least 8 characters" },
                { id: "confirmPassword", label: "Confirm New Password", name: "confirmPassword", auto: "new-password", placeholder: "Repeat new password" },
              ].map((f) => (
                <div key={f.id} className="flex flex-col gap-1.5">
                  <label htmlFor={f.id} className="text-xs font-semibold text-slate-600 tracking-wide uppercase">
                    {f.label}
                  </label>
                  <input
                    id={f.id}
                    name={f.name}
                    type="password"
                    placeholder={f.placeholder}
                    autoComplete={f.auto}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition"
                  />
                </div>
              ))}

              <button
                type="submit"
                disabled={isSubmitting && navigation.formData?.get("intent") === "password"}
                className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl px-4 py-2.5 transition-colors"
              >
                {isSubmitting && navigation.formData?.get("intent") === "password"
                  ? "Updating…"
                  : "Update Password"}
              </button>
            </Form>
          </div>
        </section>

      </div>

      {/* ── Privacy & Visibility settings ── */}
      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100">
          <p className="text-[0.9rem] font-semibold text-slate-900 leading-tight">Privacy &amp; Visibility</p>
          <p className="text-xs text-slate-500 mt-0.5">Control how others can see and interact with your profile.</p>
        </div>

        <Form method="post" className="divide-y divide-slate-100" preventScrollReset>
          <input type="hidden" name="intent" value="settings" />

          {/* Publicly visible toggle */}
          <div className="px-6 py-5 flex items-center justify-between gap-6">
            <div>
              <p className="text-sm font-semibold text-slate-800">Publicly visible profile</p>
              <p className="text-xs text-slate-500 mt-0.5">
                When enabled, your profile can be discovered and viewed by others.
              </p>
            </div>
            <Toggle checked={user.isPublic} name="isPublic" />
          </div>

          {/* Accept requests toggle */}
          <div className="px-6 py-5 flex items-center justify-between gap-6">
            <div>
              <p className="text-sm font-semibold text-slate-800">Accept requests</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Allow others to send you connection or collaboration requests.
              </p>
            </div>
            <Toggle checked={user.acceptRequests} name="acceptRequests" />
          </div>

          <div className="px-6 py-4 bg-slate-50 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting && navigation.formData?.get("intent") === "settings"}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl px-5 py-2.5 transition-colors"
            >
              {isSubmitting && navigation.formData?.get("intent") === "settings"
                ? "Saving…"
                : "Save Settings"}
            </button>
          </div>
        </Form>
      </section>

      {/* ── Danger zone ── */}
      <section className="bg-white border border-rose-100 rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-rose-100">
          <p className="text-[0.9rem] font-semibold text-rose-600 leading-tight">Danger Zone</p>
          <p className="text-xs text-slate-500 mt-0.5">Irreversible actions for your account.</p>
        </div>
        <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-800">Delete account</p>
            <p className="text-xs text-slate-500 mt-0.5">Permanently remove your account and all associated data.</p>
          </div>
          <button
            type="button"
            className="shrink-0 flex items-center gap-2 border border-rose-200 text-rose-600 text-sm font-semibold rounded-xl px-4 py-2 hover:bg-rose-50 transition-colors"
            onClick={() => window.alert("Contact support to delete your account.")}
          >
            Delete account
          </button>
        </div>
      </section>
    </div>
  );
}

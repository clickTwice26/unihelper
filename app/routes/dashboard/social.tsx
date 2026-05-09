import { Form, Link, useLoaderData, useNavigation } from "react-router";
import { BookOpen, Check, Clock3, Globe, Lock, Search, UserCheck, UserPlus, Users } from "lucide-react";

import type { Route } from "./+types/social";

type SocialTab = "discover" | "requests" | "buddies";

function resolveActiveTab(value: string | FormDataEntryValue | null | undefined): SocialTab {
  const tab = String(value ?? "");

  if (tab === "requests" || tab === "buddies") {
    return tab;
  }

  return "discover";
}

function normalizeSearchQuery(value: string | FormDataEntryValue | null | undefined) {
  return String(value ?? "").trim().slice(0, 100);
}

function buildSocialPath(tab: SocialTab, searchQuery: string) {
  const params = new URLSearchParams();

  if (tab !== "discover") {
    params.set("tab", tab);
  }

  if (searchQuery) {
    params.set("q", searchQuery);
  }

  const query = params.toString();
  return query ? `/dashboard/social?${query}` : "/dashboard/social";
}

function publicName(name: string | null) {
  const trimmed = name?.trim();
  return trimmed ? trimmed : "UniBuddy member";
}

function matchesSearch(name: string | null, searchQuery: string) {
  if (!searchQuery) {
    return true;
  }

  return publicName(name).toLocaleLowerCase().includes(searchQuery.toLocaleLowerCase());
}

function initialsFor(name: string | null) {
  const trimmed = name?.trim();

  if (!trimmed) {
    return "UH";
  }

  return trimmed.slice(0, 2).toUpperCase();
}

export function meta() {
  return [{ title: "Social | UniBuddy" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { getAuthenticatedUser } = await import("~/lib/auth.server");
  const { redirect } = await import("react-router");
  const { getSocialDirectory } = await import("~/lib/buddy.server");
  const url = new URL(request.url);

  const session = await getAuthenticatedUser(request);
  if (!session) throw redirect("/login");

  const searchQuery = normalizeSearchQuery(url.searchParams.get("q"));
  const directory = await getSocialDirectory(session.id);
  const publicUsers = directory.publicUsers.filter((user) =>
    matchesSearch(user.displayName, searchQuery),
  );
  const incomingRequests = directory.incomingRequests.filter((request) =>
    matchesSearch(request.sender.displayName, searchQuery),
  );
  const acceptedBuddies = directory.acceptedBuddies.filter((buddy) =>
    matchesSearch(buddy.displayName, searchQuery),
  );

  return {
    publicUsers,
    incomingRequests,
    acceptedBuddies,
    activeTab: resolveActiveTab(url.searchParams.get("tab")),
    searchQuery,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const { getAuthenticatedUser } = await import("~/lib/auth.server");
  const { serializeFlash } = await import("~/lib/flash.server");
  const { rateLimit } = await import("~/lib/ratelimit.server");
  const { acceptBuddyRequest, sendBuddyRequest } = await import("~/lib/buddy.server");
  const { redirect } = await import("react-router");

  const session = await getAuthenticatedUser(request);
  if (!session) throw new Response("Unauthorized", { status: 401 });

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const searchQuery = normalizeSearchQuery(formData.get("q"));
  const activeTab = resolveActiveTab(
    formData.get("tab") ?? (intent === "accept" ? "requests" : "discover"),
  );
  const redirectTo = buildSocialPath(activeTab, searchQuery);

  const flash = async (type: "success" | "error" | "warning", message: string) => {
    const headers = new Headers();
    headers.append("Set-Cookie", await serializeFlash({ type, message }));
    return redirect(redirectTo, { headers });
  };

  const limits: Record<string, { limit: number; windowSec: number }> = {
    send: { limit: 60, windowSec: 3600 },
    accept: { limit: 120, windowSec: 3600 },
  };

  if (limits[intent]) {
    try {
      await rateLimit({
        key: `social:${intent}:${session.id}`,
        ...limits[intent],
      });
    } catch (error) {
      if (error instanceof Response && error.status === 429) {
        throw await flash("error", "Too many buddy actions. Please wait and try again.");
      }
      throw error;
    }
  }

  if (intent === "send") {
    const targetUserId = String(formData.get("targetUserId") ?? "").trim();

    try {
      await sendBuddyRequest(session.id, targetUserId);
      throw await flash("success", "Buddy request sent.");
    } catch (error) {
      if (error instanceof Response) throw error;

      if (error instanceof Error) {
        const messages: Record<string, string> = {
          SELF_REQUEST: "You can't send a buddy request to yourself.",
          USER_NOT_FOUND: "That user no longer exists.",
          USER_NOT_PUBLIC: "That profile is no longer public.",
          REQUESTS_DISABLED: "This user isn't accepting buddy requests right now.",
          ALREADY_BUDDIES: "You're already buddies.",
          REQUEST_ALREADY_SENT: "You've already sent this buddy request.",
          REQUEST_ALREADY_EXISTS: "A buddy request already exists for this pair.",
          INCOMING_REQUEST_EXISTS: "This user already sent you a request. Accept it below.",
          INVALID_REQUEST: "Invalid buddy request.",
        };

        throw await flash(
          "error",
          messages[error.message] ?? "Failed to send buddy request.",
        );
      }

      throw await flash("error", "Failed to send buddy request.");
    }
  }

  if (intent === "accept") {
    const requestId = String(formData.get("requestId") ?? "").trim();

    try {
      await acceptBuddyRequest(session.id, requestId);
      throw await flash("success", "Buddy request accepted.");
    } catch (error) {
      if (error instanceof Response) throw error;

      if (error instanceof Error) {
        const messages: Record<string, string> = {
          REQUEST_NOT_FOUND: "That buddy request no longer exists.",
          FORBIDDEN_REQUEST: "You can't accept that buddy request.",
          REQUEST_NOT_PENDING: "That buddy request was already handled.",
          ALREADY_BUDDIES: "You're already buddies.",
          INVALID_REQUEST: "Invalid buddy request.",
        };

        throw await flash(
          "error",
          messages[error.message] ?? "Failed to accept buddy request.",
        );
      }

      throw await flash("error", "Failed to accept buddy request.");
    }
  }

  throw await flash("error", "Unknown action.");
}

export default function SocialPage() {
  const { publicUsers, incomingRequests, acceptedBuddies, activeTab, searchQuery } =
    useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const activeIntent = String(navigation.formData?.get("intent") ?? "");
  const activeTargetUserId = String(navigation.formData?.get("targetUserId") ?? "");
  const activeRequestId = String(navigation.formData?.get("requestId") ?? "");
  const discoverEmptyTitle = searchQuery ? "No matching public profiles" : "No new public profiles";
  const discoverEmptyMessage = searchQuery
    ? `No public profile matched "${searchQuery}".`
    : "Accepted buddies stay in the Buddies tab. New public members who are not already connected will appear here.";
  const requestsEmptyTitle = searchQuery ? "No matching requests" : "No incoming requests";
  const requestsEmptyMessage = searchQuery
    ? `No incoming request matched "${searchQuery}".`
    : "When someone sends you a buddy request, you'll accept it from this tab.";
  const buddiesEmptyTitle = searchQuery ? "No matching buddies" : "No accepted buddies yet";
  const buddiesEmptyMessage = searchQuery
    ? `No accepted buddy matched "${searchQuery}".`
    : "Once a request is accepted from either side, the mutual connection will appear here.";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="social-tabs-row flex w-full min-w-0 rounded-xl border border-slate-200 bg-white p-1 shadow-sm lg:inline-flex lg:w-auto">
          <Link
            to={buildSocialPath("discover", searchQuery)}
            aria-label="Discover"
            className={`social-tab-link flex min-w-0 flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              activeTab === "discover"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <Globe size={15} />
            <span className="social-tab-label">Discover</span>
            <span
              className={`social-tab-count inline-flex rounded-full px-2 py-0.5 text-[0.72rem] font-semibold ${
                activeTab === "discover"
                  ? "bg-white/15 text-white"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {publicUsers.length}
            </span>
          </Link>

          <Link
            to={buildSocialPath("requests", searchQuery)}
            aria-label="Requests"
            className={`social-tab-link flex min-w-0 flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              activeTab === "requests"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <Users size={15} />
            <span className="social-tab-label">Requests</span>
            <span
              className={`social-tab-count inline-flex rounded-full px-2 py-0.5 text-[0.72rem] font-semibold ${
                activeTab === "requests"
                  ? "bg-white/15 text-white"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {incomingRequests.length}
            </span>
          </Link>

          <Link
            to={buildSocialPath("buddies", searchQuery)}
            aria-label="Buddies"
            className={`social-tab-link flex min-w-0 flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              activeTab === "buddies"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <UserCheck size={15} />
            <span className="social-tab-label">Buddies</span>
            <span
              className={`social-tab-count inline-flex rounded-full px-2 py-0.5 text-[0.72rem] font-semibold ${
                activeTab === "buddies"
                  ? "bg-white/15 text-white"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {acceptedBuddies.length}
            </span>
          </Link>
        </div>

        <Form method="get" className="w-full lg:ml-auto lg:w-auto">
          {activeTab !== "discover" ? <input type="hidden" name="tab" value={activeTab} /> : null}
          <div className="flex items-center gap-2 lg:justify-end">
            <div className="relative min-w-0 flex-1 lg:w-80">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                <Search size={16} />
              </span>
              <input
                type="search"
                name="q"
                defaultValue={searchQuery}
                placeholder="Search by name"
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
              />
            </div>
            <button
              type="submit"
              className="inline-flex shrink-0 items-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Search
            </button>
            {searchQuery ? (
              <Link
                to={buildSocialPath(activeTab, "")}
                className="inline-flex shrink-0 items-center rounded-xl border border-transparent px-3 py-2.5 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              >
                Clear
              </Link>
            ) : null}
          </div>
        </Form>
      </div>

      {activeTab === "requests" && incomingRequests.length > 0 ? (
        <section>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {incomingRequests.map((request) => {
              const initials = initialsFor(request.sender.displayName);
              const isSubmitting =
                navigation.state === "submitting" &&
                activeIntent === "accept" &&
                activeRequestId === request.id;

              return (
                <div
                  key={request.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="h-11 w-11 shrink-0 select-none rounded-full border-2 border-indigo-100 bg-indigo-50 flex items-center justify-center text-base font-bold text-indigo-600">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {publicName(request.sender.displayName)}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Requested on {new Date(request.createdAt).toLocaleDateString("en-US")}
                      </p>
                    </div>
                  </div>

                  <Form method="post" preventScrollReset>
                    <input type="hidden" name="intent" value="accept" />
                    <input type="hidden" name="requestId" value={request.id} />
                    <input type="hidden" name="tab" value="requests" />
                    <input type="hidden" name="q" value={searchQuery} />
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Check size={15} />
                      {isSubmitting ? "Accepting..." : "Accept"}
                    </button>
                  </Form>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {activeTab === "requests" && incomingRequests.length === 0 ? (
        <div className="flex flex-col items-center justify-center space-y-3 rounded-2xl border border-slate-200 bg-white py-24 text-center">
          <div className="h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center">
            <Users size={24} className="text-slate-400" />
          </div>
          <p className="text-base font-semibold text-slate-700">{requestsEmptyTitle}</p>
          <p className="max-w-xs text-sm text-slate-500">{requestsEmptyMessage}</p>
        </div>
      ) : null}

      {activeTab === "buddies" && acceptedBuddies.length === 0 ? (
        <div className="flex flex-col items-center justify-center space-y-3 rounded-2xl border border-slate-200 bg-white py-24 text-center">
          <div className="h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center">
            <UserCheck size={24} className="text-slate-400" />
          </div>
          <p className="text-base font-semibold text-slate-700">{buddiesEmptyTitle}</p>
          <p className="max-w-xs text-sm text-slate-500">{buddiesEmptyMessage}</p>
        </div>
      ) : null}

      {activeTab === "buddies" && acceptedBuddies.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {acceptedBuddies.map((buddy) => {
            const initials = initialsFor(buddy.displayName);

            return (
              <div
                key={buddy.id}
                className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:border-emerald-100 hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 shrink-0 select-none rounded-full border-2 border-emerald-100 bg-emerald-50 flex items-center justify-center text-base font-bold text-emerald-600">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {publicName(buddy.displayName)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[0.75rem] font-medium text-emerald-700">
                    <Check size={11} />
                    Accepted buddy
                  </span>
                  {buddy.isPublic ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-sky-100 bg-sky-50 px-2 py-0.5 text-[0.75rem] font-medium text-sky-700">
                      <Globe size={11} />
                      Public profile
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-100 bg-slate-50 px-2 py-0.5 text-[0.75rem] font-medium text-slate-500">
                      <Lock size={11} />
                      Private profile
                    </span>
                  )}
                </div>

                <div className="mt-auto space-y-1 text-xs text-slate-500">
                  <p>Connected on {new Date(buddy.connectedAt).toLocaleDateString("en-US")}</p>
                  <p>Member since {new Date(buddy.createdAt).getFullYear()}</p>
                </div>

                <Link
                  to={`/dashboard/courses?view=${buddy.id}`}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                >
                  <BookOpen size={13} />
                  View Courses
                </Link>
              </div>
            );
          })}
        </div>
      ) : null}

      {activeTab === "discover" && publicUsers.length === 0 ? (
        <div className="flex flex-col items-center justify-center space-y-3 rounded-2xl border border-slate-200 bg-white py-24 text-center">
          <div className="h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center">
            <Lock size={24} className="text-slate-400" />
          </div>
          <p className="text-base font-semibold text-slate-700">{discoverEmptyTitle}</p>
          <p className="max-w-xs text-sm text-slate-500">{discoverEmptyMessage}</p>
        </div>
      ) : null}

      {activeTab === "discover" && publicUsers.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {publicUsers.map((user) => {
            const initials = initialsFor(user.displayName);
            const joinYear = new Date(user.createdAt).getFullYear();
            const isSubmitting =
              navigation.state === "submitting" &&
              activeIntent === "send" &&
              activeTargetUserId === user.id;

            return (
              <div
                key={user.id}
                className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:border-indigo-100 hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 shrink-0 select-none rounded-full border-2 border-indigo-100 bg-indigo-50 flex items-center justify-center text-base font-bold text-indigo-600">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {publicName(user.displayName)}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-400">Member since {joinYear}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[0.75rem] font-medium text-emerald-700">
                    <Globe size={11} />
                    Public
                  </span>
                  {user.acceptRequests ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-sky-100 bg-sky-50 px-2 py-0.5 text-[0.75rem] font-medium text-sky-700">
                      <UserCheck size={11} />
                      Accepting requests
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-100 bg-slate-50 px-2 py-0.5 text-[0.75rem] font-medium text-slate-500">
                      <Lock size={11} />
                      Not accepting
                    </span>
                  )}
                </div>

                <div className="mt-auto">
                  {user.relation === "outgoing" ? (
                    <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600">
                      <Clock3 size={15} />
                      Request sent
                    </div>
                  ) : null}

                  {user.relation === "incoming" ? (
                    <div className="inline-flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">
                      <UserCheck size={15} />
                      Incoming request
                    </div>
                  ) : null}

                  {user.relation === "closed" ? (
                    <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-500">
                      <Lock size={15} />
                      Requests unavailable
                    </div>
                  ) : null}

                  {user.relation === "available" ? (
                    <Form method="post" preventScrollReset>
                      <input type="hidden" name="intent" value="send" />
                      <input type="hidden" name="targetUserId" value={user.id} />
                      <input type="hidden" name="tab" value="discover" />
                      <input type="hidden" name="q" value={searchQuery} />
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <UserPlus size={15} />
                        {isSubmitting ? "Sending..." : "Send buddy request"}
                      </button>
                    </Form>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

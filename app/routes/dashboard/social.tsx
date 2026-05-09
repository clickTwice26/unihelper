import { useLoaderData } from "react-router";
import { Globe, UserCheck, Lock } from "lucide-react";

import type { Route } from "./+types/social";

export function meta() {
  return [{ title: "Social | Unihelper" }];
}

// ── Loader ──────────────────────────────────────────────────────────────────

export async function loader({ request }: Route.LoaderArgs) {
  const { getAuthenticatedUser } = await import("~/lib/auth.server");
  const { redirect } = await import("react-router");
  const { db } = await import("~/lib/db.server");

  const session = await getAuthenticatedUser(request);
  if (!session) throw redirect("/login");

  const publicUsers = await db.user.findMany({
    where: { isPublic: true },
    select: {
      id: true,
      displayName: true,
      email: true,
      acceptRequests: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return { publicUsers, currentUserId: session.id };
}

// ── Component ────────────────────────────────────────────────────────────────

export default function SocialPage() {
  const { publicUsers, currentUserId } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div className="space-y-1">
        <p className="eyebrow">Discover</p>
        <h1 className="type-heading-lg text-slate-900">Social</h1>
        <p className="type-body-md max-w-xl text-slate-500">
          Browse members who have made their profiles publicly visible.
        </p>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Globe size={15} className="text-indigo-500" />
        <span>
          <span className="font-semibold text-slate-800">{publicUsers.length}</span>{" "}
          {publicUsers.length === 1 ? "member" : "members"} with public profiles
        </span>
      </div>

      {/* Grid */}
      {publicUsers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-slate-200 text-center space-y-3">
          <div className="h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center">
            <Lock size={24} className="text-slate-400" />
          </div>
          <p className="text-base font-semibold text-slate-700">No public profiles yet</p>
          <p className="text-sm text-slate-500 max-w-xs">
            When members turn on public visibility in their profile settings, they'll appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {publicUsers.map((u) => {
            const initials = (u.displayName ?? u.email).slice(0, 2).toUpperCase();
            const isYou = u.id === currentUserId;
            const joinYear = new Date(u.createdAt).getFullYear();

            return (
              <div
                key={u.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col gap-4 hover:shadow-md hover:border-indigo-100 transition-all"
              >
                {/* Avatar + name */}
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-full bg-indigo-50 border-2 border-indigo-100 flex items-center justify-center text-base font-bold text-indigo-600 shrink-0 select-none">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {u.displayName ?? u.email}
                      </p>
                      {isYou && (
                        <span className="text-[0.7rem] font-semibold bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full leading-none">
                          You
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      Member since {joinYear}
                    </p>
                  </div>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 text-[0.75rem] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full">
                    <Globe size={11} />
                    Public
                  </span>
                  {u.acceptRequests ? (
                    <span className="inline-flex items-center gap-1 text-[0.75rem] font-medium bg-sky-50 text-sky-700 border border-sky-100 px-2 py-0.5 rounded-full">
                      <UserCheck size={11} />
                      Accepting requests
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[0.75rem] font-medium bg-slate-50 text-slate-500 border border-slate-100 px-2 py-0.5 rounded-full">
                      <Lock size={11} />
                      Not accepting
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useLoaderData } from "react-router";

import type { Route } from "./+types/home";
import { db } from "~/lib/db.server";

export function meta() {
  return [{ title: "Dashboard | Unihelper" }];
}

export async function loader(_: Route.LoaderArgs) {
  const now = new Date();

  const [userCount, activeSessionCount] = await Promise.all([
    db.user.count(),
    db.session.count({ where: { expiresAt: { gt: now } } }),
  ]);

  return { userCount, activeSessionCount };
}

const stats = (userCount: number, activeSessionCount: number) => [
  {
    label: "Total Users",
    value: userCount,
    sub: "registered accounts",
    color: "emerald",
  },
  {
    label: "Active Sessions",
    value: activeSessionCount,
    sub: "valid right now",
    color: "sky",
  },
  {
    label: "Database",
    value: "Online",
    sub: "PostgreSQL via Prisma",
    color: "violet",
  },
  {
    label: "Cache",
    value: "Online",
    sub: "Redis via ioredis",
    color: "amber",
  },
];

export default function DashboardHome() {
  const { userCount, activeSessionCount } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <p className="eyebrow">Overview</p>
        <h1 className="type-heading-lg text-slate-900">Welcome to your workspace</h1>
        <p className="type-body-md max-w-xl text-slate-500">
          Your infrastructure is running. Start building features, not scaffolding.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats(userCount, activeSessionCount).map((stat) => (
          <div key={stat.label} className={`dash-stat-card dash-stat-${stat.color}`}>
            <p className="type-caption text-slate-500">{stat.label}</p>
            <p className="dash-stat-value">{stat.value}</p>
            <p className="type-caption text-slate-400">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Two-column detail */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="surface-panel space-y-4 p-6">
          <p className="eyebrow">Stack</p>
          <dl className="type-body-sm space-y-3 text-slate-700">
            {[
              ["Framework", "React Router v7 (framework mode)"],
              ["ORM", "Prisma 6 + PostgreSQL"],
              ["Cache", "Redis via ioredis"],
              ["Auth", "scrypt sessions + cookie store"],
              ["Infra", "Docker Compose (local)"],
            ].map(([k, v]) => (
              <div key={k} className="metric-row">
                <dt className="text-slate-500">{k}</dt>
                <dd className="text-right text-slate-800">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="surface-panel space-y-4 p-6">
          <p className="eyebrow">Next Steps</p>
          <ul className="type-body-sm space-y-3 text-slate-700">
            {[
              "Model your first bounded context in prisma/schema.prisma",
              "Place server-only domain logic in app/lib/*.server.ts",
              "Add protected feature routes inside the dashboard layout",
              "Wire Redis for rate limiting, caching, or job queues",
              "Add email verification and magic link flows",
            ].map((step) => (
              <li key={step} className="flex items-start gap-3">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-emerald-500" />
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

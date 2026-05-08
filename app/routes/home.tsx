import { useLoaderData } from "react-router";

import type { Route } from "./+types/home";

export function meta({ data }: Route.MetaArgs) {
  return [
    { title: `${data?.appName ?? "Unihelper"} | Full-Stack Platform` },
    {
      name: "description",
      content:
        "Production-grade Remix-style project structure built on React Router, PostgreSQL, Redis, Prisma, and Docker.",
    },
  ];
}

export async function loader() {
  const { env } = await import("~/lib/env.server");

  return {
    appName: env.APP_NAME,
    environment: env.NODE_ENV,
    services: [
      "React Router framework mode for Remix-style full-stack routing",
      "Prisma ORM with PostgreSQL as the system of record",
      "Redis for cache, queues, rate-limits, and ephemeral state",
      "Docker Compose for reproducible local infrastructure",
    ],
  };
}

export default function Home() {
  const data = useLoaderData<typeof loader>();

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-10 sm:px-8 lg:px-10">
      <section id="overview" className="hero-grid gap-8 scroll-mt-28">
        <div className="surface-panel space-y-8 p-8 sm:p-10">
          <div className="space-y-4">
            <p className="eyebrow">Full-Stack Foundation</p>
            <h1 className="type-display-hero max-w-3xl text-slate-900">
              {data.appName} is ready for product work, not template cleanup.
            </h1>
            <p className="type-body-lg max-w-2xl text-slate-600">
              The app is structured for server-rendered UI, background-safe server modules,
              operational health checks, PostgreSQL persistence, and Redis-backed runtime
              concerns.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {data.services.map((service) => (
              <article key={service} className="feature-card">
                <p>{service}</p>
              </article>
            ))}
          </div>
        </div>

        <aside className="space-y-6">
          <section id="runtime" className="surface-panel scroll-mt-28 p-6">
            <p className="eyebrow">Runtime</p>
            <dl className="type-body-sm mt-5 space-y-4 text-slate-700">
              <div className="metric-row">
                <dt>Environment</dt>
                <dd>{data.environment}</dd>
              </div>
              <div className="metric-row">
                <dt>Liveness probe</dt>
                <dd>/health</dd>
              </div>
              <div className="metric-row">
                <dt>Readiness probe</dt>
                <dd>/ready</dd>
              </div>
              <div className="metric-row">
                <dt>Database</dt>
                <dd>PostgreSQL via Prisma</dd>
              </div>
              <div className="metric-row">
                <dt>Cache</dt>
                <dd>Redis via ioredis</dd>
              </div>
            </dl>
          </section>

          <section id="next-steps" className="surface-panel scroll-mt-28 p-6">
            <p className="eyebrow">Suggested Next Moves</p>
            <ul className="type-body-sm mt-5 space-y-3 text-slate-700">
              <li>Model your first bounded context in prisma/schema.prisma.</li>
              <li>Place server-only domain logic in app/lib/*.server.ts modules.</li>
              <li>Introduce feature routes behind authenticated layouts as the product grows.</li>
            </ul>
          </section>
        </aside>
      </section>
    </main>
  );
}

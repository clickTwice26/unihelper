import { getReadinessReport } from "~/lib/health.server";

export async function loader() {
  const report = await getReadinessReport();

  return Response.json(report, {
    headers: {
      "Cache-Control": "no-store",
    },
    status: report.status === "ok" ? 200 : 503,
  });
}
/**
 * GET /api/search?q=<query>
 *
 * Returns JSON array of SearchResult objects for the authenticated user.
 * Rate limited to 120 requests/min per user (one per ~500ms keystroke burst).
 */
import type { Route } from "./+types/api.search";

export async function loader({ request }: Route.LoaderArgs) {
  const { getAuthenticatedUser } = await import("~/lib/auth.server");
  const { rateLimit } = await import("~/lib/ratelimit.server");
  const { globalSearch } = await import("~/lib/search.server");

  const user = await getAuthenticatedUser(request);
  if (!user) return Response.json([], { status: 401 });

  // Let 429 propagate naturally — useFetcher handles it gracefully
  await rateLimit({ key: `search:${user.id}`, limit: 120, windowSec: 60 });

  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";

  const results = await globalSearch(user.id, query);
  return Response.json(results);
}

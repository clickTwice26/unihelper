import type { Route } from "./+types/logout";

export async function action({ request }: Route.ActionArgs) {
  const { destroyUserSession } = await import("~/lib/auth.server");

  return destroyUserSession(request, "/");
}
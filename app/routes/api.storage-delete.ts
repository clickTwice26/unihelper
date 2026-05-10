/**
 * POST /api/storage/delete
 * Authenticated action to delete a personal file.
 */
import type { Route } from "./+types/api.storage-delete";

export async function action({ request }: Route.ActionArgs) {
  const { getAuthenticatedUser } = await import("~/lib/auth.server");
  const { rateLimit } = await import("~/lib/ratelimit.server");
  const { deletePersonalFile } = await import("~/lib/personal-storage.server");
  const { serializeFlash } = await import("~/lib/flash.server");
  const { redirect } = await import("react-router");

  const user = await getAuthenticatedUser(request);
  if (!user) return new Response("Unauthorized", { status: 401 });

  await rateLimit({ key: `storage-delete:${user.id}`, limit: 30, windowSec: 60 });

  const formData = await request.formData();
  const fileId = String(formData.get("fileId") ?? "").trim();
  if (!fileId) return new Response("Bad Request", { status: 400 });

  const headers = new Headers();

  try {
    await deletePersonalFile(user.id, fileId);
    headers.append("Set-Cookie", await serializeFlash({ type: "success", message: "File deleted." }));
  } catch {
    headers.append("Set-Cookie", await serializeFlash({ type: "error", message: "Failed to delete file." }));
  }

  throw redirect("/dashboard/storage", { headers });
}

/**
 * GET /share/file/:token
 * Public route — redirects to R2 public URL for sharing.
 * No authentication required; anyone with the link can download.
 */
import type { Route } from "./+types/share-file";

export async function loader({ params }: Route.LoaderArgs) {
  const { redirect } = await import("react-router");
  const { getPersonalFileByToken } = await import("~/lib/personal-storage.server");
  const { env } = await import("~/lib/env.server");

  const token = params.token?.trim();
  if (!token) throw new Response("Not Found", { status: 404 });

  const file = await getPersonalFileByToken(token);
  if (!file) throw new Response("Not Found", { status: 404 });

  const publicUrl = `${env.R2_PUBLIC_URL}/${file.key}`;
  const safeName = encodeURIComponent(file.name);

  // Redirect to R2 public URL — browser handles download/preview
  return redirect(publicUrl + `?response-content-disposition=attachment%3B%20filename*%3DUTF-8''${safeName}`);
}

/**
 * /dashboard/courses/:courseId/files/:fileId
 *
 * Redirects the user to a public R2 download URL for the given file.
 * Access is verified (owner or accepted buddy) before handing out the URL.
 */
import type { Route } from "./+types/course-file";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { getAuthenticatedUser } = await import("~/lib/auth.server");
  const { redirect } = await import("react-router");
  const { db } = await import("~/lib/db.server");
  const { canAccessCourses } = await import("~/lib/course.server");
  const { getPublicDownloadUrl } = await import("~/lib/storage.server");

  const session = await getAuthenticatedUser(request);
  if (!session) throw redirect("/login");

  const { courseId, fileId } = params;
  if (!courseId || !fileId) throw new Response("Bad Request", { status: 400 });

  const file = await db.courseFile.findUnique({
    where: { id: fileId },
    include: { course: true },
  });

  if (!file || file.courseId !== courseId) {
    throw new Response("Not Found", { status: 404 });
  }

  if (file.isFolder) {
    throw new Response("Not a downloadable file", { status: 400 });
  }

  const allowed = await canAccessCourses(session.id, file.course.ownerId);
  if (!allowed) throw new Response("Forbidden", { status: 403 });

  const url = getPublicDownloadUrl(file.key);
  throw redirect(url, { status: 302 });
}

// This route only has a loader — no UI is ever rendered.
export default function CourseFilePage() {
  return null;
}

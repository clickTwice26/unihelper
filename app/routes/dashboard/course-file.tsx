/**
 * /dashboard/courses/:courseId/files/:fileId
 *
 * - Default: redirects to the public R2 URL (for preview in <img>, <video>, <iframe>).
 * - ?download=1: generates a presigned URL with Content-Disposition: attachment so
 *   the browser saves the file instead of opening it.
 *
 * Access is verified (owner or accepted buddy) before handing out any URL.
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

  const url = new URL(request.url);
  const isDownload = url.searchParams.get("download") === "1";

  if (isDownload) {
    // Generate a short-lived presigned URL that forces the browser to save the file.
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const { getR2Client } = await import("~/lib/r2.server");
    const { env } = await import("~/lib/env.server");

    const safeFileName = file.name.replace(/"/g, "'");
    const signedUrl = await getSignedUrl(
      getR2Client(),
      new GetObjectCommand({
        Bucket: env.R2_BUCKET,
        Key: file.key,
        ResponseContentDisposition: `attachment; filename="${safeFileName}"`,
      }),
      { expiresIn: 300 },
    );
    throw redirect(signedUrl, { status: 302 });
  }

  // Default: redirect to public URL (browser handles display)
  throw redirect(getPublicDownloadUrl(file.key), { status: 302 });
}

export default function CourseFilePage() {
  return null;
}


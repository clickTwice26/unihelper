import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

import { db } from "~/lib/db.server";
import { env } from "~/lib/env.server";
import { getR2Client } from "~/lib/r2.server";

export const COURSE_STORAGE_LIMIT_BYTES = 500 * 1024 * 1024; // 500 MB
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB per upload

// ── Path helpers ──────────────────────────────────────────────────────────────

/** Normalise a user-supplied path, preventing traversal. Returns "/", "/Folder/" etc. */
export function sanitizeStoragePath(raw: string): string {
  const parts = raw
    .split("/")
    .filter((p) => p.length > 0 && p !== "." && p !== "..");
  return parts.length === 0 ? "/" : `/${parts.join("/")}/`;
}

/** Sanitise a file/folder name — strips slashes and limits length. */
function sanitizeName(raw: string): string {
  return raw.replace(/[/\\]/g, "").trim().slice(0, 200);
}

/** Full R2 key for a file living at `path` inside a course. */
function buildKey(courseId: string, path: string, name: string): string {
  return `courses/${courseId}${path}${name}`;
}

/** Key prefix for all files in a course. */
function coursePrefix(courseId: string): string {
  return `courses/${courseId}/`;
}

// ── Access helper ─────────────────────────────────────────────────────────────

async function assertAccess(actorId: string, courseId: string) {
  const { canAccessCourses } = await import("~/lib/course.server");
  const course = await db.course.findUnique({ where: { id: courseId } });
  if (!course) throw new Error("COURSE_NOT_FOUND");
  const ok = await canAccessCourses(actorId, course.ownerId);
  if (!ok) throw new Error("FORBIDDEN");
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function getCourseStorageUsage(courseId: string): Promise<number> {
  const agg = await db.courseFile.aggregate({
    where: { courseId, isFolder: false },
    _sum: { size: true },
  });
  return agg._sum.size ?? 0;
}

export async function listCourseFiles(courseId: string, path: string) {
  return db.courseFile.findMany({
    where: { courseId, path },
    orderBy: [{ isFolder: "desc" }, { name: "asc" }],
  });
}

// ── Operations ────────────────────────────────────────────────────────────────

export async function createFolder(
  actorId: string,
  courseId: string,
  path: string,
  rawName: string,
) {
  await assertAccess(actorId, courseId);

  const name = sanitizeName(rawName);
  if (!name) throw new Error("INVALID_NAME");

  const existing = await db.courseFile.findFirst({
    where: { courseId, path, name, isFolder: true },
  });
  if (existing) throw new Error("ALREADY_EXISTS");

  // Folders don't create an R2 object — they're purely DB records.
  const key = buildKey(courseId, path, `${name}/`);
  await db.courseFile.create({
    data: { courseId, key, name, path, isFolder: true, size: 0 },
  });
}

type UploadableFile = {
  name: string;
  size: number;
  type: string;
  arrayBuffer(): Promise<ArrayBuffer>;
};

export async function uploadFile(
  actorId: string,
  courseId: string,
  path: string,
  file: UploadableFile,
): Promise<void> {
  await assertAccess(actorId, courseId);

  if (file.size === 0) throw new Error("EMPTY_FILE");
  if (file.size > MAX_FILE_SIZE_BYTES) throw new Error("FILE_TOO_LARGE");

  const usage = await getCourseStorageUsage(courseId);
  if (usage + file.size > COURSE_STORAGE_LIMIT_BYTES) throw new Error("STORAGE_LIMIT_EXCEEDED");

  const name = sanitizeName(file.name) || "untitled";
  const key = buildKey(courseId, path, name);

  const buffer = Buffer.from(await file.arrayBuffer());
  const r2 = getR2Client();
  await r2.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: file.type || "application/octet-stream",
      ContentLength: file.size,
    }),
  );

  await db.courseFile.upsert({
    where: { courseId_key: { courseId, key } },
    create: {
      courseId,
      key,
      name,
      path,
      isFolder: false,
      size: file.size,
      mimeType: file.type || null,
    },
    update: { size: file.size, mimeType: file.type || null },
  });
}

export async function deleteStorageItem(actorId: string, fileId: string): Promise<void> {
  const item = await db.courseFile.findUnique({
    where: { id: fileId },
    include: { course: true },
  });
  if (!item) throw new Error("NOT_FOUND");

  await assertAccess(actorId, item.courseId);

  const r2 = getR2Client();

  if (item.isFolder) {
    // Recursively delete everything inside this folder
    const folderChildPath = `${item.path}${item.name}/`;
    const children = await db.courseFile.findMany({
      where: {
        courseId: item.courseId,
        path: { startsWith: folderChildPath },
        isFolder: false,
      },
    });

    if (children.length > 0) {
      await r2.send(
        new DeleteObjectsCommand({
          Bucket: env.R2_BUCKET,
          Delete: {
            Objects: children.map((c) => ({ Key: c.key })),
            Quiet: true,
          },
        }),
      );
    }

    await db.courseFile.deleteMany({
      where: {
        courseId: item.courseId,
        path: { startsWith: folderChildPath },
      },
    });
  } else {
    await r2.send(
      new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: item.key }),
    );
  }

  await db.courseFile.delete({ where: { id: fileId } });
}

/** Returns the public download URL for a file. */
export function getPublicDownloadUrl(key: string): string {
  // Strip trailing slash from public URL just in case
  const base = env.R2_PUBLIC_URL.replace(/\/$/, "");
  return `${base}/${key}`;
}

/** Human-readable file size string. */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

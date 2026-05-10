import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { db } from "~/lib/db.server";
import { env } from "~/lib/env.server";
import { getR2Client } from "~/lib/r2.server";

export const PERSONAL_STORAGE_LIMIT_BYTES = 100 * 1024 * 1024; // 100 MB
export const PERSONAL_MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB per file

export async function getPersonalStorageUsage(userId: string): Promise<number> {
  const agg = await db.personalFile.aggregate({
    where: { userId },
    _sum: { size: true },
  });
  return agg._sum.size ?? 0;
}

export async function listPersonalFiles(userId: string) {
  return db.personalFile.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      key: true,
      name: true,
      size: true,
      mimeType: true,
      shareToken: true,
      createdAt: true,
    },
  });
}

type UploadInput = {
  name: string;
  size: number;
  mimeType: string;
  arrayBuffer(): Promise<ArrayBuffer>;
};

export async function uploadPersonalFile(
  userId: string,
  file: UploadInput,
): Promise<{ id: string; shareToken: string }> {
  if (file.size === 0) throw new Error("EMPTY_FILE");
  if (file.size > PERSONAL_MAX_FILE_BYTES) throw new Error("FILE_TOO_LARGE");

  const usage = await getPersonalStorageUsage(userId);
  if (usage + file.size > PERSONAL_STORAGE_LIMIT_BYTES) {
    throw new Error("STORAGE_LIMIT_EXCEEDED");
  }

  // Safe name: strip slashes and limit length
  const safeName = file.name.replace(/[/\\]/g, "").trim().slice(0, 200) || "untitled";

  // Create DB record first so we can use its id in the key
  const record = await db.personalFile.create({
    data: {
      userId,
      key: "pending", // will update below
      name: safeName,
      size: file.size,
      mimeType: file.mimeType || null,
    },
  });

  const key = `personal/${userId}/${record.id}/${safeName}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const r2 = getR2Client();
  await r2.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: file.mimeType || "application/octet-stream",
      ContentLength: file.size,
    }),
  );

  await db.personalFile.update({ where: { id: record.id }, data: { key } });

  return { id: record.id, shareToken: record.shareToken };
}

export async function deletePersonalFile(userId: string, fileId: string): Promise<void> {
  const file = await db.personalFile.findUnique({ where: { id: fileId } });
  if (!file || file.userId !== userId) throw new Error("NOT_FOUND");

  const r2 = getR2Client();
  try {
    await r2.send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: file.key }));
  } catch {
    // proceed even if R2 delete fails
  }

  await db.personalFile.delete({ where: { id: fileId } });
}

export async function getPersonalFileByToken(shareToken: string) {
  return db.personalFile.findUnique({
    where: { shareToken },
    select: { id: true, key: true, name: true, mimeType: true, userId: true },
  });
}

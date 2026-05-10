import { db } from "~/lib/db.server";

export type CourseData = {
  title: string;
  creditHours: number;
  teacherName: string;
  teacherInfo?: string | null;
  teacherEmail?: string | null;
  teacherPhone?: string | null;
  blcLink?: string | null;
  groupLink?: string | null;
};

function canonicalPairKey(a: string, b: string) {
  const [userAId, userBId] = [a, b].sort();
  return `${userAId}:${userBId}`;
}

/** Returns true if the viewer may read and write courses owned by ownerId. */
export async function canAccessCourses(
  viewerId: string,
  ownerId: string,
): Promise<boolean> {
  if (viewerId === ownerId) return true;
  const pairKey = canonicalPairKey(viewerId, ownerId);
  const connection = await db.buddyConnection.findUnique({ where: { pairKey } });
  return connection !== null;
}

export const COURSES_PAGE_SIZE = 20;

export async function getCourses(
  viewerId: string,
  ownerId: string,
  page = 0,
): Promise<{ courses: Awaited<ReturnType<typeof db.course.findMany>>; totalCount: number }> {
  if (!(await canAccessCourses(viewerId, ownerId))) {
    throw new Error("FORBIDDEN");
  }
  const where = { ownerId, deletedAt: null };
  const [courses, totalCount] = await Promise.all([
    db.course.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: page * COURSES_PAGE_SIZE,
      take: COURSES_PAGE_SIZE,
    }),
    db.course.count({ where }),
  ]);
  return { courses, totalCount };
}

export async function createCourse(
  actorId: string,
  ownerId: string,
  data: CourseData,
) {
  if (!(await canAccessCourses(actorId, ownerId))) {
    throw new Error("FORBIDDEN");
  }
  return db.course.create({ data: { ...data, ownerId } });
}

export async function updateCourse(
  actorId: string,
  courseId: string,
  data: CourseData,
) {
  const course = await db.course.findUnique({ where: { id: courseId, deletedAt: null } });
  if (!course) throw new Error("NOT_FOUND");
  if (!(await canAccessCourses(actorId, course.ownerId))) {
    throw new Error("FORBIDDEN");
  }
  return db.course.update({ where: { id: courseId }, data });
}

export async function deleteCourse(actorId: string, courseId: string) {
  const course = await db.course.findUnique({ where: { id: courseId, deletedAt: null } });
  if (!course) throw new Error("NOT_FOUND");
  if (!(await canAccessCourses(actorId, course.ownerId))) {
    throw new Error("FORBIDDEN");
  }
  // Soft delete — data is retained and can be purged by a scheduled job
  return db.course.update({ where: { id: courseId }, data: { deletedAt: new Date() } });
}

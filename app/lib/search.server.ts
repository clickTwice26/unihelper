/**
 * Global search library.
 *
 * Data visibility rules:
 *  - Courses + course files/storage : viewer's own + accepted buddies (shareable data)
 *  - Tasks                          : viewer's own only
 *  - Routine entries                : viewer's own only
 *  - Expenses / Health              : EXCLUDED — explicitly private per project policy
 *
 * Buddy access is validated by querying BuddyConnection directly, matching
 * the same pairKey semantics used everywhere else in the app.
 */

import { db } from "~/lib/db.server";

export type SearchResultType = "course" | "file" | "task" | "routine";

export type SearchResult = {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string;
  /** href ready for <Link to={...}> */
  href: string;
  /** Non-null when this result belongs to a buddy, not the viewer */
  ownerLabel: string | null;
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export async function globalSearch(
  viewerId: string,
  query: string,
): Promise<SearchResult[]> {
  const q = query.trim().slice(0, 100);
  if (q.length < 2) return [];

  // ── Resolve accepted buddies ──────────────────────────────────────────────
  const connections = await db.buddyConnection.findMany({
    where: { OR: [{ userAId: viewerId }, { userBId: viewerId }] },
    select: {
      userAId: true,
      userBId: true,
      userA: { select: { id: true, displayName: true } },
      userB: { select: { id: true, displayName: true } },
    },
  });

  const buddies = connections.map((c) =>
    c.userAId === viewerId ? c.userB : c.userA,
  );
  const buddyIds = buddies.map((b) => b.id);
  const buddyNameMap = new Map(
    buddies.map((b) => [b.id, b.displayName?.trim() || "Buddy"]),
  );

  // Accessible owner IDs for course-based data
  const allOwnerIds = [viewerId, ...buddyIds];
  const contains = { contains: q, mode: "insensitive" as const };

  // ── Parallel DB queries ───────────────────────────────────────────────────
  const [courses, files, tasks, routines] = await Promise.all([
    // Courses: viewer + buddies
    db.course.findMany({
      where: {
        ownerId: { in: allOwnerIds },
        OR: [{ title: contains }, { teacherName: contains }],
      },
      select: {
        id: true,
        title: true,
        teacherName: true,
        creditHours: true,
        ownerId: true,
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),

    // Course files / storage: viewer + buddies, non-folders only
    db.courseFile.findMany({
      where: {
        isFolder: false,
        name: contains,
        course: { ownerId: { in: allOwnerIds } },
      },
      select: {
        id: true,
        name: true,
        courseId: true,
        course: { select: { title: true, ownerId: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),

    // Tasks: viewer's own only (no buddy task view exists in the UI)
    db.task.findMany({
      where: {
        userId: viewerId,
        OR: [{ title: contains }, { notes: contains }],
      },
      select: { id: true, title: true, status: true, deadline: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),

    // Routine: viewer's own only
    db.classRoutine.findMany({
      where: {
        userId: viewerId,
        OR: [{ courseName: contains }, { room: contains }],
      },
      select: {
        id: true,
        courseName: true,
        room: true,
        dayOfWeek: true,
        startTime: true,
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      take: 5,
    }),
  ]);

  // ── Build result list ─────────────────────────────────────────────────────
  const results: SearchResult[] = [];

  for (const c of courses) {
    const isOwn = c.ownerId === viewerId;
    results.push({
      id: `course-${c.id}`,
      type: "course",
      title: c.title,
      subtitle: `${c.creditHours} cr · ${c.teacherName}`,
      href: `/dashboard/courses/${c.id}${isOwn ? "" : `?view=${c.ownerId}`}`,
      ownerLabel: isOwn ? null : (buddyNameMap.get(c.ownerId) ?? "Buddy"),
    });
  }

  for (const f of files) {
    const isOwn = f.course.ownerId === viewerId;
    results.push({
      id: `file-${f.id}`,
      type: "file",
      title: f.name,
      subtitle: f.course.title,
      href: `/dashboard/courses/${f.courseId}/files/${f.id}`,
      ownerLabel: isOwn ? null : (buddyNameMap.get(f.course.ownerId) ?? "Buddy"),
    });
  }

  for (const t of tasks) {
    const deadlineLabel = t.deadline
      ? new Date(t.deadline).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        })
      : t.status.replace(/_/g, " ");
    results.push({
      id: `task-${t.id}`,
      type: "task",
      title: t.title,
      subtitle: deadlineLabel,
      href: "/dashboard/tasks",
      ownerLabel: null,
    });
  }

  for (const r of routines) {
    results.push({
      id: `routine-${r.id}`,
      type: "routine",
      title: r.courseName,
      subtitle: `${DAY_LABELS[r.dayOfWeek] ?? ""} · ${r.startTime}${r.room ? ` · ${r.room}` : ""}`,
      href: "/dashboard/routine",
      ownerLabel: null,
    });
  }

  return results;
}

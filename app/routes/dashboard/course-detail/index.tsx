import { useState } from "react";
import { Form, Link, useLoaderData, useNavigation, useSearchParams } from "react-router";
import {
  ArrowLeft,
  BookMarked,
  BookOpen,
  ClipboardCheck,
  ClipboardList,
  Edit2,
  FileText,
  GraduationCap,
  HardDrive,
  Info,
  Link2,
  Mail,
  Monitor,
  Phone,
  Trash2,
  User,
} from "lucide-react";

import type { Route } from "./+types/index";
import { CustomSelect } from "~/components/ui/select";

import { EditModal } from "./components/EditModal";
import { AssignmentTab } from "./tabs/AssignmentTab";
import { AttendanceTab } from "./tabs/AttendanceTab";
import { ExamTab } from "./tabs/ExamTab";
import { LinksTab } from "./tabs/LinksTab";
import { PresentationTab } from "./tabs/PresentationTab";
import { QuizTab } from "./tabs/QuizTab";
import { StorageTab } from "./tabs/StorageTab";
import { validTabs } from "./types";
import type {
  AssignmentEntry,
  CourseLinkEntry,
  ExamEntry,
  ExamMockData,
  PresentationEntry,
  QuizEntry,
  StorageFile,
  Tab,
} from "./types";

export function meta({ data }: Route.MetaArgs) {
  const title = (data as { course?: { title?: string } } | undefined)?.course?.title;
  return [{ title: title ? `${title} | UniBuddy` : "Course | UniBuddy" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { getAuthenticatedUser } = await import("~/lib/auth.server");
  const { redirect } = await import("react-router");
  const { canAccessCourses } = await import("~/lib/course.server");
  const { db } = await import("~/lib/db.server");

  const session = await getAuthenticatedUser(request);
  if (!session) throw redirect("/login");

  const courseId = params.courseId;
  if (!courseId) throw redirect("/dashboard/courses");

  const course = await db.course.findUnique({ where: { id: courseId, deletedAt: null } });
  if (!course) throw new Response("Not Found", { status: 404 });

  const allowed = await canAccessCourses(session.id, course.ownerId);
  if (!allowed) throw new Response("Forbidden", { status: 403 });

  const url = new URL(request.url);
  const rawView = url.searchParams.get("view")?.trim() ?? "";
  const isViewingBuddy = rawView && rawView === course.ownerId;
  const backHref = isViewingBuddy
    ? `/dashboard/courses?view=${course.ownerId}`
    : "/dashboard/courses";

  const activeTab = url.searchParams.get("tab") ?? "information";
  let storageFiles: {
    id: string;
    name: string;
    path: string;
    isFolder: boolean;
    size: number;
    mimeType: string | null;
    key: string;
    createdAt: Date;
    courseId: string;
  }[] = [];
  let storageUsageBytes = 0;
  let storagePath = "/";
  let quizzes: {
    id: string;
    serial: number;
    title: string;
    syllabus: string;
    quizDate: Date;
    deadline: Date | null;
    createdAt: Date;
    myMockQuiz: {
      id: string;
      questionImageKey: string | null;
      questionImageName: string | null;
      answerImageKey: string | null;
      answerImageName: string | null;
      notes: string | null;
    } | null;
    buddyMockQuiz: {
      id: string;
      questionImageKey: string | null;
      questionImageName: string | null;
      answerImageKey: string | null;
      answerImageName: string | null;
      notes: string | null;
    } | null;
  }[] = [];
  let quizBuddyDisplayName: string | null = null;
  let assignments: {
    id: string;
    title: string;
    description: string;
    deadline: Date;
    createdAt: Date;
  }[] = [];
  let midExam: {
    id: string;
    syllabus: string;
    examDate: Date;
    venue: string | null;
    notes: string | null;
  } | null = null;
  let finalExam: {
    id: string;
    syllabus: string;
    examDate: Date;
    venue: string | null;
    notes: string | null;
  } | null = null;
  const mockExamShape = {
    id: true,
    questionImageKey: true,
    questionImageName: true,
    answerImageKey: true,
    answerImageName: true,
    notes: true,
    ownerId: true,
  } as const;
  let midMockData: ExamMockData = { myMock: null, buddyMock: null, buddyDisplayName: null };
  let finalMockData: ExamMockData = { myMock: null, buddyMock: null, buddyDisplayName: null };
  let customLinks: { id: string; label: string; url: string; createdAt: Date }[] = [];
  let presentation: {
    id: string;
    title: string;
    description: string;
    presentationDate: Date;
    venue: string | null;
    notes: string | null;
  } | null = null;
  let attendanceData: {
    classDates: string[];
    hasRoutine: boolean;
    attendanceMap: Record<string, { status: "PRESENT" | "ABSENT"; timing: "ON_TIME" | "LATE" }>;
    buddyAttendanceMap: Record<string, { status: "PRESENT" | "ABSENT"; timing: "ON_TIME" | "LATE" }>;
    buddyDisplayName: string | null;
  } | null = null;

  if (activeTab === "storage") {
    const { listCourseFiles, getCourseStorageUsage, sanitizeStoragePath } =
      await import("~/lib/storage.server");
    const rawPath = url.searchParams.get("path") ?? "/";
    storagePath = sanitizeStoragePath(rawPath);
    [storageFiles, storageUsageBytes] = await Promise.all([
      listCourseFiles(courseId, storagePath),
      getCourseStorageUsage(courseId),
    ]);
  }

  if (activeTab === "quiz") {
    // Find the two participants: course owner and their buddy.
    // quizBuddyId = the non-owner participant (buddy of the course owner).
    // otherUserId = from the VIEWER's perspective, the other person they see mock tests from.
    //   - If the viewer is the owner → the other person is quizBuddyId
    //   - If the viewer IS the buddy  → the other person is the course owner
    let quizBuddyId: string | null = null;
    let otherUserId: string | null = null;
    const conn = await db.buddyConnection.findFirst({
      where: { OR: [{ userAId: course.ownerId }, { userBId: course.ownerId }] },
      select: { userAId: true, userBId: true },
    });
    if (conn) {
      quizBuddyId = conn.userAId === course.ownerId ? conn.userBId : conn.userAId;
      otherUserId = session.id === course.ownerId ? quizBuddyId : course.ownerId;
      const other = await db.user.findUnique({ where: { id: otherUserId }, select: { displayName: true } });
      quizBuddyDisplayName = other?.displayName ?? null;
    }

    const rawQuizzes = await db.quiz.findMany({
      where: { courseId },
      orderBy: [{ serial: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        serial: true,
        title: true,
        syllabus: true,
        quizDate: true,
        deadline: true,
        createdAt: true,
        mockQuizzes: {
          where: { ownerId: { in: [session.id, ...(otherUserId ? [otherUserId] : [])] } },
          select: {
            id: true,
            ownerId: true,
            questionImageKey: true,
            questionImageName: true,
            answerImageKey: true,
            answerImageName: true,
            notes: true,
          },
        },
      },
    });
    quizzes = rawQuizzes.map((q) => ({
      id: q.id,
      serial: q.serial,
      title: q.title,
      syllabus: q.syllabus,
      quizDate: q.quizDate,
      deadline: q.deadline,
      createdAt: q.createdAt,
      myMockQuiz: q.mockQuizzes.find((mq) => mq.ownerId === session.id) ?? null,
      buddyMockQuiz: otherUserId ? (q.mockQuizzes.find((mq) => mq.ownerId === otherUserId) ?? null) : null,
    }));
  }

  if (activeTab === "assignment") {
    assignments = await db.assignment.findMany({
      where: { courseId },
      orderBy: { deadline: "asc" },
      select: { id: true, title: true, description: true, deadline: true, createdAt: true },
    });
  }

  if (activeTab === "mid" || activeTab === "final") {
    // Shared buddy lookup for mid + final tabs
    const conn = await db.buddyConnection.findFirst({
      where: { OR: [{ userAId: course.ownerId }, { userBId: course.ownerId }] },
      select: { userAId: true, userBId: true },
    });
    let examOtherId: string | null = null;
    let examBuddyName: string | null = null;
    if (conn) {
      const rawBuddyId = conn.userAId === course.ownerId ? conn.userBId : conn.userAId;
      examOtherId = session.id === course.ownerId ? rawBuddyId : course.ownerId;
      const other = await db.user.findUnique({ where: { id: examOtherId }, select: { displayName: true } });
      examBuddyName = other?.displayName ?? null;
    }

    const mockSelect = { select: mockExamShape } as const;
    const fetchMock = async (kind: string) => {
      const rows = await db.mockExam.findMany({
        where: { courseId, kind, ownerId: { in: [session.id, ...(examOtherId ? [examOtherId] : [])] } },
        select: { id: true, ownerId: true, questionImageKey: true, questionImageName: true, answerImageKey: true, answerImageName: true, notes: true },
      });
      const myRow = rows.find((r) => r.ownerId === session.id) ?? null;
      const otherRow = examOtherId ? (rows.find((r) => r.ownerId === examOtherId) ?? null) : null;
      return { myMock: myRow, buddyMock: otherRow, buddyDisplayName: examBuddyName };
    };

    if (activeTab === "mid") {
      [midExam, midMockData] = await Promise.all([
        db.midExam.findUnique({ where: { courseId }, select: { id: true, syllabus: true, examDate: true, venue: true, notes: true } }),
        fetchMock("mid"),
      ]);
    } else {
      [finalExam, finalMockData] = await Promise.all([
        db.finalExam.findUnique({ where: { courseId }, select: { id: true, syllabus: true, examDate: true, venue: true, notes: true } }),
        fetchMock("final"),
      ]);
    }
  }

  if (activeTab === "links") {
    customLinks = await db.courseLink.findMany({
      where: { courseId },
      orderBy: { createdAt: "asc" },
      select: { id: true, label: true, url: true, createdAt: true },
    });
  }

  if (activeTab === "presentation") {
    presentation = await db.presentation.findUnique({
      where: { courseId },
      select: {
        id: true,
        title: true,
        description: true,
        presentationDate: true,
        venue: true,
        notes: true,
      },
    });
  }

  if (activeTab === "attendance") {
    const routines = await db.classRoutine.findMany({
      where: {
        userId: course.ownerId,
        courseName: { equals: course.title, mode: "insensitive" },
      },
      select: { dayOfWeek: true },
    });

    const daysOfWeek = [...new Set(routines.map((r) => r.dayOfWeek))];
    const hasRoutine = daysOfWeek.length > 0;

    const classDates: string[] = [];
    if (hasRoutine) {
      // Show at least 6 months of class days from creation — including future dates
      const sixMonthsAfterCreation = new Date(course.createdAt);
      sixMonthsAfterCreation.setMonth(sixMonthsAfterCreation.getMonth() + 6);
      const endDate = new Date(Math.max(Date.now(), sixMonthsAfterCreation.getTime()));

      type DateRow = { date: Date };
      const rows = await db.$queryRaw<DateRow[]>`
        SELECT gs::date AS date
        FROM generate_series(
          ${course.createdAt}::date,
          ${endDate}::date,
          '1 day'::interval
        ) AS gs
        WHERE EXTRACT(DOW FROM gs) = ANY(${daysOfWeek}::int[])
        ORDER BY gs ASC
      `;
      for (const row of rows) {
        const d = new Date(row.date);
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, "0");
        const day = String(d.getUTCDate()).padStart(2, "0");
        classDates.push(`${y}-${m}-${day}`);
      }
    }

    const [records, buddyConn] = await Promise.all([
      db.attendance.findMany({
        where: { userId: session.id, courseId },
        select: { date: true, status: true, timing: true },
      }),
      db.buddyConnection.findFirst({
        where: { OR: [{ userAId: session.id }, { userBId: session.id }] },
        select: { userAId: true, userBId: true },
      }),
    ]);

    const attendanceMap: Record<
      string,
      { status: "PRESENT" | "ABSENT"; timing: "ON_TIME" | "LATE" }
    > = {};
    for (const rec of records) {
      attendanceMap[rec.date] = { status: rec.status, timing: rec.timing };
    }

    let buddyAttendanceMap: Record<
      string,
      { status: "PRESENT" | "ABSENT"; timing: "ON_TIME" | "LATE" }
    > = {};
    let buddyDisplayName: string | null = null;

    if (buddyConn) {
      const buddyId = buddyConn.userAId === session.id ? buddyConn.userBId : buddyConn.userAId;
      const [buddyRecords, buddyUser] = await Promise.all([
        db.attendance.findMany({
          where: { userId: buddyId, courseId },
          select: { date: true, status: true, timing: true },
        }),
        db.user.findUnique({ where: { id: buddyId }, select: { displayName: true } }),
      ]);
      buddyDisplayName = buddyUser?.displayName ?? "Your Buddy";
      for (const rec of buddyRecords) {
        buddyAttendanceMap[rec.date] = { status: rec.status, timing: rec.timing };
      }
    }

    attendanceData = { classDates, hasRoutine, attendanceMap, buddyAttendanceMap, buddyDisplayName };
  }

  const r2PublicUrl = (await import("~/lib/env.server")).env.R2_PUBLIC_URL.replace(/\/$/, "");
  return {
    course,
    backHref,
    viewerId: session.id,
    storageFiles,
    storageUsageBytes,
    storagePath,
    r2PublicUrl,
    quizzes,
    quizBuddyDisplayName,
    assignments,
    midExam,
    finalExam,
    midMockData,
    finalMockData,
    customLinks,
    presentation,
    attendanceData,
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { getAuthenticatedUser } = await import("~/lib/auth.server");
  const { serializeFlash } = await import("~/lib/flash.server");
  const { rateLimit } = await import("~/lib/ratelimit.server");
  const { redirect } = await import("react-router");

  const session = await getAuthenticatedUser(request);
  if (!session) throw new Response("Unauthorized", { status: 401 });

  const courseId = params.courseId;
  if (!courseId) throw new Response("Bad Request", { status: 400 });

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "").trim();

  let backHref = String(formData.get("backHref") ?? "").trim();
  if (!backHref.startsWith("/dashboard/")) backHref = `/dashboard/courses/${courseId}`;

  const flash = async (type: "success" | "error" | "warning", message: string, to = backHref) => {
    const headers = new Headers();
    headers.append("Set-Cookie", await serializeFlash({ type, message }));
    return redirect(to, { headers });
  };

  const storageIntents = ["create-folder", "upload-file", "delete-file"];
  const rateLimitKey = storageIntents.includes(intent)
    ? `storage:${intent}:${session.id}`
    : `courses:${intent}:${session.id}`;

  try {
    await rateLimit({ key: rateLimitKey, limit: 60, windowSec: 3600 });
  } catch (err) {
    if (err instanceof Response && err.status === 429)
      throw await flash("error", "Too many requests. Please wait and try again.");
    throw err;
  }

  // ── Custom Link: create ──────────────────────────────────────────────────
  if (intent === "create-link") {
    const { db } = await import("~/lib/db.server");
    const label = String(formData.get("label") ?? "")
      .trim()
      .slice(0, 100);
    const url = String(formData.get("url") ?? "")
      .trim()
      .slice(0, 500);
    if (!label) throw await flash("error", "Link label is required.");
    if (!url) throw await flash("error", "URL is required.");
    if (!url.startsWith("http://") && !url.startsWith("https://"))
      throw await flash("error", "URL must start with http:// or https://");
    const count = await db.courseLink.count({ where: { courseId } });
    if (count >= 20) throw await flash("error", "Maximum of 20 links per course.");
    await db.courseLink.create({ data: { courseId, label, url } });
    throw await flash("success", `Link \u201c${label}\u201d added.`);
  }

  // ── Custom Link: delete ──────────────────────────────────────────────────
  if (intent === "delete-link") {
    const { db } = await import("~/lib/db.server");
    const linkId = String(formData.get("linkId") ?? "").trim();
    if (!linkId) throw await flash("error", "Missing link ID.");
    const link = await db.courseLink.findUnique({
      where: { id: linkId },
      select: { courseId: true },
    });
    if (!link || link.courseId !== courseId) throw await flash("error", "Link not found.");
    await db.courseLink.delete({ where: { id: linkId } });
    throw await flash("success", "Link removed.");
  }

  // ── Storage: create folder ──────────────────────────────────────────────
  if (intent === "create-folder") {
    const { createFolder, sanitizeStoragePath } = await import("~/lib/storage.server");
    const path = sanitizeStoragePath(String(formData.get("path") ?? "/"));
    const name = String(formData.get("folderName") ?? "")
      .trim()
      .slice(0, 100);
    try {
      await createFolder(session.id, courseId, path, name);
      throw await flash("success", `Folder "${name}" created.`);
    } catch (err) {
      if (err instanceof Response) throw err;
      const msgs: Record<string, string> = {
        INVALID_NAME: "Folder name is invalid.",
        ALREADY_EXISTS: "A folder with that name already exists here.",
        FORBIDDEN: "You don't have permission.",
      };
      throw await flash(
        "error",
        err instanceof Error ? (msgs[err.message] ?? "Failed to create folder.") : "Failed to create folder.",
      );
    }
  }

  // ── Storage: upload file ────────────────────────────────────────────────
  if (intent === "upload-file") {
    const { uploadFile, sanitizeStoragePath } = await import("~/lib/storage.server");
    const path = sanitizeStoragePath(String(formData.get("path") ?? "/"));
    const file = formData.get("file");
    if (
      !file ||
      typeof file !== "object" ||
      typeof (file as { arrayBuffer?: unknown }).arrayBuffer !== "function"
    ) {
      throw await flash("error", "No file received.");
    }
    const uploadable = file as unknown as {
      name: string;
      size: number;
      type: string;
      arrayBuffer(): Promise<ArrayBuffer>;
    };
    try {
      await uploadFile(session.id, courseId, path, uploadable as unknown as File);
      throw await flash("success", `"${uploadable.name}" uploaded.`);
    } catch (err) {
      if (err instanceof Response) throw err;
      const { logger } = await import("~/lib/logger.server");
      logger.error({ err, courseId, intent: "upload-file" }, "File upload failed");
      const msgs: Record<string, string> = {
        EMPTY_FILE: "Cannot upload an empty file.",
        FILE_TOO_LARGE: "File exceeds the 50 MB per-file limit.",
        STORAGE_LIMIT_EXCEEDED: "Course storage limit (500 MB) would be exceeded.",
        FORBIDDEN: "You don't have permission.",
        COURSE_NOT_FOUND: "Course not found.",
      };
      const detail = err instanceof Error ? err.message : String(err);
      throw await flash(
        "error",
        err instanceof Error ? (msgs[err.message] ?? `Upload failed: ${detail}`) : `Upload failed: ${detail}`,
      );
    }
  }

  // ── Storage: delete file / folder ───────────────────────────────────────
  if (intent === "delete-file") {
    const { deleteStorageItem } = await import("~/lib/storage.server");
    const fileId = String(formData.get("fileId") ?? "").trim();
    if (!fileId) throw await flash("error", "Missing file ID.");
    try {
      await deleteStorageItem(session.id, fileId);
      throw await flash("success", "Deleted.");
    } catch (err) {
      if (err instanceof Response) throw err;
      const msgs: Record<string, string> = {
        NOT_FOUND: "Item not found.",
        FORBIDDEN: "You don't have permission.",
      };
      throw await flash(
        "error",
        err instanceof Error ? (msgs[err.message] ?? "Delete failed.") : "Delete failed.",
      );
    }
  }

  // ── Quiz: create ───────────────────────────────────────────────────────
  if (intent === "create-quiz") {
    const { db } = await import("~/lib/db.server");
    const title = String(formData.get("title") ?? "")
      .trim()
      .slice(0, 200);
    const syllabus = String(formData.get("syllabus") ?? "")
      .trim()
      .slice(0, 2000);
    const quizDateRaw = String(formData.get("quizDate") ?? "").trim();
    const deadlineRaw = String(formData.get("deadline") ?? "").trim();

    if (!title) throw await flash("error", "Quiz title is required.");
    if (!syllabus) throw await flash("error", "Syllabus is required.");
    if (!quizDateRaw) throw await flash("error", "Quiz date is required.");

    const quizDate = new Date(quizDateRaw);
    if (isNaN(quizDate.getTime())) throw await flash("error", "Invalid quiz date.");
    const deadline = deadlineRaw ? new Date(deadlineRaw) : null;
    if (deadline && isNaN(deadline.getTime())) throw await flash("error", "Invalid deadline.");

    const allQuizzes = await db.quiz.findMany({
      where: { courseId },
      select: { serial: true },
    });
    if (allQuizzes.length >= 4)
      throw await flash("error", "Maximum of 4 quizzes per course reached.");
    const usedSerials = new Set(allQuizzes.map((q) => q.serial));
    let nextSerial = 1;
    while (usedSerials.has(nextSerial)) nextSerial++;

    const newQuiz = await db.quiz.create({
      data: { courseId, title, syllabus, quizDate, deadline, serial: nextSerial },
      select: { id: true },
    });
    // Auto-initialise mock quiz for the logged-in user
    await db.mockQuiz.create({ data: { quizId: newQuiz.id, ownerId: session.id } });
    throw await flash("success", `Quiz "${title}" logged.`);
  }

  // ── Quiz: update ───────────────────────────────────────────────────────
  if (intent === "update-quiz") {
    const { db } = await import("~/lib/db.server");
    const quizId = String(formData.get("quizId") ?? "").trim();
    const title = String(formData.get("title") ?? "")
      .trim()
      .slice(0, 200);
    const syllabus = String(formData.get("syllabus") ?? "")
      .trim()
      .slice(0, 2000);
    const quizDateRaw = String(formData.get("quizDate") ?? "").trim();
    const deadlineRaw = String(formData.get("deadline") ?? "").trim();

    if (!quizId) throw await flash("error", "Missing quiz ID.");
    if (!title) throw await flash("error", "Quiz title is required.");
    if (!syllabus) throw await flash("error", "Syllabus is required.");
    if (!quizDateRaw) throw await flash("error", "Quiz date is required.");

    const quizDate = new Date(quizDateRaw);
    if (isNaN(quizDate.getTime())) throw await flash("error", "Invalid quiz date.");
    const deadline = deadlineRaw ? new Date(deadlineRaw) : null;
    if (deadline && isNaN(deadline.getTime())) throw await flash("error", "Invalid deadline.");

    const quiz = await db.quiz.findUnique({ where: { id: quizId }, select: { courseId: true } });
    if (!quiz || quiz.courseId !== courseId) throw await flash("error", "Quiz not found.");

    await db.quiz.update({
      where: { id: quizId },
      data: { title, syllabus, quizDate, deadline },
    });
    throw await flash("success", `Quiz "${title}" updated.`);
  }

  // ── Quiz: reorder ──────────────────────────────────────────────────────
  if (intent === "reorder-quiz") {
    const { db } = await import("~/lib/db.server");
    const quizId = String(formData.get("quizId") ?? "").trim();
    const newSerial = parseInt(String(formData.get("newSerial") ?? ""), 10);
    if (!quizId) throw await flash("error", "Missing quiz ID.");
    if (isNaN(newSerial) || newSerial < 1 || newSerial > 4)
      throw await flash("error", "Invalid serial number.");
    const quizToMove = await db.quiz.findUnique({
      where: { id: quizId },
      select: { serial: true, courseId: true },
    });
    if (!quizToMove || quizToMove.courseId !== courseId)
      throw await flash("error", "Quiz not found.");
    const otherQuiz = await db.quiz.findFirst({
      where: { courseId, serial: newSerial, id: { not: quizId } },
    });
    await db.$transaction(async (tx) => {
      if (otherQuiz) {
        await tx.quiz.update({
          where: { id: otherQuiz.id },
          data: { serial: quizToMove.serial },
        });
      }
      await tx.quiz.update({ where: { id: quizId }, data: { serial: newSerial } });
    });
    throw await flash("success", `Quiz moved to #${newSerial}.`);
  }

  // ── Quiz: delete ───────────────────────────────────────────────────────
  if (intent === "delete-quiz") {
    const { db } = await import("~/lib/db.server");
    const quizId = String(formData.get("quizId") ?? "").trim();
    if (!quizId) throw await flash("error", "Missing quiz ID.");
    const quiz = await db.quiz.findUnique({ where: { id: quizId }, select: { courseId: true } });
    if (!quiz || quiz.courseId !== courseId) throw await flash("error", "Quiz not found.");
    await db.quiz.delete({ where: { id: quizId } });
    throw await flash("success", "Quiz deleted.");
  }

  // ── Mock Quiz: set question photo ─────────────────────────────────────
  if (intent === "set-mock-question") {
    const { db } = await import("~/lib/db.server");
    const quizId = String(formData.get("quizId") ?? "").trim();
    if (!quizId) throw await flash("error", "Missing quiz ID.");
    const quiz = await db.quiz.findUnique({ where: { id: quizId }, select: { courseId: true } });
    if (!quiz || quiz.courseId !== courseId) throw await flash("error", "Quiz not found.");

    const raw = formData.get("questionImage");
    if (
      !raw ||
      typeof raw !== "object" ||
      typeof (raw as { arrayBuffer?: unknown }).arrayBuffer !== "function"
    )
      throw await flash("error", "No image provided.");
    const file = raw as unknown as { name: string; size: number; type: string; arrayBuffer(): Promise<ArrayBuffer> };
    if (file.size === 0) throw await flash("error", "No image provided.");
    if (file.size > 10 * 1024 * 1024) throw await flash("error", "Image must be under 10 MB.");
    if (!file.type.startsWith("image/")) throw await flash("error", "Only image files are allowed.");

    const uuid = crypto.randomUUID();
    const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const key = `mock-quiz/${courseId}/${quizId}/q-${uuid}.${ext}`;

    const { getR2Client } = await import("~/lib/r2.server");
    const { PutObjectCommand, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    const { env } = await import("~/lib/env.server");

    // Delete old question + answer images if present
    const existing = await db.mockQuiz.findUnique({ where: { quizId_ownerId: { quizId, ownerId: session.id } }, select: { questionImageKey: true, answerImageKey: true } });
    for (const oldKey of [existing?.questionImageKey, existing?.answerImageKey].filter(Boolean) as string[]) {
      try { await getR2Client().send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: oldKey })); } catch { /* ignore */ }
    }

    await getR2Client().send(new PutObjectCommand({
      Bucket: env.R2_BUCKET, Key: key,
      Body: Buffer.from(await file.arrayBuffer()),
      ContentType: file.type, ContentLength: file.size,
    }));

    await db.mockQuiz.upsert({
      where: { quizId_ownerId: { quizId, ownerId: session.id } },
      create: { quizId, ownerId: session.id, questionImageKey: key, questionImageName: file.name.slice(0, 200), answerImageKey: null, answerImageName: null, notes: null },
      update: { questionImageKey: key, questionImageName: file.name.slice(0, 200), answerImageKey: null, answerImageName: null, notes: null },
    });
    throw await flash("success", "Question photo saved.");
  }

  // ── Mock Quiz: set answer photo ────────────────────────────────────────
  if (intent === "set-mock-answer") {
    const { db } = await import("~/lib/db.server");
    const quizId = String(formData.get("quizId") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim().slice(0, 2000) || null;
    if (!quizId) throw await flash("error", "Missing quiz ID.");
    const quiz = await db.quiz.findUnique({ where: { id: quizId }, select: { courseId: true } });
    if (!quiz || quiz.courseId !== courseId) throw await flash("error", "Quiz not found.");
    const mockQuiz = await db.mockQuiz.findUnique({ where: { quizId_ownerId: { quizId, ownerId: session.id } }, select: { id: true, questionImageKey: true, answerImageKey: true } });
    if (!mockQuiz?.questionImageKey) throw await flash("error", "Upload the question photo first.");

    const raw = formData.get("answerImage");
    let key: string | null = mockQuiz.answerImageKey;
    let name: string | null = null;

    if (
      raw &&
      typeof raw === "object" &&
      typeof (raw as { arrayBuffer?: unknown }).arrayBuffer === "function"
    ) {
      const file = raw as unknown as { name: string; size: number; type: string; arrayBuffer(): Promise<ArrayBuffer> };
      if (file.size > 0) {
        if (file.size > 10 * 1024 * 1024) throw await flash("error", "Image must be under 10 MB.");
        if (!file.type.startsWith("image/")) throw await flash("error", "Only image files are allowed.");
        const uuid = crypto.randomUUID();
        const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
        key = `mock-quiz/${courseId}/${quizId}/a-${uuid}.${ext}`;
        name = file.name.slice(0, 200);
        const { getR2Client } = await import("~/lib/r2.server");
        const { PutObjectCommand, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
        const { env } = await import("~/lib/env.server");
        if (mockQuiz.answerImageKey) {
          try { await getR2Client().send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: mockQuiz.answerImageKey })); } catch { /* ignore */ }
        }
        await getR2Client().send(new PutObjectCommand({
          Bucket: env.R2_BUCKET, Key: key,
          Body: Buffer.from(await file.arrayBuffer()),
          ContentType: file.type, ContentLength: file.size,
        }));
      }
    }

    await db.mockQuiz.update({
      where: { quizId_ownerId: { quizId, ownerId: session.id } },
      data: { answerImageKey: key, answerImageName: name, notes },
    });
    throw await flash("success", "Answer saved.");
  }

  // ── Mock Quiz: delete question (resets entire Q&A) ─────────────────────
  if (intent === "delete-mock-question") {
    const { db } = await import("~/lib/db.server");
    const quizId = String(formData.get("quizId") ?? "").trim();
    if (!quizId) throw await flash("error", "Missing quiz ID.");
    const quiz = await db.quiz.findUnique({ where: { id: quizId }, select: { courseId: true } });
    if (!quiz || quiz.courseId !== courseId) throw await flash("error", "Quiz not found.");
    const mq = await db.mockQuiz.findUnique({ where: { quizId_ownerId: { quizId, ownerId: session.id } }, select: { questionImageKey: true, answerImageKey: true } });
    if (!mq) throw await flash("error", "No mock quiz found.");
    const keysToDelete = [mq.questionImageKey, mq.answerImageKey].filter(Boolean) as string[];
    if (keysToDelete.length > 0) {
      try {
        const { getR2Client } = await import("~/lib/r2.server");
        const { DeleteObjectsCommand } = await import("@aws-sdk/client-s3");
        const { env } = await import("~/lib/env.server");
        await getR2Client().send(new DeleteObjectsCommand({
          Bucket: env.R2_BUCKET,
          Delete: { Objects: keysToDelete.map((Key) => ({ Key })), Quiet: true },
        }));
      } catch { /* ignore */ }
    }
    await db.mockQuiz.update({ where: { quizId_ownerId: { quizId, ownerId: session.id } }, data: { questionImageKey: null, questionImageName: null, answerImageKey: null, answerImageName: null, notes: null } });
    throw await flash("success", "Mock quiz cleared.");
  }

  // ── Mock Quiz: delete answer only ──────────────────────────────────────
  if (intent === "delete-mock-answer") {
    const { db } = await import("~/lib/db.server");
    const quizId = String(formData.get("quizId") ?? "").trim();
    if (!quizId) throw await flash("error", "Missing quiz ID.");
    const quiz = await db.quiz.findUnique({ where: { id: quizId }, select: { courseId: true } });
    if (!quiz || quiz.courseId !== courseId) throw await flash("error", "Quiz not found.");
    const mq = await db.mockQuiz.findUnique({ where: { quizId_ownerId: { quizId, ownerId: session.id } }, select: { answerImageKey: true } });
    if (mq?.answerImageKey) {
      try {
        const { getR2Client } = await import("~/lib/r2.server");
        const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
        const { env } = await import("~/lib/env.server");
        await getR2Client().send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: mq.answerImageKey }));
      } catch { /* ignore */ }
    }
    await db.mockQuiz.update({ where: { quizId_ownerId: { quizId, ownerId: session.id } }, data: { answerImageKey: null, answerImageName: null, notes: null } });
    throw await flash("success", "Answer removed.");
  }

  // ── Assignment: create ─────────────────────────────────────────────
  if (intent === "create-assignment") {
    const { db } = await import("~/lib/db.server");
    const title = String(formData.get("title") ?? "")
      .trim()
      .slice(0, 200);
    const description = String(formData.get("description") ?? "")
      .trim()
      .slice(0, 5000);
    const deadlineRaw = String(formData.get("deadline") ?? "").trim();
    if (!title) throw await flash("error", "Assignment title is required.");
    if (!description) throw await flash("error", "Description is required.");
    if (!deadlineRaw) throw await flash("error", "Deadline is required.");
    const deadline = new Date(deadlineRaw);
    if (isNaN(deadline.getTime())) throw await flash("error", "Invalid deadline.");
    await db.assignment.create({ data: { courseId, title, description, deadline } });
    throw await flash("success", `Assignment "${title}" added.`);
  }

  // ── Assignment: update ─────────────────────────────────────────────
  if (intent === "update-assignment") {
    const { db } = await import("~/lib/db.server");
    const assignmentId = String(formData.get("assignmentId") ?? "").trim();
    const title = String(formData.get("title") ?? "")
      .trim()
      .slice(0, 200);
    const description = String(formData.get("description") ?? "")
      .trim()
      .slice(0, 5000);
    const deadlineRaw = String(formData.get("deadline") ?? "").trim();
    if (!assignmentId) throw await flash("error", "Missing assignment ID.");
    if (!title) throw await flash("error", "Assignment title is required.");
    if (!description) throw await flash("error", "Description is required.");
    if (!deadlineRaw) throw await flash("error", "Deadline is required.");
    const deadline = new Date(deadlineRaw);
    if (isNaN(deadline.getTime())) throw await flash("error", "Invalid deadline.");
    const item = await db.assignment.findUnique({ where: { id: assignmentId }, select: { courseId: true } });
    if (!item || item.courseId !== courseId) throw await flash("error", "Assignment not found.");
    await db.assignment.update({
      where: { id: assignmentId },
      data: { title, description, deadline },
    });
    throw await flash("success", `Assignment "${title}" updated.`);
  }

  // ── Assignment: delete ─────────────────────────────────────────────
  if (intent === "delete-assignment") {
    const { db } = await import("~/lib/db.server");
    const assignmentId = String(formData.get("assignmentId") ?? "").trim();
    if (!assignmentId) throw await flash("error", "Missing assignment ID.");
    const item = await db.assignment.findUnique({
      where: { id: assignmentId },
      select: { courseId: true },
    });
    if (!item || item.courseId !== courseId) throw await flash("error", "Assignment not found.");
    await db.assignment.delete({ where: { id: assignmentId } });
    throw await flash("success", "Assignment deleted.");
  }

  // ── Mock Exam: set question photo (mid or final) ─────────────────────────
  if (intent === "set-mock-exam-question") {
    const { db } = await import("~/lib/db.server");
    const kind = String(formData.get("kind") ?? "").trim();
    if (kind !== "mid" && kind !== "final") throw await flash("error", "Invalid exam kind.");

    const raw = formData.get("questionImage");
    if (!raw || typeof raw !== "object" || typeof (raw as { arrayBuffer?: unknown }).arrayBuffer !== "function")
      throw await flash("error", "No image provided.");
    const file = raw as unknown as { name: string; size: number; type: string; arrayBuffer(): Promise<ArrayBuffer> };
    if (file.size === 0) throw await flash("error", "No image provided.");
    if (file.size > 10 * 1024 * 1024) throw await flash("error", "Image must be under 10 MB.");
    if (!file.type.startsWith("image/")) throw await flash("error", "Only image files are allowed.");

    const { getR2Client } = await import("~/lib/r2.server");
    const { PutObjectCommand, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    const { env } = await import("~/lib/env.server");

    const existing = await db.mockExam.findUnique({
      where: { courseId_kind_ownerId: { courseId, kind, ownerId: session.id } },
      select: { questionImageKey: true, answerImageKey: true },
    });
    for (const oldKey of [existing?.questionImageKey, existing?.answerImageKey].filter(Boolean) as string[]) {
      try { await getR2Client().send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: oldKey })); } catch { /* ignore */ }
    }

    const uuid = crypto.randomUUID();
    const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const key = `mock-exam/${courseId}/${kind}/q-${uuid}.${ext}`;
    await getR2Client().send(new PutObjectCommand({
      Bucket: env.R2_BUCKET, Key: key,
      Body: Buffer.from(await file.arrayBuffer()),
      ContentType: file.type, ContentLength: file.size,
    }));
    await db.mockExam.upsert({
      where: { courseId_kind_ownerId: { courseId, kind, ownerId: session.id } },
      create: { courseId, kind, ownerId: session.id, questionImageKey: key, questionImageName: file.name.slice(0, 200), answerImageKey: null, answerImageName: null, notes: null },
      update: { questionImageKey: key, questionImageName: file.name.slice(0, 200), answerImageKey: null, answerImageName: null, notes: null },
    });
    throw await flash("success", "Question photo saved.");
  }

  // ── Mock Exam: set answer photo (mid or final) ────────────────────────────
  if (intent === "set-mock-exam-answer") {
    const { db } = await import("~/lib/db.server");
    const kind = String(formData.get("kind") ?? "").trim();
    if (kind !== "mid" && kind !== "final") throw await flash("error", "Invalid exam kind.");
    const notes = String(formData.get("notes") ?? "").trim().slice(0, 2000) || null;

    const mq = await db.mockExam.findUnique({
      where: { courseId_kind_ownerId: { courseId, kind, ownerId: session.id } },
      select: { id: true, questionImageKey: true, answerImageKey: true },
    });
    if (!mq?.questionImageKey) throw await flash("error", "Upload the question photo first.");

    const raw = formData.get("answerImage");
    let key: string | null = mq.answerImageKey;
    let name: string | null = null;
    if (raw && typeof raw === "object" && typeof (raw as { arrayBuffer?: unknown }).arrayBuffer === "function") {
      const file = raw as unknown as { name: string; size: number; type: string; arrayBuffer(): Promise<ArrayBuffer> };
      if (file.size > 0) {
        if (file.size > 10 * 1024 * 1024) throw await flash("error", "Image must be under 10 MB.");
        if (!file.type.startsWith("image/")) throw await flash("error", "Only image files are allowed.");
        const { getR2Client } = await import("~/lib/r2.server");
        const { PutObjectCommand, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
        const { env } = await import("~/lib/env.server");
        if (mq.answerImageKey) {
          try { await getR2Client().send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: mq.answerImageKey })); } catch { /* ignore */ }
        }
        const uuid = crypto.randomUUID();
        const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
        key = `mock-exam/${courseId}/${kind}/a-${uuid}.${ext}`;
        name = file.name.slice(0, 200);
        await getR2Client().send(new PutObjectCommand({
          Bucket: env.R2_BUCKET, Key: key,
          Body: Buffer.from(await file.arrayBuffer()),
          ContentType: file.type, ContentLength: file.size,
        }));
      }
    }
    await db.mockExam.update({
      where: { courseId_kind_ownerId: { courseId, kind, ownerId: session.id } },
      data: { answerImageKey: key, answerImageName: name, notes },
    });
    throw await flash("success", "Answer saved.");
  }

  // ── Mock Exam: delete question → resets entire record ────────────────────
  if (intent === "delete-mock-exam-question") {
    const { db } = await import("~/lib/db.server");
    const kind = String(formData.get("kind") ?? "").trim();
    if (kind !== "mid" && kind !== "final") throw await flash("error", "Invalid exam kind.");
    const mq = await db.mockExam.findUnique({
      where: { courseId_kind_ownerId: { courseId, kind, ownerId: session.id } },
      select: { questionImageKey: true, answerImageKey: true },
    });
    const keysToDelete = [mq?.questionImageKey, mq?.answerImageKey].filter(Boolean) as string[];
    if (keysToDelete.length > 0) {
      try {
        const { getR2Client } = await import("~/lib/r2.server");
        const { DeleteObjectsCommand } = await import("@aws-sdk/client-s3");
        const { env } = await import("~/lib/env.server");
        await getR2Client().send(new DeleteObjectsCommand({
          Bucket: env.R2_BUCKET,
          Delete: { Objects: keysToDelete.map((Key) => ({ Key })), Quiet: true },
        }));
      } catch { /* ignore */ }
    }
    await db.mockExam.upsert({
      where: { courseId_kind_ownerId: { courseId, kind, ownerId: session.id } },
      create: { courseId, kind, ownerId: session.id, questionImageKey: null, questionImageName: null, answerImageKey: null, answerImageName: null, notes: null },
      update: { questionImageKey: null, questionImageName: null, answerImageKey: null, answerImageName: null, notes: null },
    });
    throw await flash("success", "Mock test cleared.");
  }

  // ── Mock Exam: delete answer only ────────────────────────────────────────
  if (intent === "delete-mock-exam-answer") {
    const { db } = await import("~/lib/db.server");
    const kind = String(formData.get("kind") ?? "").trim();
    if (kind !== "mid" && kind !== "final") throw await flash("error", "Invalid exam kind.");
    const mq = await db.mockExam.findUnique({
      where: { courseId_kind_ownerId: { courseId, kind, ownerId: session.id } },
      select: { answerImageKey: true },
    });
    if (mq?.answerImageKey) {
      try {
        const { getR2Client } = await import("~/lib/r2.server");
        const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
        const { env } = await import("~/lib/env.server");
        await getR2Client().send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: mq.answerImageKey }));
      } catch { /* ignore */ }
    }
    await db.mockExam.upsert({
      where: { courseId_kind_ownerId: { courseId, kind, ownerId: session.id } },
      create: { courseId, kind, ownerId: session.id, questionImageKey: null, questionImageName: null, answerImageKey: null, answerImageName: null, notes: null },
      update: { answerImageKey: null, answerImageName: null, notes: null },
    });
    throw await flash("success", "Answer removed.");
  }

  // ── Mid / Final: upsert ────────────────────────────────────────────
  if (intent === "upsert-mid" || intent === "upsert-final") {
    const { db } = await import("~/lib/db.server");
    const syllabus = String(formData.get("syllabus") ?? "")
      .trim()
      .slice(0, 5000);
    const examDateRaw = String(formData.get("examDate") ?? "").trim();
    const venue =
      String(formData.get("venue") ?? "")
        .trim()
        .slice(0, 200) || null;
    const notes =
      String(formData.get("notes") ?? "")
        .trim()
        .slice(0, 2000) || null;
    if (!syllabus) throw await flash("error", "Syllabus is required.");
    if (!examDateRaw) throw await flash("error", "Exam date is required.");
    const examDate = new Date(examDateRaw);
    if (isNaN(examDate.getTime())) throw await flash("error", "Invalid exam date.");
    const isMid = intent === "upsert-mid";
    if (isMid) {
      await db.midExam.upsert({
        where: { courseId },
        create: { courseId, syllabus, examDate, venue, notes },
        update: { syllabus, examDate, venue, notes },
      });
    } else {
      await db.finalExam.upsert({
        where: { courseId },
        create: { courseId, syllabus, examDate, venue, notes },
        update: { syllabus, examDate, venue, notes },
      });
    }
    throw await flash("success", `${isMid ? "Mid" : "Final"} exam details saved.`);
  }

  // ── Mid / Final: delete ────────────────────────────────────────────
  if (intent === "delete-mid") {
    const { db } = await import("~/lib/db.server");
    await db.midExam.deleteMany({ where: { courseId } });
    throw await flash("success", "Mid exam details removed.");
  }
  if (intent === "delete-final") {
    const { db } = await import("~/lib/db.server");
    await db.finalExam.deleteMany({ where: { courseId } });
    throw await flash("success", "Final exam details removed.");
  }

  // ── Presentation: upsert ────────────────────────────────────────────────
  if (intent === "upsert-presentation") {
    const { db } = await import("~/lib/db.server");
    const title = String(formData.get("title") ?? "")
      .trim()
      .slice(0, 200);
    const description = String(formData.get("description") ?? "")
      .trim()
      .slice(0, 5000);
    const dateRaw = String(formData.get("presentationDate") ?? "").trim();
    const venue =
      String(formData.get("venue") ?? "")
        .trim()
        .slice(0, 200) || null;
    const notes =
      String(formData.get("notes") ?? "")
        .trim()
        .slice(0, 2000) || null;
    if (!title) throw await flash("error", "Presentation title is required.");
    if (!description) throw await flash("error", "Description / topic is required.");
    if (!dateRaw) throw await flash("error", "Presentation date is required.");
    const presentationDate = new Date(dateRaw);
    if (isNaN(presentationDate.getTime())) throw await flash("error", "Invalid date.");
    await db.presentation.upsert({
      where: { courseId },
      create: { courseId, title, description, presentationDate, venue, notes },
      update: { title, description, presentationDate, venue, notes },
    });
    throw await flash("success", "Presentation details saved.");
  }

  // ── Presentation: delete ────────────────────────────────────────────────
  if (intent === "delete-presentation") {
    const { db } = await import("~/lib/db.server");
    await db.presentation.deleteMany({ where: { courseId } });
    throw await flash("success", "Presentation details removed.");
  }

  // ── Attendance: upsert ─────────────────────────────────────────────────
  if (intent === "upsert-attendance") {
    const { db } = await import("~/lib/db.server");
    const date = String(formData.get("date") ?? "").trim();
    const state = String(formData.get("attendanceState") ?? "").trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw await flash("error", "Invalid date.");
    if (!["present", "late", "absent"].includes(state))
      throw await flash("error", "Invalid attendance state.");

    // Lock: cannot change attendance more than 2 days after the class date
    const [cy, cm, cd] = date.split("-").map(Number);
    const classDate = new Date(cy, cm - 1, cd);
    const cutoff = new Date(classDate);
    cutoff.setDate(cutoff.getDate() + 2);
    cutoff.setHours(23, 59, 59, 999);
    if (Date.now() > cutoff.getTime())
      throw await flash("error", "Attendance for this class can no longer be changed (locked after 2 days).");

    const status = state === "absent" ? ("ABSENT" as const) : ("PRESENT" as const);
    const timing = state === "late" ? ("LATE" as const) : ("ON_TIME" as const);

    await db.attendance.upsert({
      where: { userId_courseId_date: { userId: session.id, courseId, date } },
      create: { userId: session.id, courseId, date, status, timing },
      update: { status, timing },
    });

    throw redirect(`/dashboard/courses/${courseId}?tab=attendance`, {
      headers: {
        "Set-Cookie": await serializeFlash({ type: "success", message: "Attendance saved." }),
      },
    });
  }

  // ── Course: delete ─────────────────────────────────────────────────────
  if (intent === "delete") {
    const { deleteCourse } = await import("~/lib/course.server");
    try {
      await deleteCourse(session.id, courseId);
      throw await flash("success", "Course deleted.", backHref);
    } catch (err) {
      if (err instanceof Response) throw err;
      if (err instanceof Error && err.message === "FORBIDDEN")
        throw await flash("error", "You don't have permission to delete that course.");
      if (err instanceof Error && err.message === "NOT_FOUND")
        throw await flash("error", "Course not found.");
      throw await flash("error", "Failed to delete course.");
    }
  }

  // ── Course: update ─────────────────────────────────────────────────────
  if (intent === "update") {
    const { updateCourse } = await import("~/lib/course.server");
    const rawTitle = String(formData.get("title") ?? "").trim();
    const rawCreditHours = String(formData.get("creditHours") ?? "").trim();
    const rawTeacherName = String(formData.get("teacherName") ?? "").trim();
    const rawTeacherInfo = String(formData.get("teacherInfo") ?? "").trim();
    const rawTeacherEmail = String(formData.get("teacherEmail") ?? "").trim();
    const rawTeacherPhone = String(formData.get("teacherPhone") ?? "").trim();
    const rawBlcLink = String(formData.get("blcLink") ?? "").trim();
    const rawGroupLink = String(formData.get("groupLink") ?? "").trim();

    if (!rawTitle || rawTitle.length > 200)
      throw await flash("error", "Course title is required (max 200 characters).");
    if (!rawTeacherName || rawTeacherName.length > 100)
      throw await flash("error", "Teacher name is required (max 100 characters).");
    if (rawTeacherInfo.length > 2000)
      throw await flash("error", "Teacher notes must be under 2000 characters.");
    if (rawTeacherEmail.length > 200)
      throw await flash("error", "Teacher email must be under 200 characters.");
    if (rawTeacherPhone.length > 30)
      throw await flash("error", "Teacher phone must be under 30 characters.");

    const creditHours = parseFloat(rawCreditHours);
    if (isNaN(creditHours) || creditHours < 0.5 || creditHours > 12)
      throw await flash("error", "Credit hours must be between 0.5 and 12.");

    function safeLink(url: string, label: string): string | null {
      if (!url) return null;
      if (!url.startsWith("http://") && !url.startsWith("https://"))
        throw new Error(`${label} must start with http:// or https://`);
      if (url.length > 500) throw new Error(`${label} must be under 500 characters.`);
      return url;
    }

    let blcLink: string | null = null;
    let groupLink: string | null = null;
    try {
      blcLink = safeLink(rawBlcLink, "BLC link");
      groupLink = safeLink(rawGroupLink, "Group link");
    } catch (err) {
      throw await flash("error", err instanceof Error ? err.message : "Invalid link.");
    }

    try {
      await updateCourse(session.id, courseId, {
        title: rawTitle,
        creditHours,
        teacherName: rawTeacherName,
        teacherInfo: rawTeacherInfo || null,
        teacherEmail: rawTeacherEmail || null,
        teacherPhone: rawTeacherPhone || null,
        blcLink,
        groupLink,
      });
      throw await flash(
        "success",
        "Course updated.",
        `/dashboard/courses/${courseId}${backHref.includes("view=") ? `?view=${backHref.split("view=")[1]}` : ""}`,
      );
    } catch (err) {
      if (err instanceof Response) throw err;
      if (err instanceof Error && err.message === "FORBIDDEN")
        throw await flash("error", "You don't have permission to edit that course.");
      if (err instanceof Error && err.message === "NOT_FOUND")
        throw await flash("error", "Course not found.");
      throw await flash("error", "Failed to update course.");
    }
  }

  throw await flash("error", "Unknown action.");
}

// ── InfoRow ───────────────────────────────────────────────────────────────────

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        <Icon size={15} />
      </div>
      <div className="min-w-0">
        <p className="text-[0.72rem] font-medium uppercase tracking-wide text-slate-400">{label}</p>
        <div className="mt-0.5 text-sm text-slate-800">{children}</div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CourseDetailPage() {
  const {
    course,
    backHref,
    viewerId,
    storageFiles,
    storageUsageBytes,
    storagePath,
    r2PublicUrl,
    quizzes,
    quizBuddyDisplayName,
    assignments,
    midExam,
    finalExam,
    midMockData,
    finalMockData,
    customLinks,
    presentation,
    attendanceData,
  } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const isOwner = viewerId === course.ownerId;

  const rawTab = searchParams.get("tab") ?? "information";
  const activeTab: Tab = (validTabs.includes(rawTab as Tab) ? rawTab : "information") as Tab;

  const isSubmitting = navigation.state === "submitting";
  const isDeleting = isSubmitting && String(navigation.formData?.get("intent")) === "delete";

  function switchTab(tab: Tab) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (tab === "information") {
          next.delete("tab");
          next.delete("path");
        } else {
          next.set("tab", tab);
          if (tab !== "storage") next.delete("path");
        }
        return next;
      },
      { preventScrollReset: true },
    );
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        to={backHref}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
      >
        <ArrowLeft size={16} />
        Back to Courses
      </Link>

      {/* Main card */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Card header */}
        <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <BookOpen size={22} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-slate-900 leading-snug">{course.title}</h1>
              <span className="mt-1 inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                {course.creditHours} credit hour{course.creditHours !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {isOwner ? (
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <Edit2 size={15} />
                Edit
              </button>
              {!deleteConfirm ? (
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3.5 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                >
                  <Trash2 size={15} />
                  Delete
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Delete confirm banner */}
        {deleteConfirm ? (
          <div className="flex flex-col gap-3 border-b border-red-100 bg-red-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <p className="text-sm font-medium text-red-700">
              Are you sure you want to delete this course? This cannot be undone.
            </p>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(false)}
                disabled={isDeleting}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <Form method="post" preventScrollReset>
                <input type="hidden" name="intent" value="delete" />
                <input type="hidden" name="backHref" value={backHref} />
                <button
                  type="submit"
                  disabled={isDeleting}
                  className="rounded-xl bg-red-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                >
                  {isDeleting ? "Deleting…" : "Yes, delete"}
                </button>
              </Form>
            </div>
          </div>
        ) : null}

        {/* Mobile: custom select picker */}
        <div className="border-b border-slate-100 px-4 py-3 sm:hidden">
          <CustomSelect
            name="tab-mobile"
            value={activeTab}
            onChange={(v) => switchTab(v as typeof activeTab)}
            options={[
              { value: "information", label: "Information" },
              { value: "links", label: "Links" },
              { value: "storage", label: "Storage" },
              { value: "quiz", label: "Quiz" },
              { value: "assignment", label: "Assignment" },
              { value: "mid", label: "Mid" },
              { value: "final", label: "Final" },
              { value: "presentation", label: "Presentation" },
              { value: "attendance", label: "Attendance" },
            ]}
          />
        </div>

        {/* Desktop: tab bar */}
        <div className="hidden sm:block">
          <div className="flex border-b border-slate-100 px-6">
            {(
              [
                { key: "information", icon: Info, label: "Information" },
                { key: "links", icon: Link2, label: "Links" },
                { key: "storage", icon: HardDrive, label: "Storage" },
                { key: "quiz", icon: ClipboardList, label: "Quiz" },
                { key: "assignment", icon: FileText, label: "Assignment" },
                { key: "mid", icon: BookMarked, label: "Mid" },
                { key: "final", icon: GraduationCap, label: "Final" },
                { key: "presentation", icon: Monitor, label: "Presentation" },
                { key: "attendance", icon: ClipboardCheck, label: "Attendance" },
              ] as const
            ).map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => switchTab(key)}
                className={`mr-4 flex items-center gap-2 border-b-2 py-3.5 text-sm font-semibold transition-colors ${
                  activeTab === key
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab: Information */}
        {activeTab === "information" ? (
          <div className="grid grid-cols-1 gap-6 px-6 py-6 sm:grid-cols-2">
            <InfoRow icon={User} label="Teacher">
              {course.teacherName}
            </InfoRow>

            {course.teacherEmail ? (
              <InfoRow icon={Mail} label="Teacher Email">
                <a
                  href={`mailto:${course.teacherEmail}`}
                  className="break-all transition-colors hover:text-indigo-600"
                >
                  {course.teacherEmail}
                </a>
              </InfoRow>
            ) : null}

            {course.teacherPhone ? (
              <InfoRow icon={Phone} label="Teacher Phone">
                <a href={`tel:${course.teacherPhone}`} className="transition-colors hover:text-indigo-600">
                  {course.teacherPhone}
                </a>
              </InfoRow>
            ) : null}

            {course.teacherInfo ? (
              <div className="sm:col-span-2">
                <InfoRow icon={Info} label="Notes & Info">
                  <p className="whitespace-pre-wrap leading-relaxed text-slate-700">
                    {course.teacherInfo}
                  </p>
                </InfoRow>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Tab: Links */}
        {activeTab === "links" ? (
          <LinksTab
            courseId={course.id}
            blcLink={course.blcLink ?? null}
            groupLink={course.groupLink ?? null}
            customLinks={customLinks as CourseLinkEntry[]}
            navigation={navigation}
            isOwner={isOwner}
          />
        ) : null}

        {/* Tab: Storage */}
        {activeTab === "storage" ? (
          <StorageTab
            courseId={course.id}
            storagePath={storagePath}
            storageFiles={storageFiles as StorageFile[]}
            storageUsageBytes={storageUsageBytes}
            navigation={navigation}
            r2PublicUrl={r2PublicUrl}
          />
        ) : null}

        {/* Tab: Quiz */}
        {activeTab === "quiz" ? (
          <QuizTab
            courseId={course.id}
            quizzes={quizzes as QuizEntry[]}
            navigation={navigation}
            r2PublicUrl={r2PublicUrl}
            buddyDisplayName={quizBuddyDisplayName}
          />
        ) : null}

        {/* Tab: Assignment */}
        {activeTab === "assignment" ? (
          <AssignmentTab
            courseId={course.id}
            assignments={assignments as AssignmentEntry[]}
            navigation={navigation}
          />
        ) : null}

        {/* Tab: Mid */}
        {activeTab === "mid" ? (
          <ExamTab
            courseId={course.id}
            kind="mid"
            exam={midExam as ExamEntry | null}
            navigation={navigation}
            mockData={midMockData as ExamMockData}
            r2PublicUrl={r2PublicUrl}
          />
        ) : null}

        {/* Tab: Final */}
        {activeTab === "final" ? (
          <ExamTab
            courseId={course.id}
            kind="final"
            exam={finalExam as ExamEntry | null}
            navigation={navigation}
            mockData={finalMockData as ExamMockData}
            r2PublicUrl={r2PublicUrl}
          />
        ) : null}

        {/* Tab: Presentation */}
        {activeTab === "presentation" ? (
          <PresentationTab
            courseId={course.id}
            presentation={presentation as PresentationEntry | null}
            navigation={navigation}
          />
        ) : null}

        {/* Tab: Attendance */}
        {activeTab === "attendance" ? (
          <AttendanceTab
            courseId={course.id}
            courseTitle={course.title}
            classDates={attendanceData?.classDates ?? []}
            hasRoutine={attendanceData?.hasRoutine ?? false}
            attendanceMap={
              (attendanceData?.attendanceMap ?? {}) as Record<
                string,
                { status: "PRESENT" | "ABSENT"; timing: "ON_TIME" | "LATE" }
              >
            }
            buddyAttendanceMap={
              (attendanceData?.buddyAttendanceMap ?? {}) as Record<
                string,
                { status: "PRESENT" | "ABSENT"; timing: "ON_TIME" | "LATE" }
              >
            }
            buddyDisplayName={(attendanceData?.buddyDisplayName as string | null) ?? null}
            navigation={navigation}
          />
        ) : null}
      </div>

      {/* Edit modal */}
      {editOpen ? (
        <EditModal
          course={course}
          backHref={backHref}
          isSubmitting={isSubmitting}
          onClose={() => setEditOpen(false)}
        />
      ) : null}
    </div>
  );
}

export { RouteErrorBoundary as ErrorBoundary } from "~/components/RouteErrorBoundary";

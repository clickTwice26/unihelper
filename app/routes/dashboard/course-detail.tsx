import { useEffect, useRef, useState } from "react";
import { Form, Link, useLoaderData, useNavigation, useRevalidator, useSearchParams } from "react-router";
import {
  ArrowLeft,
  BookMarked,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardList,
  Clock,
  Copy,
  Edit2,
  ExternalLink,
  Download,
  Eye,
  File,
  FileText,
  FolderOpen,
  FolderPlus,
  GraduationCap,
  HardDrive,
  Info,
  Link2,
  Mail,
  MessageCircle,
  Monitor,
  Phone,
  Plus,
  Trash2,
  Upload,
  User,
  X,
} from "lucide-react";

import type { Route } from "./+types/course-detail";
import { CustomSelect } from "~/components/ui/select";

function QuizReorderSelect({
  quizId,
  serial,
  idx,
  quizCount,
  courseId,
}: {
  quizId: string;
  serial: number;
  idx: number;
  quizCount: number;
  courseId: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const options = Array.from({ length: quizCount }, (_, i) => ({
    value: String(i + 1),
    label: `#${i + 1}`,
  }));
  return (
    <Form method="post" preventScrollReset ref={formRef}>
      <input type="hidden" name="intent" value="reorder-quiz" />
      <input type="hidden" name="quizId" value={quizId} />
      <input type="hidden" name="backHref" value={`/dashboard/courses/${courseId}?tab=quiz`} />
      <CustomSelect
        name="newSerial"
        defaultValue={String(serial || idx + 1)}
        options={options}
        onChange={() => formRef.current?.submit()}
        className="!w-auto !rounded-full !border-0 !bg-indigo-100 !py-0.5 !px-2 !text-xs !font-bold !text-indigo-700 hover:!bg-indigo-200 !shadow-none"
      />
    </Form>
  );
}

export function meta({ data }: Route.MetaArgs) {
  const title = (data as { course?: { title?: string } } | undefined)?.course?.title;
  return [{ title: title ? `${title} | UniBuddy` : "Course | UniBuddy" }];
}

const STORAGE_LIMIT_BYTES = 500 * 1024 * 1024;

export async function loader({ request, params }: Route.LoaderArgs) {
  const { getAuthenticatedUser } = await import("~/lib/auth.server");
  const { redirect } = await import("react-router");
  const { canAccessCourses } = await import("~/lib/course.server");
  const { db } = await import("~/lib/db.server");

  const session = await getAuthenticatedUser(request);
  if (!session) throw redirect("/login");

  const courseId = params.courseId;
  if (!courseId) throw redirect("/dashboard/courses");

  const course = await db.course.findUnique({ where: { id: courseId } });
  if (!course) throw new Response("Not Found", { status: 404 });

  const allowed = await canAccessCourses(session.id, course.ownerId);
  if (!allowed) throw new Response("Forbidden", { status: 403 });

  const url = new URL(request.url);
  const rawView = url.searchParams.get("view")?.trim() ?? "";
  const isViewingBuddy = rawView && rawView === course.ownerId;
  const backHref = isViewingBuddy
    ? `/dashboard/courses?view=${course.ownerId}`
    : "/dashboard/courses";

  // Storage data — only loaded on the storage tab
  const activeTab = url.searchParams.get("tab") ?? "information";
  let storageFiles: { id: string; name: string; path: string; isFolder: boolean; size: number; mimeType: string | null; key: string; createdAt: Date; courseId: string }[] = [];
  let storageUsageBytes = 0;
  let storagePath = "/";
  let quizzes: { id: string; serial: number; title: string; syllabus: string; quizDate: Date; deadline: Date | null; createdAt: Date }[] = [];
  let assignments: { id: string; title: string; description: string; deadline: Date; createdAt: Date }[] = [];
  let midExam: { id: string; syllabus: string; examDate: Date; venue: string | null; notes: string | null } | null = null;
  let finalExam: { id: string; syllabus: string; examDate: Date; venue: string | null; notes: string | null } | null = null;
  let customLinks: { id: string; label: string; url: string; createdAt: Date }[] = [];
  let presentation: { id: string; title: string; description: string; presentationDate: Date; venue: string | null; notes: string | null } | null = null;

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
    const { db } = await import("~/lib/db.server");
    quizzes = await db.quiz.findMany({
      where: { courseId },
      orderBy: [{ serial: "asc" }, { createdAt: "asc" }],
      select: { id: true, serial: true, title: true, syllabus: true, quizDate: true, deadline: true, createdAt: true },
    });
  }

  if (activeTab === "assignment") {
    const { db } = await import("~/lib/db.server");
    assignments = await db.assignment.findMany({
      where: { courseId },
      orderBy: { deadline: "asc" },
      select: { id: true, title: true, description: true, deadline: true, createdAt: true },
    });
  }

  if (activeTab === "mid") {
    const { db } = await import("~/lib/db.server");
    midExam = await db.midExam.findUnique({
      where: { courseId },
      select: { id: true, syllabus: true, examDate: true, venue: true, notes: true },
    });
  }

  if (activeTab === "final") {
    const { db } = await import("~/lib/db.server");
    finalExam = await db.finalExam.findUnique({
      where: { courseId },
      select: { id: true, syllabus: true, examDate: true, venue: true, notes: true },
    });
  }

  if (activeTab === "links") {
    const { db } = await import("~/lib/db.server");
    customLinks = await db.courseLink.findMany({
      where: { courseId },
      orderBy: { createdAt: "asc" },
      select: { id: true, label: true, url: true, createdAt: true },
    });
  }

  if (activeTab === "presentation") {
    const { db } = await import("~/lib/db.server");
    presentation = await db.presentation.findUnique({
      where: { courseId },
      select: { id: true, title: true, description: true, presentationDate: true, venue: true, notes: true },
    });
  }

  const r2PublicUrl = (await import("~/lib/env.server")).env.R2_PUBLIC_URL.replace(/\/$/, "");
  return { course, backHref, viewerId: session.id, storageFiles, storageUsageBytes, storagePath, r2PublicUrl, quizzes, assignments, midExam, finalExam, customLinks, presentation };
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

  // Sanitize backHref from form — must start with /dashboard/
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
    const label = String(formData.get("label") ?? "").trim().slice(0, 100);
    const url = String(formData.get("url") ?? "").trim().slice(0, 500);
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
    const link = await db.courseLink.findUnique({ where: { id: linkId }, select: { courseId: true } });
    if (!link || link.courseId !== courseId) throw await flash("error", "Link not found.");
    await db.courseLink.delete({ where: { id: linkId } });
    throw await flash("success", "Link removed.");
  }

  // ── Storage: create folder ──────────────────────────────────────────────
  if (intent === "create-folder") {
    const { createFolder, sanitizeStoragePath } = await import("~/lib/storage.server");
    const path = sanitizeStoragePath(String(formData.get("path") ?? "/"));
    const name = String(formData.get("folderName") ?? "").trim().slice(0, 100);
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
      throw await flash("error", err instanceof Error ? (msgs[err.message] ?? "Failed to create folder.") : "Failed to create folder.");
    }
  }

  // ── Storage: upload file ────────────────────────────────────────────────
  if (intent === "upload-file") {
    const { uploadFile, sanitizeStoragePath } = await import("~/lib/storage.server");
    const path = sanitizeStoragePath(String(formData.get("path") ?? "/"));
    const file = formData.get("file");
    // `File` is only a global in Node ≥ 20; use duck-typing for Node 18 compat
    if (!file || typeof file !== "object" || typeof (file as { arrayBuffer?: unknown }).arrayBuffer !== "function") {
      throw await flash("error", "No file received.");
    }
    const uploadable = file as unknown as { name: string; size: number; type: string; arrayBuffer(): Promise<ArrayBuffer> };
    try {
      await uploadFile(session.id, courseId, path, uploadable as unknown as File);
      throw await flash("success", `"${uploadable.name}" uploaded.`);
    } catch (err) {
      if (err instanceof Response) throw err;
      console.error("[upload-file] error:", err);
      const msgs: Record<string, string> = {
        EMPTY_FILE: "Cannot upload an empty file.",
        FILE_TOO_LARGE: "File exceeds the 50 MB per-file limit.",
        STORAGE_LIMIT_EXCEEDED: "Course storage limit (500 MB) would be exceeded.",
        FORBIDDEN: "You don't have permission.",
        COURSE_NOT_FOUND: "Course not found.",
      };
      const detail = err instanceof Error ? err.message : String(err);
      throw await flash("error", err instanceof Error ? (msgs[err.message] ?? `Upload failed: ${detail}`) : `Upload failed: ${detail}`);
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
      throw await flash("error", err instanceof Error ? (msgs[err.message] ?? "Delete failed.") : "Delete failed.");
    }
  }

  // ── Quiz: create ───────────────────────────────────────────────────────
  if (intent === "create-quiz") {
    const { db } = await import("~/lib/db.server");
    const title = String(formData.get("title") ?? "").trim().slice(0, 200);
    const syllabus = String(formData.get("syllabus") ?? "").trim().slice(0, 2000);
    const quizDateRaw = String(formData.get("quizDate") ?? "").trim();
    const deadlineRaw = String(formData.get("deadline") ?? "").trim();

    if (!title) throw await flash("error", "Quiz title is required.");
    if (!syllabus) throw await flash("error", "Syllabus is required.");
    if (!quizDateRaw) throw await flash("error", "Quiz date is required.");

    const quizDate = new Date(quizDateRaw);
    if (isNaN(quizDate.getTime())) throw await flash("error", "Invalid quiz date.");
    const deadline = deadlineRaw ? new Date(deadlineRaw) : null;
    if (deadline && isNaN(deadline.getTime())) throw await flash("error", "Invalid deadline.");

    const allQuizzes = await db.quiz.findMany({ where: { courseId }, select: { serial: true } });
    if (allQuizzes.length >= 4) throw await flash("error", "Maximum of 4 quizzes per course reached.");
    const usedSerials = new Set(allQuizzes.map((q) => q.serial));
    let nextSerial = 1;
    while (usedSerials.has(nextSerial)) nextSerial++;

    await db.quiz.create({
      data: { courseId, title, syllabus, quizDate, deadline, serial: nextSerial },
    });
    throw await flash("success", `Quiz "${title}" logged.`);
  }

  // ── Quiz: reorder ──────────────────────────────────────────────────────
  if (intent === "reorder-quiz") {
    const { db } = await import("~/lib/db.server");
    const quizId = String(formData.get("quizId") ?? "").trim();
    const newSerial = parseInt(String(formData.get("newSerial") ?? ""), 10);
    if (!quizId) throw await flash("error", "Missing quiz ID.");
    if (isNaN(newSerial) || newSerial < 1 || newSerial > 4) throw await flash("error", "Invalid serial number.");
    const quizToMove = await db.quiz.findUnique({ where: { id: quizId }, select: { serial: true, courseId: true } });
    if (!quizToMove || quizToMove.courseId !== courseId) throw await flash("error", "Quiz not found.");
    const otherQuiz = await db.quiz.findFirst({ where: { courseId, serial: newSerial, id: { not: quizId } } });
    await db.$transaction(async (tx) => {
      if (otherQuiz) {
        await tx.quiz.update({ where: { id: otherQuiz.id }, data: { serial: quizToMove.serial } });
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

  // ── Assignment: create ─────────────────────────────────────────────
  if (intent === "create-assignment") {
    const { db } = await import("~/lib/db.server");
    const title = String(formData.get("title") ?? "").trim().slice(0, 200);
    const description = String(formData.get("description") ?? "").trim().slice(0, 5000);
    const deadlineRaw = String(formData.get("deadline") ?? "").trim();
    if (!title) throw await flash("error", "Assignment title is required.");
    if (!description) throw await flash("error", "Description is required.");
    if (!deadlineRaw) throw await flash("error", "Deadline is required.");
    const deadline = new Date(deadlineRaw);
    if (isNaN(deadline.getTime())) throw await flash("error", "Invalid deadline.");
    await db.assignment.create({ data: { courseId, title, description, deadline } });
    throw await flash("success", `Assignment "${title}" added.`);
  }

  // ── Assignment: delete ─────────────────────────────────────────────
  if (intent === "delete-assignment") {
    const { db } = await import("~/lib/db.server");
    const assignmentId = String(formData.get("assignmentId") ?? "").trim();
    if (!assignmentId) throw await flash("error", "Missing assignment ID.");
    const item = await db.assignment.findUnique({ where: { id: assignmentId }, select: { courseId: true } });
    if (!item || item.courseId !== courseId) throw await flash("error", "Assignment not found.");
    await db.assignment.delete({ where: { id: assignmentId } });
    throw await flash("success", "Assignment deleted.");
  }

  // ── Mid / Final: upsert ────────────────────────────────────────────
  if (intent === "upsert-mid" || intent === "upsert-final") {
    const { db } = await import("~/lib/db.server");
    const syllabus = String(formData.get("syllabus") ?? "").trim().slice(0, 5000);
    const examDateRaw = String(formData.get("examDate") ?? "").trim();
    const venue = String(formData.get("venue") ?? "").trim().slice(0, 200) || null;
    const notes = String(formData.get("notes") ?? "").trim().slice(0, 2000) || null;
    if (!syllabus) throw await flash("error", "Syllabus is required.");
    if (!examDateRaw) throw await flash("error", "Exam date is required.");
    const examDate = new Date(examDateRaw);
    if (isNaN(examDate.getTime())) throw await flash("error", "Invalid exam date.");
    const isMid = intent === "upsert-mid";
    const model = isMid ? db.midExam : db.finalExam;
    await model.upsert({
      where: { courseId },
      create: { courseId, syllabus, examDate, venue, notes },
      update: { syllabus, examDate, venue, notes },
    });
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
    const title = String(formData.get("title") ?? "").trim().slice(0, 200);
    const description = String(formData.get("description") ?? "").trim().slice(0, 5000);
    const dateRaw = String(formData.get("presentationDate") ?? "").trim();
    const venue = String(formData.get("venue") ?? "").trim().slice(0, 200) || null;
    const notes = String(formData.get("notes") ?? "").trim().slice(0, 2000) || null;
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
      throw await flash("success", "Course updated.", `/dashboard/courses/${courseId}${backHref.includes("view=") ? `?view=${backHref.split("view=")[1]}` : ""}`);
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

// ── Edit Modal ───────────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";
const labelCls = "mb-1.5 block text-sm font-medium text-slate-700";

type CourseShape = {
  id: string;
  title: string;
  creditHours: number;
  teacherName: string;
  teacherInfo: string | null;
  teacherEmail: string | null;
  teacherPhone: string | null;
  blcLink: string | null;
  groupLink: string | null;
};

function EditModal({
  course,
  backHref,
  isSubmitting,
  onClose,
}: {
  course: CourseShape;
  backHref: string;
  isSubmitting: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">Edit Course</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto">
          <Form method="post" preventScrollReset className="space-y-4 px-6 py-5">
            <input type="hidden" name="intent" value="update" />
            <input type="hidden" name="backHref" value={backHref} />

            <div>
              <label className={labelCls}>
                Course Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="title"
                defaultValue={course.title}
                required
                maxLength={200}
                className={inputCls}
                autoFocus
              />
            </div>
            <div>
              <label className={labelCls}>
                Credit Hours <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="creditHours"
                defaultValue={course.creditHours}
                required
                min={0.5}
                max={12}
                step={0.5}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>
                Teacher Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="teacherName"
                defaultValue={course.teacherName}
                required
                maxLength={100}
                className={inputCls}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Teacher Email</label>
                <input
                  type="email"
                  name="teacherEmail"
                  defaultValue={course.teacherEmail ?? ""}
                  maxLength={200}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Teacher Phone</label>
                <input
                  type="tel"
                  name="teacherPhone"
                  defaultValue={course.teacherPhone ?? ""}
                  maxLength={30}
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>Teacher Info / Notes</label>
              <textarea
                name="teacherInfo"
                defaultValue={course.teacherInfo ?? ""}
                maxLength={2000}
                rows={3}
                className={`${inputCls} resize-none`}
              />
            </div>
            <div>
              <label className={labelCls}>BLC Link</label>
              <input
                type="url"
                name="blcLink"
                defaultValue={course.blcLink ?? ""}
                maxLength={500}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Communication Group Link</label>
              <input
                type="url"
                name="groupLink"
                defaultValue={course.groupLink ?? ""}
                maxLength={500}
                className={inputCls}
              />
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
              >
                {isSubmitting ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </Form>
        </div>
      </div>
    </div>
  );
}

// ── Storage helpers ───────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function parseBreadcrumbs(path: string) {
  const parts = path.split("/").filter(Boolean);
  const crumbs: { label: string; path: string }[] = [{ label: "Root", path: "/" }];
  let acc = "/";
  for (const part of parts) {
    acc = `${acc}${part}/`;
    crumbs.push({ label: part, path: acc });
  }
  return crumbs;
}

function MimeIcon({ mimeType, size = 18 }: { mimeType: string | null; size?: number }) {
  if (!mimeType) return <File size={size} className="text-slate-400" />;
  if (mimeType.startsWith("image/")) return <File size={size} className="text-emerald-500" />;
  if (mimeType === "application/pdf") return <File size={size} className="text-red-500" />;
  if (mimeType.includes("word") || mimeType.includes("document")) return <File size={size} className="text-blue-500" />;
  if (mimeType.includes("sheet") || mimeType.includes("excel")) return <File size={size} className="text-green-500" />;
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return <File size={size} className="text-orange-500" />;
  if (mimeType.startsWith("video/")) return <File size={size} className="text-purple-500" />;
  if (mimeType.startsWith("audio/")) return <File size={size} className="text-pink-500" />;
  return <File size={size} className="text-slate-400" />;
}

function NewFolderModal({
  path,
  courseId,
  isSubmitting,
  onClose,
}: {
  path: string;
  courseId: string;
  isSubmitting: boolean;
  onClose: () => void;
}) {
  const storageBackHref = `/dashboard/courses/${courseId}?tab=storage&path=${encodeURIComponent(path)}`;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">New Folder</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition">
            <X size={16} />
          </button>
        </div>
        <Form method="post" preventScrollReset className="px-5 py-4 space-y-4">
          <input type="hidden" name="intent" value="create-folder" />
          <input type="hidden" name="path" value={path} />
          <input type="hidden" name="backHref" value={storageBackHref} />
          <div>
            <label className={labelCls}>Folder Name</label>
            <input type="text" name="folderName" required maxLength={100} placeholder="e.g. Lectures" className={inputCls} autoFocus />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-60">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition disabled:opacity-60">
              {isSubmitting ? "Creating…" : "Create"}
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}

type StorageFile = {
  id: string;
  name: string;
  path: string;
  isFolder: boolean;
  size: number;
  mimeType: string | null;
  key: string;
  createdAt: Date | string;
  courseId: string;
};

type QuizEntry = {
  id: string;
  serial: number;
  title: string;
  syllabus: string;
  quizDate: Date | string;
  deadline: Date | string | null;
  createdAt: Date | string;
};

type AssignmentEntry = {
  id: string;
  title: string;
  description: string;
  deadline: Date | string;
  createdAt: Date | string;
};

type CourseLinkEntry = {
  id: string;
  label: string;
  url: string;
  createdAt: Date | string;
};

type ExamEntry = {
  id: string;
  syllabus: string;
  examDate: Date | string;
  venue: string | null;
  notes: string | null;
};

function previewType(mimeType: string | null): "image" | "video" | "pdf" | "none" {
  if (!mimeType) return "none";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType === "application/pdf") return "pdf";
  return "none";
}

function FilePreviewModal({
  file,
  courseId,
  onClose,
}: {
  file: StorageFile;
  courseId: string;
  onClose: () => void;
}) {
  const fileUrl = `/dashboard/courses/${courseId}/files/${file.id}`;
  const downloadUrl = `${fileUrl}?download=1`;
  const kind = previewType(file.mimeType);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-slate-950/90"
      style={{ backdropFilter: "blur(6px)" }}
    >
      {/* Keyboard close */}
      <div
        className="absolute inset-0"
        onClick={onClose}
        role="button"
        tabIndex={-1}
        aria-label="Close preview"
        onKeyDown={(e) => e.key === "Escape" && onClose()}
      />

      {/* Shell (sits above the backdrop click-trap) */}
      <div className="pointer-events-none relative z-10 flex h-full flex-col">
        {/* Header */}
        <div className="pointer-events-auto flex shrink-0 items-center justify-between gap-4 border-b border-white/10 bg-slate-900 px-5 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <File size={15} className="shrink-0 text-slate-400" />
            <span className="truncate text-sm font-semibold text-white">{file.name}</span>
            <span className="hidden shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-slate-400 sm:block">
              {formatBytes(file.size)}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={downloadUrl}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
            >
              <Download size={13} />
              Download
            </a>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
              aria-label="Close preview"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content area — takes remaining height */}
        <div className="pointer-events-auto relative flex flex-1 items-center justify-center overflow-hidden p-4">
          {kind === "image" && (
            <img
              src={fileUrl}
              alt={file.name}
              className="rounded-lg object-contain shadow-2xl"
              style={{ maxWidth: "100%", maxHeight: "100%" }}
            />
          )}
          {kind === "video" && (
            <video
              src={fileUrl}
              controls
              className="rounded-lg shadow-2xl"
              style={{ maxWidth: "100%", maxHeight: "100%" }}
            />
          )}
          {kind === "pdf" && (
            <iframe
              src={fileUrl}
              title={file.name}
              className="h-full w-full rounded-lg bg-white shadow-2xl"
            />
          )}
          {kind === "none" && (
            <div className="flex flex-col items-center gap-5 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10">
                <File size={36} className="text-slate-300" />
              </div>
              <p className="text-sm font-medium text-slate-300">
                Preview not available for this file type.
              </p>
              <a
                href={downloadUrl}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
              >
                <Download size={15} />
                Download File
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Links Tab ───────────────────────────────────────────────────────────────

function LinksTab({
  courseId,
  blcLink,
  groupLink,
  customLinks,
  navigation,
  isOwner,
}: {
  courseId: string;
  blcLink: string | null;
  groupLink: string | null;
  customLinks: CourseLinkEntry[];
  navigation: ReturnType<typeof useNavigation>;
  isOwner: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const isSubmitting = navigation.state === "submitting";
  const intent = String(navigation.formData?.get("intent") ?? "");
  const backHref = `/dashboard/courses/${courseId}?tab=links`;

  const hasAnything = blcLink || groupLink || customLinks.length > 0;

  return (
    <div className="px-6 py-6 space-y-5">
      {/* Fixed links: BLC + Group */}
      {(blcLink || groupLink) ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Course Links</p>
          <div className="flex flex-wrap gap-3">
            {blcLink ? (
              <a
                href={blcLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
              >
                <ExternalLink size={15} />
                BLC Link
              </a>
            ) : null}
            {groupLink ? (
              <a
                href={groupLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
              >
                <MessageCircle size={15} />
                Group Link
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Custom links header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Custom Links{customLinks.length > 0 ? ` (${customLinks.length})` : ""}
        </p>
        {isOwner && !showForm ? (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            <Plus size={15} />
            Add Link
          </button>
        ) : null}
      </div>

      {/* Add link form */}
      {showForm && isOwner ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <p className="mb-4 text-sm font-semibold text-slate-800">Add a New Link</p>
          <Form method="post" preventScrollReset className="space-y-3">
            <input type="hidden" name="intent" value="create-link" />
            <input type="hidden" name="backHref" value={backHref} />
            <div>
              <label className={labelCls}>Label</label>
              <input
                type="text"
                name="label"
                required
                maxLength={100}
                placeholder="e.g. Lecture Slides, Reference Book…"
                className={inputCls}
                autoFocus
              />
            </div>
            <div>
              <label className={labelCls}>URL</label>
              <input
                type="url"
                name="url"
                required
                maxLength={500}
                placeholder="https://…"
                className={inputCls}
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={isSubmitting && intent === "create-link"}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
              >
                {isSubmitting && intent === "create-link" ? "Saving…" : "Save Link"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-100"
              >
                Cancel
              </button>
            </div>
          </Form>
        </div>
      ) : null}

      {/* Custom links list */}
      {customLinks.length === 0 && !showForm ? (
        !hasAnything ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <Link2 size={22} />
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-700">No links yet</p>
            <p className="mt-1 text-sm text-slate-400">
              {isOwner ? 'Click "Add Link" to save a URL with a label.' : "No links have been added to this course yet."}
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-400">No custom links added yet.</p>
        )
      ) : (
        <div className="flex flex-col gap-2">
          {customLinks.map((link) => {
            const isDeleting = isSubmitting && intent === "delete-link" && String(navigation.formData?.get("linkId")) === link.id;
            return (
              <div key={link.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-sm font-semibold text-indigo-700 transition hover:text-indigo-900"
                >
                  <ExternalLink size={14} className="shrink-0 text-slate-400" />
                  <span className="truncate">{link.label}</span>
                </a>
                {isOwner ? (
                  deleteConfirmId === link.id ? (
                    <div className="flex shrink-0 items-center gap-1">
                      <span className="text-xs text-slate-500">Remove?</span>
                      <button type="button" onClick={() => setDeleteConfirmId(null)} className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100">No</button>
                      <Form method="post" preventScrollReset>
                        <input type="hidden" name="intent" value="delete-link" />
                        <input type="hidden" name="linkId" value={link.id} />
                        <input type="hidden" name="backHref" value={backHref} />
                        <button type="submit" disabled={isDeleting} className="rounded-lg bg-red-600 px-2 py-1 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-60">
                          {isDeleting ? "…" : "Yes"}
                        </button>
                      </Form>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(link.id)}
                      className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                      title="Remove link"
                    >
                      <Trash2 size={15} />
                    </button>
                  )
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Quiz Tab ────────────────────────────────────────────────────────────────

function QuizTab({
  courseId,
  quizzes,
  navigation,
}: {
  courseId: string;
  quizzes: QuizEntry[];
  navigation: ReturnType<typeof useNavigation>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const isSubmitting = navigation.state === "submitting";
  const intent = String(navigation.formData?.get("intent") ?? "");

  function fmt(dateVal: Date | string) {
    return new Date(dateVal).toLocaleDateString(undefined, {
      year: "numeric", month: "short", day: "numeric",
    });
  }

  return (
    <div className="px-6 py-5">
      {/* Header row */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">
          {quizzes.length} / 4 {quizzes.length === 1 ? "quiz" : "quizzes"} logged
        </p>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          disabled={quizzes.length >= 4}
          title={quizzes.length >= 4 ? "Maximum 4 quizzes per course" : undefined}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={15} />
          Log Quiz
        </button>
      </div>

      {/* New quiz form */}
      {showForm ? (
        <Form method="post" preventScrollReset className="mb-6 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5">
          <input type="hidden" name="intent" value="create-quiz" />
          <input type="hidden" name="backHref" value={`/dashboard/courses/${courseId}?tab=quiz`} />
          <h3 className="mb-4 text-sm font-bold text-slate-800">Log a New Quiz</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-600">Quiz Title / Topic</label>
              <input
                name="title"
                type="text"
                required
                maxLength={200}
                placeholder="e.g. Mid-term Chapter 3-5"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none ring-indigo-300 transition focus:border-indigo-400 focus:ring-2"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-600">Syllabus / Topics Covered</label>
              <textarea
                name="syllabus"
                required
                maxLength={2000}
                rows={3}
                placeholder="Chapter 3: Arrays, Chapter 4: Linked Lists…"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none ring-indigo-300 transition focus:border-indigo-400 focus:ring-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Quiz Date</label>
              <input
                name="quizDate"
                type="date"
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none ring-indigo-300 transition focus:border-indigo-400 focus:ring-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Deadline <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input
                name="deadline"
                type="datetime-local"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none ring-indigo-300 transition focus:border-indigo-400 focus:ring-2"
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button
              type="submit"
              disabled={isSubmitting && intent === "create-quiz"}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60"
            >
              {isSubmitting && intent === "create-quiz" ? "Saving…" : "Save Quiz"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </Form>
      ) : null}

      {/* Quiz list */}
      {quizzes.length === 0 && !showForm ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <ClipboardList size={22} />
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-700">No quizzes logged yet</p>
          <p className="mt-1 text-sm text-slate-400">Click "Log Quiz" to add your first quiz.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {quizzes.map((quiz, idx) => {
            const isDeleting = isSubmitting && intent === "delete-quiz" && String(navigation.formData?.get("quizId")) === quiz.id;
            return (
              <div key={quiz.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <QuizReorderSelect
                        quizId={quiz.id}
                        serial={quiz.serial}
                        idx={idx}
                        quizCount={quizzes.length}
                        courseId={courseId}
                      />
                      <p className="truncate text-sm font-bold text-slate-800">{quiz.title}</p>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                        <CalendarDays size={12} />
                        Quiz: <span className="font-semibold text-slate-700">{fmt(quiz.quizDate)}</span>
                      </span>
                      {quiz.deadline ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-amber-600">
                          <Clock size={12} />
                          Deadline: <span className="font-semibold">{fmt(quiz.deadline)}</span>
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{quiz.syllabus}</p>
                  </div>
                  <div className="shrink-0">
                    {deleteConfirmId === quiz.id ? (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-slate-500">Delete?</span>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(null)}
                          className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100"
                        >
                          No
                        </button>
                        <Form method="post" preventScrollReset>
                          <input type="hidden" name="intent" value="delete-quiz" />
                          <input type="hidden" name="quizId" value={quiz.id} />
                          <input type="hidden" name="backHref" value={`/dashboard/courses/${courseId}?tab=quiz`} />
                          <button
                            type="submit"
                            disabled={isDeleting}
                            className="rounded-lg bg-red-600 px-2 py-1 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                          >
                            {isDeleting ? "…" : "Yes"}
                          </button>
                        </Form>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(quiz.id)}
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                        title="Delete quiz"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Assignment Tab ───────────────────────────────────────────────────────────

function AssignmentTab({
  courseId,
  assignments,
  navigation,
}: {
  courseId: string;
  assignments: AssignmentEntry[];
  navigation: ReturnType<typeof useNavigation>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const isSubmitting = navigation.state === "submitting";
  const intent = String(navigation.formData?.get("intent") ?? "");

  function fmt(dateVal: Date | string) {
    return new Date(dateVal).toLocaleString(undefined, {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  function isPast(dateVal: Date | string) {
    return new Date(dateVal) < new Date();
  }

  return (
    <div className="px-6 py-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">
          {assignments.length} {assignments.length === 1 ? "assignment" : "assignments"}
        </p>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
        >
          <Plus size={15} />
          Add Assignment
        </button>
      </div>

      {showForm ? (
        <Form method="post" preventScrollReset className="mb-6 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5">
          <input type="hidden" name="intent" value="create-assignment" />
          <input type="hidden" name="backHref" value={`/dashboard/courses/${courseId}?tab=assignment`} />
          <h3 className="mb-4 text-sm font-bold text-slate-800">Add Assignment</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-600">Title</label>
              <input
                name="title"
                type="text"
                required
                maxLength={200}
                placeholder="e.g. Assignment 1 — Sorting Algorithms"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none ring-indigo-300 transition focus:border-indigo-400 focus:ring-2"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-600">Description / Instructions</label>
              <textarea
                name="description"
                required
                maxLength={5000}
                rows={4}
                placeholder="Implement QuickSort and MergeSort, submit a report…"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none ring-indigo-300 transition focus:border-indigo-400 focus:ring-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Deadline</label>
              <input
                name="deadline"
                type="datetime-local"
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none ring-indigo-300 transition focus:border-indigo-400 focus:ring-2"
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button
              type="submit"
              disabled={isSubmitting && intent === "create-assignment"}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60"
            >
              {isSubmitting && intent === "create-assignment" ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-100">
              Cancel
            </button>
          </div>
        </Form>
      ) : null}

      {assignments.length === 0 && !showForm ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <FileText size={22} />
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-700">No assignments yet</p>
          <p className="mt-1 text-sm text-slate-400">Click "Add Assignment" to log one.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {assignments.map((a, idx) => {
            const isDeleting = isSubmitting && intent === "delete-assignment" && String(navigation.formData?.get("assignmentId")) === a.id;
            const overdue = isPast(a.deadline);
            return (
              <div key={a.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="shrink-0 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-700">#{idx + 1}</span>
                      <p className="text-sm font-bold text-slate-800">{a.title}</p>
                    </div>
                    <div className="mt-1.5">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${overdue ? "text-red-600" : "text-amber-600"}`}>
                        <Clock size={12} />
                        Deadline: {fmt(a.deadline)}{overdue ? " (overdue)" : ""}
                      </span>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{a.description}</p>
                  </div>
                  <div className="shrink-0">
                    {deleteConfirmId === a.id ? (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-slate-500">Delete?</span>
                        <button type="button" onClick={() => setDeleteConfirmId(null)} className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100">No</button>
                        <Form method="post" preventScrollReset>
                          <input type="hidden" name="intent" value="delete-assignment" />
                          <input type="hidden" name="assignmentId" value={a.id} />
                          <input type="hidden" name="backHref" value={`/dashboard/courses/${courseId}?tab=assignment`} />
                          <button type="submit" disabled={isDeleting} className="rounded-lg bg-red-600 px-2 py-1 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-60">
                            {isDeleting ? "…" : "Yes"}
                          </button>
                        </Form>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setDeleteConfirmId(a.id)} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600" title="Delete">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Exam Tab (Mid / Final) ───────────────────────────────────────────────────

function ExamTab({
  courseId,
  kind,
  exam,
  navigation,
}: {
  courseId: string;
  kind: "mid" | "final";
  exam: ExamEntry | null;
  navigation: ReturnType<typeof useNavigation>;
}) {
  const [showForm, setShowForm] = useState(false);
  const isSubmitting = navigation.state === "submitting";
  const intent = String(navigation.formData?.get("intent") ?? "");
  const upsertIntent = kind === "mid" ? "upsert-mid" : "upsert-final";
  const deleteIntent = kind === "mid" ? "delete-mid" : "delete-final";
  const label = kind === "mid" ? "Mid Exam" : "Final Exam";
  const tabParam = kind === "mid" ? "mid" : "final";

  function fmt(dateVal: Date | string) {
    return new Date(dateVal).toLocaleDateString(undefined, {
      year: "numeric", month: "long", day: "numeric",
    });
  }

  // Pre-fill form values from existing exam
  const defaultDate = exam ? new Date(exam.examDate).toISOString().slice(0, 10) : "";

  return (
    <div className="px-6 py-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">{label} Details</p>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
        >
          <Edit2 size={13} />
          {exam ? "Edit" : "Set Details"}
        </button>
      </div>

      {showForm ? (
        <Form method="post" preventScrollReset className="mb-6 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5">
          <input type="hidden" name="intent" value={upsertIntent} />
          <input type="hidden" name="backHref" value={`/dashboard/courses/${courseId}?tab=${tabParam}`} />
          <h3 className="mb-4 text-sm font-bold text-slate-800">{exam ? `Edit ${label}` : `Set ${label} Details`}</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-600">Syllabus / Topics</label>
              <textarea
                name="syllabus"
                required
                maxLength={5000}
                rows={4}
                defaultValue={exam?.syllabus ?? ""}
                placeholder="Chapter 1-6, all labs, case studies…"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none ring-indigo-300 transition focus:border-indigo-400 focus:ring-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Exam Date</label>
              <input
                name="examDate"
                type="date"
                required
                defaultValue={defaultDate}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none ring-indigo-300 transition focus:border-indigo-400 focus:ring-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Venue <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input
                name="venue"
                type="text"
                maxLength={200}
                defaultValue={exam?.venue ?? ""}
                placeholder="e.g. Hall A, Room 301"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none ring-indigo-300 transition focus:border-indigo-400 focus:ring-2"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Notes <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <textarea
                name="notes"
                maxLength={2000}
                rows={2}
                defaultValue={exam?.notes ?? ""}
                placeholder="Open book, bring calculator…"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none ring-indigo-300 transition focus:border-indigo-400 focus:ring-2"
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button type="submit" disabled={isSubmitting && intent === upsertIntent} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60">
              {isSubmitting && intent === upsertIntent ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-100">
              Cancel
            </button>
          </div>
        </Form>
      ) : null}

      {!exam && !showForm ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            {kind === "mid" ? <BookMarked size={22} /> : <GraduationCap size={22} />}
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-700">No {label} details yet</p>
          <p className="mt-1 text-sm text-slate-400">Click "Set Details" to add exam information.</p>
        </div>
      ) : exam ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-4">
              <div>
                <p className="text-[0.72rem] font-semibold uppercase tracking-wide text-slate-400">Exam Date</p>
                <p className="mt-0.5 text-sm font-bold text-slate-800">{fmt(exam.examDate)}</p>
              </div>
              {exam.venue ? (
                <div>
                  <p className="text-[0.72rem] font-semibold uppercase tracking-wide text-slate-400">Venue</p>
                  <p className="mt-0.5 text-sm text-slate-700">{exam.venue}</p>
                </div>
              ) : null}
              <div>
                <p className="text-[0.72rem] font-semibold uppercase tracking-wide text-slate-400">Syllabus</p>
                <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{exam.syllabus}</p>
              </div>
              {exam.notes ? (
                <div>
                  <p className="text-[0.72rem] font-semibold uppercase tracking-wide text-slate-400">Notes</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{exam.notes}</p>
                </div>
              ) : null}
            </div>
            <Form method="post" preventScrollReset className="shrink-0">
              <input type="hidden" name="intent" value={deleteIntent} />
              <input type="hidden" name="backHref" value={`/dashboard/courses/${courseId}?tab=${tabParam}`} />
              <button type="submit" disabled={isSubmitting && intent === deleteIntent} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-60" title="Remove exam details">
                <Trash2 size={15} />
              </button>
            </Form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── Presentation Tab ─────────────────────────────────────────────────────────

type PresentationEntry = {
  id: string;
  title: string;
  description: string;
  presentationDate: Date | string;
  venue: string | null;
  notes: string | null;
};

function PresentationTab({
  courseId,
  presentation,
  navigation,
}: {
  courseId: string;
  presentation: PresentationEntry | null;
  navigation: ReturnType<typeof useNavigation>;
}) {
  const [showForm, setShowForm] = useState(false);
  const isSubmitting = navigation.state === "submitting";
  const intent = String(navigation.formData?.get("intent") ?? "");
  const backHref = `/dashboard/courses/${courseId}?tab=presentation`;

  const defaultDate = presentation
    ? new Date(presentation.presentationDate).toISOString().slice(0, 10)
    : "";

  function fmt(dateVal: Date | string) {
    return new Date(dateVal).toLocaleDateString(undefined, {
      year: "numeric", month: "long", day: "numeric",
    });
  }

  return (
    <div className="px-6 py-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">Presentation Details</p>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
        >
          <Edit2 size={13} />
          {presentation ? "Edit" : "Set Details"}
        </button>
      </div>

      {showForm ? (
        <Form method="post" preventScrollReset className="mb-6 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5">
          <input type="hidden" name="intent" value="upsert-presentation" />
          <input type="hidden" name="backHref" value={backHref} />
          <h3 className="mb-4 text-sm font-bold text-slate-800">
            {presentation ? "Edit Presentation" : "Set Presentation Details"}
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Presentation Title / Topic <span className="text-red-500">*</span>
              </label>
              <input
                name="title"
                type="text"
                required
                maxLength={200}
                defaultValue={presentation?.title ?? ""}
                placeholder="e.g. Database Normalization Overview"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none ring-indigo-300 transition focus:border-indigo-400 focus:ring-2"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Description / What to Cover <span className="text-red-500">*</span>
              </label>
              <textarea
                name="description"
                required
                maxLength={5000}
                rows={4}
                defaultValue={presentation?.description ?? ""}
                placeholder="Topics, scope, key points to address…"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none ring-indigo-300 transition focus:border-indigo-400 focus:ring-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Presentation Date <span className="text-red-500">*</span>
              </label>
              <input
                name="presentationDate"
                type="date"
                required
                defaultValue={defaultDate}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none ring-indigo-300 transition focus:border-indigo-400 focus:ring-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Venue <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input
                name="venue"
                type="text"
                maxLength={200}
                defaultValue={presentation?.venue ?? ""}
                placeholder="e.g. Seminar Hall, Room 302"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none ring-indigo-300 transition focus:border-indigo-400 focus:ring-2"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Notes <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <textarea
                name="notes"
                maxLength={2000}
                rows={2}
                defaultValue={presentation?.notes ?? ""}
                placeholder="Time limit, group members, special instructions…"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none ring-indigo-300 transition focus:border-indigo-400 focus:ring-2"
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button
              type="submit"
              disabled={isSubmitting && intent === "upsert-presentation"}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60"
            >
              {isSubmitting && intent === "upsert-presentation" ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </Form>
      ) : null}

      {!presentation && !showForm ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Monitor size={22} />
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-700">No presentation details yet</p>
          <p className="mt-1 text-sm text-slate-400">Click "Set Details" to add presentation information.</p>
        </div>
      ) : presentation ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-4">
              <div>
                <p className="text-[0.72rem] font-semibold uppercase tracking-wide text-slate-400">Title</p>
                <p className="mt-0.5 text-sm font-bold text-slate-800">{presentation.title}</p>
              </div>
              <div>
                <p className="text-[0.72rem] font-semibold uppercase tracking-wide text-slate-400">Date</p>
                <p className="mt-0.5 text-sm font-bold text-slate-800">{fmt(presentation.presentationDate)}</p>
              </div>
              {presentation.venue ? (
                <div>
                  <p className="text-[0.72rem] font-semibold uppercase tracking-wide text-slate-400">Venue</p>
                  <p className="mt-0.5 text-sm text-slate-700">{presentation.venue}</p>
                </div>
              ) : null}
              <div>
                <p className="text-[0.72rem] font-semibold uppercase tracking-wide text-slate-400">Description</p>
                <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{presentation.description}</p>
              </div>
              {presentation.notes ? (
                <div>
                  <p className="text-[0.72rem] font-semibold uppercase tracking-wide text-slate-400">Notes</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{presentation.notes}</p>
                </div>
              ) : null}
            </div>
            <Form method="post" preventScrollReset className="shrink-0">
              <input type="hidden" name="intent" value="delete-presentation" />
              <input type="hidden" name="backHref" value={backHref} />
              <button
                type="submit"
                disabled={isSubmitting && intent === "delete-presentation"}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
                title="Remove presentation details"
              >
                <Trash2 size={15} />
              </button>
            </Form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StorageTab({
  courseId,
  storagePath,
  storageFiles,
  storageUsageBytes,
  navigation,
  r2PublicUrl,
}: {
  courseId: string;
  storagePath: string;
  storageFiles: StorageFile[];
  storageUsageBytes: number;
  navigation: ReturnType<typeof useNavigation>;
  r2PublicUrl: string;
}) {
  const [, setSearchParams] = useSearchParams();
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<StorageFile | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadFileName, setUploadFileName] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const wasCreatingFolder = useRef(false);

  useEffect(() => {
    if (navigation.state === "submitting" && String(navigation.formData?.get("intent") ?? "") === "create-folder") {
      wasCreatingFolder.current = true;
    }
    if (navigation.state === "idle" && wasCreatingFolder.current) {
      wasCreatingFolder.current = false;
      setShowNewFolder(false);
    }
  }, [navigation.state]);

  function copyShareLink(item: StorageFile) {
    const encodedKey = item.key.split("/").map(encodeURIComponent).join("/");
    const url = `${r2PublicUrl}/${encodedKey}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }
  const fileInputRef = useRef<HTMLInputElement>(null);
  const revalidator = useRevalidator();

  const isSubmitting = navigation.state === "submitting";
  const submittingIntent = String(navigation.formData?.get("intent") ?? "");
  const submittingFileId = String(navigation.formData?.get("fileId") ?? "");

  const usagePct = Math.min((storageUsageBytes / STORAGE_LIMIT_BYTES) * 100, 100);
  const crumbs = parseBreadcrumbs(storagePath);

  function navigateTo(path: string) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", "storage");
        next.set("path", path);
        return next;
      },
      { preventScrollReset: true },
    );
  }

  const storageBackHref = `/dashboard/courses/${courseId}?tab=storage&path=${encodeURIComponent(storagePath)}`;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadFileName(file.name);
    setUploadProgress(0);
    setUploadError(null);

    const fd = new FormData();
    fd.append("intent", "upload-file");
    fd.append("path", storagePath);
    fd.append("backHref", storageBackHref);
    fd.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", window.location.pathname + window.location.search);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        setUploadProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      setUploadProgress(null);
      setUploadFileName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      revalidator.revalidate();
    };

    xhr.onerror = () => {
      setUploadProgress(null);
      setUploadFileName("");
      setUploadError("Upload failed. Check your connection and try again.");
      if (fileInputRef.current) fileInputRef.current.value = "";
    };

    xhr.send(fd);
  }

  return (
    <div className="px-6 py-5 space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Breadcrumbs */}
        <nav className="flex min-w-0 flex-wrap items-center gap-1 text-sm text-slate-500">
          {crumbs.map((crumb, i) => (
            <span key={crumb.path} className="flex items-center gap-1">
              {i > 0 && <ChevronRight size={14} className="shrink-0 text-slate-300" />}
              {i === crumbs.length - 1 ? (
                <span className="font-semibold text-slate-800 truncate max-w-[140px]">{crumb.label}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => navigateTo(crumb.path)}
                  className="truncate max-w-[120px] transition-colors hover:text-indigo-600 hover:underline"
                >
                  {crumb.label}
                </button>
              )}
            </span>
          ))}
        </nav>

        {/* Action buttons */}
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setShowNewFolder(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <FolderPlus size={15} />
            New Folder
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadProgress !== null}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
          >
            <Upload size={15} />
            Upload
          </button>
          {/* Hidden file input — XHR handles the actual upload */}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>

      {/* Upload progress */}
      {uploadProgress !== null ? (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="flex min-w-0 items-center gap-2 font-medium text-indigo-700">
              <Upload size={13} className="shrink-0 animate-pulse" />
              <span className="truncate">Uploading {uploadFileName}…</span>
            </span>
            <span className="shrink-0 font-semibold text-indigo-700">{uploadProgress}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-indigo-200">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all duration-150"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      ) : null}

      {/* Inline upload error */}
      {uploadError ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{uploadError}</span>
          <button type="button" onClick={() => setUploadError(null)} className="shrink-0 text-red-400 hover:text-red-700 transition">
            <X size={15} />
          </button>
        </div>
      ) : null}

      {/* Usage bar */}
      <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
        <div className="mb-1.5 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1.5 font-medium">
            <HardDrive size={13} />
            Storage
          </span>
          <span>
            {formatBytes(storageUsageBytes)} / 500 MB
            <span className="ml-1 text-slate-400">({usagePct.toFixed(1)}%)</span>
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className={`h-full rounded-full transition-all ${usagePct > 90 ? "bg-red-500" : usagePct > 70 ? "bg-amber-500" : "bg-indigo-500"}`}
            style={{ width: `${usagePct}%` }}
          />
        </div>
      </div>

      {/* File grid */}
      {storageFiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-300">
            <FolderOpen size={26} />
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-700">This folder is empty</p>
          <p className="mt-1 text-xs text-slate-400">Upload files or create a folder to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {storageFiles.map((item) => {
            const isDeleting = isSubmitting && submittingIntent === "delete-file" && submittingFileId === item.id;
            const confirmingDelete = deleteConfirmId === item.id;
            const dateStr = new Date(item.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

            return (
              <div
                key={item.id}
                className="group relative flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-4 text-center transition hover:border-indigo-200 hover:shadow-md"
              >
                {/* Clickable icon / thumbnail */}
                {(() => {
                  const isImage = item.mimeType?.startsWith("image/");
                  const thumbUrl = isImage
                    ? `${r2PublicUrl}/${item.key.split("/").map(encodeURIComponent).join("/")}`
                    : null;
                  return (
                    <button
                      type="button"
                      onClick={() =>
                        item.isFolder
                          ? navigateTo(`${storagePath}${item.name}/`)
                          : setPreviewItem(item)
                      }
                      className={`overflow-hidden rounded-2xl transition group-hover:ring-2 group-hover:ring-indigo-300 ${
                        thumbUrl ? "h-24 w-full" : "flex h-16 w-16 items-center justify-center bg-slate-50 group-hover:bg-indigo-50"
                      }`}
                    >
                      {thumbUrl ? (
                        <img
                          src={thumbUrl}
                          alt={item.name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : item.isFolder ? (
                        <FolderOpen size={34} className="text-amber-400" />
                      ) : (
                        <MimeIcon mimeType={item.mimeType} size={30} />
                      )}
                    </button>
                  );
                })()}

                {/* Name */}
                <p className="mt-2.5 w-full truncate text-xs font-semibold text-slate-800" title={item.name}>
                  {item.name}
                </p>

                {/* Meta */}
                <p className="mt-0.5 text-[10px] text-slate-400">
                  {item.isFolder ? "Folder" : formatBytes(item.size)}
                </p>
                <p className="text-[10px] text-slate-300">{dateStr}</p>

                {/* Hover action bar */}
                {!confirmingDelete && (
                  <div className="absolute right-2 top-2 flex flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    {!item.isFolder && (
                      <>
                        <button
                          type="button"
                          onClick={() => setPreviewItem(item)}
                          className="rounded-lg bg-white p-1 shadow-sm border border-slate-100 text-slate-400 transition hover:text-indigo-600"
                          title="Preview"
                        >
                          <Eye size={13} />
                        </button>
                        <a
                          href={`/dashboard/courses/${courseId}/files/${item.id}?download=1`}
                          className="rounded-lg bg-white p-1 shadow-sm border border-slate-100 text-slate-400 transition hover:text-slate-700 flex items-center justify-center"
                          title="Download"
                        >
                          <Download size={13} />
                        </a>
                        <button
                          type="button"
                          onClick={() => copyShareLink(item)}
                          className={`rounded-lg bg-white p-1 shadow-sm border border-slate-100 transition ${
                            copiedId === item.id ? "text-green-600" : "text-slate-400 hover:text-slate-700"
                          }`}
                          title={copiedId === item.id ? "Copied!" : "Copy link"}
                        >
                          {copiedId === item.id ? <Check size={13} /> : <Copy size={13} />}
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(item.id)}
                      className="rounded-lg bg-white p-1 shadow-sm border border-slate-100 text-slate-400 transition hover:text-red-600"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}

                {/* Delete confirm overlay */}
                {confirmingDelete && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl bg-white/95 p-3">
                    <p className="text-xs font-semibold text-red-600">Delete?</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(null)}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        No
                      </button>
                      <Form method="post" preventScrollReset>
                        <input type="hidden" name="intent" value="delete-file" />
                        <input type="hidden" name="fileId" value={item.id} />
                        <input type="hidden" name="backHref" value={storageBackHref} />
                        <button
                          type="submit"
                          disabled={isDeleting}
                          className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                        >
                          {isDeleting ? "…" : "Yes"}
                        </button>
                      </Form>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showNewFolder ? (
        <NewFolderModal
          path={storagePath}
          courseId={courseId}
          isSubmitting={isSubmitting}
          onClose={() => setShowNewFolder(false)}
        />
      ) : null}

      {previewItem ? (
        <FilePreviewModal
          file={previewItem}
          courseId={courseId}
          onClose={() => setPreviewItem(null)}
        />
      ) : null}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

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

export default function CourseDetailPage() {
  const { course, backHref, viewerId, storageFiles, storageUsageBytes, storagePath, r2PublicUrl, quizzes, assignments, midExam, finalExam, customLinks, presentation } =
    useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const isOwner = viewerId === course.ownerId;

  type Tab = "information" | "links" | "storage" | "quiz" | "assignment" | "mid" | "final" | "presentation";
  const rawTab = searchParams.get("tab") ?? "information";
  const validTabs: Tab[] = ["links", "storage", "quiz", "assignment", "mid", "final", "presentation"];
  const activeTab: Tab = (validTabs.includes(rawTab as Tab) ? rawTab : "information") as Tab;

  const isSubmitting = navigation.state === "submitting";
  const isDeleting =
    isSubmitting && String(navigation.formData?.get("intent")) === "delete";

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
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <BookOpen size={22} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-slate-900 leading-snug">
                {course.title}
              </h1>
              <span className="mt-1 inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                {course.creditHours} credit hour{course.creditHours !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

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
        </div>

        {/* Delete confirm banner */}
        {deleteConfirm ? (
          <div className="flex items-center justify-between gap-4 border-b border-red-100 bg-red-50 px-6 py-4">
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

        {/* Tab bar */}
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
                <a
                  href={`tel:${course.teacherPhone}`}
                  className="transition-colors hover:text-indigo-600"
                >
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
          />
        ) : null}

        {/* Tab: Final */}
        {activeTab === "final" ? (
          <ExamTab
            courseId={course.id}
            kind="final"
            exam={finalExam as ExamEntry | null}
            navigation={navigation}
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

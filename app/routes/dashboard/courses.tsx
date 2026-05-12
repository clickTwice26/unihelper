import { useEffect, useRef, useState } from "react";
import { Form, Link, useLoaderData, useNavigation, useSearchParams } from "react-router";
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Mail,
  Phone,
  Plus,
  User,
  X,
} from "lucide-react";

import type { Route } from "./+types/courses";

type Course = {
  id: string;
  title: string;
  creditHours: number;
  teacherName: string;
  teacherInfo: string | null;
  teacherEmail: string | null;
  teacherPhone: string | null;
  blcLink: string | null;
  groupLink: string | null;
  ownerId: string;
  createdAt: Date;
};

type ModalState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; course: Course };

export function meta() {
  return [{ title: "Courses | UniBuddy" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { getAuthenticatedUser } = await import("~/lib/auth.server");
  const { redirect } = await import("react-router");
  const { getCourses, canAccessCourses, COURSES_PAGE_SIZE } = await import("~/lib/course.server");
  const { db } = await import("~/lib/db.server");

  const session = await getAuthenticatedUser(request);
  if (!session) throw redirect("/login");

  const url = new URL(request.url);
  const rawView = url.searchParams.get("view")?.trim() ?? "";
  // Sanitize: only accept CUID-style IDs
  const viewUserId =
    rawView && /^[a-z0-9_-]+$/i.test(rawView) && rawView !== session.id
      ? rawView
      : null;

  let ownerId = session.id;
  let ownerName: string | null = null;
  let isViewingBuddy = false;

  if (viewUserId) {
    const allowed = await canAccessCourses(session.id, viewUserId);
    if (!allowed) throw redirect("/dashboard/courses");
    const owner = await db.user.findUnique({
      where: { id: viewUserId },
      select: { id: true, displayName: true },
    });
    if (!owner) throw redirect("/dashboard/courses");
    ownerId = owner.id;
    ownerName = owner.displayName;
    isViewingBuddy = true;
  }

  const rawPage = parseInt(url.searchParams.get("page") ?? "0", 10);
  const page = isNaN(rawPage) || rawPage < 0 ? 0 : rawPage;

  const { cached } = await import("~/lib/cache.server");
  const { courses, totalCount } = await cached(
    `courses:${ownerId}:p${page}`,
    30,
    () => getCourses(session.id, ownerId, page),
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / COURSES_PAGE_SIZE));

  return { courses, ownerId, ownerName, isViewingBuddy, page, totalPages, totalCount };
}

export async function action({ request }: Route.ActionArgs) {
  const { getAuthenticatedUser } = await import("~/lib/auth.server");
  const { serializeFlash } = await import("~/lib/flash.server");
  const { rateLimit } = await import("~/lib/ratelimit.server");
  const { createCourse, updateCourse, deleteCourse } = await import(
    "~/lib/course.server"
  );
  const { redirect } = await import("react-router");

  const session = await getAuthenticatedUser(request);
  if (!session) throw new Response("Unauthorized", { status: 401 });

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "").trim();

  // Sanitize ownerId from form — never trust user input for URL construction
  let ownerId = String(formData.get("ownerId") ?? "").trim();
  if (!ownerId || !/^[a-z0-9_-]+$/i.test(ownerId)) {
    ownerId = session.id;
  }

  const redirectTo =
    ownerId !== session.id
      ? `/dashboard/courses?view=${ownerId}`
      : "/dashboard/courses";

  const flash = async (
    type: "success" | "error" | "warning",
    message: string,
  ) => {
    const headers = new Headers();
    headers.append("Set-Cookie", await serializeFlash({ type, message }));
    return redirect(redirectTo, { headers });
  };

  try {
    await rateLimit({
      key: `courses:${intent}:${session.id}`,
      limit: 60,
      windowSec: 3600,
    });
  } catch (err) {
    if (err instanceof Response && err.status === 429) {
      throw await flash("error", "Too many requests. Please wait and try again.");
    }
    throw err;
  }

  // ── Delete ──────────────────────────────────────────────────────────────
  if (intent === "delete") {
    const courseId = String(formData.get("courseId") ?? "").trim();
    if (!courseId) throw await flash("error", "Missing course ID.");
    const { invalidateCachePattern } = await import("~/lib/cache.server");
    try {
      await deleteCourse(session.id, courseId);
      await invalidateCachePattern(`courses:${session.id}:*`);
      throw await flash("success", "Course deleted.");
    } catch (err) {
      if (err instanceof Response) throw err;
      if (err instanceof Error && err.message === "FORBIDDEN")
        throw await flash("error", "You don't have permission to delete that course.");
      if (err instanceof Error && err.message === "NOT_FOUND")
        throw await flash("error", "Course not found.");
      throw await flash("error", "Failed to delete course.");
    }
  }

  // ── Shared validation for create / update ────────────────────────────────
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
    if (url.length > 500)
      throw new Error(`${label} must be under 500 characters.`);
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

  const data = {
    title: rawTitle,
    creditHours,
    teacherName: rawTeacherName,
    teacherInfo: rawTeacherInfo || null,
    teacherEmail: rawTeacherEmail || null,
    teacherPhone: rawTeacherPhone || null,
    blcLink,
    groupLink,
  };

  // ── Create ───────────────────────────────────────────────────────────────
  if (intent === "create") {
    const { invalidateCachePattern } = await import("~/lib/cache.server");
    try {
      await createCourse(session.id, ownerId, data);
      await invalidateCachePattern(`courses:${ownerId}:*`);
      throw await flash("success", "Course added.");
    } catch (err) {
      if (err instanceof Response) throw err;
      if (err instanceof Error && err.message === "FORBIDDEN")
        throw await flash("error", "You don't have permission to add a course here.");
      throw await flash("error", "Failed to add course.");
    }
  }

  // ── Update ───────────────────────────────────────────────────────────────
  if (intent === "update") {
    const courseId = String(formData.get("courseId") ?? "").trim();
    if (!courseId) throw await flash("error", "Missing course ID.");
    const { invalidateCachePattern } = await import("~/lib/cache.server");
    try {
      await updateCourse(session.id, courseId, data);
      await invalidateCachePattern(`courses:${ownerId}:*`);
      throw await flash("success", "Course updated.");
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

// ── Course Card ─────────────────────────────────────────────────────────────

function CourseCard({
  course,
  isViewingBuddy,
}: {
  course: Course;
  isViewingBuddy: boolean;
}) {
  const href = `/dashboard/courses/${course.id}${
    isViewingBuddy ? `?view=${course.ownerId}` : ""
  }`;

  return (
    <Link
      to={href}
      className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md hover:border-indigo-200"
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <BookOpen size={18} />
        </div>
        <div className="min-w-0">
          <h3 className="break-words text-sm font-semibold leading-snug text-slate-900">
            {course.title}
          </h3>
          <span className="mt-1 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[0.72rem] font-medium text-slate-600">
            {course.creditHours} credit{course.creditHours !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Teacher info */}
      <div className="space-y-1.5 border-t border-slate-100 pt-3">
        <div className="flex items-center gap-2 text-sm text-slate-700">
          <User size={14} className="shrink-0 text-slate-400" />
          <span className="font-medium">{course.teacherName}</span>
        </div>
        {course.teacherEmail ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Mail size={14} className="shrink-0 text-slate-400" />
            <span className="truncate">{course.teacherEmail}</span>
          </div>
        ) : null}
        {course.teacherPhone ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Phone size={14} className="shrink-0 text-slate-400" />
            <span>{course.teacherPhone}</span>
          </div>
        ) : null}
        {course.teacherInfo ? (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-400">
            {course.teacherInfo}
          </p>
        ) : null}
      </div>
    </Link>
  );
}

// ── Course Modal ─────────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";
const labelCls = "mb-1.5 block text-sm font-medium text-slate-700";

function CourseModal({
  mode,
  course,
  ownerId,
  isSubmitting,
  onClose,
}: {
  mode: "create" | "edit";
  course?: Course;
  ownerId: string;
  isSubmitting: boolean;
  onClose: () => void;
}) {
  const intent = mode === "create" ? "create" : "update";

  // Close on Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl">
        {/* Modal header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            {mode === "create" ? "Add Course" : "Edit Course"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable form body */}
        <div className="overflow-y-auto">
          <Form
            method="post"
            preventScrollReset
            className="space-y-4 px-6 py-5"
          >
            <input type="hidden" name="intent" value={intent} />
            <input type="hidden" name="ownerId" value={ownerId} />
            {mode === "edit" && course ? (
              <input type="hidden" name="courseId" value={course.id} />
            ) : null}

            {/* Title */}
            <div>
              <label className={labelCls}>
                Course Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="title"
                defaultValue={course?.title ?? ""}
                required
                maxLength={200}
                placeholder="e.g. Data Structures and Algorithms"
                className={inputCls}
                autoFocus
              />
            </div>

            {/* Credit Hours */}
            <div>
              <label className={labelCls}>
                Credit Hours <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="creditHours"
                defaultValue={course?.creditHours ?? ""}
                required
                min={0.5}
                max={12}
                step={0.5}
                placeholder="e.g. 3"
                className={inputCls}
              />
            </div>

            {/* Teacher Name */}
            <div>
              <label className={labelCls}>
                Teacher Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="teacherName"
                defaultValue={course?.teacherName ?? ""}
                required
                maxLength={100}
                placeholder="e.g. Dr. Jane Smith"
                className={inputCls}
              />
            </div>

            {/* Teacher Email + Phone */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Teacher Email</label>
                <input
                  type="email"
                  name="teacherEmail"
                  defaultValue={course?.teacherEmail ?? ""}
                  maxLength={200}
                  placeholder="teacher@university.edu"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Teacher Phone</label>
                <input
                  type="tel"
                  name="teacherPhone"
                  defaultValue={course?.teacherPhone ?? ""}
                  maxLength={30}
                  placeholder="+880 1234 567890"
                  className={inputCls}
                />
              </div>
            </div>

            {/* Teacher Info */}
            <div>
              <label className={labelCls}>Teacher Info / Notes</label>
              <textarea
                name="teacherInfo"
                defaultValue={course?.teacherInfo ?? ""}
                maxLength={2000}
                rows={3}
                placeholder="Office hours, consulting schedule, room number…"
                className={`${inputCls} resize-none`}
              />
            </div>

            {/* BLC Link */}
            <div>
              <label className={labelCls}>BLC Link</label>
              <input
                type="url"
                name="blcLink"
                defaultValue={course?.blcLink ?? ""}
                maxLength={500}
                placeholder="https://blc.diu.edu.bd/…"
                className={inputCls}
              />
            </div>

            {/* Group Link */}
            <div>
              <label className={labelCls}>Communication Group Link</label>
              <input
                type="url"
                name="groupLink"
                defaultValue={course?.groupLink ?? ""}
                maxLength={500}
                placeholder="https://chat.whatsapp.com/…"
                className={inputCls}
              />
            </div>

            {/* Footer actions */}
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
                {isSubmitting
                  ? mode === "create"
                    ? "Adding…"
                    : "Saving…"
                  : mode === "create"
                    ? "Add Course"
                    : "Save Changes"}
              </button>
            </div>
          </Form>
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CoursesPage() {
  const { courses, ownerId, ownerName, isViewingBuddy, page, totalPages, totalCount } =
    useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [modalState, setModalState] = useState<ModalState>({ mode: "closed" });

  const isSubmitting = navigation.state === "submitting";

  // Close modal after a successful mutation (nav goes submitting → loading)
  const prevNavState = useRef(navigation.state);
  useEffect(() => {
    if (
      prevNavState.current === "submitting" &&
      navigation.state === "loading"
    ) {
      setModalState({ mode: "closed" });
    }
    prevNavState.current = navigation.state;
  }, [navigation.state]);

  const ownerLabel = isViewingBuddy
    ? `${ownerName?.trim() || "Buddy"}'s Courses`
    : "My Courses";

  function goToPage(p: number) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (p === 0) next.delete("page");
        else next.set("page", String(p));
        return next;
      },
      { preventScrollReset: true },
    );
  }

  return (
    <div className="space-y-6">
      {/* Action row */}
      <div className="flex items-center justify-between gap-4">
        {isViewingBuddy ? (
          <Link
            to="/dashboard/social?tab=buddies"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
          >
            <ArrowLeft size={16} />
            Back to Buddies
          </Link>
        ) : (
          <p className="text-sm text-slate-500">
            {totalCount === 0
              ? "No courses yet."
              : `${totalCount} course${totalCount !== 1 ? "s" : ""}`}
          </p>
        )}
        <button
          type="button"
          onClick={() => setModalState({ mode: "create" })}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
        >
          <Plus size={16} />
          Add Course
        </button>
      </div>

      {/* Empty state */}
      {totalCount === 0 ? (
        <div className="flex flex-col items-center justify-center space-y-3 rounded-2xl border border-slate-200 bg-white py-24 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
            <BookOpen size={24} className="text-slate-400" />
          </div>
          <p className="text-base font-semibold text-slate-700">
            No courses in {ownerLabel}
          </p>
          <p className="max-w-xs text-sm text-slate-500">
            Add the first course using the button above.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {courses.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                isViewingBuddy={isViewingBuddy}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 ? (
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => goToPage(page - 1)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft size={16} />
                Previous
              </button>
              <span className="text-sm text-slate-500">
                Page {page + 1} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages - 1}
                onClick={() => goToPage(page + 1)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
                <ChevronRight size={16} />
              </button>
            </div>
          ) : null}
        </>
      )}

      {/* Modal */}
      {modalState.mode !== "closed" ? (
        <CourseModal
          mode={modalState.mode}
          course={modalState.mode === "edit" ? modalState.course : undefined}
          ownerId={ownerId}
          isSubmitting={isSubmitting}
          onClose={() => setModalState({ mode: "closed" })}
        />
      ) : null}
    </div>
  );
}

export { RouteErrorBoundary as ErrorBoundary } from "~/components/RouteErrorBoundary";

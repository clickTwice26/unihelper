import { useState } from "react";
import { Form, Link, useLoaderData, useNavigation, useSearchParams } from "react-router";
import {
  ArrowLeft,
  BookOpen,
  Edit2,
  ExternalLink,
  Info,
  Link2,
  Mail,
  MessageCircle,
  Phone,
  Trash2,
  User,
  X,
} from "lucide-react";

import type { Route } from "./+types/course-detail";

export function meta({ data }: Route.MetaArgs) {
  const title = (data as { course?: { title?: string } } | undefined)?.course?.title;
  return [{ title: title ? `${title} | Unihelper` : "Course | Unihelper" }];
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

  return { course, backHref, viewerId: session.id };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { getAuthenticatedUser } = await import("~/lib/auth.server");
  const { serializeFlash } = await import("~/lib/flash.server");
  const { rateLimit } = await import("~/lib/ratelimit.server");
  const { deleteCourse, updateCourse } = await import("~/lib/course.server");
  const { redirect } = await import("react-router");

  const session = await getAuthenticatedUser(request);
  if (!session) throw new Response("Unauthorized", { status: 401 });

  const courseId = params.courseId;
  if (!courseId) throw new Response("Bad Request", { status: 400 });

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "").trim();

  // Sanitize backHref from form — must start with /dashboard/
  let backHref = String(formData.get("backHref") ?? "").trim();
  if (!backHref.startsWith("/dashboard/")) backHref = "/dashboard/courses";

  const flash = async (type: "success" | "error" | "warning", message: string, to = backHref) => {
    const headers = new Headers();
    headers.append("Set-Cookie", await serializeFlash({ type, message }));
    return redirect(to, { headers });
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

  if (intent === "delete") {
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
  const { course, backHref } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const activeTab = searchParams.get("tab") === "links" ? "links" : "information";

  const isSubmitting = navigation.state === "submitting";
  const isDeleting =
    isSubmitting && String(navigation.formData?.get("intent")) === "delete";

  function switchTab(tab: "information" | "links") {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab === "information") {
        next.delete("tab");
      } else {
        next.set("tab", tab);
      }
      return next;
    }, { preventScrollReset: true });
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
          <button
            type="button"
            onClick={() => switchTab("information")}
            className={`flex items-center gap-2 border-b-2 py-3.5 pr-5 text-sm font-semibold transition-colors ${
              activeTab === "information"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Info size={15} />
            Information
          </button>
          <button
            type="button"
            onClick={() => switchTab("links")}
            className={`flex items-center gap-2 border-b-2 py-3.5 pr-5 text-sm font-semibold transition-colors ${
              activeTab === "links"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Link2 size={15} />
            Links
          </button>
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
          <div className="px-6 py-6">
            {course.blcLink || course.groupLink ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                {course.blcLink ? (
                  <a
                    href={course.blcLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                  >
                    <ExternalLink size={16} />
                    BLC Link
                  </a>
                ) : null}
                {course.groupLink ? (
                  <a
                    href={course.groupLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                  >
                    <MessageCircle size={16} />
                    Group Link
                  </a>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <Link2 size={22} />
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-700">No links added</p>
                <p className="mt-1 text-sm text-slate-400">
                  Edit this course to add a BLC link or communication group link.
                </p>
              </div>
            )}
          </div>
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

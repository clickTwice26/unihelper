import { useRef, useState } from "react";
import { Form, Link, useLoaderData, useNavigation, useSearchParams } from "react-router";
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  Edit2,
  ExternalLink,
  File,
  FilePlus,
  FolderOpen,
  FolderPlus,
  HardDrive,
  Info,
  Link2,
  Mail,
  MessageCircle,
  Phone,
  Trash2,
  Upload,
  User,
  X,
} from "lucide-react";

import type { Route } from "./+types/course-detail";

export function meta({ data }: Route.MetaArgs) {
  const title = (data as { course?: { title?: string } } | undefined)?.course?.title;
  return [{ title: title ? `${title} | Unihelper` : "Course | Unihelper" }];
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

  return { course, backHref, viewerId: session.id, storageFiles, storageUsageBytes, storagePath };
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
      const msgs: Record<string, string> = {
        EMPTY_FILE: "Cannot upload an empty file.",
        FILE_TOO_LARGE: "File exceeds the 50 MB per-file limit.",
        STORAGE_LIMIT_EXCEEDED: "Course storage limit (500 MB) would be exceeded.",
        FORBIDDEN: "You don't have permission.",
        COURSE_NOT_FOUND: "Course not found.",
      };
      throw await flash("error", err instanceof Error ? (msgs[err.message] ?? "Upload failed.") : "Upload failed.");
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

  // ── Course: delete ──────────────────────────────────────────────────────
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

function MimeIcon({ mimeType }: { mimeType: string | null }) {
  if (!mimeType) return <File size={18} className="text-slate-400" />;
  if (mimeType.startsWith("image/")) return <File size={18} className="text-emerald-500" />;
  if (mimeType === "application/pdf") return <File size={18} className="text-red-500" />;
  if (mimeType.includes("word") || mimeType.includes("document")) return <File size={18} className="text-blue-500" />;
  if (mimeType.includes("sheet") || mimeType.includes("excel")) return <File size={18} className="text-green-500" />;
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return <File size={18} className="text-orange-500" />;
  if (mimeType.startsWith("video/")) return <File size={18} className="text-purple-500" />;
  if (mimeType.startsWith("audio/")) return <File size={18} className="text-pink-500" />;
  return <File size={18} className="text-slate-400" />;
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

function StorageTab({
  courseId,
  storagePath,
  storageFiles,
  storageUsageBytes,
  navigation,
}: {
  courseId: string;
  storagePath: string;
  storageFiles: StorageFile[];
  storageUsageBytes: number;
  navigation: ReturnType<typeof useNavigation>;
}) {
  const [, setSearchParams] = useSearchParams();
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadFormRef = useRef<HTMLFormElement>(null);

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
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            <Upload size={15} />
            Upload
          </button>
          {/* Hidden upload form */}
          <Form
            method="post"
            encType="multipart/form-data"
            preventScrollReset
            ref={uploadFormRef}
            className="hidden"
          >
            <input type="hidden" name="intent" value="upload-file" />
            <input type="hidden" name="path" value={storagePath} />
            <input type="hidden" name="backHref" value={storageBackHref} />
            <input
              ref={fileInputRef}
              type="file"
              name="file"
              onChange={() => uploadFormRef.current?.requestSubmit()}
            />
          </Form>
        </div>
      </div>

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

      {/* File list */}
      {storageFiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-300">
            <FolderOpen size={26} />
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-700">This folder is empty</p>
          <p className="mt-1 text-xs text-slate-400">Upload files or create a folder to get started.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left">
                <th className="px-4 py-2.5 text-xs font-semibold text-slate-500">Name</th>
                <th className="hidden px-4 py-2.5 text-xs font-semibold text-slate-500 sm:table-cell">Size</th>
                <th className="hidden px-4 py-2.5 text-xs font-semibold text-slate-500 md:table-cell">Added</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {storageFiles.map((item) => {
                const isDeleting =
                  isSubmitting && submittingIntent === "delete-file" && submittingFileId === item.id;
                const confirmingDelete = deleteConfirmId === item.id;

                return (
                  <tr key={item.id} className="group transition-colors hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        {item.isFolder ? (
                          <FolderOpen size={18} className="shrink-0 text-amber-400" />
                        ) : (
                          <MimeIcon mimeType={item.mimeType} />
                        )}
                        {item.isFolder ? (
                          <button
                            type="button"
                            onClick={() => navigateTo(`${storagePath}${item.name}/`)}
                            className="truncate font-medium text-slate-800 transition-colors hover:text-indigo-600"
                          >
                            {item.name}
                          </button>
                        ) : (
                          <a
                            href={`/dashboard/courses/${courseId}/files/${item.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="truncate font-medium text-slate-800 transition-colors hover:text-indigo-600"
                          >
                            {item.name}
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 text-slate-500 sm:table-cell">
                      {item.isFolder ? "—" : formatBytes(item.size)}
                    </td>
                    <td className="hidden px-4 py-3 text-slate-500 md:table-cell">
                      {new Date(item.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      {confirmingDelete ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs font-medium text-red-600">Delete?</span>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(null)}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
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
                              className="rounded-lg bg-red-600 px-2 py-1 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                            >
                              {isDeleting ? "…" : "Yes"}
                            </button>
                          </Form>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          {!item.isFolder && (
                            <a
                              href={`/dashboard/courses/${courseId}/files/${item.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                              title="Download / Open"
                            >
                              <FilePlus size={15} />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(item.id)}
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                            title="Delete"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
  const { course, backHref, storageFiles, storageUsageBytes, storagePath } =
    useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  type Tab = "information" | "links" | "storage";
  const rawTab = searchParams.get("tab") ?? "information";
  const activeTab: Tab =
    rawTab === "links" ? "links" : rawTab === "storage" ? "storage" : "information";

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

        {/* Tab: Storage */}
        {activeTab === "storage" ? (
          <StorageTab
            courseId={course.id}
            storagePath={storagePath}
            storageFiles={storageFiles as StorageFile[]}
            storageUsageBytes={storageUsageBytes}
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

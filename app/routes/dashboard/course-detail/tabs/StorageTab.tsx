import { useEffect, useRef, useState } from "react";
import { Form, useNavigation, useRevalidator, useSearchParams } from "react-router";
import {
  Check,
  ChevronRight,
  Copy,
  Download,
  Eye,
  FolderOpen,
  FolderPlus,
  HardDrive,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { FilePreviewModal } from "../components/FilePreviewModal";
import { NewFolderModal } from "../components/NewFolderModal";
import { formatBytes, MimeIcon, parseBreadcrumbs } from "../helpers";
import type { StorageFile } from "../types";
import { STORAGE_LIMIT_BYTES } from "../types";

export function StorageTab({
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
    if (
      navigation.state === "submitting" &&
      String(navigation.formData?.get("intent") ?? "") === "create-folder"
    ) {
      wasCreatingFolder.current = true;
    }
    if (navigation.state === "idle" && wasCreatingFolder.current) {
      wasCreatingFolder.current = false;
      setShowNewFolder(false);
    }
  }, [navigation.state]);

  function copyShareLink(item: StorageFile) {
    const encodedKey = item.key
      .split("/")
      .map(encodeURIComponent)
      .join("/");
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
                <span className="font-semibold text-slate-800 truncate max-w-[140px]">
                  {crumb.label}
                </span>
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
          <button
            type="button"
            onClick={() => setUploadError(null)}
            className="shrink-0 text-red-400 hover:text-red-700 transition"
          >
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
            className={`h-full rounded-full transition-all ${
              usagePct > 90 ? "bg-red-500" : usagePct > 70 ? "bg-amber-500" : "bg-indigo-500"
            }`}
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
          <p className="mt-1 text-xs text-slate-400">
            Upload files or create a folder to get started.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {storageFiles.map((item) => {
            const isDeleting =
              isSubmitting &&
              submittingIntent === "delete-file" &&
              submittingFileId === item.id;
            const confirmingDelete = deleteConfirmId === item.id;
            const dateStr = new Date(item.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });

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
                        thumbUrl
                          ? "h-24 w-full"
                          : "flex h-16 w-16 items-center justify-center bg-slate-50 group-hover:bg-indigo-50"
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
                <p
                  className="mt-2.5 w-full truncate text-xs font-semibold text-slate-800"
                  title={item.name}
                >
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
                            copiedId === item.id
                              ? "text-green-600"
                              : "text-slate-400 hover:text-slate-700"
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

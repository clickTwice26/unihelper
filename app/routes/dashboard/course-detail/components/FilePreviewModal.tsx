import { Download, File, X } from "lucide-react";

import { formatBytes, previewType } from "../helpers";
import type { StorageFile } from "../types";

export function FilePreviewModal({
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
      <div
        className="absolute inset-0"
        onClick={onClose}
        role="button"
        tabIndex={-1}
        aria-label="Close preview"
        onKeyDown={(e) => e.key === "Escape" && onClose()}
      />
      <div className="pointer-events-none relative z-10 flex h-full flex-col">
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

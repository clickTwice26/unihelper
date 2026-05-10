import { Form } from "react-router";
import { X } from "lucide-react";

import { inputCls, labelCls } from "../helpers";

export function NewFolderModal({
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
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">New Folder</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            <X size={16} />
          </button>
        </div>
        <Form method="post" preventScrollReset className="px-5 py-4 space-y-4">
          <input type="hidden" name="intent" value="create-folder" />
          <input type="hidden" name="path" value={path} />
          <input type="hidden" name="backHref" value={storageBackHref} />
          <div>
            <label className={labelCls}>Folder Name</label>
            <input
              type="text"
              name="folderName"
              required
              maxLength={100}
              placeholder="e.g. Lectures"
              className={inputCls}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition disabled:opacity-60"
            >
              {isSubmitting ? "Creating…" : "Create"}
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}

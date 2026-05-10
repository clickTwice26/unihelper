import { Form } from "react-router";
import { X } from "lucide-react";

import { inputCls, labelCls } from "../helpers";
import type { CourseShape } from "../types";

export function EditModal({
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

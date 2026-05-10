import { useState } from "react";
import { Form, useNavigation } from "react-router";
import { BookMarked, Edit2, GraduationCap, Trash2 } from "lucide-react";

import type { ExamEntry } from "../types";

export function ExamTab({
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
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

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
        <Form
          method="post"
          preventScrollReset
          className="mb-6 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5"
        >
          <input type="hidden" name="intent" value={upsertIntent} />
          <input
            type="hidden"
            name="backHref"
            value={`/dashboard/courses/${courseId}?tab=${tabParam}`}
          />
          <h3 className="mb-4 text-sm font-bold text-slate-800">
            {exam ? `Edit ${label}` : `Set ${label} Details`}
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Syllabus / Topics
              </label>
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
            <button
              type="submit"
              disabled={isSubmitting && intent === upsertIntent}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60"
            >
              {isSubmitting && intent === upsertIntent ? "Saving…" : "Save"}
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

      {!exam && !showForm ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            {kind === "mid" ? <BookMarked size={22} /> : <GraduationCap size={22} />}
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-700">No {label} details yet</p>
          <p className="mt-1 text-sm text-slate-400">
            Click &ldquo;Set Details&rdquo; to add exam information.
          </p>
        </div>
      ) : exam ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-4">
              <div>
                <p className="text-[0.72rem] font-semibold uppercase tracking-wide text-slate-400">
                  Exam Date
                </p>
                <p className="mt-0.5 text-sm font-bold text-slate-800">{fmt(exam.examDate)}</p>
              </div>
              {exam.venue ? (
                <div>
                  <p className="text-[0.72rem] font-semibold uppercase tracking-wide text-slate-400">
                    Venue
                  </p>
                  <p className="mt-0.5 text-sm text-slate-700">{exam.venue}</p>
                </div>
              ) : null}
              <div>
                <p className="text-[0.72rem] font-semibold uppercase tracking-wide text-slate-400">
                  Syllabus
                </p>
                <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                  {exam.syllabus}
                </p>
              </div>
              {exam.notes ? (
                <div>
                  <p className="text-[0.72rem] font-semibold uppercase tracking-wide text-slate-400">
                    Notes
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                    {exam.notes}
                  </p>
                </div>
              ) : null}
            </div>
            <Form method="post" preventScrollReset className="shrink-0">
              <input type="hidden" name="intent" value={deleteIntent} />
              <input
                type="hidden"
                name="backHref"
                value={`/dashboard/courses/${courseId}?tab=${tabParam}`}
              />
              <button
                type="submit"
                disabled={isSubmitting && intent === deleteIntent}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
                title="Remove exam details"
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

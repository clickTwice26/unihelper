import { useState } from "react";
import { Form, useNavigation } from "react-router";
import { Clock, FileText, Plus, Trash2 } from "lucide-react";

import type { AssignmentEntry } from "../types";

export function AssignmentTab({
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
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
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
        <Form
          method="post"
          preventScrollReset
          className="mb-6 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5"
        >
          <input type="hidden" name="intent" value="create-assignment" />
          <input
            type="hidden"
            name="backHref"
            value={`/dashboard/courses/${courseId}?tab=assignment`}
          />
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
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Description / Instructions
              </label>
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

      {assignments.length === 0 && !showForm ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <FileText size={22} />
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-700">No assignments yet</p>
          <p className="mt-1 text-sm text-slate-400">Click &ldquo;Add Assignment&rdquo; to log one.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {assignments.map((a, idx) => {
            const isDeleting =
              isSubmitting &&
              intent === "delete-assignment" &&
              String(navigation.formData?.get("assignmentId")) === a.id;
            const overdue = isPast(a.deadline);
            return (
              <div key={a.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="shrink-0 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
                        #{idx + 1}
                      </span>
                      <p className="text-sm font-bold text-slate-800">{a.title}</p>
                    </div>
                    <div className="mt-1.5">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                          overdue ? "text-red-600" : "text-amber-600"
                        }`}
                      >
                        <Clock size={12} />
                        Deadline: {fmt(a.deadline)}
                        {overdue ? " (overdue)" : ""}
                      </span>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                      {a.description}
                    </p>
                  </div>
                  <div className="shrink-0">
                    {deleteConfirmId === a.id ? (
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
                          <input type="hidden" name="intent" value="delete-assignment" />
                          <input type="hidden" name="assignmentId" value={a.id} />
                          <input
                            type="hidden"
                            name="backHref"
                            value={`/dashboard/courses/${courseId}?tab=assignment`}
                          />
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
                        onClick={() => setDeleteConfirmId(a.id)}
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                        title="Delete"
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

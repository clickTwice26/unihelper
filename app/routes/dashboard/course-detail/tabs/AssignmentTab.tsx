import { useState } from "react";
import { Form, useNavigation } from "react-router";
import { Clock, Edit2, FileText, Plus, Trash2, X } from "lucide-react";

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
  const [editingAssignment, setEditingAssignment] = useState<AssignmentEntry | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const isSubmitting = navigation.state === "submitting";
  const intent = String(navigation.formData?.get("intent") ?? "");
  const isEditing = editingAssignment !== null;

  function openCreateForm() {
    setEditingAssignment(null);
    setShowForm(true);
  }

  function openEditForm(assignment: AssignmentEntry) {
    setEditingAssignment(assignment);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingAssignment(null);
  }

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
          onClick={openCreateForm}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
        >
          <Plus size={15} />
          Add Assignment
        </button>
      </div>

      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={closeForm} aria-hidden="true" />
          <div className="relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 className="text-base font-semibold text-slate-900">
                {isEditing ? "Edit Assignment" : "Add Assignment"}
              </h2>
              <button
                type="button"
                onClick={closeForm}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto">
              <Form
                key={editingAssignment?.id ?? "new-assignment"}
                method="post"
                preventScrollReset
                className="space-y-4 px-6 py-5"
              >
                <input type="hidden" name="intent" value={isEditing ? "update-assignment" : "create-assignment"} />
                {editingAssignment ? <input type="hidden" name="assignmentId" value={editingAssignment.id} /> : null}
                <input type="hidden" name="backHref" value={`/dashboard/courses/${courseId}?tab=assignment`} />
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Title</label>
                  <input
                    name="title"
                    type="text"
                    required
                    maxLength={200}
                    defaultValue={editingAssignment?.title ?? ""}
                    placeholder="e.g. Assignment 1 — Sorting Algorithms"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none ring-indigo-300 transition focus:border-indigo-400 focus:ring-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Description / Instructions
                  </label>
                  <textarea
                    name="description"
                    required
                    maxLength={5000}
                    rows={4}
                    defaultValue={editingAssignment?.description ?? ""}
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
                    defaultValue={
                      editingAssignment ? new Date(editingAssignment.deadline).toISOString().slice(0, 16) : ""
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none ring-indigo-300 transition focus:border-indigo-400 focus:ring-2"
                  />
                </div>
                <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={closeForm}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting && intent === (isEditing ? "update-assignment" : "create-assignment")}
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {isSubmitting && intent === (isEditing ? "update-assignment" : "create-assignment")
                      ? "Saving…"
                      : isEditing
                        ? "Save Changes"
                        : "Save Assignment"}
                  </button>
                </div>
              </Form>
            </div>
          </div>
        </div>
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
                    <button
                      type="button"
                      onClick={() => openEditForm(a)}
                      className="mr-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                      title="Edit assignment"
                    >
                      <Edit2 size={12} />
                      Edit
                    </button>
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

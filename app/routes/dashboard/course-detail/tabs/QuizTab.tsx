import { useRef, useState } from "react";
import { Form, useNavigation } from "react-router";
import { CalendarDays, ClipboardList, Clock, Edit2, Plus, Trash2, X } from "lucide-react";

import { CustomSelect } from "~/components/ui/select";
import type { QuizEntry } from "../types";

function QuizReorderSelect({
  quizId,
  serial,
  idx,
  quizCount,
  courseId,
}: {
  quizId: string;
  serial: number;
  idx: number;
  quizCount: number;
  courseId: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const options = Array.from({ length: quizCount }, (_, i) => ({
    value: String(i + 1),
    label: `#${i + 1}`,
  }));
  return (
    <Form method="post" preventScrollReset ref={formRef}>
      <input type="hidden" name="intent" value="reorder-quiz" />
      <input type="hidden" name="quizId" value={quizId} />
      <input type="hidden" name="backHref" value={`/dashboard/courses/${courseId}?tab=quiz`} />
      <CustomSelect
        name="newSerial"
        defaultValue={String(serial || idx + 1)}
        options={options}
        onChange={() => formRef.current?.submit()}
        className="!w-auto !rounded-full !border-0 !bg-indigo-100 !py-0.5 !px-2 !text-xs !font-bold !text-indigo-700 hover:!bg-indigo-200 !shadow-none"
      />
    </Form>
  );
}

export function QuizTab({
  courseId,
  quizzes,
  navigation,
}: {
  courseId: string;
  quizzes: QuizEntry[];
  navigation: ReturnType<typeof useNavigation>;
}) {
  const [editingQuiz, setEditingQuiz] = useState<QuizEntry | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const isSubmitting = navigation.state === "submitting";
  const intent = String(navigation.formData?.get("intent") ?? "");
  const isEditing = editingQuiz !== null;

  function openCreateForm() {
    setEditingQuiz(null);
    setShowForm(true);
  }

  function openEditForm(quiz: QuizEntry) {
    setEditingQuiz(quiz);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingQuiz(null);
  }

  function fmt(dateVal: Date | string) {
    return new Date(dateVal).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <div className="px-6 py-5">
      {/* Header row */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">
          {quizzes.length} / 4 {quizzes.length === 1 ? "quiz" : "quizzes"} logged
        </p>
        <button
          type="button"
          onClick={openCreateForm}
          disabled={!isEditing && quizzes.length >= 4}
          title={!isEditing && quizzes.length >= 4 ? "Maximum 4 quizzes per course" : undefined}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={15} />
          Log Quiz
        </button>
      </div>

      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={closeForm} aria-hidden="true" />
          <div className="relative z-10 flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 className="text-base font-semibold text-slate-900">
                {isEditing ? "Edit Quiz" : "Log a New Quiz"}
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
                key={editingQuiz?.id ?? "new-quiz"}
                method="post"
                preventScrollReset
                className="space-y-4 px-6 py-5"
              >
                <input type="hidden" name="intent" value={isEditing ? "update-quiz" : "create-quiz"} />
                {editingQuiz ? <input type="hidden" name="quizId" value={editingQuiz.id} /> : null}
                <input type="hidden" name="backHref" value={`/dashboard/courses/${courseId}?tab=quiz`} />
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Quiz Title / Topic</label>
                  <input
                    name="title"
                    type="text"
                    required
                    maxLength={200}
                    defaultValue={editingQuiz?.title ?? ""}
                    placeholder="e.g. Mid-term Chapter 3-5"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none ring-indigo-300 transition focus:border-indigo-400 focus:ring-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Syllabus / Topics Covered</label>
                  <textarea
                    name="syllabus"
                    required
                    maxLength={2000}
                    rows={4}
                    defaultValue={editingQuiz?.syllabus ?? ""}
                    placeholder="Chapter 3: Arrays, Chapter 4: Linked Lists…"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none ring-indigo-300 transition focus:border-indigo-400 focus:ring-2"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">Quiz Date</label>
                    <input
                      name="quizDate"
                      type="date"
                      required
                      defaultValue={editingQuiz ? new Date(editingQuiz.quizDate).toISOString().slice(0, 10) : ""}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none ring-indigo-300 transition focus:border-indigo-400 focus:ring-2"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">
                      Deadline <span className="font-normal text-slate-400">(optional)</span>
                    </label>
                    <input
                      name="deadline"
                      type="datetime-local"
                      defaultValue={
                        editingQuiz?.deadline
                          ? new Date(editingQuiz.deadline).toISOString().slice(0, 16)
                          : ""
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none ring-indigo-300 transition focus:border-indigo-400 focus:ring-2"
                    />
                  </div>
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
                    disabled={isSubmitting && intent === (isEditing ? "update-quiz" : "create-quiz")}
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {isSubmitting && intent === (isEditing ? "update-quiz" : "create-quiz")
                      ? "Saving…"
                      : isEditing
                        ? "Save Changes"
                        : "Save Quiz"}
                  </button>
                </div>
              </Form>
            </div>
          </div>
        </div>
      ) : null}

      {/* Quiz list */}
      {quizzes.length === 0 && !showForm ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <ClipboardList size={22} />
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-700">No quizzes logged yet</p>
          <p className="mt-1 text-sm text-slate-400">Click &ldquo;Log Quiz&rdquo; to add your first quiz.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {quizzes.map((quiz, idx) => {
            const isDeleting =
              isSubmitting &&
              intent === "delete-quiz" &&
              String(navigation.formData?.get("quizId")) === quiz.id;
            return (
              <div key={quiz.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <QuizReorderSelect
                        quizId={quiz.id}
                        serial={quiz.serial}
                        idx={idx}
                        quizCount={quizzes.length}
                        courseId={courseId}
                      />
                      <p className="truncate text-sm font-bold text-slate-800">{quiz.title}</p>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                        <CalendarDays size={12} />
                        Quiz: <span className="font-semibold text-slate-700">{fmt(quiz.quizDate)}</span>
                      </span>
                      {quiz.deadline ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-amber-600">
                          <Clock size={12} />
                          Deadline: <span className="font-semibold">{fmt(quiz.deadline)}</span>
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                      {quiz.syllabus}
                    </p>
                  </div>
                  <div className="shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditForm(quiz)}
                      className="mr-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                      title="Edit quiz"
                    >
                      <Edit2 size={12} />
                      Edit
                    </button>
                    {deleteConfirmId === quiz.id ? (
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
                          <input type="hidden" name="intent" value="delete-quiz" />
                          <input type="hidden" name="quizId" value={quiz.id} />
                          <input
                            type="hidden"
                            name="backHref"
                            value={`/dashboard/courses/${courseId}?tab=quiz`}
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
                        onClick={() => setDeleteConfirmId(quiz.id)}
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                        title="Delete quiz"
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

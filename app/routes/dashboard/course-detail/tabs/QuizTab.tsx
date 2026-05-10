import { useRef, useState } from "react";
import { Form, useNavigation } from "react-router";
import { CalendarDays, ClipboardList, Clock, Plus, Trash2 } from "lucide-react";

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
  const [showForm, setShowForm] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const isSubmitting = navigation.state === "submitting";
  const intent = String(navigation.formData?.get("intent") ?? "");

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
          onClick={() => setShowForm((v) => !v)}
          disabled={quizzes.length >= 4}
          title={quizzes.length >= 4 ? "Maximum 4 quizzes per course" : undefined}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={15} />
          Log Quiz
        </button>
      </div>

      {/* New quiz form */}
      {showForm ? (
        <Form
          method="post"
          preventScrollReset
          className="mb-6 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5"
        >
          <input type="hidden" name="intent" value="create-quiz" />
          <input type="hidden" name="backHref" value={`/dashboard/courses/${courseId}?tab=quiz`} />
          <h3 className="mb-4 text-sm font-bold text-slate-800">Log a New Quiz</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-600">Quiz Title / Topic</label>
              <input
                name="title"
                type="text"
                required
                maxLength={200}
                placeholder="e.g. Mid-term Chapter 3-5"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none ring-indigo-300 transition focus:border-indigo-400 focus:ring-2"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-600">Syllabus / Topics Covered</label>
              <textarea
                name="syllabus"
                required
                maxLength={2000}
                rows={3}
                placeholder="Chapter 3: Arrays, Chapter 4: Linked Lists…"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none ring-indigo-300 transition focus:border-indigo-400 focus:ring-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Quiz Date</label>
              <input
                name="quizDate"
                type="date"
                required
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
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none ring-indigo-300 transition focus:border-indigo-400 focus:ring-2"
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button
              type="submit"
              disabled={isSubmitting && intent === "create-quiz"}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60"
            >
              {isSubmitting && intent === "create-quiz" ? "Saving…" : "Save Quiz"}
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

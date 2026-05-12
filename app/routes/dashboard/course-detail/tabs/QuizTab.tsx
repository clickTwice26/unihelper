import { useRef, useState } from "react";
import { Form, useNavigation } from "react-router";
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Clock,
  Edit2,
  Eye,
  EyeOff,
  FlaskConical,
  ImagePlus,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import { CustomSelect } from "~/components/ui/select";
import type { MockQuizData, QuizEntry } from "../types";

function fmt(dateVal: Date | string) {
  return new Date(dateVal).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ── Quiz reorder select ───────────────────────────────────────────────────────

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

// ── Zoomable image card ───────────────────────────────────────────────────────

function QuizImageCard({ src, alt, accent = "slate" }: { src: string; alt: string; accent?: "slate" | "emerald" }) {
  const [lightbox, setLightbox] = useState(false);
  const border = accent === "emerald" ? "border-emerald-200" : "border-slate-200";
  return (
    <>
      <button
        type="button"
        onClick={() => setLightbox(true)}
        className={`group relative w-full overflow-hidden rounded-xl border ${border} shadow-sm transition hover:shadow-md`}
      >
        <img src={src} alt={alt} className="max-h-56 w-full object-contain transition group-hover:scale-[1.02]" />
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/8">
          <span className="rounded bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white opacity-0 transition group-hover:opacity-100">Expand</span>
        </div>
      </button>
      {lightbox ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4" onClick={() => setLightbox(false)}>
          <button type="button" onClick={() => setLightbox(false)} className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20" aria-label="Close">
            <X size={20} />
          </button>
          <img src={src} alt={alt} className="max-h-[90vh] max-w-full rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      ) : null}
    </>
  );
}

// ── My editable mock quiz section ─────────────────────────────────────────────

function MyMockQuizSection({
  quiz,
  courseId,
  r2PublicUrl,
  isSubmitting,
  pendingIntent,
  pendingQuizId,
}: {
  quiz: QuizEntry;
  courseId: string;
  r2PublicUrl: string;
  isSubmitting: boolean;
  pendingIntent: string;
  pendingQuizId: string;
}) {
  const mq: MockQuizData = quiz.myMockQuiz;
  const [showAnswer, setShowAnswer] = useState(false);
  const [aPreview, setAPreview] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<"question" | "answer" | null>(null);
  const qInputRef = useRef<HTMLInputElement>(null);
  const qFormRef = useRef<HTMLFormElement>(null);
  const aInputRef = useRef<HTMLInputElement>(null);
  const aFormRef = useRef<HTMLFormElement>(null);

  const hasQuestion = !!mq?.questionImageKey;
  const hasAnswer = !!mq?.answerImageKey;
  const qUrl = hasQuestion ? `${r2PublicUrl}/${mq!.questionImageKey}` : null;
  const aUrl = hasAnswer ? `${r2PublicUrl}/${mq!.answerImageKey}` : null;

  const myPending = pendingQuizId === quiz.id;
  const submittingQ = myPending && pendingIntent === "set-mock-question";
  const submittingA = myPending && pendingIntent === "set-mock-answer";
  const deletingQ = myPending && pendingIntent === "delete-mock-question";
  const deletingA = myPending && pendingIntent === "delete-mock-answer";

  function onQuestionPicked(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.[0]) return;
    setTimeout(() => qFormRef.current?.submit(), 50);
  }

  function onAnswerPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (aPreview) URL.revokeObjectURL(aPreview);
    setAPreview(URL.createObjectURL(file));
  }

  return (
    <div className="space-y-3">
      {!hasQuestion ? (
        <Form ref={qFormRef} method="post" encType="multipart/form-data" preventScrollReset>
          <input type="hidden" name="intent" value="set-mock-question" />
          <input type="hidden" name="quizId" value={quiz.id} />
          <input type="hidden" name="backHref" value={`/dashboard/courses/${courseId}?tab=quiz`} />
          <input ref={qInputRef} type="file" name="questionImage" accept="image/*" className="hidden" onChange={onQuestionPicked} />
          <button
            type="button"
            onClick={() => qInputRef.current?.click()}
            disabled={submittingQ}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/40 py-7 text-indigo-400 transition hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-60"
          >
            <ImagePlus size={20} />
            <span className="text-sm font-semibold">{submittingQ ? "Uploading…" : "Upload Question Photo"}</span>
            <span className="text-xs text-slate-400">Tap to choose a photo of the question</span>
          </button>
        </Form>
      ) : (
        <>
          {/* Question */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Question</p>
              <div className="flex items-center gap-1">
                <Form ref={qFormRef} method="post" encType="multipart/form-data" preventScrollReset>
                  <input type="hidden" name="intent" value="set-mock-question" />
                  <input type="hidden" name="quizId" value={quiz.id} />
                  <input type="hidden" name="backHref" value={`/dashboard/courses/${courseId}?tab=quiz`} />
                  <input ref={qInputRef} type="file" name="questionImage" accept="image/*" className="hidden" onChange={onQuestionPicked} />
                  <button type="button" onClick={() => qInputRef.current?.click()} disabled={submittingQ} title="Replace question" className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-indigo-600">
                    <Edit2 size={12} />
                  </button>
                </Form>
                {deleteConfirm === "question" ? (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-slate-500">Reset?</span>
                    <button type="button" onClick={() => setDeleteConfirm(null)} className="rounded px-1.5 py-0.5 text-xs font-semibold text-slate-500 hover:bg-slate-100">No</button>
                    <Form method="post" preventScrollReset>
                      <input type="hidden" name="intent" value="delete-mock-question" />
                      <input type="hidden" name="quizId" value={quiz.id} />
                      <input type="hidden" name="backHref" value={`/dashboard/courses/${courseId}?tab=quiz`} />
                      <button type="submit" disabled={deletingQ} className="rounded bg-red-600 px-1.5 py-0.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60">{deletingQ ? "…" : "Yes"}</button>
                    </Form>
                  </div>
                ) : (
                  <button type="button" onClick={() => setDeleteConfirm("question")} title="Clear mock quiz" className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500">
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
            <QuizImageCard src={qUrl!} alt="Question" />
          </div>

          {/* Answer */}
          {!hasAnswer ? (
            <Form ref={aFormRef} method="post" encType="multipart/form-data" preventScrollReset>
              <input type="hidden" name="intent" value="set-mock-answer" />
              <input type="hidden" name="quizId" value={quiz.id} />
              <input type="hidden" name="backHref" value={`/dashboard/courses/${courseId}?tab=quiz`} />
              <input ref={aInputRef} type="file" name="answerImage" accept="image/*" className="hidden" onChange={onAnswerPicked} />
              <div className="rounded-xl border-2 border-dashed border-amber-200 bg-amber-50/40 p-4">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-wide text-amber-500">Waiting for Answer</p>
                {aPreview ? (
                  <div className="space-y-3">
                    <div className="relative overflow-hidden rounded-xl border border-slate-200">
                      <img src={aPreview} alt="Answer preview" className="max-h-48 w-full object-contain" />
                      <button
                        type="button"
                        onClick={() => { URL.revokeObjectURL(aPreview); setAPreview(null); if (aInputRef.current) aInputRef.current.value = ""; }}
                        className="absolute right-2 top-2 rounded-full bg-white/90 p-1 text-slate-500 shadow-sm hover:text-red-500"
                      >
                        <X size={13} />
                      </button>
                    </div>
                    <textarea name="notes" maxLength={2000} rows={2} placeholder="Optional notes…" className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none ring-indigo-300 transition focus:border-indigo-400 focus:ring-2" />
                    <button type="submit" disabled={submittingA} className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60">
                      {submittingA ? "Saving…" : "Save Answer"}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => aInputRef.current?.click()}
                    disabled={submittingA}
                    className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-amber-300 bg-amber-50 py-5 text-amber-500 transition hover:border-amber-400 hover:bg-amber-100 disabled:opacity-60"
                  >
                    <ImagePlus size={16} />
                    <span className="text-sm font-semibold">Upload Answer Photo</span>
                  </button>
                )}
              </div>
            </Form>
          ) : (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowAnswer((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                >
                  {showAnswer ? <EyeOff size={12} /> : <Eye size={12} />}
                  {showAnswer ? "Hide Answer" : "Show Answer"}
                </button>
                <div className="flex items-center gap-1">
                  <Form ref={aFormRef} method="post" encType="multipart/form-data" preventScrollReset>
                    <input type="hidden" name="intent" value="set-mock-answer" />
                    <input type="hidden" name="quizId" value={quiz.id} />
                    <input type="hidden" name="backHref" value={`/dashboard/courses/${courseId}?tab=quiz`} />
                    <input ref={aInputRef} type="file" name="answerImage" accept="image/*" className="hidden" onChange={(e) => { onAnswerPicked(e); setTimeout(() => aFormRef.current?.submit(), 50); }} />
                    <button type="button" onClick={() => aInputRef.current?.click()} disabled={submittingA} title="Replace answer" className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-indigo-600">
                      <Edit2 size={12} />
                    </button>
                  </Form>
                  {deleteConfirm === "answer" ? (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-500">Remove?</span>
                      <button type="button" onClick={() => setDeleteConfirm(null)} className="rounded px-1.5 py-0.5 text-xs font-semibold text-slate-500 hover:bg-slate-100">No</button>
                      <Form method="post" preventScrollReset>
                        <input type="hidden" name="intent" value="delete-mock-answer" />
                        <input type="hidden" name="quizId" value={quiz.id} />
                        <input type="hidden" name="backHref" value={`/dashboard/courses/${courseId}?tab=quiz`} />
                        <button type="submit" disabled={deletingA} className="rounded bg-red-600 px-1.5 py-0.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60">{deletingA ? "…" : "Yes"}</button>
                      </Form>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setDeleteConfirm("answer")} title="Remove answer" className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
              {showAnswer ? (
                <div className="space-y-2">
                  <QuizImageCard src={aUrl!} alt="Answer" accent="emerald" />
                  {mq?.notes ? <p className="whitespace-pre-wrap rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm leading-relaxed text-slate-700">{mq.notes}</p> : null}
                </div>
              ) : null}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Buddy read-only mock quiz section ─────────────────────────────────────────

function BuddyMockQuizSection({
  mq,
  r2PublicUrl,
  buddyLabel,
}: {
  mq: MockQuizData;
  r2PublicUrl: string;
  buddyLabel: string;
}) {
  const [showAnswer, setShowAnswer] = useState(false);
  const hasQuestion = !!mq?.questionImageKey;
  const hasAnswer = !!mq?.answerImageKey;
  const qUrl = hasQuestion ? `${r2PublicUrl}/${mq!.questionImageKey}` : null;
  const aUrl = hasAnswer ? `${r2PublicUrl}/${mq!.answerImageKey}` : null;

  if (!hasQuestion) {
    return (
      <p className="text-sm text-slate-400 italic">{buddyLabel} hasn&apos;t uploaded their question yet.</p>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Question</p>
        <QuizImageCard src={qUrl!} alt={`${buddyLabel}'s question`} />
      </div>
      {hasAnswer ? (
        <div>
          <button
            type="button"
            onClick={() => setShowAnswer((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
          >
            {showAnswer ? <EyeOff size={12} /> : <Eye size={12} />}
            {showAnswer ? "Hide Answer" : "Show Answer"}
          </button>
          {showAnswer ? (
            <div className="mt-2 space-y-2">
              <QuizImageCard src={aUrl!} alt={`${buddyLabel}'s answer`} accent="emerald" />
              {mq?.notes ? <p className="whitespace-pre-wrap rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm leading-relaxed text-slate-700">{mq.notes}</p> : null}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-amber-600 italic">{buddyLabel} hasn&apos;t uploaded their answer yet.</p>
      )}
    </div>
  );
}

// ── Combined mock quiz accordion ──────────────────────────────────────────────

function MockQuizAccordion({
  quiz,
  courseId,
  r2PublicUrl,
  isSubmitting,
  pendingIntent,
  pendingQuizId,
  buddyDisplayName,
}: {
  quiz: QuizEntry;
  courseId: string;
  r2PublicUrl: string;
  isSubmitting: boolean;
  pendingIntent: string;
  pendingQuizId: string;
  buddyDisplayName: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasBuddy = buddyDisplayName !== null;
  const buddyLabel = buddyDisplayName ?? "Buddy";

  const myHasQ = !!quiz.myMockQuiz?.questionImageKey;
  const myHasA = !!quiz.myMockQuiz?.answerImageKey;
  const buddyHasQ = !!quiz.buddyMockQuiz?.questionImageKey;
  const buddyHasA = !!quiz.buddyMockQuiz?.answerImageKey;

  const myReady = myHasQ && myHasA;
  const buddyReady = buddyHasQ && buddyHasA;
  const bothReady = hasBuddy ? myReady && buddyReady : myReady;

  const badge = bothReady ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Q&amp;A ready</span>
  ) : myHasQ && !myHasA ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">Waiting for answer</span>
  ) : !myHasQ ? (
    <span className="text-[11px] text-slate-400">No question yet</span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-700">In progress</span>
  );

  return (
    <div className="border-t border-slate-100">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-3 text-left transition hover:bg-slate-50"
      >
        <div className="flex items-center gap-2">
          <FlaskConical size={14} className="shrink-0 text-indigo-500" />
          <span className="text-xs font-semibold text-slate-700">Mock Quiz</span>
          {badge}
        </div>
        {expanded ? <ChevronUp size={14} className="shrink-0 text-slate-400" /> : <ChevronDown size={14} className="shrink-0 text-slate-400" />}
      </button>

      {expanded ? (
        <div className="px-5 pb-5">
          {hasBuddy ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {/* My section */}
              <div>
                <p className="mb-3 text-[10px] font-bold uppercase tracking-wide text-indigo-500">My Mock Test</p>
                <MyMockQuizSection
                  quiz={quiz}
                  courseId={courseId}
                  r2PublicUrl={r2PublicUrl}
                  isSubmitting={isSubmitting}
                  pendingIntent={pendingIntent}
                  pendingQuizId={pendingQuizId}
                />
              </div>
              {/* Buddy section */}
              <div>
                <p className="mb-3 text-[10px] font-bold uppercase tracking-wide text-slate-400">{buddyLabel}&apos;s Mock Test</p>
                <BuddyMockQuizSection mq={quiz.buddyMockQuiz} r2PublicUrl={r2PublicUrl} buddyLabel={buddyLabel} />
              </div>
            </div>
          ) : (
            <MyMockQuizSection
              quiz={quiz}
              courseId={courseId}
              r2PublicUrl={r2PublicUrl}
              isSubmitting={isSubmitting}
              pendingIntent={pendingIntent}
              pendingQuizId={pendingQuizId}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}

// ── Main QuizTab ──────────────────────────────────────────────────────────────

export function QuizTab({
  courseId,
  quizzes,
  navigation,
  r2PublicUrl,
  buddyDisplayName,
}: {
  courseId: string;
  quizzes: QuizEntry[];
  navigation: ReturnType<typeof useNavigation>;
  r2PublicUrl: string;
  buddyDisplayName: string | null;
}) {
  const [editingQuiz, setEditingQuiz] = useState<QuizEntry | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const isSubmitting = navigation.state === "submitting";
  const intent = String(navigation.formData?.get("intent") ?? "");
  const pendingQuizId = String(navigation.formData?.get("quizId") ?? "");
  const isEditing = editingQuiz !== null;

  const allComplete = quizzes.length === 0 || quizzes.every((quiz) => {
    const myDone = !!quiz.myMockQuiz?.questionImageKey && !!quiz.myMockQuiz?.answerImageKey;
    const buddyDone = !buddyDisplayName || (!!quiz.buddyMockQuiz?.questionImageKey && !!quiz.buddyMockQuiz?.answerImageKey);
    return myDone && buddyDone;
  });
  const canAddQuiz = quizzes.length < 4 && allComplete;
  const addDisabledReason = quizzes.length >= 4
    ? "Maximum 4 quizzes per course"
    : !allComplete
    ? buddyDisplayName
      ? "Both you and your buddy must complete all mock tests (Q&A) before logging a new quiz"
      : "Complete all mock tests (Q&A) before logging a new quiz"
    : undefined;

  return (
    <div className="px-6 py-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">
          {quizzes.length} / 4 {quizzes.length === 1 ? "quiz" : "quizzes"} logged
        </p>
        <button
          type="button"
          onClick={() => { setEditingQuiz(null); setShowForm(true); }}
          disabled={!canAddQuiz}
          title={addDisabledReason}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={15} />
          Log Quiz
        </button>
      </div>

      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => { setShowForm(false); setEditingQuiz(null); }} aria-hidden="true" />
          <div className="relative z-10 flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 className="text-base font-semibold text-slate-900">{isEditing ? "Edit Quiz" : "Log a New Quiz"}</h2>
              <button type="button" onClick={() => { setShowForm(false); setEditingQuiz(null); }} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto">
              <Form key={editingQuiz?.id ?? "new-quiz"} method="post" preventScrollReset className="space-y-4 px-6 py-5">
                <input type="hidden" name="intent" value={isEditing ? "update-quiz" : "create-quiz"} />
                {editingQuiz ? <input type="hidden" name="quizId" value={editingQuiz.id} /> : null}
                <input type="hidden" name="backHref" value={`/dashboard/courses/${courseId}?tab=quiz`} />
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Quiz Title / Topic</label>
                  <input name="title" type="text" required maxLength={200} defaultValue={editingQuiz?.title ?? ""} placeholder="e.g. Mid-term Chapter 3-5" className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none ring-indigo-300 transition focus:border-indigo-400 focus:ring-2" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Syllabus / Topics Covered</label>
                  <textarea name="syllabus" required maxLength={2000} rows={4} defaultValue={editingQuiz?.syllabus ?? ""} placeholder="Chapter 3: Arrays, Chapter 4: Linked Lists…" className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none ring-indigo-300 transition focus:border-indigo-400 focus:ring-2" />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">Quiz Date</label>
                    <input name="quizDate" type="date" required defaultValue={editingQuiz ? new Date(editingQuiz.quizDate).toISOString().slice(0, 10) : ""} className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none ring-indigo-300 transition focus:border-indigo-400 focus:ring-2" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">Deadline <span className="font-normal text-slate-400">(optional)</span></label>
                    <input name="deadline" type="datetime-local" defaultValue={editingQuiz?.deadline ? new Date(editingQuiz.deadline).toISOString().slice(0, 16) : ""} className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none ring-indigo-300 transition focus:border-indigo-400 focus:ring-2" />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                  <button type="button" onClick={() => { setShowForm(false); setEditingQuiz(null); }} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Cancel</button>
                  <button type="submit" disabled={isSubmitting && intent === (isEditing ? "update-quiz" : "create-quiz")} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60">
                    {isSubmitting && intent === (isEditing ? "update-quiz" : "create-quiz") ? "Saving…" : isEditing ? "Save Changes" : "Save Quiz"}
                  </button>
                </div>
              </Form>
            </div>
          </div>
        </div>
      ) : null}

      {quizzes.length === 0 ? (
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
            const isDeleting = isSubmitting && intent === "delete-quiz" && pendingQuizId === quiz.id;
            return (
              <div key={quiz.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <QuizReorderSelect quizId={quiz.id} serial={quiz.serial} idx={idx} quizCount={quizzes.length} courseId={courseId} />
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
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{quiz.syllabus}</p>
                    </div>
                    <div className="shrink-0">
                      <button type="button" onClick={() => { setEditingQuiz(quiz); setShowForm(true); }} className="mr-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700">
                        <Edit2 size={12} />Edit
                      </button>
                      {deleteConfirmId === quiz.id ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-slate-500">Delete?</span>
                          <button type="button" onClick={() => setDeleteConfirmId(null)} className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100">No</button>
                          <Form method="post" preventScrollReset>
                            <input type="hidden" name="intent" value="delete-quiz" />
                            <input type="hidden" name="quizId" value={quiz.id} />
                            <input type="hidden" name="backHref" value={`/dashboard/courses/${courseId}?tab=quiz`} />
                            <button type="submit" disabled={isDeleting} className="rounded-lg bg-red-600 px-2 py-1 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-60">{isDeleting ? "…" : "Yes"}</button>
                          </Form>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setDeleteConfirmId(quiz.id)} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600" title="Delete quiz">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <MockQuizAccordion
                  quiz={quiz}
                  courseId={courseId}
                  r2PublicUrl={r2PublicUrl}
                  isSubmitting={isSubmitting}
                  pendingIntent={intent}
                  pendingQuizId={pendingQuizId}
                  buddyDisplayName={buddyDisplayName}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

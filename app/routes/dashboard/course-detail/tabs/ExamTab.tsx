import { useRef, useState } from "react";
import { Form, useNavigation } from "react-router";
import { BookMarked, Edit2, Eye, EyeOff, FlaskConical, GraduationCap, ImagePlus, Trash2, X } from "lucide-react";

import type { ExamEntry, ExamMockData, MockExamData } from "../types";

// ── Zoomable image card ───────────────────────────────────────────────────────

function ExamImageCard({ src, alt, accent = "slate" }: { src: string; alt: string; accent?: "slate" | "emerald" }) {
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

// ── My editable mock exam section ─────────────────────────────────────────────

function MyMockExamSection({
  myMock,
  courseId,
  kind,
  r2PublicUrl,
  isSubmitting,
  pendingIntent,
}: {
  myMock: MockExamData;
  courseId: string;
  kind: "mid" | "final";
  r2PublicUrl: string;
  isSubmitting: boolean;
  pendingIntent: string;
}) {
  const [showAnswer, setShowAnswer] = useState(false);
  const [aPreview, setAPreview] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<"question" | "answer" | null>(null);
  const qInputRef = useRef<HTMLInputElement>(null);
  const qFormRef = useRef<HTMLFormElement>(null);
  const aInputRef = useRef<HTMLInputElement>(null);
  const aFormRef = useRef<HTMLFormElement>(null);

  const hasQuestion = !!myMock?.questionImageKey;
  const hasAnswer = !!myMock?.answerImageKey;
  const qUrl = hasQuestion ? `${r2PublicUrl}/${myMock!.questionImageKey}` : null;
  const aUrl = hasAnswer ? `${r2PublicUrl}/${myMock!.answerImageKey}` : null;

  const submittingQ = isSubmitting && pendingIntent === "set-mock-exam-question";
  const submittingA = isSubmitting && pendingIntent === "set-mock-exam-answer";
  const deletingQ = isSubmitting && pendingIntent === "delete-mock-exam-question";
  const deletingA = isSubmitting && pendingIntent === "delete-mock-exam-answer";

  const backHref = `/dashboard/courses/${courseId}?tab=${kind}`;

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
          <input type="hidden" name="intent" value="set-mock-exam-question" />
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="backHref" value={backHref} />
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
                  <input type="hidden" name="intent" value="set-mock-exam-question" />
                  <input type="hidden" name="kind" value={kind} />
                  <input type="hidden" name="backHref" value={backHref} />
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
                      <input type="hidden" name="intent" value="delete-mock-exam-question" />
                      <input type="hidden" name="kind" value={kind} />
                      <input type="hidden" name="backHref" value={backHref} />
                      <button type="submit" disabled={deletingQ} className="rounded bg-red-600 px-1.5 py-0.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60">{deletingQ ? "…" : "Yes"}</button>
                    </Form>
                  </div>
                ) : (
                  <button type="button" onClick={() => setDeleteConfirm("question")} title="Clear mock test" className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500">
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
            <ExamImageCard src={qUrl!} alt="Question" />
          </div>

          {/* Answer */}
          {!hasAnswer ? (
            <Form ref={aFormRef} method="post" encType="multipart/form-data" preventScrollReset>
              <input type="hidden" name="intent" value="set-mock-exam-answer" />
              <input type="hidden" name="kind" value={kind} />
              <input type="hidden" name="backHref" value={backHref} />
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
                    <input type="hidden" name="intent" value="set-mock-exam-answer" />
                    <input type="hidden" name="kind" value={kind} />
                    <input type="hidden" name="backHref" value={backHref} />
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
                        <input type="hidden" name="intent" value="delete-mock-exam-answer" />
                        <input type="hidden" name="kind" value={kind} />
                        <input type="hidden" name="backHref" value={backHref} />
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
                  <ExamImageCard src={aUrl!} alt="Answer" accent="emerald" />
                  {myMock?.notes ? <p className="whitespace-pre-wrap rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm leading-relaxed text-slate-700">{myMock.notes}</p> : null}
                </div>
              ) : null}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Buddy read-only mock exam section ─────────────────────────────────────────

function BuddyMockExamSection({
  buddyMock,
  r2PublicUrl,
  buddyLabel,
}: {
  buddyMock: MockExamData;
  r2PublicUrl: string;
  buddyLabel: string;
}) {
  const [showAnswer, setShowAnswer] = useState(false);
  const hasQuestion = !!buddyMock?.questionImageKey;
  const hasAnswer = !!buddyMock?.answerImageKey;
  const qUrl = hasQuestion ? `${r2PublicUrl}/${buddyMock!.questionImageKey}` : null;
  const aUrl = hasAnswer ? `${r2PublicUrl}/${buddyMock!.answerImageKey}` : null;

  if (!hasQuestion) {
    return (
      <p className="text-sm text-slate-400 italic">{buddyLabel} hasn&apos;t uploaded their question yet.</p>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Question</p>
        <ExamImageCard src={qUrl!} alt={`${buddyLabel}'s question`} />
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
              <ExamImageCard src={aUrl!} alt={`${buddyLabel}'s answer`} accent="emerald" />
              {buddyMock?.notes ? <p className="whitespace-pre-wrap rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm leading-relaxed text-slate-700">{buddyMock.notes}</p> : null}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-amber-600 italic">{buddyLabel} hasn&apos;t uploaded their answer yet.</p>
      )}
    </div>
  );
}

// ── Combined mock exam section ─────────────────────────────────────────────────

function MockExamSection({
  mockData,
  courseId,
  kind,
  r2PublicUrl,
  isSubmitting,
  pendingIntent,
}: {
  mockData: ExamMockData;
  courseId: string;
  kind: "mid" | "final";
  r2PublicUrl: string;
  isSubmitting: boolean;
  pendingIntent: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasBuddy = mockData.buddyDisplayName !== null;
  const buddyLabel = mockData.buddyDisplayName ?? "Buddy";

  const myHasQ = !!mockData.myMock?.questionImageKey;
  const myHasA = !!mockData.myMock?.answerImageKey;
  const buddyHasQ = !!mockData.buddyMock?.questionImageKey;
  const buddyHasA = !!mockData.buddyMock?.answerImageKey;

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
    <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-3 text-left transition hover:bg-slate-50"
      >
        <div className="flex items-center gap-2">
          <FlaskConical size={14} className="shrink-0 text-indigo-500" />
          <span className="text-xs font-semibold text-slate-700">Mock Test</span>
          {badge}
        </div>
        {expanded ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-400"><path d="m18 15-6-6-6 6"/></svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-400"><path d="m6 9 6 6 6-6"/></svg>
        )}
      </button>

      {expanded ? (
        <div className="border-t border-slate-100 px-5 pb-5 pt-4">
          {hasBuddy ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <p className="mb-3 text-[10px] font-bold uppercase tracking-wide text-indigo-500">My Mock Test</p>
                <MyMockExamSection
                  myMock={mockData.myMock}
                  courseId={courseId}
                  kind={kind}
                  r2PublicUrl={r2PublicUrl}
                  isSubmitting={isSubmitting}
                  pendingIntent={pendingIntent}
                />
              </div>
              <div>
                <p className="mb-3 text-[10px] font-bold uppercase tracking-wide text-slate-400">{buddyLabel}&apos;s Mock Test</p>
                <BuddyMockExamSection buddyMock={mockData.buddyMock} r2PublicUrl={r2PublicUrl} buddyLabel={buddyLabel} />
              </div>
            </div>
          ) : (
            <MyMockExamSection
              myMock={mockData.myMock}
              courseId={courseId}
              kind={kind}
              r2PublicUrl={r2PublicUrl}
              isSubmitting={isSubmitting}
              pendingIntent={pendingIntent}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}

// ── Main ExamTab ──────────────────────────────────────────────────────────────

export function ExamTab({
  courseId,
  kind,
  exam,
  navigation,
  mockData,
  r2PublicUrl,
}: {
  courseId: string;
  kind: "mid" | "final";
  exam: ExamEntry | null;
  navigation: ReturnType<typeof useNavigation>;
  mockData: ExamMockData;
  r2PublicUrl: string;
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
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
        >
          <Edit2 size={13} />
          {exam ? "Edit" : "Set Details"}
        </button>
      </div>

      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowForm(false)} aria-hidden="true" />
          <div className="relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 className="text-base font-semibold text-slate-900">
                {exam ? `Edit ${label}` : `Set ${label} Details`}
              </h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto">
              <Form
                key={exam?.id ?? "new-exam"}
                method="post"
                preventScrollReset
                className="space-y-4 px-6 py-5"
              >
                <input type="hidden" name="intent" value={upsertIntent} />
                <input type="hidden" name="backHref" value={`/dashboard/courses/${courseId}?tab=${tabParam}`} />
                <div>
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
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                </div>
                <div>
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
                <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting && intent === upsertIntent}
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {isSubmitting && intent === upsertIntent ? "Saving…" : "Save"}
                  </button>
                </div>
              </Form>
            </div>
          </div>
        </div>
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

      <MockExamSection
        mockData={mockData}
        courseId={courseId}
        kind={kind}
        r2PublicUrl={r2PublicUrl}
        isSubmitting={isSubmitting}
        pendingIntent={intent}
      />
    </div>
  );
}

import { useState } from "react";
import { Form, useNavigation } from "react-router";
import { Edit2, Monitor, Trash2 } from "lucide-react";

import type { PresentationEntry } from "../types";

export function PresentationTab({
  courseId,
  presentation,
  navigation,
}: {
  courseId: string;
  presentation: PresentationEntry | null;
  navigation: ReturnType<typeof useNavigation>;
}) {
  const [showForm, setShowForm] = useState(false);
  const isSubmitting = navigation.state === "submitting";
  const intent = String(navigation.formData?.get("intent") ?? "");
  const backHref = `/dashboard/courses/${courseId}?tab=presentation`;

  const defaultDate = presentation
    ? new Date(presentation.presentationDate).toISOString().slice(0, 10)
    : "";

  function fmt(dateVal: Date | string) {
    return new Date(dateVal).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  return (
    <div className="px-6 py-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">Presentation Details</p>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
        >
          <Edit2 size={13} />
          {presentation ? "Edit" : "Set Details"}
        </button>
      </div>

      {showForm ? (
        <Form
          method="post"
          preventScrollReset
          className="mb-6 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5"
        >
          <input type="hidden" name="intent" value="upsert-presentation" />
          <input type="hidden" name="backHref" value={backHref} />
          <h3 className="mb-4 text-sm font-bold text-slate-800">
            {presentation ? "Edit Presentation" : "Set Presentation Details"}
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Presentation Title / Topic <span className="text-red-500">*</span>
              </label>
              <input
                name="title"
                type="text"
                required
                maxLength={200}
                defaultValue={presentation?.title ?? ""}
                placeholder="e.g. Database Normalization Overview"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none ring-indigo-300 transition focus:border-indigo-400 focus:ring-2"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Description / What to Cover <span className="text-red-500">*</span>
              </label>
              <textarea
                name="description"
                required
                maxLength={5000}
                rows={4}
                defaultValue={presentation?.description ?? ""}
                placeholder="Topics, scope, key points to address…"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none ring-indigo-300 transition focus:border-indigo-400 focus:ring-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Presentation Date <span className="text-red-500">*</span>
              </label>
              <input
                name="presentationDate"
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
                defaultValue={presentation?.venue ?? ""}
                placeholder="e.g. Seminar Hall, Room 302"
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
                defaultValue={presentation?.notes ?? ""}
                placeholder="Time limit, group members, special instructions…"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none ring-indigo-300 transition focus:border-indigo-400 focus:ring-2"
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button
              type="submit"
              disabled={isSubmitting && intent === "upsert-presentation"}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60"
            >
              {isSubmitting && intent === "upsert-presentation" ? "Saving…" : "Save"}
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

      {!presentation && !showForm ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Monitor size={22} />
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-700">No presentation details yet</p>
          <p className="mt-1 text-sm text-slate-400">
            Click &ldquo;Set Details&rdquo; to add presentation information.
          </p>
        </div>
      ) : presentation ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-4">
              <div>
                <p className="text-[0.72rem] font-semibold uppercase tracking-wide text-slate-400">Title</p>
                <p className="mt-0.5 text-sm font-bold text-slate-800">{presentation.title}</p>
              </div>
              <div>
                <p className="text-[0.72rem] font-semibold uppercase tracking-wide text-slate-400">Date</p>
                <p className="mt-0.5 text-sm font-bold text-slate-800">
                  {fmt(presentation.presentationDate)}
                </p>
              </div>
              {presentation.venue ? (
                <div>
                  <p className="text-[0.72rem] font-semibold uppercase tracking-wide text-slate-400">
                    Venue
                  </p>
                  <p className="mt-0.5 text-sm text-slate-700">{presentation.venue}</p>
                </div>
              ) : null}
              <div>
                <p className="text-[0.72rem] font-semibold uppercase tracking-wide text-slate-400">
                  Description
                </p>
                <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                  {presentation.description}
                </p>
              </div>
              {presentation.notes ? (
                <div>
                  <p className="text-[0.72rem] font-semibold uppercase tracking-wide text-slate-400">
                    Notes
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                    {presentation.notes}
                  </p>
                </div>
              ) : null}
            </div>
            <Form method="post" preventScrollReset className="shrink-0">
              <input type="hidden" name="intent" value="delete-presentation" />
              <input type="hidden" name="backHref" value={backHref} />
              <button
                type="submit"
                disabled={isSubmitting && intent === "delete-presentation"}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
                title="Remove presentation details"
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

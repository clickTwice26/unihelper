import { useState } from "react";
import { Form, useNavigation } from "react-router";
import { ExternalLink, Link2, MessageCircle, Plus, Trash2 } from "lucide-react";

import { inputCls, labelCls } from "../helpers";
import type { CourseLinkEntry } from "../types";

export function LinksTab({
  courseId,
  blcLink,
  groupLink,
  customLinks,
  navigation,
  isOwner,
}: {
  courseId: string;
  blcLink: string | null;
  groupLink: string | null;
  customLinks: CourseLinkEntry[];
  navigation: ReturnType<typeof useNavigation>;
  isOwner: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const isSubmitting = navigation.state === "submitting";
  const intent = String(navigation.formData?.get("intent") ?? "");
  const backHref = `/dashboard/courses/${courseId}?tab=links`;

  const hasAnything = blcLink || groupLink || customLinks.length > 0;

  return (
    <div className="px-6 py-6 space-y-5">
      {/* Fixed links: BLC + Group */}
      {(blcLink || groupLink) ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Course Links</p>
          <div className="flex flex-wrap gap-3">
            {blcLink ? (
              <a
                href={blcLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
              >
                <ExternalLink size={15} />
                BLC Link
              </a>
            ) : null}
            {groupLink ? (
              <a
                href={groupLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
              >
                <MessageCircle size={15} />
                Group Link
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Custom links header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Custom Links{customLinks.length > 0 ? ` (${customLinks.length})` : ""}
        </p>
        {isOwner && !showForm ? (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            <Plus size={15} />
            Add Link
          </button>
        ) : null}
      </div>

      {/* Add link form */}
      {showForm && isOwner ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <p className="mb-4 text-sm font-semibold text-slate-800">Add a New Link</p>
          <Form method="post" preventScrollReset className="space-y-3">
            <input type="hidden" name="intent" value="create-link" />
            <input type="hidden" name="backHref" value={backHref} />
            <div>
              <label className={labelCls}>Label</label>
              <input
                type="text"
                name="label"
                required
                maxLength={100}
                placeholder="e.g. Lecture Slides, Reference Book…"
                className={inputCls}
                autoFocus
              />
            </div>
            <div>
              <label className={labelCls}>URL</label>
              <input
                type="url"
                name="url"
                required
                maxLength={500}
                placeholder="https://…"
                className={inputCls}
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={isSubmitting && intent === "create-link"}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
              >
                {isSubmitting && intent === "create-link" ? "Saving…" : "Save Link"}
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
        </div>
      ) : null}

      {/* Custom links list */}
      {customLinks.length === 0 && !showForm ? (
        !hasAnything ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <Link2 size={22} />
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-700">No links yet</p>
            <p className="mt-1 text-sm text-slate-400">
              {isOwner ? 'Click "Add Link" to save a URL with a label.' : "No links have been added to this course yet."}
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-400">No custom links added yet.</p>
        )
      ) : (
        <div className="flex flex-col gap-2">
          {customLinks.map((link) => {
            const isDeleting =
              isSubmitting &&
              intent === "delete-link" &&
              String(navigation.formData?.get("linkId")) === link.id;
            return (
              <div
                key={link.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
              >
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-sm font-semibold text-indigo-700 transition hover:text-indigo-900"
                >
                  <ExternalLink size={14} className="shrink-0 text-slate-400" />
                  <span className="truncate">{link.label}</span>
                </a>
                {isOwner ? (
                  deleteConfirmId === link.id ? (
                    <div className="flex shrink-0 items-center gap-1">
                      <span className="text-xs text-slate-500">Remove?</span>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(null)}
                        className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100"
                      >
                        No
                      </button>
                      <Form method="post" preventScrollReset>
                        <input type="hidden" name="intent" value="delete-link" />
                        <input type="hidden" name="linkId" value={link.id} />
                        <input type="hidden" name="backHref" value={backHref} />
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
                      onClick={() => setDeleteConfirmId(link.id)}
                      className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                      title="Remove link"
                    >
                      <Trash2 size={15} />
                    </button>
                  )
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

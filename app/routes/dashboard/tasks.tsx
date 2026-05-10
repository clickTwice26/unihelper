import { useEffect, useRef, useState } from "react";
import { Form, useLoaderData, useNavigation } from "react-router";
import {
  AlertCircle,
  Calendar,
  Check,
  CheckSquare,
  Plus,
  Trash2,
  User,
  X,
} from "lucide-react";

import type { Route } from "./+types/tasks";

export function meta() {
  return [{ title: "Tasks | UniBuddy" }];
}

// ── Types ─────────────────────────────────────────────────────────────────────

type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";

type TaskEntry = {
  id: string;
  title: string;
  notes: string | null;
  deadline: string | null;
  status: TaskStatus;
  assignees: string[];
  createdAt: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; badgeCls: string; dotCls: string; borderCls: string }
> = {
  TODO: {
    label: "To Do",
    badgeCls: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
    dotCls: "bg-slate-400",
    borderCls: "border-l-slate-300",
  },
  IN_PROGRESS: {
    label: "In Progress",
    badgeCls: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
    dotCls: "bg-blue-500",
    borderCls: "border-l-blue-400",
  },
  DONE: {
    label: "Done",
    badgeCls: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    dotCls: "bg-emerald-500",
    borderCls: "border-l-emerald-400",
  },
};

const STATUS_ORDER: TaskStatus[] = ["TODO", "IN_PROGRESS", "DONE"];

// ── Loader ────────────────────────────────────────────────────────────────────

export async function loader({ request }: Route.LoaderArgs) {
  const { getAuthenticatedUser } = await import("~/lib/auth.server");
  const { redirect } = await import("react-router");
  const { db } = await import("~/lib/db.server");

  const session = await getAuthenticatedUser(request);
  if (!session) throw redirect("/login");

  const [tasks, buddyConnections] = await Promise.all([
    db.task.findMany({
      where: { userId: session.id },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        notes: true,
        deadline: true,
        status: true,
        assignees: true,
        createdAt: true,
      },
    }),
    db.buddyConnection.findMany({
      where: { OR: [{ userAId: session.id }, { userBId: session.id }] },
      select: {
        userA: { select: { id: true, displayName: true } },
        userB: { select: { id: true, displayName: true } },
      },
    }),
  ]);

  // Suggestion list: only accepted buddies, never email
  const suggestions = buddyConnections
    .map((c) => {
      const buddy = c.userA.id === session.id ? c.userB : c.userA;
      return buddy.displayName;
    })
    .filter((n): n is string => !!n);

  return {
    suggestions,
    tasks: tasks.map((t) => ({
      ...t,
      deadline: t.deadline?.toISOString() ?? null,
      createdAt: t.createdAt.toISOString(),
    })),
  };
}

// ── Action ────────────────────────────────────────────────────────────────────

export async function action({ request }: Route.ActionArgs) {
  const { getAuthenticatedUser } = await import("~/lib/auth.server");
  const { redirect } = await import("react-router");
  const { db } = await import("~/lib/db.server");
  const { rateLimit } = await import("~/lib/ratelimit.server");
  const { serializeFlash } = await import("~/lib/flash.server");

  const session = await getAuthenticatedUser(request);
  if (!session) throw new Response("Unauthorized", { status: 401 });

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "").trim();

  const headers = new Headers();
  const flash = async (type: "success" | "error", message: string) => {
    headers.append("Set-Cookie", await serializeFlash({ type, message }));
    return redirect("/dashboard/tasks", { headers });
  };

  try {
    await rateLimit({ key: `tasks:${intent}:${session.id}`, limit: 60, windowSec: 3600 });
  } catch (err) {
    if (err instanceof Response && err.status === 429)
      throw await flash("error", "Too many requests. Please wait.");
    throw err;
  }

  if (intent === "create") {
    const title = String(formData.get("title") ?? "").trim().slice(0, 200);
    const notes = String(formData.get("notes") ?? "").trim().slice(0, 2000) || null;
    const deadlineRaw = String(formData.get("deadline") ?? "").trim();
    const assignees = formData
      .getAll("assignees")
      .map((a) => String(a).trim().slice(0, 100))
      .filter(Boolean)
      .slice(0, 20);

    if (!title) throw await flash("error", "Title is required.");

    let deadline: Date | null = null;
    if (deadlineRaw) {
      deadline = new Date(deadlineRaw);
      if (isNaN(deadline.getTime())) throw await flash("error", "Invalid deadline.");
    }

    const count = await db.task.count({ where: { userId: session.id } });
    if (count >= 200) throw await flash("error", "Maximum 200 tasks reached.");

    await db.task.create({
      data: { userId: session.id, title, notes, deadline, assignees },
    });
    throw await flash("success", `Task "${title}" created.`);
  }

  if (intent === "update-status") {
    const id = String(formData.get("id") ?? "").trim();
    const status = String(formData.get("status") ?? "").trim() as TaskStatus;
    if (!id) throw await flash("error", "Missing task ID.");
    if (!STATUS_ORDER.includes(status)) throw await flash("error", "Invalid status.");

    const task = await db.task.findUnique({ where: { id }, select: { userId: true } });
    if (!task || task.userId !== session.id) throw await flash("error", "Task not found.");

    await db.task.update({ where: { id }, data: { status } });
    throw await flash("success", `Marked as ${STATUS_CONFIG[status].label}.`);
  }

  if (intent === "delete") {
    const id = String(formData.get("id") ?? "").trim();
    if (!id) throw await flash("error", "Missing task ID.");

    const task = await db.task.findUnique({ where: { id }, select: { userId: true } });
    if (!task || task.userId !== session.id) throw await flash("error", "Task not found.");

    await db.task.delete({ where: { id } });
    throw await flash("success", "Task deleted.");
  }

  throw new Response("Unknown intent", { status: 400 });
}

// ── Assignee Tag Input ────────────────────────────────────────────────────────

function AssigneeInput({
  value,
  onChange,
  suggestions = [],
}: {
  value: string[];
  onChange: (v: string[]) => void;
  suggestions?: string[];
}) {
  const [inputVal, setInputVal] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const filtered = suggestions.filter(
    (s) =>
      inputVal.trim().length > 0 &&
      s.toLowerCase().includes(inputVal.toLowerCase()) &&
      !value.includes(s),
  );

  function addTag(raw: string) {
    const tag = raw.trim();
    if (!tag || value.includes(tag) || value.length >= 20) return;
    onChange([...value, tag]);
    setInputVal("");
    setOpen(false);
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  return (
    <div ref={containerRef} className="relative">
      {value.map((tag) => (
        <input key={tag} type="hidden" name="assignees" value={tag} />
      ))}
      <div
        className="flex min-h-[42px] cursor-text flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 transition focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200"
          >
            <User size={10} />
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(tag);
              }}
              className="rounded-full p-0.5 transition hover:bg-indigo-200"
            >
              <X size={10} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputVal}
          placeholder={value.length === 0 ? "Type a name or pick a buddy…" : ""}
          onChange={(e) => {
            setInputVal(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (filtered.length > 0) addTag(filtered[0]);
              else addTag(inputVal);
            } else if (e.key === "Escape") {
              setOpen(false);
            } else if (e.key === "," || e.key === "Tab") {
              e.preventDefault();
              if (filtered.length > 0) addTag(filtered[0]);
              else addTag(inputVal);
            } else if (e.key === "Backspace" && !inputVal && value.length > 0) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => {
            // small delay so suggestion click fires first
            setTimeout(() => {
              setOpen(false);
              if (inputVal.trim() && filtered.length === 0) addTag(inputVal);
            }, 150);
          }}
          className="min-w-[140px] flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
        />
      </div>

      {/* Suggestions dropdown */}
      {open && filtered.length > 0 && (
        <div className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          {filtered.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault(); // prevent blur
                addTag(s);
              }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-slate-800 transition hover:bg-indigo-50 hover:text-indigo-700"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-600">
                {s.charAt(0).toUpperCase()}
              </span>
              {s}
            </button>
          ))}
        </div>
      )}

      <p className="mt-1 text-xs text-slate-400">Pick a buddy suggestion or type any name and press Enter</p>
    </div>
  );
}

// ── Add Task Modal ────────────────────────────────────────────────────────────

function AddTaskModal({
  isSubmitting,
  onClose,
  suggestions,
}: {
  isSubmitting: boolean;
  onClose: () => void;
  suggestions: string[];
}) {
  const [assignees, setAssignees] = useState<string[]>([]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-bold text-slate-900">New Task</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto">
          <Form method="post" preventScrollReset className="space-y-4 px-6 py-5">
            <input type="hidden" name="intent" value="create" />

            {/* Title */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="title"
                required
                maxLength={200}
                autoFocus
                placeholder="e.g. Review lecture notes…"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            {/* Deadline */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Deadline
              </label>
              <input
                type="datetime-local"
                name="deadline"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            {/* Assignees */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Assigned To
              </label>
              <AssigneeInput value={assignees} onChange={setAssignees} suggestions={suggestions} />
            </div>

            {/* Notes */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Notes
              </label>
              <textarea
                name="notes"
                rows={4}
                maxLength={2000}
                placeholder="Any additional notes or details…"
                className="w-full resize-none rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
              >
                <Plus size={15} />
                {isSubmitting ? "Creating…" : "Create Task"}
              </button>
            </div>
          </Form>
        </div>
      </div>
    </div>
  );
}

// ── Task Card ─────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  navigation,
}: {
  task: TaskEntry;
  navigation: ReturnType<typeof useNavigation>;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const cfg = STATUS_CONFIG[task.status];
  const deadline = task.deadline ? new Date(task.deadline) : null;
  const isOverdue = deadline && deadline < new Date() && task.status !== "DONE";

  const isDeleting =
    navigation.state !== "idle" &&
    String(navigation.formData?.get("intent")) === "delete" &&
    String(navigation.formData?.get("id")) === task.id;

  function fmtDeadline(d: Date) {
    return (
      d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }) +
      " · " +
      d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    );
  }

  const nextStatus: TaskStatus | null =
    task.status === "TODO"
      ? "IN_PROGRESS"
      : task.status === "IN_PROGRESS"
        ? "DONE"
        : null;

  const prevStatus: TaskStatus | null =
    task.status === "IN_PROGRESS"
      ? "TODO"
      : task.status === "DONE"
        ? "IN_PROGRESS"
        : null;

  return (
    <div
      className={`group flex flex-col rounded-2xl border border-l-4 ${cfg.borderCls} border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span
            className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.badgeCls}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dotCls}`} />
            {cfg.label}
          </span>
          <h3
            className={`text-sm font-bold leading-snug text-slate-900 ${
              task.status === "DONE" ? "line-through text-slate-400" : ""
            }`}
          >
            {task.title}
          </h3>
        </div>

        {/* Delete confirm */}
        {confirmDelete ? (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-100"
            >
              No
            </button>
            <Form method="post" preventScrollReset>
              <input type="hidden" name="intent" value="delete" />
              <input type="hidden" name="id" value={task.id} />
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
            onClick={() => setConfirmDelete(true)}
            className="shrink-0 rounded-lg p-1.5 text-transparent transition group-hover:text-slate-300 hover:!text-red-500 hover:bg-red-50"
            title="Delete task"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Deadline */}
      {deadline && (
        <div
          className={`mt-3 inline-flex items-center gap-1.5 text-xs font-semibold ${
            isOverdue ? "text-red-600" : "text-slate-400"
          }`}
        >
          {isOverdue ? <AlertCircle size={12} /> : <Calendar size={12} />}
          {isOverdue ? "Overdue · " : "Due · "}
          {fmtDeadline(deadline)}
        </div>
      )}

      {/* Notes preview */}
      {task.notes && (
        <p className="mt-2.5 line-clamp-2 text-sm leading-relaxed text-slate-500">
          {task.notes}
        </p>
      )}

      {/* Assignees */}
      {task.assignees.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {task.assignees.map((a) => (
            <span
              key={a}
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"
            >
              <User size={10} />
              {a}
            </span>
          ))}
        </div>
      )}

      {/* Status quick-actions */}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        {prevStatus && (
          <Form method="post" preventScrollReset>
            <input type="hidden" name="intent" value="update-status" />
            <input type="hidden" name="id" value={task.id} />
            <input type="hidden" name="status" value={prevStatus} />
            <button
              type="submit"
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              ← {STATUS_CONFIG[prevStatus].label}
            </button>
          </Form>
        )}
        {nextStatus && (
          <Form method="post" preventScrollReset>
            <input type="hidden" name="intent" value="update-status" />
            <input type="hidden" name="id" value={task.id} />
            <input type="hidden" name="status" value={nextStatus} />
            <button
              type="submit"
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                nextStatus === "DONE"
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  : "border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
              }`}
            >
              {nextStatus === "DONE" && <Check size={12} />}
              {nextStatus === "DONE" ? "Mark Done" : `→ ${STATUS_CONFIG[nextStatus].label}`}
            </button>
          </Form>
        )}
        {task.status === "DONE" && (
          <Form method="post" preventScrollReset>
            <input type="hidden" name="intent" value="update-status" />
            <input type="hidden" name="id" value={task.id} />
            <input type="hidden" name="status" value="TODO" />
            <button
              type="submit"
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-50"
            >
              ↩ Reopen
            </button>
          </Form>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const { tasks, suggestions } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isSubmitting =
    navigation.state !== "idle" &&
    String(navigation.formData?.get("intent")) === "create";

  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<"ALL" | TaskStatus>("ALL");

  // Auto-close modal after successful create
  const wasCreating = useRef(false);
  useEffect(() => {
    const creating =
      navigation.state !== "idle" &&
      String(navigation.formData?.get("intent")) === "create";
    if (creating) {
      wasCreating.current = true;
    } else if (wasCreating.current && navigation.state === "idle") {
      wasCreating.current = false;
      setShowModal(false);
    }
  }, [navigation.state, navigation.formData]);

  const now = new Date();
  const todoCnt = tasks.filter((t) => t.status === "TODO").length;
  const inProgressCnt = tasks.filter((t) => t.status === "IN_PROGRESS").length;
  const doneCnt = tasks.filter((t) => t.status === "DONE").length;
  const overdueCnt = tasks.filter(
    (t) => t.deadline && new Date(t.deadline) < now && t.status !== "DONE",
  ).length;

  const filtered = tasks.filter((t) => filter === "ALL" || t.status === filter);

  const tabs: { key: "ALL" | TaskStatus; label: string; count: number }[] = [
    { key: "ALL", label: "All", count: tasks.length },
    { key: "TODO", label: "To Do", count: todoCnt },
    { key: "IN_PROGRESS", label: "In Progress", count: inProgressCnt },
    { key: "DONE", label: "Done", count: doneCnt },
  ];

  return (
    <>
      {showModal && (
        <AddTaskModal isSubmitting={isSubmitting} onClose={() => setShowModal(false)} suggestions={suggestions as string[]} />
      )}

      <div className="space-y-5">
        {/* Stats + CTA */}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
            </span>
            {inProgressCnt > 0 && (
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600 ring-1 ring-blue-200">
                {inProgressCnt} in progress
              </span>
            )}
            {overdueCnt > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600 ring-1 ring-red-200">
                <AlertCircle size={11} />
                {overdueCnt} overdue
              </span>
            )}
            {doneCnt > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600 ring-1 ring-emerald-200">
                <Check size={11} />
                {doneCnt} done
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-95 sm:w-auto"
          >
            <Plus size={15} />
            New Task
          </button>
        </div>

        {/* Filter tabs */}
        <div className="-mx-1 overflow-x-auto">
          <div className="flex min-w-max items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition sm:gap-2 sm:px-4
                  ${
                    filter === tab.key
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
              >
                {tab.label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${
                    filter === tab.key
                      ? "bg-indigo-500 text-white"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Task grid or empty state */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-20 text-center shadow-sm">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <CheckSquare size={26} />
            </div>
            <p className="mt-4 text-sm font-bold text-slate-700">
              {filter === "ALL"
                ? "No tasks yet"
                : `No "${STATUS_CONFIG[filter as TaskStatus]?.label}" tasks`}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              {filter === "ALL"
                ? "Create your first task to get started."
                : "Tasks with this status will appear here."}
            </p>
            {filter === "ALL" && (
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
              >
                <Plus size={15} />
                Create First Task
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((task) => (
              <TaskCard key={task.id} task={task as TaskEntry} navigation={navigation} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { Form, useFetcher, useLoaderData, useNavigation } from "react-router";
import {
  AlertCircle,
  Calendar,
  Check,
  CheckSquare,
  LayoutDashboard,
  LayoutGrid,
  LayoutList,
  Lock,
  Plus,
  Search,
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

type BuddyTaskEntry = TaskEntry & { ownerName: string };

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

  const [tasks, buddyConnections, buddyTasks] = await Promise.all([
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
    // ── Buddy tasks — read-only in Kanban ──
    (async () => {
      const conns = await db.buddyConnection.findMany({
        where: { OR: [{ userAId: session.id }, { userBId: session.id }] },
        select: {
          userA: { select: { id: true, displayName: true } },
          userB: { select: { id: true, displayName: true } },
        },
      });
      const buddyMap = new Map<string, string>(
        conns.map((c) => {
          const buddy = c.userA.id === session.id ? c.userB : c.userA;
          return [buddy.id, buddy.displayName ?? "Buddy"] as [string, string];
        }),
      );
      const empty: BuddyTaskEntry[] = [];
      if (buddyMap.size === 0) return empty;
      const rows = await db.task.findMany({
        where: { userId: { in: [...buddyMap.keys()] } },
        orderBy: [{ createdAt: "desc" }],
        select: {
          id: true, title: true, notes: true, deadline: true,
          status: true, assignees: true, createdAt: true, userId: true,
        },
      });
      return rows.map((t) => ({
        id: t.id,
        title: t.title,
        notes: t.notes,
        deadline: t.deadline?.toISOString() ?? null,
        status: t.status as unknown as TaskStatus,
        assignees: t.assignees,
        createdAt: t.createdAt.toISOString(),
        ownerName: buddyMap.get(t.userId) ?? "Buddy",
      }));
    })(),
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
    buddyTasks,
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
// ── Task Row (list view) ────────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  navigation,
}: {
  task: TaskEntry;
  navigation: ReturnType<typeof useNavigation>;
}) {
  const cfg = STATUS_CONFIG[task.status];
  const deadline = task.deadline ? new Date(task.deadline) : null;
  const isOverdue = deadline && deadline < new Date() && task.status !== "DONE";
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isDeleting =
    navigation.state !== "idle" &&
    String(navigation.formData?.get("intent")) === "delete" &&
    String(navigation.formData?.get("id")) === task.id;

  const nextStatus: TaskStatus | null =
    task.status === "TODO" ? "IN_PROGRESS" : task.status === "IN_PROGRESS" ? "DONE" : null;
  const prevStatus: TaskStatus | null =
    task.status === "IN_PROGRESS" ? "TODO" : task.status === "DONE" ? "IN_PROGRESS" : null;

  return (
    <div className="group flex items-center gap-4 border-b border-slate-100 px-5 py-3.5 last:border-0 transition hover:bg-slate-50/60">
      <span className={`h-2 w-2 shrink-0 rounded-full ${cfg.dotCls}`} />

      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-semibold text-slate-900 ${
          task.status === "DONE" ? "line-through text-slate-400" : ""
        }`}>
          {task.title}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-3">
          {deadline && (
            <span className={`flex items-center gap-1 text-xs font-medium ${
              isOverdue ? "text-red-500" : "text-slate-400"
            }`}>
              {isOverdue ? <AlertCircle size={11} /> : <Calendar size={11} />}
              {deadline.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
            </span>
          )}
          {task.assignees.slice(0, 3).map((a) => (
            <span key={a} className="flex items-center gap-1 text-xs text-slate-400">
              <User size={10} />{a}
            </span>
          ))}
        </div>
      </div>

      <span className={`hidden shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold sm:inline-flex ${cfg.badgeCls}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${cfg.dotCls}`} />
        {cfg.label}
      </span>

      <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100">
        {prevStatus && (
          <Form method="post" preventScrollReset>
            <input type="hidden" name="intent" value="update-status" />
            <input type="hidden" name="id" value={task.id} />
            <input type="hidden" name="status" value={prevStatus} />
            <button type="submit"
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">
              ← {STATUS_CONFIG[prevStatus].label}
            </button>
          </Form>
        )}
        {nextStatus && (
          <Form method="post" preventScrollReset>
            <input type="hidden" name="intent" value="update-status" />
            <input type="hidden" name="id" value={task.id} />
            <input type="hidden" name="status" value={nextStatus} />
            <button type="submit"
              className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition ${
                nextStatus === "DONE"
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  : "border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
              }`}>
              {nextStatus === "DONE" && <Check size={11} />}
              {nextStatus === "DONE" ? "Done" : `→ ${STATUS_CONFIG[nextStatus].label}`}
            </button>
          </Form>
        )}
        {task.status === "DONE" && (
          <Form method="post" preventScrollReset>
            <input type="hidden" name="intent" value="update-status" />
            <input type="hidden" name="id" value={task.id} />
            <input type="hidden" name="status" value="TODO" />
            <button type="submit"
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-50">
              ↩ Reopen
            </button>
          </Form>
        )}
        {confirmDelete ? (
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setConfirmDelete(false)}
              className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100">
              No
            </button>
            <Form method="post" preventScrollReset>
              <input type="hidden" name="intent" value="delete" />
              <input type="hidden" name="id" value={task.id} />
              <button type="submit" disabled={isDeleting}
                className="rounded-lg bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                {isDeleting ? "…" : "Yes"}
              </button>
            </Form>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)}
            className="rounded-lg p-1.5 text-slate-300 transition hover:bg-red-50 hover:text-red-500">
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Kanban Buddy Card (read-only) ──────────────────────────────────────────────────────────────────

function KanbanBuddyCard({ task }: { task: BuddyTaskEntry }) {
  const deadline = task.deadline ? new Date(task.deadline) : null;
  const isOverdue = deadline && deadline < new Date() && task.status !== "DONE";
  return (
    <div className="flex flex-col rounded-xl border border-dashed border-slate-200 bg-white/80 p-3.5">
      <div className="flex items-start justify-between gap-2">
        <h3 className={`text-xs font-semibold leading-snug text-slate-600 ${
          task.status === "DONE" ? "line-through text-slate-400" : ""
        }`}>
          {task.title}
        </h3>
        <Lock size={11} className="mt-0.5 shrink-0 text-slate-300" />
      </div>
      {task.notes && (
        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-400">{task.notes}</p>
      )}
      {deadline && (
        <div className={`mt-2 flex items-center gap-1 text-xs ${
          isOverdue ? "font-medium text-red-400" : "text-slate-400"
        }`}>
          {isOverdue ? <AlertCircle size={10} /> : <Calendar size={10} />}
          {deadline.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </div>
      )}
      <div className="mt-2.5 flex items-center gap-1.5">
        <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
          <User size={9} />{task.ownerName}
        </span>
      </div>
    </div>
  );
}
// ── Page ──────────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const { tasks, suggestions, buddyTasks } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isSubmitting =
    navigation.state !== "idle" &&
    String(navigation.formData?.get("intent")) === "create";

  const fetcher = useFetcher();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<"ALL" | TaskStatus>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list" | "kanban">("grid");

  // Optimistically reflect a drag-drop status change before the fetcher resolves
  const optimisticTasks = useMemo((): TaskEntry[] => {
    if (
      fetcher.state !== "idle" &&
      String(fetcher.formData?.get("intent")) === "update-status"
    ) {
      const id = String(fetcher.formData!.get("id"));
      const newStatus = String(fetcher.formData!.get("status")) as TaskStatus;
      return (tasks as TaskEntry[]).map((t) =>
        t.id === id ? { ...t, status: newStatus } : t,
      );
    }
    return tasks as TaskEntry[];
  }, [fetcher.state, fetcher.formData, tasks]);

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

  const q = searchQuery.trim().toLowerCase();
  const filtered = tasks.filter((t) => {
    if (filter !== "ALL" && t.status !== filter) return false;
    if (!q) return true;
    return (
      t.title.toLowerCase().includes(q) ||
      (t.notes ?? "").toLowerCase().includes(q) ||
      t.assignees.some((a) => a.toLowerCase().includes(q))
    );
  });

  // Kanban: search-only filter (status handled by columns)
  const kanbanOwn = q
    ? optimisticTasks.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.notes ?? "").toLowerCase().includes(q) ||
          t.assignees.some((a) => a.toLowerCase().includes(q)),
      )
    : optimisticTasks;

  // Buddy tasks filtered by search query
  const buddyFiltered = q
    ? (buddyTasks as BuddyTaskEntry[]).filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.notes ?? "").toLowerCase().includes(q) ||
          t.ownerName.toLowerCase().includes(q),
      )
    : (buddyTasks as BuddyTaskEntry[]);

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
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <div className="flex items-center gap-0.5 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
              {([
                { key: "grid" as const, Icon: LayoutGrid, label: "Grid" },
                { key: "list" as const, Icon: LayoutList, label: "List" },
              ]).map(({ key, Icon, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setViewMode(key)}
                  title={label}
                  className={`rounded-lg p-2 transition ${
                    viewMode === key
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  <Icon size={15} />
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setViewMode("kanban")}
              className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold shadow-sm transition ${
                viewMode === "kanban"
                  ? "border-indigo-600 bg-indigo-600 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
              }`}
            >
              <LayoutDashboard size={15} />
              <span>Kanban</span>
            </button>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-95 sm:flex-none"
            >
              <Plus size={15} />
              New Task
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search
            size={15}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks by title, notes, or assignee…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter tabs — hidden in Kanban (columns handle status grouping) */}
        {viewMode !== "kanban" && (
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
        )}

        {/* ── Grid view ── */}
        {viewMode === "grid" && (
          filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-20 text-center shadow-sm">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <CheckSquare size={26} />
              </div>
              <p className="mt-4 text-sm font-bold text-slate-700">
                {q ? `No tasks match "${searchQuery}"` : filter === "ALL" ? "No tasks yet" : `No "${STATUS_CONFIG[filter as TaskStatus]?.label}" tasks`}
              </p>
              <p className="mt-1 text-sm text-slate-400">
                {q ? "Try a different keyword." : filter === "ALL" ? "Create your first task to get started." : "Tasks with this status will appear here."}
              </p>
              {!q && filter === "ALL" && (
                <button type="button" onClick={() => setShowModal(true)}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700">
                  <Plus size={15} />Create First Task
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((task) => (
                <TaskCard key={task.id} task={task as TaskEntry} navigation={navigation} />
              ))}
            </div>
          )
        )}

        {/* ── List view ── */}
        {viewMode === "list" && (
          filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-20 text-center shadow-sm">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <CheckSquare size={26} />
              </div>
              <p className="mt-4 text-sm font-bold text-slate-700">
                {q ? `No tasks match "${searchQuery}"` : filter === "ALL" ? "No tasks yet" : `No "${STATUS_CONFIG[filter as TaskStatus]?.label}" tasks`}
              </p>
              <p className="mt-1 text-sm text-slate-400">
                {q ? "Try a different keyword." : filter === "ALL" ? "Create your first task to get started." : "Tasks with this status will appear here."}
              </p>
              {!q && filter === "ALL" && (
                <button type="button" onClick={() => setShowModal(true)}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700">
                  <Plus size={15} />Create First Task
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              {filtered.map((task) => (
                <TaskRow key={task.id} task={task as TaskEntry} navigation={navigation} />
              ))}
            </div>
          )
        )}

        {/* ── Kanban view ── */}
        {viewMode === "kanban" && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {(["TODO", "IN_PROGRESS", "DONE"] as const).map((status) => {
              const cfg = STATUS_CONFIG[status];
              const ownCol = kanbanOwn.filter((t) => t.status === status);
              const buddyCol = buddyFiltered.filter((t) => t.status === status);
              const isDragTarget = dragOverStatus === status && draggedId !== null;
              return (
                <div
                  key={status}
                  className={`flex flex-col rounded-2xl border shadow-sm transition-all duration-150 ${
                    isDragTarget
                      ? "border-indigo-400 bg-indigo-50/60 ring-2 ring-indigo-300/40"
                      : "border-slate-200 bg-slate-50/50"
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (dragOverStatus !== status) setDragOverStatus(status);
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setDragOverStatus(null);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverStatus(null);
                    if (!draggedId) return;
                    const task = optimisticTasks.find((t) => t.id === draggedId);
                    if (!task || task.status === status) { setDraggedId(null); return; }
                    fetcher.submit(
                      { intent: "update-status", id: draggedId, status },
                      { method: "post", action: "/dashboard/tasks" },
                    );
                    setDraggedId(null);
                  }}
                >
                  <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${cfg.dotCls}`} />
                      <span className="text-sm font-bold text-slate-800">{cfg.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-600 ring-1 ring-slate-200">
                        {ownCol.length}
                      </span>
                      {buddyCol.length > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-500">
                          <Lock size={9} />{buddyCol.length}
                        </span>
                      )}
                    </div>
                  </div>
                  <div
                    className="flex flex-col gap-3 overflow-y-auto p-3"
                    style={{ minHeight: "120px", maxHeight: "calc(100vh - 320px)" }}
                  >
                    {ownCol.map((t) => (
                      <div
                        key={t.id}
                        draggable
                        onDragStart={(e) => {
                          setDraggedId(t.id);
                          e.dataTransfer.effectAllowed = "move";
                          // Tiny delay so the ghost image renders before opacity changes
                          requestAnimationFrame(() => setDraggedId(t.id));
                        }}
                        onDragEnd={() => {
                          setDraggedId(null);
                          setDragOverStatus(null);
                        }}
                        className={`cursor-grab active:cursor-grabbing transition-opacity duration-150 ${
                          draggedId === t.id ? "opacity-40" : "opacity-100"
                        }`}
                      >
                        <TaskCard task={t as TaskEntry} navigation={navigation} />
                      </div>
                    ))}
                    {buddyCol.map((t) => (
                      <KanbanBuddyCard key={t.id} task={t} />
                    ))}
                    {ownCol.length === 0 && buddyCol.length === 0 && (
                      <p className={`py-10 text-center text-xs transition-colors ${
                        isDragTarget ? "text-indigo-400 font-medium" : "text-slate-400"
                      }`}>
                        {isDragTarget ? "Drop here" : "No tasks"}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

export { RouteErrorBoundary as ErrorBoundary } from "~/components/RouteErrorBoundary";

import { useMemo, useEffect, useRef, useState } from "react";
import { Form, useLoaderData, useNavigation } from "react-router";
import {
  BookOpen,
  CalendarDays,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  GraduationCap,
  Monitor,
  Plus,
  X,
} from "lucide-react";

import type { Route } from "./+types/calendar";

export function meta() {
  return [{ title: "Calendar | UniBuddy" }];
}

// ── Types ────────────────────────────────────────────────────────────────────

type EventType = "quiz" | "assignment" | "mid" | "final" | "task" | "presentation";

type CalendarEvent = {
  id: string;
  date: string; // "YYYY-MM-DD"
  title: string;
  courseName: string;
  type: EventType;
};

// ── Loader ───────────────────────────────────────────────────────────────────

export async function loader({ request }: Route.LoaderArgs) {
  const { getAuthenticatedUser } = await import("~/lib/auth.server");
  const { redirect } = await import("react-router");
  const { db } = await import("~/lib/db.server");

  const session = await getAuthenticatedUser(request);
  if (!session) throw redirect("/login");

  const courses = await db.course.findMany({
    where: { ownerId: session.id },
    select: { id: true, title: true },
  });
  const courseIds = courses.map((c) => c.id);
  const courseMap = Object.fromEntries(courses.map((c) => [c.id, c.title]));

  // Always fetch tasks (user-scoped). Only fetch course events when user has courses.
  const [quizzes, assignments, midExams, finalExams, tasks, presentations] = await Promise.all([
    courseIds.length > 0
      ? db.quiz.findMany({
          where: { courseId: { in: courseIds } },
          select: { id: true, title: true, quizDate: true, courseId: true, serial: true },
        })
      : Promise.resolve([]),
    courseIds.length > 0
      ? db.assignment.findMany({
          where: { courseId: { in: courseIds } },
          select: { id: true, title: true, deadline: true, courseId: true },
        })
      : Promise.resolve([]),
    courseIds.length > 0
      ? db.midExam.findMany({
          where: { courseId: { in: courseIds } },
          select: { id: true, examDate: true, courseId: true },
        })
      : Promise.resolve([]),
    courseIds.length > 0
      ? db.finalExam.findMany({
          where: { courseId: { in: courseIds } },
          select: { id: true, examDate: true, courseId: true },
        })
      : Promise.resolve([]),
    db.task.findMany({
      where: { userId: session.id, deadline: { not: null } },
      select: { id: true, title: true, deadline: true },
    }),
    courseIds.length > 0
      ? db.presentation.findMany({
          where: { courseId: { in: courseIds } },
          select: { id: true, title: true, presentationDate: true, courseId: true },
        })
      : Promise.resolve([]),
  ]);

  const events: CalendarEvent[] = [
    ...quizzes.map((q) => ({
      id: `quiz-${q.id}`,
      date: q.quizDate.toISOString().slice(0, 10),
      title: `Quiz #${q.serial}: ${q.title}`,
      courseName: courseMap[q.courseId] ?? "Unknown",
      type: "quiz" as const,
    })),
    ...assignments.map((a) => ({
      id: `assign-${a.id}`,
      date: a.deadline.toISOString().slice(0, 10),
      title: a.title,
      courseName: courseMap[a.courseId] ?? "Unknown",
      type: "assignment" as const,
    })),
    ...midExams.map((m) => ({
      id: `mid-${m.id}`,
      date: m.examDate.toISOString().slice(0, 10),
      title: "Mid Exam",
      courseName: courseMap[m.courseId] ?? "Unknown",
      type: "mid" as const,
    })),
    ...finalExams.map((f) => ({
      id: `final-${f.id}`,
      date: f.examDate.toISOString().slice(0, 10),
      title: "Final Exam",
      courseName: courseMap[f.courseId] ?? "Unknown",
      type: "final" as const,
    })),
    ...tasks
      .filter((t) => t.deadline !== null)
      .map((t) => ({
        id: `task-${t.id}`,
        date: t.deadline!.toISOString().slice(0, 10),
        title: t.title,
        courseName: "Task",
        type: "task" as const,
      })),
    ...presentations.map((p) => ({
      id: `presentation-${p.id}`,
      date: p.presentationDate.toISOString().slice(0, 10),
      title: p.title,
      courseName: courseMap[p.courseId] ?? "Unknown",
      type: "presentation" as const,
    })),
  ];

  events.sort((a, b) => a.date.localeCompare(b.date));
  return { events };
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const EVENT_STYLES: Record<EventType, {
  pill: string;
  dot: string;
  badge: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
}> = {
  quiz: {
    pill: "bg-indigo-100 text-indigo-700",
    dot: "bg-indigo-500",
    badge: "bg-indigo-50 border border-indigo-200 text-indigo-700",
    icon: ClipboardList,
    label: "Quiz",
  },
  assignment: {
    pill: "bg-amber-100 text-amber-700",
    dot: "bg-amber-500",
    badge: "bg-amber-50 border border-amber-200 text-amber-700",
    icon: FileText,
    label: "Assignment",
  },
  mid: {
    pill: "bg-rose-100 text-rose-700",
    dot: "bg-rose-500",
    badge: "bg-rose-50 border border-rose-200 text-rose-700",
    icon: BookOpen,
    label: "Mid Exam",
  },
  final: {
    pill: "bg-red-100 text-red-800",
    dot: "bg-red-600",
    badge: "bg-red-50 border border-red-200 text-red-800",
    icon: GraduationCap,
    label: "Final Exam",
  },
  task: {
    pill: "bg-violet-100 text-violet-700",
    dot: "bg-violet-500",
    badge: "bg-violet-50 border border-violet-200 text-violet-700",
    icon: CheckSquare,
    label: "Task",
  },
  presentation: {
    pill: "bg-orange-100 text-orange-700",
    dot: "bg-orange-500",
    badge: "bg-orange-50 border border-orange-200 text-orange-700",
    icon: Monitor,
    label: "Presentation",
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function toLocalDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00");
}

function toLocalISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatWeekday(dateStr: string) {
  return toLocalDate(dateStr).toLocaleDateString(undefined, {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

// ── Action ───────────────────────────────────────────────────────────────────

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
    return redirect("/dashboard/calendar", { headers });
  };

  if (intent === "create-task") {
    try {
      await rateLimit({ key: `calendar:create-task:${session.id}`, limit: 60, windowSec: 3600 });
    } catch (err) {
      if (err instanceof Response && err.status === 429)
        throw await flash("error", "Too many requests. Please wait.");
      throw err;
    }

    const title = String(formData.get("title") ?? "").trim().slice(0, 200);
    const notes = String(formData.get("notes") ?? "").trim().slice(0, 2000) || null;
    const deadlineRaw = String(formData.get("deadline") ?? "").trim();

    if (!title) throw await flash("error", "Task title is required.");

    let deadline: Date | null = null;
    if (deadlineRaw) {
      deadline = new Date(deadlineRaw);
      if (isNaN(deadline.getTime())) deadline = null;
    }

    const count = await db.task.count({ where: { userId: session.id } });
    if (count >= 200) throw await flash("error", "Maximum 200 tasks reached.");

    await db.task.create({
      data: { userId: session.id, title, notes, deadline },
    });
    throw await flash("success", `Task "${title}" added.`);
  }

  throw new Response("Unknown intent", { status: 400 });
}

// ── Day Modal ─────────────────────────────────────────────────────────────────

function DayModal({
  dateStr,
  dayEvents,
  isSubmitting,
  onClose,
}: {
  dateStr: string;
  dayEvents: CalendarEvent[];
  isSubmitting: boolean;
  onClose: () => void;
}) {
  const [showTaskForm, setShowTaskForm] = useState(false);
  const wasSubmitting = useRef(false);

  // Auto-collapse task form after successful submit
  useEffect(() => {
    if (isSubmitting) { wasSubmitting.current = true; return; }
    if (wasSubmitting.current) {
      wasSubmitting.current = false;
      setShowTaskForm(false);
    }
  }, [isSubmitting]);

  const d = toLocalDate(dateStr);
  const label = d.toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
  // Default deadline = 23:59 on that day in local time
  const defaultDeadline = `${dateStr}T23:59`;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-w-lg sm:rounded-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Events</p>
            <h2 className="mt-0.5 text-sm font-bold text-slate-900">{label}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        {/* Event list */}
        <div className="flex-1 overflow-y-auto">
          {dayEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <CalendarDays size={22} />
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-700">No events this day</p>
              <p className="mt-1 text-xs text-slate-400">Add a task to get started.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 p-4">
              {dayEvents.map((ev) => {
                const s = EVENT_STYLES[ev.type];
                const Icon = s.icon;
                return (
                  <div
                    key={ev.id}
                    className={`flex items-start gap-3 rounded-xl px-4 py-3 ${s.badge}`}
                  >
                    <Icon size={16} className="mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-snug">{ev.title}</p>
                      <p className="mt-0.5 text-xs opacity-70">
                        <span className="font-medium">{s.label}</span>
                        {ev.courseName !== "Task" && ` · ${ev.courseName}`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add task form */}
          {showTaskForm ? (
            <div className="border-t border-slate-100 px-4 pb-4 pt-3">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">New Task</p>
              <Form method="post" preventScrollReset className="space-y-3">
                <input type="hidden" name="intent" value="create-task" />
                <input type="hidden" name="deadline" value={defaultDeadline} />
                <input
                  type="text"
                  name="title"
                  required
                  maxLength={200}
                  autoFocus
                  placeholder="Task title…"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
                <textarea
                  name="notes"
                  rows={2}
                  maxLength={2000}
                  placeholder="Notes (optional)…"
                  className="w-full resize-none rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowTaskForm(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {isSubmitting ? "Adding…" : "Add Task"}
                  </button>
                </div>
              </Form>
            </div>
          ) : (
            <div className="shrink-0 border-t border-slate-100 px-4 pb-5 pt-3">
              <button
                type="button"
                onClick={() => setShowTaskForm(true)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-indigo-300 bg-indigo-50/50 py-3 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-50 hover:border-indigo-400"
              >
                <Plus size={15} />
                Add Task for this Day
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const { events } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state !== "idle" && navigation.formData?.get("intent") === "create-task";

  const today = new Date();
  const todayStr = toLocalISODate(today);

  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [modalDay, setModalDay] = useState<string | null>(null);

  // Close modal after successful create-task
  const wasSubmitting = useRef(false);
  useEffect(() => {
    if (isSubmitting) { wasSubmitting.current = true; return; }
    if (wasSubmitting.current) { wasSubmitting.current = false; /* stay open so user sees updated events */ }
  }, [isSubmitting]);

  // Event map: date → events[]
  const eventMap = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const arr = map.get(ev.date) ?? [];
      arr.push(ev);
      map.set(ev.date, arr);
    }
    return map;
  }, [events]);

  // Grid cells for current month
  const cells = useMemo(() => {
    const firstDow = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const result: (string | null)[] = [];
    for (let i = 0; i < firstDow; i++) result.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      result.push(toLocalISODate(new Date(currentYear, currentMonth, d)));
    }
    while (result.length % 7 !== 0) result.push(null);
    return result;
  }, [currentYear, currentMonth]);

  function prevMonth() {
    if (currentMonth === 0) { setCurrentYear((y) => y - 1); setCurrentMonth(11); }
    else setCurrentMonth((m) => m - 1);
  }
  function nextMonth() {
    if (currentMonth === 11) { setCurrentYear((y) => y + 1); setCurrentMonth(0); }
    else setCurrentMonth((m) => m + 1);
  }
  function goToToday() {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    setSelectedDay(todayStr);
  }

  // Upcoming: next 30 days from today
  const upcoming = useMemo(() => {
    const limit = new Date();
    limit.setDate(limit.getDate() + 30);
    const limitStr = toLocalISODate(limit);
    return events.filter((e) => e.date >= todayStr && e.date <= limitStr).slice(0, 12);
  }, [events, todayStr]);

  const modalEvents = modalDay ? (eventMap.get(modalDay) ?? []) : [];

  return (
    <div className="space-y-5">
      {/* Main calendar card */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="flex items-center gap-3">
            <CalendarDays size={19} className="shrink-0 text-indigo-600" />
            <span className="text-lg font-bold text-slate-900">
              {MONTHS[currentMonth]} {currentYear}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goToToday}
              className="rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-95"
            >
              Today
            </button>
            <div className="flex items-center divide-x divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
              <button
                type="button"
                onClick={prevMonth}
                className="p-2 text-slate-500 transition hover:bg-slate-50 active:scale-95"
                aria-label="Previous month"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={nextMonth}
                className="p-2 text-slate-500 transition hover:bg-slate-50 active:scale-95"
                aria-label="Next month"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/60">
          {DAYS_OF_WEEK.map((d) => (
            <div
              key={d}
              className="py-2 text-center text-[10px] font-bold uppercase tracking-widest text-slate-400"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {cells.map((dateStr, idx) => {
            const isLastCol = (idx + 1) % 7 === 0;
            if (!dateStr) {
              return (
                <div
                  key={`pad-${idx}`}
                  className={`min-h-[72px] border-b border-r border-slate-100 bg-slate-50/30 ${isLastCol ? "border-r-0" : ""}`}
                />
              );
            }

            const dayEvents = eventMap.get(dateStr) ?? [];
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDay;
            const dayNum = toLocalDate(dateStr).getDate();
            const visible = dayEvents.slice(0, 2);
            const overflow = dayEvents.length - visible.length;

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => { setSelectedDay(dateStr); setModalDay(dateStr); }}
                className={`group relative min-h-[72px] border-b border-r border-slate-100 p-1.5 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-400
                  ${isLastCol ? "border-r-0" : ""}
                  ${isSelected ? "bg-indigo-50/70" : "hover:bg-slate-50"}
                `}
              >
                {/* Date number */}
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition
                    ${isToday
                      ? "bg-indigo-600 text-white shadow-sm"
                      : isSelected
                        ? "bg-indigo-100 text-indigo-800"
                        : "text-slate-700 group-hover:bg-slate-100"
                    }
                  `}
                >
                  {dayNum}
                </span>

                {/* Event pills */}
                <div className="mt-1 flex flex-col gap-px">
                  {visible.map((ev) => (
                    <span
                      key={ev.id}
                      className={`truncate rounded px-1 py-px text-[10px] font-medium leading-snug ${EVENT_STYLES[ev.type].pill}`}
                    >
                      {ev.title}
                    </span>
                  ))}
                  {overflow > 0 && (
                    <span className="px-1 text-[10px] font-medium text-slate-400">
                      +{overflow} more
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Day modal */}
      {modalDay && (
        <DayModal
          dateStr={modalDay}
          dayEvents={modalEvents}
          isSubmitting={isSubmitting}
          onClose={() => setModalDay(null)}
        />
      )}

      {/* Legend + upcoming */}
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {/* Upcoming events */}
        <div className="space-y-3">
          {upcoming.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 className="text-sm font-bold text-slate-900">Upcoming — next 30 days</h2>
              </div>
              <div className="divide-y divide-slate-100">
                {upcoming.map((ev) => {
                  const s = EVENT_STYLES[ev.type];
                  const Icon = s.icon;
                  const d = toLocalDate(ev.date);
                  const isEvToday = ev.date === todayStr;
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => {
                        setCurrentYear(d.getFullYear());
                        setCurrentMonth(d.getMonth());
                        setSelectedDay(ev.date);
                        setModalDay(ev.date);
                      }}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                    >
                      <div
                        className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl leading-none ${s.badge}`}
                      >
                        <span className="text-[10px] font-bold uppercase tracking-wide opacity-70">
                          {d.toLocaleDateString(undefined, { month: "short" })}
                        </span>
                        <span className="text-lg font-extrabold">{d.getDate()}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800">{ev.title}</p>
                        <p className="truncate text-xs text-slate-500">{ev.courseName}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${s.pill}`}>
                          {s.label}
                        </span>
                        {isEvToday && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                            Today
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {upcoming.length === 0 && events.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-6 text-center shadow-sm">
              <p className="text-sm font-semibold text-slate-700">All clear for the next 30 days</p>
              <p className="mt-1 text-xs text-slate-400">No upcoming events in this window.</p>
            </div>
          )}
        </div>

        {/* Legend */}
        <div>
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Legend</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
              {(["quiz", "assignment", "mid", "final", "task", "presentation"] as const).map((t) => {
                const s = EVENT_STYLES[t];
                return (
                  <span
                    key={t}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${s.badge}`}
                  >
                    <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${s.dot}`} />
                    {s.label}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

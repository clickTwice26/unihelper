import { useMemo, useState } from "react";
import { useLoaderData } from "react-router";
import {
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  GraduationCap,
} from "lucide-react";

import type { Route } from "./+types/calendar";

export function meta() {
  return [{ title: "Calendar | UniBuddy" }];
}

// ── Types ────────────────────────────────────────────────────────────────────

type EventType = "quiz" | "assignment" | "mid" | "final";

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

  if (courseIds.length === 0) return { events: [] as CalendarEvent[] };

  const [quizzes, assignments, midExams, finalExams] = await Promise.all([
    db.quiz.findMany({
      where: { courseId: { in: courseIds } },
      select: { id: true, title: true, quizDate: true, courseId: true, serial: true },
    }),
    db.assignment.findMany({
      where: { courseId: { in: courseIds } },
      select: { id: true, title: true, deadline: true, courseId: true },
    }),
    db.midExam.findMany({
      where: { courseId: { in: courseIds } },
      select: { id: true, examDate: true, courseId: true },
    }),
    db.finalExam.findMany({
      where: { courseId: { in: courseIds } },
      select: { id: true, examDate: true, courseId: true },
    }),
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

// ── Component ─────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const { events } = useLoaderData<typeof loader>();

  const today = new Date();
  const todayStr = toLocalISODate(today);

  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(todayStr);

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

  const selectedEvents = selectedDay ? (eventMap.get(selectedDay) ?? []) : [];

  return (
    <div className="space-y-5">
      {/* Main calendar card */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
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
              className="py-3 text-center text-[11px] font-bold uppercase tracking-widest text-slate-400"
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
                  className={`min-h-[110px] border-b border-r border-slate-100 bg-slate-50/30 ${isLastCol ? "border-r-0" : ""}`}
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
                onClick={() => setSelectedDay(dateStr === selectedDay ? null : dateStr)}
                className={`group relative min-h-[110px] border-b border-r border-slate-100 p-2 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-400
                  ${isLastCol ? "border-r-0" : ""}
                  ${isSelected ? "bg-indigo-50/70" : "hover:bg-slate-50"}
                `}
              >
                {/* Date number */}
                <span
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold transition
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
                <div className="mt-1.5 flex flex-col gap-0.5">
                  {visible.map((ev) => (
                    <span
                      key={ev.id}
                      className={`truncate rounded px-1.5 py-0.5 text-[11px] font-medium leading-snug ${EVENT_STYLES[ev.type].pill}`}
                    >
                      {ev.title}
                    </span>
                  ))}
                  {overflow > 0 && (
                    <span className="px-1 text-[11px] font-medium text-slate-400">
                      +{overflow} more
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend + selected day — side by side on large screens */}
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {/* Left: selected day panel or upcoming */}
        <div className="space-y-5">
          {/* Selected day events */}
          {selectedDay && selectedEvents.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 className="text-sm font-bold text-slate-900">{formatWeekday(selectedDay)}</h2>
              </div>
              <div className="flex flex-col gap-2 p-4">
                {selectedEvents.map((ev) => {
                  const s = EVENT_STYLES[ev.type];
                  const Icon = s.icon;
                  return (
                    <div
                      key={ev.id}
                      className={`flex items-start gap-3 rounded-xl px-4 py-3 ${s.badge}`}
                    >
                      <Icon size={16} className="mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold">{ev.title}</p>
                        <p className="mt-0.5 text-xs opacity-70">{ev.courseName}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {selectedDay && selectedEvents.length === 0 && (
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <CalendarDays size={17} />
              </div>
              <p className="text-sm text-slate-500">
                No events on{" "}
                <span className="font-semibold text-slate-700">
                  {toLocalDate(selectedDay).toLocaleDateString(undefined, { month: "long", day: "numeric" })}
                </span>
              </p>
            </div>
          )}

          {/* Empty state */}
          {events.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-16 text-center shadow-sm">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <CalendarDays size={26} />
              </div>
              <p className="mt-4 text-sm font-semibold text-slate-700">No events yet</p>
              <p className="mt-1 text-sm text-slate-400">
                Add quizzes, assignments, and exam dates to your courses to see them here.
              </p>
            </div>
          )}
        </div>

        {/* Right column: legend + upcoming */}
        <div className="space-y-5">
          {/* Legend */}
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Legend</p>
            <div className="grid grid-cols-2 gap-2">
              {(["quiz", "assignment", "mid", "final"] as const).map((t) => {
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

          {/* Upcoming events */}
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
                      }}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                    >
                      {/* Mini date badge */}
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
      </div>
    </div>
  );
}

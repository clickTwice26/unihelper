import { Link, useLoaderData } from "react-router";
import {
  BookOpen,
  CalendarDays,
  CheckSquare,
  Clock,
  AlertCircle,
  ArrowRight,
  LayoutGrid,
  Users,
} from "lucide-react";

import type { Route } from "./+types/home";

export function meta() {
  return [{ title: "Dashboard | UniBuddy" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { getAuthenticatedUser } = await import("~/lib/auth.server");
  const { redirect } = await import("react-router");
  const { db } = await import("~/lib/db.server");

  const user = await getAuthenticatedUser(request);
  if (!user) throw redirect("/login");

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const in30 = new Date(now);
  in30.setDate(in30.getDate() + 30);
  const in30Str = in30.toISOString().slice(0, 10);

  const [
    courses,
    taskStats,
    overdueTasks,
    buddyCount,
    routineCount,
    upcomingEvents,
  ] = await Promise.all([
    db.course.findMany({
      where: { ownerId: user.id },
      select: { id: true, title: true, creditHours: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.task.groupBy({
      by: ["status"],
      where: { userId: user.id },
      _count: { id: true },
    }),
    db.task.count({
      where: {
        userId: user.id,
        status: { not: "DONE" },
        deadline: { lt: now },
      },
    }),
    db.buddyConnection.count({
      where: { OR: [{ userAId: user.id }, { userBId: user.id }] },
    }),
    db.classRoutine.count({ where: { userId: user.id } }),
    // Upcoming: quizzes, assignments, mid, final, presentations in next 30 days
    (async () => {
      const courseIds = (
        await db.course.findMany({ where: { ownerId: user.id }, select: { id: true, title: true } })
      );
      const courseMap = Object.fromEntries(courseIds.map((c) => [c.id, c.title]));
      const ids = courseIds.map((c) => c.id);
      if (ids.length === 0) return [];

      const [quizzes, assignments, mids, finals, presentations] = await Promise.all([
        db.quiz.findMany({
          where: { courseId: { in: ids }, quizDate: { gte: now, lte: in30 } },
          select: { id: true, title: true, quizDate: true, courseId: true, serial: true },
          orderBy: { quizDate: "asc" }, take: 5,
        }),
        db.assignment.findMany({
          where: { courseId: { in: ids }, deadline: { gte: now, lte: in30 } },
          select: { id: true, title: true, deadline: true, courseId: true },
          orderBy: { deadline: "asc" }, take: 5,
        }),
        db.midExam.findMany({
          where: { courseId: { in: ids }, examDate: { gte: now, lte: in30 } },
          select: { id: true, examDate: true, courseId: true },
          orderBy: { examDate: "asc" }, take: 3,
        }),
        db.finalExam.findMany({
          where: { courseId: { in: ids }, examDate: { gte: now, lte: in30 } },
          select: { id: true, examDate: true, courseId: true },
          orderBy: { examDate: "asc" }, take: 3,
        }),
        db.presentation.findMany({
          where: { courseId: { in: ids }, presentationDate: { gte: now, lte: in30 } },
          select: { id: true, title: true, presentationDate: true, courseId: true },
          orderBy: { presentationDate: "asc" }, take: 3,
        }),
      ]);

      type UpcomingItem = { id: string; date: string; label: string; course: string; type: string };
      const items: UpcomingItem[] = [
        ...quizzes.map((q) => ({ id: `q-${q.id}`, date: q.quizDate.toISOString().slice(0, 10), label: `Quiz #${q.serial}: ${q.title}`, course: courseMap[q.courseId] ?? "", type: "quiz" })),
        ...assignments.map((a) => ({ id: `a-${a.id}`, date: a.deadline.toISOString().slice(0, 10), label: a.title, course: courseMap[a.courseId] ?? "", type: "assignment" })),
        ...mids.map((m) => ({ id: `m-${m.id}`, date: m.examDate.toISOString().slice(0, 10), label: "Mid Exam", course: courseMap[m.courseId] ?? "", type: "mid" })),
        ...finals.map((f) => ({ id: `f-${f.id}`, date: f.examDate.toISOString().slice(0, 10), label: "Final Exam", course: courseMap[f.courseId] ?? "", type: "final" })),
        ...presentations.map((p) => ({ id: `p-${p.id}`, date: p.presentationDate.toISOString().slice(0, 10), label: p.title, course: courseMap[p.courseId] ?? "", type: "presentation" })),
      ];
      items.sort((a, b) => a.date.localeCompare(b.date));
      return items.slice(0, 8);
    })(),
  ]);

  // Task counts
  const taskTodo = taskStats.find((s) => s.status === "TODO")?._count.id ?? 0;
  const taskInProgress = taskStats.find((s) => s.status === "IN_PROGRESS")?._count.id ?? 0;
  const taskDone = taskStats.find((s) => s.status === "DONE")?._count.id ?? 0;
  const taskTotal = taskTodo + taskInProgress + taskDone;

  return {
    user,
    courses,
    taskTodo,
    taskInProgress,
    taskDone,
    taskTotal,
    overdueTasks,
    buddyCount,
    routineCount,
    upcomingEvents,
    todayStr,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const EVENT_COLORS: Record<string, { pill: string; dot: string }> = {
  quiz:         { pill: "bg-indigo-100 text-indigo-700", dot: "bg-indigo-500" },
  assignment:   { pill: "bg-amber-100 text-amber-700",   dot: "bg-amber-500" },
  mid:          { pill: "bg-rose-100 text-rose-700",     dot: "bg-rose-500" },
  final:        { pill: "bg-red-100 text-red-800",       dot: "bg-red-600" },
  task:         { pill: "bg-violet-100 text-violet-700", dot: "bg-violet-500" },
  presentation: { pill: "bg-orange-100 text-orange-700", dot: "bg-orange-500" },
};

function fmtDate(str: string) {
  const d = new Date(str + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function daysUntil(str: string, todayStr: string) {
  const a = new Date(str + "T00:00:00");
  const b = new Date(todayStr + "T00:00:00");
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardHome() {
  const {
    user,
    courses,
    taskTodo,
    taskInProgress,
    taskDone,
    taskTotal,
    overdueTasks,
    buddyCount,
    routineCount,
    upcomingEvents,
    todayStr,
  } = useLoaderData<typeof loader>();

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  const name = user.displayName ?? user.email.split("@")[0];

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {greeting}, {name} 👋
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Link
          to="/dashboard/courses"
          className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition hover:border-indigo-200 hover:shadow-md"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition group-hover:bg-indigo-100">
            <BookOpen size={22} />
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-extrabold text-slate-900">{courses.length}</p>
            <p className="text-xs font-semibold text-slate-500">Courses</p>
          </div>
        </Link>

        <Link
          to="/dashboard/tasks"
          className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition hover:border-violet-200 hover:shadow-md"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 transition group-hover:bg-violet-100">
            <CheckSquare size={22} />
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-extrabold text-slate-900">{taskTotal}</p>
            <p className="text-xs font-semibold text-slate-500">Tasks</p>
          </div>
        </Link>

        <Link
          to="/dashboard/social"
          className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition hover:border-emerald-200 hover:shadow-md"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 transition group-hover:bg-emerald-100">
            <Users size={22} />
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-extrabold text-slate-900">{buddyCount}</p>
            <p className="text-xs font-semibold text-slate-500">Buddies</p>
          </div>
        </Link>

        <Link
          to="/dashboard/routine"
          className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition hover:border-amber-200 hover:shadow-md"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 transition group-hover:bg-amber-100">
            <LayoutGrid size={22} />
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-extrabold text-slate-900">{routineCount}</p>
            <p className="text-xs font-semibold text-slate-500">Classes</p>
          </div>
        </Link>
      </div>

      {/* Two column: upcoming + tasks/courses */}
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        {/* Upcoming events */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <CalendarDays size={17} className="text-indigo-500" />
              <h2 className="text-sm font-bold text-slate-900">Upcoming — next 30 days</h2>
            </div>
            <Link
              to="/dashboard/calendar"
              className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
            >
              View all <ArrowRight size={13} />
            </Link>
          </div>

          {upcomingEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <CalendarDays size={20} />
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-700">All clear!</p>
              <p className="mt-1 text-xs text-slate-400">No upcoming events in the next 30 days.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {upcomingEvents.map((ev) => {
                const style = EVENT_COLORS[ev.type] ?? EVENT_COLORS.quiz;
                const days = daysUntil(ev.date, todayStr);
                return (
                  <div key={ev.id} className="flex items-center gap-3 px-5 py-3">
                    <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">{ev.label}</p>
                      <p className="truncate text-xs text-slate-500">{ev.course}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${style.pill}`}>
                        {fmtDate(ev.date)}
                      </span>
                      <span className={`text-[10px] font-semibold ${days === 0 ? "text-red-600" : days <= 3 ? "text-amber-600" : "text-slate-400"}`}>
                        {days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days}d`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Task summary */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <CheckSquare size={17} className="text-violet-500" />
                <h2 className="text-sm font-bold text-slate-900">Tasks</h2>
              </div>
              <Link to="/dashboard/tasks" className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                View all <ArrowRight size={13} />
              </Link>
            </div>
            <div className="space-y-2 px-5 py-4">
              {overdueTasks > 0 && (
                <div className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2">
                  <AlertCircle size={14} className="shrink-0 text-red-500" />
                  <p className="text-xs font-semibold text-red-700">{overdueTasks} overdue task{overdueTasks !== 1 ? "s" : ""}</p>
                </div>
              )}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "To Do", count: taskTodo, cls: "bg-slate-100 text-slate-700" },
                  { label: "In Progress", count: taskInProgress, cls: "bg-indigo-50 text-indigo-700" },
                  { label: "Done", count: taskDone, cls: "bg-emerald-50 text-emerald-700" },
                ].map((s) => (
                  <div key={s.label} className={`flex flex-col items-center justify-center rounded-xl px-2 py-3 ${s.cls}`}>
                    <span className="text-xl font-extrabold">{s.count}</span>
                    <span className="mt-0.5 text-[10px] font-semibold">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Courses quick list */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <BookOpen size={17} className="text-indigo-500" />
                <h2 className="text-sm font-bold text-slate-900">My Courses</h2>
              </div>
              <Link to="/dashboard/courses" className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                View all <ArrowRight size={13} />
              </Link>
            </div>
            {courses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <p className="text-sm font-semibold text-slate-700">No courses yet</p>
                <Link to="/dashboard/courses" className="mt-2 text-xs font-semibold text-indigo-600 hover:underline">Add your first course →</Link>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {courses.map((c) => (
                  <Link
                    key={c.id}
                    to={`/dashboard/courses/${c.id}`}
                    className="flex items-center gap-3 px-5 py-3 transition hover:bg-slate-50"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                      <BookOpen size={14} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">{c.title}</p>
                      <p className="text-xs text-slate-400">{c.creditHours} credit{c.creditHours !== 1 ? "s" : ""}</p>
                    </div>
                    <ArrowRight size={14} className="shrink-0 text-slate-300" />
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Routine quick link */}
          <Link
            to="/dashboard/routine"
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition hover:border-amber-200 hover:bg-amber-50/40"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Clock size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900">Class Routine</p>
              <p className="text-xs text-slate-500">{routineCount} class{routineCount !== 1 ? "es" : ""} scheduled</p>
            </div>
            <ArrowRight size={16} className="shrink-0 text-slate-400" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export { RouteErrorBoundary as ErrorBoundary } from "~/components/RouteErrorBoundary";

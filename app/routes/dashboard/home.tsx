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
  const sevenDaysAgo  = new Date(now); sevenDaysAgo.setDate(now.getDate() - 7);
  const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(now.getDate() - 30);

  const [
    courses,
    taskStats,
    overdueTasks,
    buddyCount,
    routineCount,
    upcomingEvents,
    wardenAlertCount,
    recentWeightCount,
    anyWeightLog,
    monthlyExpenseRows,
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
    // ── Warden alert count: items inside their urgency window ──
    (async () => {
      const cIds = await db.course
        .findMany({ where: { ownerId: user.id, deletedAt: null }, select: { id: true } })
        .then((cs) => cs.map((c) => c.id));
      if (cIds.length === 0) return 0;
      const plus3 = new Date(now); plus3.setDate(now.getDate() + 3);
      const plus7 = new Date(now); plus7.setDate(now.getDate() + 7);
      const [qz, as_, mi, fi, pr] = await Promise.all([
        db.quiz.count({ where: { courseId: { in: cIds }, quizDate: { gte: now, lte: plus3 } } }),
        db.assignment.count({ where: { courseId: { in: cIds }, deadline: { gte: now, lte: plus3 } } }),
        db.midExam.count({ where: { courseId: { in: cIds }, examDate: { gte: now, lte: plus7 } } }),
        db.finalExam.count({ where: { courseId: { in: cIds }, examDate: { gte: now, lte: plus7 } } }),
        db.presentation.count({ where: { courseId: { in: cIds }, presentationDate: { gte: now, lte: plus7 } } }),
      ]);
      return qz + as_ + mi + fi + pr;
    })(),
    // ── Weight logs in last 7 days ──
    db.weightLog.count({ where: { userId: user.id, date: { gte: sevenDaysAgo } } }),
    // ── Any weight log ever (existence check) ──
    db.weightLog.findFirst({ where: { userId: user.id }, select: { id: true } }),
    // ── Income + expense rows for last 30 days ──
    db.expense.findMany({
      where: { userId: user.id, date: { gte: thirtyDaysAgo } },
      select: { type: true, amount: true },
    }),
  ]);

  // Task counts
  const taskTodo = taskStats.find((s) => s.status === "TODO")?._count.id ?? 0;
  const taskInProgress = taskStats.find((s) => s.status === "IN_PROGRESS")?._count.id ?? 0;
  const taskDone = taskStats.find((s) => s.status === "DONE")?._count.id ?? 0;
  const taskTotal = taskTodo + taskInProgress + taskDone;

  // Aggregate monthly income / expense
  let monthlyIncome = 0;
  let monthlyExpense = 0;
  for (const row of monthlyExpenseRows) {
    const amt = Number(row.amount);
    if (row.type === "INCOME") monthlyIncome += amt;
    else monthlyExpense += amt;
  }

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
    wardenAlertCount: wardenAlertCount as number,
    recentWeightCount,
    hasAnyWeightLog: !!anyWeightLog,
    monthlyIncome,
    monthlyExpense,
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

// ── Human Fill Figure ─────────────────────────────────────────────────────────

function HumanFillFigure({
  id,
  fillPercent,
  colorMain,
  colorLight,
  bgColor = "#080d1c",
  pctColor = "white",
  label,
  sublabel,
}: {
  id: string;
  fillPercent: number;
  colorMain: string;
  colorLight: string;
  bgColor?: string;
  pctColor?: string;
  label: string;
  sublabel: string;
}) {
  const VW = 100, VH = 245;
  const fill = Math.min(100, Math.max(0, fillPercent));
  // 0% → fillY=245 (empty); 100% → fillY=5 (full head-to-toe)
  const fillY = 245 - (fill / 100) * 240;

  // Human silhouette: head circle + body path in a 100×245 viewBox
  const bodyPath =
    "M 44 39 C 30 41 10 52 8 72 L 5 145 C 5 151 9 154 14 150 " +
    "L 20 83 C 23 70 27 66 31 68 L 30 150 L 21 235 L 40 235 " +
    "C 43 231 43 226 43 222 L 44 158 L 56 158 L 57 222 " +
    "C 57 226 57 231 60 235 L 79 235 L 70 150 L 69 68 " +
    "C 73 66 77 70 80 83 L 86 150 C 91 154 95 151 95 145 " +
    "L 92 72 C 90 52 70 41 56 39 Z";

  // Wave: period=20px, amplitude=2.5px — spans x=-100..300 for seamless scroll
  const segs: string[] = [];
  for (let i = 0; i < 20; i++) segs.push("q 5 -2.5 10 0 q 5 2.5 10 0");
  const wavePath = `M -100 ${fillY} ${segs.join(" ")} L 300 242 L -100 242 Z`;

  return (
    <div className="flex flex-col items-center gap-3">
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        className="w-28 sm:w-36 md:w-40"
        style={{ overflow: "visible" }}
      >
        <defs>
          {/* Clip both head circle + body as one shape */}
          <clipPath id={`hc-${id}`}>
            <circle cx="50" cy="22" r="17" />
            <path d={bodyPath} />
          </clipPath>
          {/* Fluid gradient: light top → main bottom */}
          <linearGradient id={`hg-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colorLight} stopOpacity="0.95" />
            <stop offset="100%" stopColor={colorMain} stopOpacity="1" />
          </linearGradient>
          {/* Glow filter for the fluid layer */}
          <filter id={`hf-${id}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Heavy blur for ambient halo */}
          <filter id={`ha-${id}`}>
            <feGaussianBlur in="SourceGraphic" stdDeviation="14" />
          </filter>
        </defs>

        {/* Pulsing ambient halo */}
        <ellipse cx="50" cy="128" rx="38" ry="60" fill={colorMain} opacity="0.18"
          filter={`url(#ha-${id})`}>
          <animate attributeName="opacity" values="0.14;0.26;0.14"
            dur="3.5s" repeatCount="indefinite" />
        </ellipse>

        {/* Ghost silhouette outline */}
        <circle cx="50" cy="22" r="17" fill="none"
          stroke={colorMain} strokeWidth="1.5" strokeOpacity="0.22" />
        <path d={bodyPath} fill="none"
          stroke={colorMain} strokeWidth="1.5" strokeOpacity="0.22" />

        {/* Interior base */}
        <g clipPath={`url(#hc-${id})`}>
          <rect x="0" y="0" width={VW} height={VH} fill={bgColor} />
        </g>

        {/* Two fluid wave layers */}
        <g clipPath={`url(#hc-${id})`} filter={`url(#hf-${id})`}>
          {/* Back wave — slower, lighter */}
          <path d={wavePath} fill={colorLight} opacity="0.22">
            <animateTransform attributeName="transform" type="translate"
              from="0 0" to="-20 0" dur="4s" repeatCount="indefinite" />
          </path>
          {/* Front wave — main gradient */}
          <path d={wavePath} fill={`url(#hg-${id})`} opacity="0.92">
            <animateTransform attributeName="transform" type="translate"
              from="-10 0" to="-30 0" dur="2.6s" repeatCount="indefinite" />
          </path>
        </g>

        {/* Fill percentage — centre of torso */}
        <text x="50" y="118"
          textAnchor="middle" dominantBaseline="middle"
          fontSize="15" fontWeight="900"
          fill={pctColor} fontFamily="system-ui,sans-serif">
          {Math.round(fill)}%
        </text>
      </svg>

      <div className="text-center">
        <p className="text-[13px] font-bold tracking-wide" style={{ color: colorMain }}>{label}</p>
        <p className="mt-0.5 text-[11px] text-slate-400">{sublabel}</p>
      </div>
    </div>
  );
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
    wardenAlertCount,
    recentWeightCount,
    hasAnyWeightLog,
    monthlyIncome,
    monthlyExpense,
  } = useLoaderData<typeof loader>();

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  const name = user.displayName ?? user.email.split("@")[0];

  // ── Academic fill: task completion (60%) + warden urgency health (40%) ──
  // 0 alerts → full 40 pts; each alert costs 8 pts; 5+ alerts → 0 pts
  const taskScore   = taskTotal > 0 ? Math.round((taskDone / taskTotal) * 60) : Math.min(courses.length * 10, 30);
  const wardenScore = Math.max(0, 40 - wardenAlertCount * 8);
  const academicPct = Math.min(100, taskScore + wardenScore);

  // ── Wellbeing fill: weight consistency (50%) + expense health (50%) ──
  // Weight: logged last 7d → 50; ever logged → 20; never → 0
  const weightScore  = recentWeightCount > 0 ? 50 : hasAnyWeightLog ? 20 : 0;
  // Expense: no data → neutral 30; balanced/surplus → 50; deficit → proportional
  const expenseScore =
    monthlyExpense === 0
      ? 30
      : monthlyIncome >= monthlyExpense
      ? 50
      : Math.round((monthlyIncome / monthlyExpense) * 50);
  const wellbeingPct = Math.min(100, Math.max(5, weightScore + expenseScore));

  return (
    <div className="space-y-5">

      {/* ── Hero: light panel with animated liquid-fill figures ── */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white px-6 pb-8 pt-6 shadow-sm">
        {/* Soft colour washes */}
        <div className="pointer-events-none absolute left-0 top-0 h-full w-1/2 bg-gradient-to-br from-indigo-50/60 to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 h-full w-1/2 bg-gradient-to-bl from-emerald-50/60 to-transparent" />
        {/* Subtle dot-grid texture */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.4]"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(148,163,184,0.25) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        {/* Greeting */}
        <div className="relative mb-7 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
          <h1 className="mt-2 text-xl font-bold text-slate-900 sm:text-2xl">
            {greeting}, {name} 👋
          </h1>
        </div>

        {/* Two human figures side by side */}
        <div className="relative flex items-end justify-center gap-10 sm:gap-20">
          <HumanFillFigure
            id="acad"
            fillPercent={academicPct}
            colorMain="#6366f1"
            colorLight="#a5b4fc"
            bgColor="#f5f5ff"
            pctColor="#4338ca"
            label="Academic"
            sublabel={`${taskDone}/${taskTotal} tasks · ${wardenAlertCount === 0 ? "no alerts" : `${wardenAlertCount} alert${wardenAlertCount > 1 ? "s" : ""}`}`}
          />
          {/* Centre divider */}
          <div className="absolute left-1/2 top-4 h-[85%] w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-slate-200 to-transparent" />
          <HumanFillFigure
            id="wbeing"
            fillPercent={wellbeingPct}
            colorMain="#10b981"
            colorLight="#6ee7b7"
            bgColor="#f0fdf9"
            pctColor="#065f46"
            label="Wellbeing"
            sublabel={`${recentWeightCount > 0 ? "weight logged" : "no recent weight"} · ${monthlyExpense === 0 ? "no expenses" : monthlyIncome >= monthlyExpense ? "balanced" : "over budget"}`}
          />
        </div>

        {/* Quick-link stat chips */}
        <div className="relative mt-8 flex flex-wrap items-center justify-center gap-2">
          {([
            { to: "/dashboard/courses", icon: BookOpen,    label: `${courses.length} Courses`  },
            { to: "/dashboard/tasks",   icon: CheckSquare, label: `${taskTotal} Tasks`          },
            { to: "/dashboard/social",  icon: Users,       label: `${buddyCount} Buddies`       },
            { to: "/dashboard/routine", icon: LayoutGrid,  label: `${routineCount} Classes`     },
          ] as const).map((s) => {
            const Icon = s.icon;
            return (
              <Link
                key={s.to}
                to={s.to}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
              >
                <Icon size={12} />
                {s.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Two-column body ── */}
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

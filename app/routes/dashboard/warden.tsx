import { Link, useLoaderData } from "react-router";
import {
  AlertTriangle,
  BookMarked,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileText,
  GraduationCap,
  Monitor,
  ShieldCheck,
} from "lucide-react";

import type { Route } from "./+types/warden";

export function meta() {
  return [{ title: "Warden | UniBuddy" }];
}

// ── Types ──────────────────────────────────────────────────────────────────────

type WardenAlert = {
  courseId: string;
  courseTitle: string;
  kind: "quiz" | "assignment" | "mid" | "final" | "presentation";
  label: string;
  daysUntil: number;
  threshold: number;
  tab: string;
};

// ── Loader ─────────────────────────────────────────────────────────────────────

export async function loader({ request }: Route.LoaderArgs) {
  const { getAuthenticatedUser } = await import("~/lib/auth.server");
  const { redirect } = await import("react-router");
  const { db } = await import("~/lib/db.server");

  const session = await getAuthenticatedUser(request);
  if (!session) throw redirect("/login");

  const now = new Date();

  // Load all active courses for this user
  const courses = await db.course.findMany({
    where: { ownerId: session.id, deletedAt: null },
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  });

  const courseIds = courses.map((c) => c.id);
  const courseMap = Object.fromEntries(courses.map((c) => [c.id, c.title]));

  const alerts: WardenAlert[] = [];

  if (courseIds.length > 0) {
    // ── Quizzes: alert if quiz date is within 3 days ───────────────────────
    const upcomingQuizzes = await db.quiz.findMany({
      where: {
        courseId: { in: courseIds },
        quizDate: { gte: now },
      },
      select: { courseId: true, title: true, quizDate: true },
      orderBy: { quizDate: "asc" },
    });
    for (const q of upcomingQuizzes) {
      const daysUntil = Math.ceil(
        (new Date(q.quizDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (daysUntil <= 3) {
        alerts.push({
          courseId: q.courseId,
          courseTitle: courseMap[q.courseId],
          kind: "quiz",
          label: q.title,
          daysUntil,
          threshold: 3,
          tab: "quiz",
        });
      }
    }

    // ── Assignments: alert if deadline is within 3 days ───────────────────
    const upcomingAssignments = await db.assignment.findMany({
      where: {
        courseId: { in: courseIds },
        deadline: { gte: now },
      },
      select: { courseId: true, title: true, deadline: true },
      orderBy: { deadline: "asc" },
    });
    for (const a of upcomingAssignments) {
      const daysUntil = Math.ceil(
        (new Date(a.deadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (daysUntil <= 3) {
        alerts.push({
          courseId: a.courseId,
          courseTitle: courseMap[a.courseId],
          kind: "assignment",
          label: a.title,
          daysUntil,
          threshold: 3,
          tab: "assignment",
        });
      }
    }

    // ── Mid exams: alert if exam date is within 7 days ────────────────────
    const upcomingMids = await db.midExam.findMany({
      where: {
        courseId: { in: courseIds },
        examDate: { gte: now },
      },
      select: { courseId: true, examDate: true },
      orderBy: { examDate: "asc" },
    });
    for (const m of upcomingMids) {
      const daysUntil = Math.ceil(
        (new Date(m.examDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (daysUntil <= 7) {
        alerts.push({
          courseId: m.courseId,
          courseTitle: courseMap[m.courseId],
          kind: "mid",
          label: "Mid Exam",
          daysUntil,
          threshold: 7,
          tab: "mid",
        });
      }
    }

    // ── Final exams: alert if exam date is within 7 days ─────────────────
    const upcomingFinals = await db.finalExam.findMany({
      where: {
        courseId: { in: courseIds },
        examDate: { gte: now },
      },
      select: { courseId: true, examDate: true },
      orderBy: { examDate: "asc" },
    });
    for (const f of upcomingFinals) {
      const daysUntil = Math.ceil(
        (new Date(f.examDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (daysUntil <= 7) {
        alerts.push({
          courseId: f.courseId,
          courseTitle: courseMap[f.courseId],
          kind: "final",
          label: "Final Exam",
          daysUntil,
          threshold: 7,
          tab: "final",
        });
      }
    }

    // ── Presentations: alert if date is within 7 days ─────────────────────
    const upcomingPresentations = await db.presentation.findMany({
      where: {
        courseId: { in: courseIds },
        presentationDate: { gte: now },
      },
      select: { courseId: true, title: true, presentationDate: true },
      orderBy: { presentationDate: "asc" },
    });
    for (const p of upcomingPresentations) {
      const daysUntil = Math.ceil(
        (new Date(p.presentationDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (daysUntil <= 7) {
        alerts.push({
          courseId: p.courseId,
          courseTitle: courseMap[p.courseId],
          kind: "presentation",
          label: p.title,
          daysUntil,
          threshold: 7,
          tab: "presentation",
        });
      }
    }
  }

  // Sort: most urgent first
  alerts.sort((a, b) => a.daysUntil - b.daysUntil);

  return { alerts, courseCount: courses.length };
}

// ── Config ────────────────────────────────────────────────────────────────────

const KIND_CONFIG: Record<
  WardenAlert["kind"],
  {
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    rule: string;
    urgentCls: string;
    normalCls: string;
    iconCls: string;
  }
> = {
  quiz: {
    label: "Quiz",
    icon: ClipboardList,
    rule: "Do a mock quiz within 3 days of the actual quiz date",
    urgentCls: "border-amber-200 bg-amber-50",
    normalCls: "border-slate-200 bg-white",
    iconCls: "text-amber-500",
  },
  assignment: {
    label: "Assignment",
    icon: FileText,
    rule: "Start and submit within the 3-day deadline window",
    urgentCls: "border-orange-200 bg-orange-50",
    normalCls: "border-slate-200 bg-white",
    iconCls: "text-orange-500",
  },
  mid: {
    label: "Mid Exam",
    icon: BookMarked,
    rule: "Do a mock exam within 1 week of the actual exam date",
    urgentCls: "border-red-200 bg-red-50",
    normalCls: "border-slate-200 bg-white",
    iconCls: "text-red-500",
  },
  final: {
    label: "Final Exam",
    icon: GraduationCap,
    rule: "Do a mock exam within 1 week of the actual exam date",
    urgentCls: "border-red-200 bg-red-50",
    normalCls: "border-slate-200 bg-white",
    iconCls: "text-red-500",
  },
  presentation: {
    label: "Presentation",
    icon: Monitor,
    rule: "Have slides ready at least 7 days before the presentation date",
    urgentCls: "border-purple-200 bg-purple-50",
    normalCls: "border-slate-200 bg-white",
    iconCls: "text-purple-500",
  },
};

const GUIDELINES: Array<{
  kind: WardenAlert["kind"];
  threshold: string;
  description: string;
}> = [
  {
    kind: "quiz",
    threshold: "3 days before",
    description: "Do a mock quiz within 3 days of the actual quiz date to test your preparation.",
  },
  {
    kind: "mid",
    threshold: "1 week before",
    description: "Do a mock mid exam within 1 week of the actual exam date to test your readiness.",
  },
  {
    kind: "final",
    threshold: "1 week before",
    description: "Do a mock final exam within 1 week of the actual exam date to test your readiness.",
  },
  {
    kind: "assignment",
    threshold: "3 days before",
    description: "Begin your assignment at least 3 days before the deadline.",
  },
  {
    kind: "presentation",
    threshold: "7 days before",
    description: "Have your presentation slides ready at least 7 days before the date.",
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

function urgencyLabel(daysUntil: number): string {
  if (daysUntil === 0) return "Today";
  if (daysUntil === 1) return "Tomorrow";
  return `${daysUntil} days`;
}

function urgencyBadgeCls(daysUntil: number): string {
  if (daysUntil <= 1) return "bg-red-100 text-red-700";
  if (daysUntil <= 3) return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

export default function WardenPage() {
  const { alerts, courseCount } = useLoaderData<typeof loader>();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Hero */}
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
          <ShieldCheck size={24} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Warden</h1>
          <p className="mt-1 text-sm text-slate-500">
            Your academic accountability tracker. Warden watches your upcoming deadlines and
            reminds you when it&rsquo;s time to act — before it&rsquo;s too late.
          </p>
        </div>
      </div>

      {/* Guidelines */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Guidelines
        </h2>
        <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
          {GUIDELINES.map((g) => {
            const cfg = KIND_CONFIG[g.kind];
            return (
              <div key={g.kind} className="flex items-start gap-4 px-5 py-4">
                <div className={`mt-0.5 shrink-0 ${cfg.iconCls}`}>
                  <cfg.icon size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800">{cfg.label}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                      {g.threshold}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-slate-500">{g.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Active alerts */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Active Alerts
          </h2>
          {alerts.length > 0 && (
            <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
              {alerts.length} {alerts.length === 1 ? "alert" : "alerts"}
            </span>
          )}
        </div>

        {courseCount === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
            <BookOpen size={28} className="text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">No courses yet</p>
            <p className="mt-1 text-sm text-slate-400">
              Add courses to start tracking deadlines.
            </p>
            <Link
              to="/dashboard/courses"
              className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
            >
              Go to Courses
            </Link>
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 px-6 py-16 text-center shadow-sm">
            <CheckCircle2 size={28} className="text-emerald-400" />
            <p className="mt-3 text-sm font-semibold text-emerald-800">All clear!</p>
            <p className="mt-1 text-sm text-emerald-600">
              No upcoming deadlines within the alert windows. Keep it up.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {alerts.map((alert, idx) => {
              const cfg = KIND_CONFIG[alert.kind];
              const isUrgent = alert.daysUntil <= Math.ceil(alert.threshold / 2);
              return (
                <Link
                  key={idx}
                  to={`/dashboard/courses/${alert.courseId}?tab=${alert.tab}`}
                  className={`flex items-start gap-4 rounded-2xl border px-5 py-4 shadow-sm transition hover:shadow-md ${
                    alert.daysUntil <= 1 ? cfg.urgentCls : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className={`mt-0.5 shrink-0 ${cfg.iconCls}`}>
                    <cfg.icon size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-800">{alert.label}</span>
                      <span className="text-xs text-slate-400">·</span>
                      <span className="text-xs font-medium text-slate-500">{alert.courseTitle}</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${urgencyBadgeCls(alert.daysUntil)}`}>
                        <CalendarClock size={10} />
                        {urgencyLabel(alert.daysUntil)}
                      </span>
                      <span className="text-xs text-slate-400">{cfg.rule}</span>
                    </div>
                  </div>
                  {alert.daysUntil <= 1 && (
                    <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-500" />
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

import { Link } from "react-router";
import {
  BookOpen,
  Users,
  CalendarDays,
  ClipboardList,
  Wallet,
  Heart,
  HardDrive,
  MessageSquare,
  ClipboardCheck,
  BookMarked,
  FileText,
  Link2,
  ArrowRight,
  GraduationCap,
} from "lucide-react";

import type { Route } from "./+types/home";

export function meta() {
  return [
    { title: "UniBuddy — Your university life, organised" },
    {
      name: "description",
      content:
        "Courses, attendance, exams, assignments, study buddies, tasks, expenses, health tracking, and more — all in one place for university students.",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { getAuthenticatedUser } = await import("~/lib/auth.server");
  const session = await getAuthenticatedUser(request);
  return { isLoggedIn: !!session };
}

// ── Feature definitions ───────────────────────────────────────────────────────

const coreFeatures = [
  {
    icon: BookOpen,
    title: "Course Hub",
    description:
      "Store every detail about each course — teacher info, BLC & group links, quizzes, assignments, mid/final exams, and presentations — all in one place.",
    color: "bg-indigo-50 text-indigo-600",
  },
  {
    icon: ClipboardCheck,
    title: "Attendance Tracker",
    description:
      "Mark present, late, or absent for each class day. See your attendance percentage at a glance and catch up before it's too late.",
    color: "bg-emerald-50 text-emerald-600",
  },
  {
    icon: BookMarked,
    title: "Exam & Quiz Log",
    description:
      "Track syllabus, dates, and venue for mid-terms and finals. Log quiz serials, topics, and deadlines so nothing slips past you.",
    color: "bg-violet-50 text-violet-600",
  },
  {
    icon: FileText,
    title: "Assignment Manager",
    description:
      "Add assignments with descriptions and deadlines. Sort by due date so the most urgent tasks are always at the top.",
    color: "bg-amber-50 text-amber-600",
  },
  {
    icon: HardDrive,
    title: "Course Storage",
    description:
      "Upload lecture slides, notes, and resources directly into each course. Navigate folders, preview files, and share them with your study buddy.",
    color: "bg-cyan-50 text-cyan-600",
  },
  {
    icon: Link2,
    title: "Smart Links",
    description:
      "Keep BLC links, WhatsApp group links, and any custom course links organised per course — no more hunting through old chats.",
    color: "bg-rose-50 text-rose-600",
  },
];

const lifestyleFeatures = [
  {
    icon: Users,
    title: "Study Buddies",
    description:
      "Connect with classmates and instantly share all your course data — notes, exams, attendance records — with accepted buddies.",
    color: "bg-sky-50 text-sky-600",
  },
  {
    icon: CalendarDays,
    title: "Calendar",
    description:
      "A unified view of deadlines, exam dates, and events. Spot clashes before they happen.",
    color: "bg-orange-50 text-orange-600",
  },
  {
    icon: ClipboardList,
    title: "Class Routine",
    description:
      "Set your weekly class schedule. The attendance tracker uses it to automatically know which days you have each course.",
    color: "bg-teal-50 text-teal-600",
  },
  {
    icon: BookOpen,
    title: "Task List",
    description:
      "Personal to-do list with priorities and deadlines. Separate from assignments — for everything else on your plate.",
    color: "bg-purple-50 text-purple-600",
  },
  {
    icon: Wallet,
    title: "Expense Tracker",
    description:
      "Log income and expenses with categories. Know exactly where your money goes every month.",
    color: "bg-lime-50 text-lime-600",
  },
  {
    icon: Heart,
    title: "Health Log",
    description:
      "Track daily meals, diet habits, and weight over time. Small data points that add up to big insights.",
    color: "bg-pink-50 text-pink-600",
  },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div className="overflow-x-hidden">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section
        id="hero"
        className="mx-auto max-w-7xl px-6 pb-24 pt-36 sm:px-8 sm:pt-40 lg:px-10"
      >
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5">
            <GraduationCap size={14} className="text-emerald-600" />
            <span className="type-overline text-emerald-700">Built for university students</span>
          </div>

          <h1 className="type-display-hero text-slate-900">
            Your entire university life,{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #16a34a, #0ea5e9)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              organised.
            </span>
          </h1>

          <p className="type-body-lg mx-auto mt-7 max-w-xl text-slate-500">
            Courses, attendance, exams, assignments, notes storage, tasks, expenses, and
            your study circle — all in one private workspace that syncs across devices.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link to="/register" className="nav-pill nav-pill-primary px-7 py-3 text-base">
              Get started free
            </Link>
            <Link
              to="/login"
              className="nav-pill nav-pill-secondary px-7 py-3 text-base"
            >
              Sign in
            </Link>
          </div>
        </div>

        {/* Mock dashboard preview */}
        <div className="mx-auto mt-20 max-w-5xl">
          <div className="surface-panel overflow-hidden p-1.5">
            <div className="rounded-[1.6rem] bg-slate-100 px-6 py-4">
              {/* Fake window chrome */}
              <div className="mb-4 flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-rose-400" />
                <div className="h-3 w-3 rounded-full bg-amber-400" />
                <div className="h-3 w-3 rounded-full bg-emerald-400" />
                <div className="ml-3 h-5 flex-1 max-w-xs rounded-full bg-slate-200 text-[0.68rem] leading-5 text-center text-slate-400">
                  unibuddy.app/dashboard
                </div>
              </div>
              {/* Fake dashboard layout */}
              <div className="flex gap-4">
                {/* Sidebar */}
                <div className="hidden w-44 shrink-0 space-y-1 sm:block">
                  {["Dashboard","Social","Courses","Calendar","Routine","Tasks","Expenses","Health","Storage","Chat"].map((item, i) => (
                    <div
                      key={item}
                      className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium ${
                        i === 2
                          ? "bg-indigo-600 text-white"
                          : "text-slate-500"
                      }`}
                    >
                      <div className={`h-2 w-2 rounded-sm ${i === 2 ? "bg-white/60" : "bg-slate-300"}`} />
                      {item}
                    </div>
                  ))}
                </div>
                {/* Main content */}
                <div className="min-w-0 flex-1 space-y-3">
                  {/* Course card */}
                  <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="h-4 w-40 rounded-full bg-slate-200" />
                      <div className="h-6 w-16 rounded-full bg-indigo-100" />
                    </div>
                    {/* Tabs */}
                    <div className="mb-4 flex gap-3 border-b border-slate-100 pb-3">
                      {["Information","Links","Storage","Quiz","Assignment","Mid","Final"].map((t, i) => (
                        <div
                          key={t}
                          className={`text-[0.62rem] font-semibold ${
                            i === 0 ? "border-b-2 border-indigo-600 pb-1 text-indigo-600" : "text-slate-400"
                          }`}
                        >
                          {t}
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {["Teacher","Email","Phone","Notes"].map((f) => (
                        <div key={f} className="space-y-1">
                          <div className="h-2 w-12 rounded-full bg-slate-200" />
                          <div className="h-3 w-24 rounded-full bg-slate-100" />
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Attendance", val: "84%", color: "text-emerald-600" },
                      { label: "Assignments", val: "3 due", color: "text-amber-600" },
                      { label: "Quizzes", val: "2 logged", color: "text-indigo-600" },
                    ].map((s) => (
                      <div key={s.label} className="rounded-2xl bg-white p-3 shadow-sm text-center">
                        <p className={`text-base font-bold ${s.color}`}>{s.val}</p>
                        <p className="mt-0.5 text-[0.65rem] text-slate-400">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Core academic features ────────────────────────────────────────── */}
      <section
        id="features"
        className="mx-auto max-w-7xl scroll-mt-24 px-6 py-24 sm:px-8 lg:px-10"
      >
        <div className="mb-14 max-w-xl">
          <p className="eyebrow">Academic tools</p>
          <h2 className="type-heading-lg mt-3 text-slate-900">
            Everything your courses need.
          </h2>
          <p className="type-body-lg mt-4 text-slate-500">
            One place to track every course from the first lecture to the final exam.
            No spreadsheets, no sticky notes.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {coreFeatures.map((f) => (
            <article key={f.title} className="surface-panel flex flex-col gap-4 p-6">
              <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${f.color}`}>
                <f.icon size={20} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">{f.title}</h3>
                <p className="type-body-sm mt-1.5 text-slate-500">{f.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ── Buddy spotlight ────────────────────────────────────────────────── */}
      <section
        id="buddies"
        className="mx-auto max-w-7xl scroll-mt-24 px-6 py-24 sm:px-8 lg:px-10"
      >
        <div className="surface-panel overflow-hidden">
          <div className="grid items-center gap-12 p-8 sm:p-12 lg:grid-cols-2">
            <div className="space-y-6">
              <p className="eyebrow">Study Buddy System</p>
              <h2 className="type-heading-lg text-slate-900">
                Share your whole workspace with classmates.
              </h2>
              <p className="type-body-lg text-slate-500">
                Add a classmate as a buddy and instantly get mutual access to each other's
                course data — notes, files, attendance history, quiz details, and more.
                No manual sharing needed, ever.
              </p>
              <ul className="space-y-3">
                {[
                  "Discover classmates in the social directory",
                  "Send & accept buddy requests",
                  "Full mutual access to all course content",
                  "Chat directly with any buddy",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-slate-700">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                    </div>
                    <span className="type-body-sm">{item}</span>
                  </li>
                ))}
              </ul>
              <Link
                to="/register"
                className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 transition hover:text-emerald-700"
              >
                Get started <ArrowRight size={16} />
              </Link>
            </div>

            {/* Visual */}
            <div className="relative">
              <div className="rounded-3xl bg-gradient-to-br from-slate-50 to-slate-100 p-6">
                {/* Buddy cards */}
                <div className="space-y-3">
                  {[
                    { name: "Raiyan Ahmed", status: "Buddy", courses: 5, color: "bg-indigo-100 text-indigo-700" },
                    { name: "Tashfia Islam", status: "Buddy", courses: 4, color: "bg-emerald-100 text-emerald-700" },
                    { name: "Fahim Hossain", status: "Pending", courses: 0, color: "bg-amber-100 text-amber-700" },
                    { name: "Nadia Sultana", status: "Discover", courses: 0, color: "bg-slate-100 text-slate-600" },
                  ].map((b) => (
                    <div
                      key={b.name}
                      className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-500">
                          {b.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{b.name}</p>
                          {b.courses > 0 ? (
                            <p className="text-xs text-slate-400">{b.courses} shared courses</p>
                          ) : (
                            <p className="text-xs text-slate-400">CSE, BRACU</p>
                          )}
                        </div>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${b.color}`}>
                        {b.status}
                      </span>
                    </div>
                  ))}
                </div>
                {/* Shared indicator */}
                <div className="mt-4 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  <p className="text-xs font-medium text-emerald-700">
                    Raiyan can see your Computer Networks notes
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Lifestyle features ───────────────────────────────────────────────── */}
      <section
        id="more"
        className="mx-auto max-w-7xl scroll-mt-24 px-6 py-24 sm:px-8 lg:px-10"
      >
        <div className="mb-14 max-w-xl">
          <p className="eyebrow">Beyond academics</p>
          <h2 className="type-heading-lg mt-3 text-slate-900">
            The rest of student life, too.
          </h2>
          <p className="type-body-lg mt-4 text-slate-500">
            UniBuddy handles more than just courses — it's your daily life dashboard
            as a student.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {lifestyleFeatures.map((f) => (
            <article key={f.title} className="surface-panel flex flex-col gap-4 p-6">
              <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${f.color}`}>
                <f.icon size={20} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">{f.title}</h3>
                <p className="type-body-sm mt-1.5 text-slate-500">{f.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ── Bottom CTA ───────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 pb-32 sm:px-8 lg:px-10">
        <div
          className="surface-panel p-12 text-center"
          style={{
            background:
              "linear-gradient(135deg, rgba(22,163,74,0.06) 0%, rgba(14,165,233,0.05) 100%), rgba(255,255,255,0.95)",
          }}
        >
          <p className="eyebrow">Start today</p>
          <h2 className="type-heading-lg mx-auto mt-3 max-w-lg text-slate-900">
            Stop juggling. Start studying.
          </h2>
          <p className="type-body-lg mx-auto mt-4 max-w-md text-slate-500">
            Free to use. No credit card. Just sign up, add your courses, and get
            organised before the semester runs away from you.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link to="/register" className="nav-pill nav-pill-primary px-8 py-3.5 text-base">
              Create your workspace
            </Link>
            <Link to="/login" className="nav-pill nav-pill-secondary px-8 py-3.5 text-base">
              Sign in
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

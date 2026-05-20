import { useEffect, useRef, useState } from "react";
import { Link, useLoaderData } from "react-router";
import {
  AlertTriangle,
  BookMarked,
  BookOpen,
  Bot,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileText,
  GraduationCap,
  Monitor,
  Send,
  ShieldCheck,
  Sparkles,
  X,
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

type ChatMessage = { role: "user" | "assistant"; text: string; isError?: boolean };

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

  const { buildUserContext } = await import("~/lib/warden-ai.server");
  const aiContext = await buildUserContext(session.id, db);

  return { alerts, courseCount: courses.length, aiContext };
}

// ── Config ────────────────────────────────────────────────────────────────────

const SUGGESTION_CHIPS = [
  "What courses am I enrolled in?",
  "What are my upcoming deadlines?",
  "Show my attendance per course",
  "Summarize my tasks",
  "How much did I spend this month?",
  "Show my weight trend",
  "What's on my schedule today?",
  "Any active warden alerts?",
];

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

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── AI message bubble ──────────────────────────────────────────────────────────

function FormattedText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;
        const bulletMatch = line.match(/^(\s*[-*•])\s+(.+)/);
        if (bulletMatch) {
          return (
            <div key={i} className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
              <span>{renderBold(bulletMatch[2])}</span>
            </div>
          );
        }
        if (line.startsWith("### ")) return <p key={i} className="font-bold text-slate-900">{line.slice(4)}</p>;
        if (line.startsWith("## ")) return <p key={i} className="font-bold text-slate-900">{line.slice(3)}</p>;
        return <p key={i}>{renderBold(line)}</p>;
      })}
    </div>
  );
}

function renderBold(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-indigo-600 px-4 py-2.5 text-sm leading-relaxed text-white shadow-sm">
          {msg.text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2.5">
      <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full shadow-sm ${
        msg.isError ? "bg-red-100" : "bg-indigo-100"
      }`}>
        {msg.isError ? <X size={14} className="text-red-600" /> : <Bot size={14} className="text-indigo-600" />}
      </div>
      <div className={`max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
        msg.isError
          ? "bg-red-50 text-red-700 ring-1 ring-red-200"
          : "bg-white text-slate-800 ring-1 ring-slate-200"
      }`}>
        <FormattedText text={msg.text} />
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-start gap-2.5">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 shadow-sm">
        <Bot size={14} className="text-indigo-600" />
      </div>
      <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function WardenPage() {
  const { alerts, courseCount } = useLoaderData<typeof loader>();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  async function sendMessage(text: string) {
    const trimmed = text.trim().slice(0, 1000);
    if (!trimmed || isThinking) return;

    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setInput("");
    setIsThinking(true);

    try {
      const history = messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        text: m.text,
      }));

      const fd = new FormData();
      fd.append("message", trimmed);
      fd.append("history", JSON.stringify(history));

      const res = await fetch("/api/warden-chat", { method: "POST", body: fd });
      const data = (await res.json()) as { reply?: string; error?: string };

      if (!res.ok || data.error) {
        throw new Error(data.error ?? "AI service unavailable. Please try again.");
      }

      setMessages((prev) => [...prev, { role: "assistant", text: data.reply! }]);
    } catch (err) {
      const msg = (err as Error)?.message ?? "AI service unavailable. Please try again.";
      setMessages((prev) => [...prev, { role: "assistant", text: msg, isError: true }]);
    } finally {
      setIsThinking(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[1fr_420px] lg:items-start">
      {/* ── Left column ── */}
      <div className="space-y-8">

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

      </div>{/* end left column */}

      {/* ── Right column: AI chat ── */}
      <div className="lg:sticky lg:top-6">
        <div className="flex h-[calc(100vh-7rem)] min-h-[500px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">

          {/* Header */}
          <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
              <Bot size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900">Warden AI</p>
              <p className="truncate text-xs text-slate-400">Powered by Gemini · your data stays on-server</p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
              <Sparkles size={9} />
              No personal info shared
            </span>
          </div>

          {/* Messages */}
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
            {messages.length === 0 && !isThinking && (
              <div className="flex flex-col items-center justify-center gap-4 py-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100">
                  <Bot size={28} className="text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Ask me anything about your academic life</p>
                  <p className="mt-1 text-xs text-slate-400">I can see your courses, tasks, expenses, health data, attendance, and more.</p>
                </div>
                <div className="flex w-full flex-wrap justify-center gap-2 pt-1">
                  {SUGGESTION_CHIPS.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => sendMessage(chip)}
                      disabled={isThinking}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <MessageBubble key={i} msg={msg} />
            ))}

            {isThinking && <TypingIndicator />}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="shrink-0 border-t border-slate-200 bg-white p-3">
            <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm transition focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your courses, tasks, expenses…"
                rows={1}
                maxLength={1000}
                disabled={isThinking}
                className="max-h-32 flex-1 resize-none bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:opacity-60"
                style={{ scrollbarWidth: "none" }}
              />
              <button
                type="button"
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isThinking}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send size={14} />
              </button>
            </div>
            <p className="mt-1.5 px-1 text-[10px] text-slate-400">
              Enter to send · Shift+Enter for new line
            </p>
          </div>

        </div>
      </div>{/* end right column */}

    </div>
  );
}

export { RouteErrorBoundary as ErrorBoundary } from "~/components/RouteErrorBoundary";

import { GoogleGenAI } from "@google/genai";
import { env } from "~/lib/env.server";

// ── Gemini client singleton ────────────────────────────────────────────────────

let _client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!_client)
    _client = new GoogleGenAI({
      apiKey: env.GEMINI_API_KEY,
      httpOptions: { apiVersion: "v1" },
    });
  return _client;
}

const MODEL = "gemini-2.0-flash-lite";

// ── Types ──────────────────────────────────────────────────────────────────────

export type ChatTurn = { role: "user" | "model"; text: string };

// ── Context builder ────────────────────────────────────────────────────────────
// Fetches ALL user data anonymized — never includes email, displayName, or raw IDs.

export async function buildUserContext(
  userId: string,
  db: import("@prisma/client").PrismaClient,
): Promise<string> {
  const now = new Date();
  const ninetyDaysAgo = new Date(now);
  ninetyDaysAgo.setDate(now.getDate() - 90);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);
  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(now.getDate() - 14);

  const [
    courses,
    tasks,
    routine,
    expenses,
    weightLogs,
    dietLogs,
  ] = await Promise.all([
    // ── Courses with all sub-data ──
    db.course.findMany({
      where: { ownerId: userId, deletedAt: null },
      select: {
        title: true,
        creditHours: true,
        teacherName: true,
        quizzes: {
          orderBy: { quizDate: "asc" },
          select: { title: true, quizDate: true, deadline: true },
        },
        assignments: {
          orderBy: { deadline: "asc" },
          select: { title: true, deadline: true },
        },
        midExam: {
          select: { examDate: true, syllabus: true, venue: true },
        },
        finalExam: {
          select: { examDate: true, syllabus: true, venue: true },
        },
        presentation: {
          select: { title: true, presentationDate: true, venue: true },
        },
        attendances: {
          where: { userId },
          select: { status: true, timing: true },
        },
        mockExams: {
          where: { ownerId: userId },
          select: { kind: true },
        },
      },
      orderBy: { title: "asc" },
    }),

    // ── Tasks ──
    db.task.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { title: true, status: true, deadline: true, notes: true, assignees: true },
    }),

    // ── Class routine ──
    db.classRoutine.findMany({
      where: { userId },
      select: { dayOfWeek: true, courseName: true, startTime: true, endTime: true, room: true },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    }),

    // ── Expenses (last 90 days) ──
    db.expense.findMany({
      where: { userId, date: { gte: ninetyDaysAgo } },
      orderBy: { date: "desc" },
      select: { type: true, amount: true, category: true, date: true },
    }),

    // ── Weight logs (last 30) ──
    db.weightLog.findMany({
      where: { userId, date: { gte: thirtyDaysAgo } },
      orderBy: { date: "desc" },
      select: { weightKg: true, date: true, notes: true },
    }),

    // ── Diet logs (last 14 days) ──
    db.dietLog.findMany({
      where: { userId, date: { gte: fourteenDaysAgo } },
      orderBy: { date: "desc" },
      select: { date: true, mealType: true, description: true, calories: true, habit: true },
    }),
  ]);

  // ── Process courses ────────────────────────────────────────────────────────
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const coursesSummary = courses.map((c) => {
    const totalAttendance = c.attendances.length;
    const presentCount = c.attendances.filter((a) => a.status === "PRESENT").length;
    const attendancePct = totalAttendance > 0
      ? Math.round((presentCount / totalAttendance) * 100)
      : null;

    const mockMidDone = c.mockExams.some((m) => m.kind === "mid");
    const mockFinalDone = c.mockExams.some((m) => m.kind === "final");

    return {
      course: c.title,
      creditHours: c.creditHours,
      teacher: c.teacherName ?? undefined,
      attendance: attendancePct !== null
        ? `${attendancePct}% (${presentCount}/${totalAttendance} classes)`
        : "no records",
      quizzes: c.quizzes.map((q) => ({
        title: q.title,
        date: q.quizDate.toISOString().slice(0, 10),
        deadline: q.deadline ? q.deadline.toISOString().slice(0, 10) : null,
      })),
      assignments: c.assignments.map((a) => ({
        title: a.title,
        deadline: a.deadline.toISOString().slice(0, 10),
      })),
      midExam: c.midExam
        ? { date: c.midExam.examDate.toISOString().slice(0, 10), venue: c.midExam.venue, mockDone: mockMidDone }
        : null,
      finalExam: c.finalExam
        ? { date: c.finalExam.examDate.toISOString().slice(0, 10), venue: c.finalExam.venue, mockDone: mockFinalDone }
        : null,
      presentation: c.presentation
        ? { title: c.presentation.title, date: c.presentation.presentationDate.toISOString().slice(0, 10), venue: c.presentation.venue }
        : null,
    };
  });

  // ── Process routine ────────────────────────────────────────────────────────
  const routineSummary = routine.map((r) => ({
    day: DAYS[r.dayOfWeek] ?? r.dayOfWeek,
    course: r.courseName,
    time: `${r.startTime}–${r.endTime}`,
    room: r.room ?? null,
  }));

  // ── Process tasks ──────────────────────────────────────────────────────────
  const tasksSummary = tasks.map((t) => ({
    title: t.title,
    status: t.status,
    deadline: t.deadline ? t.deadline.toISOString().slice(0, 10) : null,
    assignees: t.assignees.length > 0 ? t.assignees : undefined,
    notes: t.notes ?? undefined,
  }));

  // ── Process expenses ───────────────────────────────────────────────────────
  // Group by month
  type MonthGroup = { income: number; expense: number; byCategory: Record<string, number> };
  const expensesByMonth: Record<string, MonthGroup> = {};
  for (const e of expenses) {
    const month = e.date.toISOString().slice(0, 7); // "YYYY-MM"
    if (!expensesByMonth[month]) {
      expensesByMonth[month] = { income: 0, expense: 0, byCategory: {} };
    }
    const amount = Number(e.amount);
    if (e.type === "INCOME") {
      expensesByMonth[month].income += amount;
    } else {
      expensesByMonth[month].expense += amount;
      const cat = e.category ?? "Other";
      expensesByMonth[month].byCategory[cat] = (expensesByMonth[month].byCategory[cat] ?? 0) + amount;
    }
  }
  const expensesSummary = Object.entries(expensesByMonth)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, data]) => ({
      month,
      income: Math.round(data.income * 100) / 100,
      expense: Math.round(data.expense * 100) / 100,
      net: Math.round((data.income - data.expense) * 100) / 100,
      byCategory: data.byCategory,
    }));

  // ── Process health data ────────────────────────────────────────────────────
  const weightSummary = weightLogs.map((w) => ({
    date: w.date.toISOString().slice(0, 10),
    weightKg: Number(w.weightKg),
    notes: w.notes ?? undefined,
  }));

  const dietSummary = dietLogs.map((d) => ({
    date: d.date.toISOString().slice(0, 10),
    meal: d.mealType,
    description: d.description,
    calories: d.calories ?? undefined,
    habit: d.habit ?? undefined,
  }));

  // ── Warden alerts ──────────────────────────────────────────────────────────
  const wardenAlerts: Array<{kind: string; course: string; label: string; daysUntil: number}> = [];
  for (const c of courses) {
    for (const q of c.quizzes) {
      const daysUntil = Math.ceil((q.quizDate.getTime() - now.getTime()) / 86400000);
      if (daysUntil >= 0 && daysUntil <= 3) {
        wardenAlerts.push({ kind: "quiz", course: c.title, label: q.title, daysUntil });
      }
    }
    for (const a of c.assignments) {
      const daysUntil = Math.ceil((a.deadline.getTime() - now.getTime()) / 86400000);
      if (daysUntil >= 0 && daysUntil <= 3) {
        wardenAlerts.push({ kind: "assignment", course: c.title, label: a.title, daysUntil });
      }
    }
    if (c.midExam) {
      const daysUntil = Math.ceil((c.midExam.examDate.getTime() - now.getTime()) / 86400000);
      if (daysUntil >= 0 && daysUntil <= 7) {
        wardenAlerts.push({ kind: "mid exam", course: c.title, label: "Mid Exam", daysUntil });
      }
    }
    if (c.finalExam) {
      const daysUntil = Math.ceil((c.finalExam.examDate.getTime() - now.getTime()) / 86400000);
      if (daysUntil >= 0 && daysUntil <= 7) {
        wardenAlerts.push({ kind: "final exam", course: c.title, label: "Final Exam", daysUntil });
      }
    }
    if (c.presentation) {
      const daysUntil = Math.ceil((c.presentation.presentationDate.getTime() - now.getTime()) / 86400000);
      if (daysUntil >= 0 && daysUntil <= 7) {
        wardenAlerts.push({ kind: "presentation", course: c.title, label: c.presentation.title, daysUntil });
      }
    }
  }
  wardenAlerts.sort((a, b) => a.daysUntil - b.daysUntil);

  const context = {
    today: now.toISOString().slice(0, 10),
    dayOfWeek: DAYS[now.getDay()],
    courses: coursesSummary,
    tasks: tasksSummary,
    weeklyRoutine: routineSummary,
    expensesByMonth: expensesSummary,
    recentWeight: weightSummary,
    recentDiet: dietSummary,
    activeWardenAlerts: wardenAlerts,
  };

  return JSON.stringify(context);
}

// ── Gemini call ────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Warden AI, an intelligent academic and personal productivity assistant embedded in UniBuddy — a university student productivity app. You have access to a complete anonymized snapshot of the student's logged data.

IMPORTANT PRIVACY RULES:
- Never refer to the user by name. Use "you" / "your" only.
- Never mention emails, passwords, or any identifying information.
- Do not reveal or repeat raw IDs from the context.

YOUR CAPABILITIES:
You can answer questions and provide insights about:
- Courses: enrollment, credit hours, teachers, syllabi
- Upcoming deadlines: quizzes, assignments, mid/final exams, presentations
- Warden alerts: items in the urgent preparation window
- Attendance: per-course present/absent stats and percentages
- Tasks: to-do list, in-progress items, completed tasks, overdue tasks
- Weekly class routine: schedule by day, rooms, times
- Financial tracking: income vs expenses, spending by category and month
- Health: weight trends, diet logs, meal habits
- Academic preparation: mock exam completion status

RESPONSE STYLE:
- Be direct, helpful, and concise. Use bullet points or tables for lists.
- If data is missing or empty, say so honestly.
- Give actionable suggestions when appropriate.
- Do not hallucinate or invent data. Only reference what is in the context.
- Keep responses focused. For large data sets, summarize and offer to drill down.

The current date is provided in the context. Always reason relative to it for "upcoming" or "overdue" calculations.`;

export async function callWardenAI({
  userMessage,
  history,
  context,
}: {
  userMessage: string;
  history: ChatTurn[];
  context: string;
}): Promise<string> {
  const ai = getClient();

  // Build the contents array: system context as first user turn + model ack, then history, then current message
  const contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [
    {
      role: "user",
      parts: [{ text: `${SYSTEM_PROMPT}\n\n--- USER DATA CONTEXT ---\n${context}\n--- END CONTEXT ---\n\nI understand you have this data. I'm ready to help.` }],
    },
    {
      role: "model",
      parts: [{ text: "Got it. I have your full academic and personal data context. Ask me anything about your courses, tasks, attendance, expenses, health, or anything else you've logged." }],
    },
    ...history.map((turn) => ({
      role: turn.role,
      parts: [{ text: turn.text }],
    })),
    {
      role: "user" as const,
      parts: [{ text: userMessage }],
    },
  ];

  // Retry once on transient 503 / UNAVAILABLE errors
  async function attempt(): Promise<string> {
    const response = await ai.models.generateContent({ model: MODEL, contents });
    return response.text ?? "Sorry, I couldn't generate a response. Please try again.";
  }

  try {
    return await attempt();
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    if (status === 503 || status === 429) {
      // Wait 2 s then retry once
      await new Promise((r) => setTimeout(r, 2000));
      return await attempt();
    }
    throw err;
  }
}

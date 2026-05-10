import { useEffect, useRef, useState } from "react";
import { Form, Link, useLoaderData, useNavigation, useSearchParams } from "react-router";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart2,
  BookOpen,
  Bus,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Coffee,
  DollarSign,
  Flame,
  Heart,
  Home,
  List,
  MoreHorizontal,
  Plus,
  ShoppingBag,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";

import type { Route } from "./+types/expenses";
import { CustomSelect } from "~/components/ui/select";

export function meta() {
  return [{ title: "Expenses | UniBuddy" }];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  "FOOD",
  "TRANSPORT",
  "HOUSING",
  "EDUCATION",
  "HEALTH",
  "ENTERTAINMENT",
  "SHOPPING",
  "UTILITIES",
  "OTHER",
] as const;

type Category = (typeof CATEGORIES)[number];

const CATEGORY_CONFIG: Record<
  Category,
  { label: string; icon: React.ComponentType<{ size?: number; className?: string }>; color: string; bg: string; bar: string; hex: string }
> = {
  FOOD:          { label: "Food & Drinks",  icon: Coffee,        color: "text-orange-600", bg: "bg-orange-50",  bar: "bg-orange-400",  hex: "#fb923c" },
  TRANSPORT:     { label: "Transport",       icon: Bus,           color: "text-blue-600",   bg: "bg-blue-50",    bar: "bg-blue-400",    hex: "#60a5fa" },
  HOUSING:       { label: "Housing",         icon: Home,          color: "text-slate-600",  bg: "bg-slate-100",  bar: "bg-slate-400",   hex: "#94a3b8" },
  EDUCATION:     { label: "Education",       icon: BookOpen,      color: "text-indigo-600", bg: "bg-indigo-50",  bar: "bg-indigo-400",  hex: "#818cf8" },
  HEALTH:        { label: "Health",          icon: Heart,         color: "text-rose-600",   bg: "bg-rose-50",    bar: "bg-rose-400",    hex: "#fb7185" },
  ENTERTAINMENT: { label: "Entertainment",   icon: Clapperboard,  color: "text-violet-600", bg: "bg-violet-50",  bar: "bg-violet-400",  hex: "#a78bfa" },
  SHOPPING:      { label: "Shopping",        icon: ShoppingBag,   color: "text-pink-600",   bg: "bg-pink-50",    bar: "bg-pink-400",    hex: "#f472b6" },
  UTILITIES:     { label: "Utilities",       icon: Flame,         color: "text-amber-600",  bg: "bg-amber-50",   bar: "bg-amber-400",   hex: "#fbbf24" },
  OTHER:         { label: "Other",           icon: MoreHorizontal,color: "text-slate-500",  bg: "bg-slate-50",   bar: "bg-slate-300",   hex: "#cbd5e1" },
};

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

// ── Loader ────────────────────────────────────────────────────────────────────

export async function loader({ request }: Route.LoaderArgs) {
  const { getAuthenticatedUser } = await import("~/lib/auth.server");
  const { redirect } = await import("react-router");
  const { db } = await import("~/lib/db.server");

  const user = await getAuthenticatedUser(request);
  if (!user) throw redirect("/login");

  const url = new URL(request.url);
  const now = new Date();
  const year  = parseInt(url.searchParams.get("year")  ?? String(now.getFullYear()), 10);
  const month = parseInt(url.searchParams.get("month") ?? String(now.getMonth() + 1), 10);
  const filterCat = url.searchParams.get("cat") as Category | null;

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd   = new Date(year, month, 0, 23, 59, 59, 999);
  const prevMonthStart = new Date(year, month - 2, 1);
  const prevMonthEnd   = new Date(year, month - 1, 0, 23, 59, 59, 999);
  const yearStart = new Date(year, 0, 1);
  const yearEnd   = new Date(year, 11, 31, 23, 59, 59, 999);

  // Last 6 months windows
  const six: Array<{ y: number; m: number; start: Date; end: Date }> = [];
  for (let i = 5; i >= 0; i--) {
    let m2 = month - i; let y2 = year;
    if (m2 < 1) { m2 += 12; y2--; }
    six.push({ y: y2, m: m2, start: new Date(y2, m2 - 1, 1), end: new Date(y2, m2, 0, 23, 59, 59, 999) });
  }

  const [allThisMonth, prevMonthAgg, yearExpenses, filteredExpenses, sixMonthRows] = await Promise.all([
    db.expense.findMany({ where: { userId: user.id, date: { gte: monthStart, lte: monthEnd } }, orderBy: { date: "desc" } }),
    db.expense.aggregate({ where: { userId: user.id, date: { gte: prevMonthStart, lte: prevMonthEnd } }, _sum: { amount: true } }),
    db.expense.findMany({ where: { userId: user.id, date: { gte: yearStart, lte: yearEnd } }, select: { date: true, amount: true } }),
    db.expense.findMany({
      where: { userId: user.id, date: { gte: monthStart, lte: monthEnd }, ...(filterCat ? { category: filterCat } : {}) },
      orderBy: { date: "desc" },
    }),
    db.expense.findMany({ where: { userId: user.id, date: { gte: six[0].start, lte: six[5].end } }, select: { date: true, amount: true } }),
  ]);

  // Category totals
  const categoryTotals: Record<string, number> = {};
  const categoryCounts: Record<string, number> = {};
  for (const e of allThisMonth) {
    const cat = e.category as string;
    categoryTotals[cat] = (categoryTotals[cat] ?? 0) + Number(e.amount);
    categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1;
  }

  // Monthly totals Jan–Dec
  const monthlyTotals = Array.from({ length: 12 }, (_, i) =>
    yearExpenses.filter((e) => new Date(e.date).getMonth() === i).reduce((s, e) => s + Number(e.amount), 0)
  );

  // Daily totals for current month
  const daysInMonth = new Date(year, month, 0).getDate();
  const dailyTotals = Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1;
    return allThisMonth
      .filter((e) => new Date(e.date).getDate() === d)
      .reduce((s, e) => s + Number(e.amount), 0);
  });

  // Six-month comparison
  const sixMonthTotals = six.map(({ m: m2, y: y2, start, end }) => ({
    label: `${MONTHS[m2 - 1].slice(0, 3)} ${y2}`,
    m: m2, y: y2,
    total: sixMonthRows.filter((e) => {
      const d = new Date(e.date);
      return d >= start && d <= end;
    }).reduce((s, e) => s + Number(e.amount), 0),
  }));

  const thisMonthTotal = allThisMonth.reduce((s, e) => s + Number(e.amount), 0);
  const prevTotal      = Number(prevMonthAgg._sum.amount ?? 0);
  const yearTotal      = yearExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const daysWithData   = dailyTotals.filter((d) => d > 0).length;
  const avgPerDay      = daysWithData > 0 ? thisMonthTotal / daysWithData : 0;

  // Top 5 expenses
  const top5 = [...allThisMonth]
    .sort((a, b) => Number(b.amount) - Number(a.amount))
    .slice(0, 5)
    .map((e) => ({ id: e.id, description: e.description, amount: Number(e.amount), category: e.category as Category, date: e.date.toISOString().slice(0, 10) }));

  return {
    expenses: filteredExpenses.map((e) => ({
      id: e.id, amount: Number(e.amount), category: e.category as Category,
      description: e.description, date: e.date.toISOString().slice(0, 10), notes: e.notes,
    })),
    thisMonthTotal, prevMonthTotal: prevTotal, yearTotal,
    categoryTotals, categoryCounts,
    monthlyTotals, dailyTotals, sixMonthTotals, top5,
    avgPerDay, txCount: allThisMonth.length,
    year, month, filterCat,
    now: now.toISOString(),
  };
}

// ── Action ────────────────────────────────────────────────────────────────────

export async function action({ request }: Route.ActionArgs) {
  const { getAuthenticatedUser } = await import("~/lib/auth.server");
  const { redirect } = await import("react-router");
  const { db } = await import("~/lib/db.server");
  const { rateLimit } = await import("~/lib/ratelimit.server");
  const { serializeFlash } = await import("~/lib/flash.server");

  const user = await getAuthenticatedUser(request);
  if (!user) throw redirect("/login");

  await rateLimit(`expenses:${user.id}`, 60, 30);

  const form = await request.formData();
  const intent = form.get("intent") as string;

  if (intent === "add") {
    const description = String(form.get("description") ?? "").trim().slice(0, 200);
    const amountRaw   = String(form.get("amount") ?? "").trim();
    const category    = String(form.get("category") ?? "OTHER") as Category;
    const date        = String(form.get("date") ?? "").trim();
    const notes       = String(form.get("notes") ?? "").trim().slice(0, 1000);

    if (!description || !amountRaw || !date) {
      throw redirect(request.url, { headers: { "Set-Cookie": await serializeFlash({ type: "error", message: "Description, amount and date are required." }) } });
    }
    const amount = parseFloat(amountRaw);
    if (isNaN(amount) || amount <= 0 || amount > 999999.99) {
      throw redirect(request.url, { headers: { "Set-Cookie": await serializeFlash({ type: "error", message: "Invalid amount." }) } });
    }
    if (!CATEGORIES.includes(category)) {
      throw redirect(request.url, { headers: { "Set-Cookie": await serializeFlash({ type: "error", message: "Invalid category." }) } });
    }
    const parsedDate = new Date(date + "T12:00:00");
    if (isNaN(parsedDate.getTime())) {
      throw redirect(request.url, { headers: { "Set-Cookie": await serializeFlash({ type: "error", message: "Invalid date." }) } });
    }
    await db.expense.create({ data: { userId: user.id, description, amount, category, date: parsedDate, notes: notes || null } });
    throw redirect(request.url, { headers: { "Set-Cookie": await serializeFlash({ type: "success", message: "Expense added." }) } });
  }

  if (intent === "delete") {
    const id = String(form.get("id") ?? "");
    await db.expense.deleteMany({ where: { id, userId: user.id } });
    throw redirect(request.url, { headers: { "Set-Cookie": await serializeFlash({ type: "success", message: "Expense deleted." }) } });
  }

  throw redirect(request.url);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(str: string) {
  return new Date(str + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// ── Add Expense Modal ─────────────────────────────────────────────────────────

function AddExpenseModal({ open, onClose, defaultDate }: { open: boolean; onClose: () => void; defaultDate: string }) {
  const navigation = useNavigation();
  const submitting = navigation.state !== "idle";
  const formRef  = useRef<HTMLFormElement>(null);
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) setTimeout(() => firstRef.current?.focus(), 50); }, [open]);
  useEffect(() => { if (!submitting && open) { formRef.current?.reset(); onClose(); } }, [submitting]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50"><DollarSign size={16} className="text-emerald-600" /></div>
            <h2 className="text-sm font-bold text-slate-900">Add Expense</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"><X size={16} /></button>
        </div>
        <Form method="post" ref={formRef} className="px-5 py-5 space-y-4">
          <input type="hidden" name="intent" value="add" />
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Description <span className="text-red-500">*</span></label>
            <input ref={firstRef} name="description" type="text" placeholder="e.g. Lunch at cafeteria" maxLength={200} required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Amount <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">৳</span>
                <input name="amount" type="number" min="0.01" max="999999.99" step="0.01" placeholder="0.00" required
                  className="w-full rounded-lg border border-slate-300 py-2 pl-7 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Category</label>
              <CustomSelect name="category" defaultValue="OTHER"
                options={CATEGORIES.map((c) => ({ value: c, label: CATEGORY_CONFIG[c].label, icon: CATEGORY_CONFIG[c].icon }))} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Date <span className="text-red-500">*</span></label>
            <input name="date" type="date" defaultValue={defaultDate} required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Notes <span className="text-slate-400 font-normal">(optional)</span></label>
            <textarea name="notes" rows={2} maxLength={1000} placeholder="Any additional notes…"
              className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={submitting}
              className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60">
              {submitting ? "Adding…" : "Add Expense"}
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}

// ── Delete Button ─────────────────────────────────────────────────────────────

function DeleteExpenseButton({ id }: { id: string }) {
  const [confirm, setConfirm] = useState(false);
  const navigation = useNavigation();
  const submitting = navigation.state !== "idle" && navigation.formData?.get("id") === id;
  if (confirm) {
    return (
      <Form method="post" className="flex items-center gap-1">
        <input type="hidden" name="intent" value="delete" />
        <input type="hidden" name="id" value={id} />
        <button type="button" onClick={() => setConfirm(false)} className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 transition-colors">Cancel</button>
        <button type="submit" disabled={submitting} className="rounded px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50">{submitting ? "…" : "Confirm"}</button>
      </Form>
    );
  }
  return (
    <button type="button" onClick={() => setConfirm(true)} className="rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500 transition-colors">
      <Trash2 size={14} />
    </button>
  );
}

// ── Transactions View ─────────────────────────────────────────────────────────

function TransactionsView({
  expenses,
  filterCat,
  setCategory,
  onAdd,
}: {
  expenses: ReturnType<typeof useLoaderData<typeof loader>>["expenses"];
  filterCat: string | null;
  setCategory: (cat: Category | null) => void;
  onAdd: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Category filter */}
      <div className="flex gap-1.5 overflow-x-auto border-b border-slate-100 px-4 py-3 scrollbar-none">
        <button type="button" onClick={() => setCategory(null)}
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${!filterCat ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
          All
        </button>
        {CATEGORIES.map((cat) => {
          const active = filterCat === cat;
          return (
            <button key={cat} type="button" onClick={() => setCategory(active ? null : cat)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${active ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
              {CATEGORY_CONFIG[cat].label}
            </button>
          );
        })}
      </div>

      {expenses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400"><DollarSign size={22} /></div>
          <p className="mt-3 text-sm font-semibold text-slate-700">No expenses yet</p>
          <p className="mt-1 text-xs text-slate-400">
            {filterCat ? `No ${CATEGORY_CONFIG[filterCat as Category].label} expenses this month.` : "Add your first expense for this month."}
          </p>
          {!filterCat && (
            <button type="button" onClick={onAdd} className="mt-4 flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors">
              <Plus size={14} /> Add Expense
            </button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {expenses.map((exp) => {
            const cfg = CATEGORY_CONFIG[exp.category];
            const Icon = cfg.icon;
            return (
              <div key={exp.id} className="flex items-center gap-3 px-4 py-3 group">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${cfg.bg}`}>
                  <Icon size={16} className={cfg.color} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{exp.description}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[10px] font-bold ${cfg.color}`}>{cfg.label}</span>
                    <span className="text-[10px] text-slate-400">·</span>
                    <span className="text-[10px] text-slate-400">{fmtDate(exp.date)}</span>
                  </div>
                  {exp.notes && <p className="mt-0.5 truncate text-[11px] text-slate-400">{exp.notes}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-extrabold text-slate-900">৳{fmt(exp.amount)}</span>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity"><DeleteExpenseButton id={exp.id} /></div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Analytics View ────────────────────────────────────────────────────────────

function AnalyticsView({
  thisMonthTotal,
  prevMonthTotal,
  yearTotal,
  avgPerDay,
  txCount,
  categoryTotals,
  categoryCounts,
  monthlyTotals,
  dailyTotals,
  sixMonthTotals,
  top5,
  year,
  month,
}: {
  thisMonthTotal: number;
  prevMonthTotal: number;
  yearTotal: number;
  avgPerDay: number;
  txCount: number;
  categoryTotals: Record<string, number>;
  categoryCounts: Record<string, number>;
  monthlyTotals: number[];
  dailyTotals: number[];
  sixMonthTotals: { label: string; m: number; y: number; total: number }[];
  top5: { id: string; description: string; amount: number; category: Category; date: string }[];
  year: number;
  month: number;
}) {
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);
  const [hoveredDay, setHoveredDay]     = useState<number | null>(null);

  const monthDiff    = thisMonthTotal - prevMonthTotal;
  const monthDiffPct = prevMonthTotal > 0 ? ((monthDiff / prevMonthTotal) * 100) : null;

  const catBreakdown = (Object.entries(categoryTotals) as [Category, number][]).sort((a, b) => b[1] - a[1]);
  const maxMonthly   = Math.max(...monthlyTotals, 1);
  const maxDaily     = Math.max(...dailyTotals, 1);
  const maxSix       = Math.max(...sixMonthTotals.map((s) => s.total), 1);
  const topCat       = catBreakdown[0]?.[0] as Category | undefined;

  return (
    <div className="space-y-5">
      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "This Month",
            value: `৳${fmt(thisMonthTotal)}`,
            sub: monthDiffPct !== null
              ? `${monthDiff >= 0 ? "+" : ""}${monthDiffPct.toFixed(1)}% vs last month`
              : "No prior data",
            icon: DollarSign,
            iconBg: "bg-emerald-50",
            iconColor: "text-emerald-600",
            subColor: monthDiffPct !== null ? (monthDiff > 0 ? "text-red-500" : "text-emerald-600") : "text-slate-400",
            SubIcon: monthDiffPct !== null ? (monthDiff > 0 ? TrendingUp : TrendingDown) : null,
          },
          {
            label: "Avg / Active Day",
            value: `৳${fmt(avgPerDay)}`,
            sub: `${txCount} transaction${txCount !== 1 ? "s" : ""} this month`,
            icon: Zap,
            iconBg: "bg-amber-50",
            iconColor: "text-amber-600",
            subColor: "text-slate-400",
            SubIcon: null,
          },
          {
            label: `${year} Total`,
            value: `৳${fmt(yearTotal)}`,
            sub: "All categories, full year",
            icon: BarChart2,
            iconBg: "bg-indigo-50",
            iconColor: "text-indigo-600",
            subColor: "text-slate-400",
            SubIcon: null,
          },
          {
            label: "Top Category",
            value: topCat ? CATEGORY_CONFIG[topCat].label : "—",
            sub: topCat ? `৳${fmt(categoryTotals[topCat])} · ${categoryCounts[topCat]} tx` : "No data yet",
            icon: topCat ? CATEGORY_CONFIG[topCat].icon : MoreHorizontal,
            iconBg: topCat ? CATEGORY_CONFIG[topCat].bg : "bg-slate-50",
            iconColor: topCat ? CATEGORY_CONFIG[topCat].color : "text-slate-400",
            subColor: "text-slate-400",
            SubIcon: null,
          },
        ].map((kpi) => {
          const KpiIcon = kpi.icon;
          const SIcon   = kpi.SubIcon;
          return (
            <div key={kpi.label} className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-500">{kpi.label}</p>
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${kpi.iconBg}`}>
                  <KpiIcon size={15} className={kpi.iconColor} />
                </div>
              </div>
              <p className="text-xl font-extrabold text-slate-900 truncate">{kpi.value}</p>
              <div className={`mt-1 flex items-center gap-1 text-xs font-semibold ${kpi.subColor}`}>
                {SIcon && <SIcon size={12} />}
                {kpi.sub}
              </div>
            </div>
          );
        })}
      </div>

      {/* Monthly bar chart — full width */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4">
          <h3 className="text-sm font-bold text-slate-900">{year} — Monthly Spending</h3>
          <p className="mt-0.5 text-xs text-slate-400">Click on a bar to navigate to that month</p>
        </div>
        <div className="px-6 py-5">
          <div className="flex items-end gap-2 h-[160px]">
            {monthlyTotals.map((total, i) => {
              const h = maxMonthly > 0 ? (total / maxMonthly) * 128 : 0;
              const isCur = i + 1 === month;
              const isHov = hoveredMonth === i;
              return (
                <div key={i} className="flex flex-1 flex-col items-center gap-2 cursor-pointer group"
                  onMouseEnter={() => setHoveredMonth(i)}
                  onMouseLeave={() => setHoveredMonth(null)}>
                  <div className="relative w-full flex flex-col items-center">
                    {isHov && total > 0 && (
                      <div className="absolute bottom-full mb-1.5 z-10 pointer-events-none">
                        <div className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white whitespace-nowrap shadow-lg">
                          {MONTHS[i].slice(0, 3)}<br />৳{fmt(total)}
                        </div>
                      </div>
                    )}
                    <div
                      className={`w-full rounded-t-md transition-all duration-150 ${
                        isCur ? "bg-indigo-500" : isHov ? "bg-slate-400" : "bg-slate-200"
                      }`}
                      style={{ height: `${Math.max(h, total > 0 ? 4 : 0)}px` }}
                    />
                  </div>
                  <span className={`text-[10px] font-bold ${isCur ? "text-indigo-600" : "text-slate-400"}`}>
                    {MONTHS[i].slice(0, 1)}
                  </span>
                </div>
              );
            })}
          </div>
          {/* Y-axis labels */}
          <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400">
            <span>৳0</span>
            <span>৳{fmt(maxMonthly / 2)}</span>
            <span>৳{fmt(maxMonthly)}</span>
          </div>
        </div>
      </div>

      {/* Two column: category breakdown + daily chart */}
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* Category breakdown */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-4">
            <h3 className="text-sm font-bold text-slate-900">Spending by Category</h3>
            <p className="mt-0.5 text-xs text-slate-400">{MONTHS[month - 1]} {year}</p>
          </div>
          {catBreakdown.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <p className="text-sm font-semibold text-slate-700">No data yet</p>
              <p className="text-xs text-slate-400 mt-1">Add expenses to see your breakdown.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {catBreakdown.map(([cat, total]) => {
                const cfg = CATEGORY_CONFIG[cat as Category];
                const Icon = cfg.icon;
                const pct = thisMonthTotal > 0 ? ((total / thisMonthTotal) * 100) : 0;
                const barW = ((total / (catBreakdown[0][1])) * 100);
                const count = categoryCounts[cat] ?? 0;
                return (
                  <div key={cat} className="flex items-center gap-4 px-6 py-3.5">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${cfg.bg}`}>
                      <Icon size={16} className={cfg.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-semibold text-slate-800">{cfg.label}</span>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs text-slate-400">{count} tx</span>
                          <span className="text-xs font-semibold text-slate-500 w-9 text-right">{pct.toFixed(1)}%</span>
                          <span className="text-sm font-extrabold text-slate-900 w-24 text-right">৳{fmt(total)}</span>
                        </div>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div className={`h-full rounded-full ${cfg.bar} transition-all duration-300`} style={{ width: `${barW}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column: daily chart + 6-month */}
        <div className="space-y-5">
          {/* Daily spending */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-4 py-4">
              <h3 className="text-sm font-bold text-slate-900">Daily — {MONTHS[month - 1]}</h3>
            </div>
            <div className="px-4 py-4">
              <div className="flex items-end gap-[3px] h-[80px]">
                {dailyTotals.map((total, i) => {
                  const h = maxDaily > 0 ? (total / maxDaily) * 64 : 0;
                  const isHov = hoveredDay === i;
                  return (
                    <div key={i} className="relative flex flex-1 flex-col items-center group cursor-default"
                      onMouseEnter={() => setHoveredDay(i)}
                      onMouseLeave={() => setHoveredDay(null)}>
                      {isHov && total > 0 && (
                        <div className="absolute bottom-full mb-1 z-10 pointer-events-none">
                          <div className="rounded-md bg-slate-900 px-2 py-1 text-[10px] font-semibold text-white whitespace-nowrap shadow-lg">
                            Day {i + 1}: ৳{fmt(total)}
                          </div>
                        </div>
                      )}
                      <div
                        className={`w-full rounded-t-sm transition-all ${total > 0 ? (isHov ? "bg-indigo-500" : "bg-indigo-300") : "bg-slate-100"}`}
                        style={{ height: `${Math.max(h, total > 0 ? 3 : 2)}px` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex justify-between text-[9px] text-slate-400">
                <span>1</span>
                <span>{Math.ceil(dailyTotals.length / 2)}</span>
                <span>{dailyTotals.length}</span>
              </div>
            </div>
          </div>

          {/* 6-month comparison */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-4 py-4">
              <h3 className="text-sm font-bold text-slate-900">Last 6 Months</h3>
            </div>
            <div className="divide-y divide-slate-50">
              {sixMonthTotals.map((item, i) => {
                const barW = maxSix > 0 ? (item.total / maxSix) * 100 : 0;
                const isCur = item.m === month && item.y === year;
                return (
                  <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                    <span className={`text-xs font-semibold w-20 shrink-0 ${isCur ? "text-indigo-600" : "text-slate-500"}`}>{item.label}</span>
                    <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-300 ${isCur ? "bg-indigo-500" : "bg-slate-300"}`} style={{ width: `${barW}%` }} />
                    </div>
                    <span className={`text-xs font-bold w-20 text-right shrink-0 ${isCur ? "text-indigo-700" : "text-slate-700"}`}>
                      ৳{fmt(item.total)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Top 5 expenses */}
      {top5.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-4">
            <h3 className="text-sm font-bold text-slate-900">Biggest Expenses — {MONTHS[month - 1]} {year}</h3>
          </div>
          <div className="divide-y divide-slate-50">
            {top5.map((exp, i) => {
              const cfg = CATEGORY_CONFIG[exp.category];
              const Icon = cfg.icon;
              const pct = thisMonthTotal > 0 ? ((exp.amount / thisMonthTotal) * 100).toFixed(1) : "0";
              return (
                <div key={exp.id} className="flex items-center gap-4 px-6 py-3.5">
                  <span className="w-5 shrink-0 text-xs font-extrabold text-slate-300">#{i + 1}</span>
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${cfg.bg}`}>
                    <Icon size={16} className={cfg.color} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{exp.description}</p>
                    <p className={`text-[10px] font-bold ${cfg.color}`}>{cfg.label} · {fmtDate(exp.date)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-extrabold text-slate-900">৳{fmt(exp.amount)}</p>
                    <p className="text-[10px] text-slate-400">{pct}% of month</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const data = useLoaderData<typeof loader>();
  const { expenses, thisMonthTotal, prevMonthTotal, yearTotal, avgPerDay, txCount,
    categoryTotals, categoryCounts, monthlyTotals, dailyTotals, sixMonthTotals, top5,
    year, month, filterCat, now } = data;

  const [searchParams, setSearchParams] = useSearchParams();
  const [modalOpen, setModalOpen] = useState(false);
  const todayStr = now.slice(0, 10);
  const activeTab = searchParams.get("tab") === "analytics" ? "analytics" : "transactions";

  const monthDiff = thisMonthTotal - prevMonthTotal;
  const monthDiffPct = prevMonthTotal > 0 ? ((monthDiff / prevMonthTotal) * 100).toFixed(1) : null;

  function goMonth(delta: number) {
    let m = month + delta, y = year;
    if (m < 1)  { m = 12; y--; }
    if (m > 12) { m = 1;  y++; }
    const p = new URLSearchParams(searchParams);
    p.set("year", String(y)); p.set("month", String(m)); p.delete("cat");
    setSearchParams(p);
  }

  function setCategory(cat: Category | null) {
    const p = new URLSearchParams(searchParams);
    if (cat) p.set("cat", cat); else p.delete("cat");
    setSearchParams(p);
  }

  function setTab(tab: "transactions" | "analytics") {
    const p = new URLSearchParams(searchParams);
    if (tab === "analytics") p.set("tab", "analytics"); else p.delete("tab");
    setSearchParams(p);
  }

  return (
    <>
      <AddExpenseModal open={modalOpen} onClose={() => setModalOpen(false)} defaultDate={todayStr} />

      <div className="space-y-5">
        {/* Controls row */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Month nav */}
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => goMonth(-1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition-colors shadow-sm">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-bold text-slate-900 min-w-[130px] text-center">
              {MONTHS[month - 1]} {year}
            </span>
            <button type="button" onClick={() => goMonth(1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition-colors shadow-sm">
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm ml-2">
            <button type="button" onClick={() => setTab("transactions")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === "transactions" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              <List size={13} /> Transactions
            </button>
            <button type="button" onClick={() => setTab("analytics")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === "analytics" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              <BarChart2 size={13} /> Analytics
            </button>
          </div>

          <div className="ml-auto">
            <button type="button" onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700">
              <Plus size={16} /> Add Expense
            </button>
          </div>
        </div>

        {/* Stats strip — always visible */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 mb-1">This Month</p>
            <p className="text-2xl font-extrabold text-slate-900">৳{fmt(thisMonthTotal)}</p>
            {monthDiffPct !== null ? (
              <div className={`mt-1.5 flex items-center gap-1 text-xs font-semibold ${monthDiff > 0 ? "text-red-600" : "text-emerald-600"}`}>
                {monthDiff > 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                {monthDiff > 0 ? "+" : ""}{monthDiffPct}% vs last month
              </div>
            ) : (
              <p className="mt-1 text-xs text-slate-400">{txCount} transaction{txCount !== 1 ? "s" : ""}</p>
            )}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 mb-1">Last Month</p>
            <p className="text-2xl font-extrabold text-slate-900">৳{fmt(prevMonthTotal)}</p>
            <p className="mt-1 text-xs text-slate-400">{prevMonthTotal > 0 ? "Previous period" : "No expenses recorded"}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 mb-1">{year} Total</p>
            <p className="text-2xl font-extrabold text-slate-900">৳{fmt(yearTotal)}</p>
            <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">
              <ArrowDownLeft size={12} /> All categories
            </div>
          </div>
        </div>

        {/* Tab content */}
        {activeTab === "transactions" ? (
          <TransactionsView
            expenses={expenses}
            filterCat={filterCat}
            setCategory={setCategory}
            onAdd={() => setModalOpen(true)}
          />
        ) : (
          <AnalyticsView
            thisMonthTotal={thisMonthTotal}
            prevMonthTotal={prevMonthTotal}
            yearTotal={yearTotal}
            avgPerDay={avgPerDay}
            txCount={txCount}
            categoryTotals={categoryTotals}
            categoryCounts={categoryCounts}
            monthlyTotals={monthlyTotals}
            dailyTotals={dailyTotals}
            sixMonthTotals={sixMonthTotals}
            top5={top5}
            year={year}
            month={month}
          />
        )}
      </div>
    </>
  );
}


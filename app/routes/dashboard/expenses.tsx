import { useEffect, useRef, useState } from "react";
import { Form, useLoaderData, useNavigation, useSearchParams } from "react-router";
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
  Wallet,
  X,
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
type TxType = "INCOME" | "EXPENSE";

const CATEGORY_CONFIG: Record<
  Category,
  { label: string; icon: React.ComponentType<{ size?: number; className?: string }>; color: string; bg: string; bar: string }
> = {
  FOOD:          { label: "Food & Drinks",  icon: Coffee,         color: "text-orange-600", bg: "bg-orange-50",  bar: "bg-orange-400"  },
  TRANSPORT:     { label: "Transport",       icon: Bus,            color: "text-blue-600",   bg: "bg-blue-50",    bar: "bg-blue-400"    },
  HOUSING:       { label: "Housing",         icon: Home,           color: "text-slate-600",  bg: "bg-slate-100",  bar: "bg-slate-400"   },
  EDUCATION:     { label: "Education",       icon: BookOpen,       color: "text-indigo-600", bg: "bg-indigo-50",  bar: "bg-indigo-400"  },
  HEALTH:        { label: "Health",          icon: Heart,          color: "text-rose-600",   bg: "bg-rose-50",    bar: "bg-rose-400"    },
  ENTERTAINMENT: { label: "Entertainment",   icon: Clapperboard,   color: "text-violet-600", bg: "bg-violet-50",  bar: "bg-violet-400"  },
  SHOPPING:      { label: "Shopping",        icon: ShoppingBag,    color: "text-pink-600",   bg: "bg-pink-50",    bar: "bg-pink-400"    },
  UTILITIES:     { label: "Utilities",       icon: Flame,          color: "text-amber-600",  bg: "bg-amber-50",   bar: "bg-amber-400"   },
  OTHER:         { label: "Other",           icon: MoreHorizontal, color: "text-slate-500",  bg: "bg-slate-50",   bar: "bg-slate-300"   },
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

  const url        = new URL(request.url);
  const now        = new Date();
  const year       = Math.max(2000, Math.min(2100, parseInt(url.searchParams.get("year")  ?? "", 10) || now.getFullYear()));
  const month      = Math.max(1,    Math.min(12,   parseInt(url.searchParams.get("month") ?? "", 10) || (now.getMonth() + 1)));
  const rawCat     = url.searchParams.get("cat");
  const filterCat  = (CATEGORIES as readonly string[]).includes(rawCat ?? "") ? rawCat as Category : null;
  const filterType = (url.searchParams.get("type") as TxType | "ALL" | null) ?? "ALL";

  const monthStart     = new Date(year, month - 1, 1);
  const monthEnd       = new Date(year, month, 0, 23, 59, 59, 999);
  const prevMonthStart = new Date(year, month - 2, 1);
  const prevMonthEnd   = new Date(year, month - 1, 0, 23, 59, 59, 999);
  const yearStart      = new Date(year, 0, 1);
  const yearEnd        = new Date(year, 11, 31, 23, 59, 59, 999);

  // Last 6 months windows
  const six: Array<{ y: number; m: number; start: Date; end: Date }> = [];
  for (let i = 5; i >= 0; i--) {
    let m2 = month - i; let y2 = year;
    if (m2 < 1) { m2 += 12; y2--; }
    six.push({ y: y2, m: m2, start: new Date(y2, m2 - 1, 1), end: new Date(y2, m2, 0, 23, 59, 59, 999) });
  }

  const [allThisMonth, prevMonthRows, yearRows, sixMonthRows, globalRows] = await Promise.all([
    db.expense.findMany({ where: { userId: user.id, date: { gte: monthStart, lte: monthEnd } }, orderBy: { date: "desc" } }),
    db.expense.findMany({ where: { userId: user.id, date: { gte: prevMonthStart, lte: prevMonthEnd } }, select: { amount: true, type: true } }),
    db.expense.findMany({ where: { userId: user.id, date: { gte: yearStart, lte: yearEnd } }, select: { date: true, amount: true, type: true } }),
    db.expense.findMany({ where: { userId: user.id, date: { gte: six[0].start, lte: six[5].end } }, select: { date: true, amount: true, type: true } }),
    db.expense.findMany({ where: { userId: user.id }, select: { amount: true, type: true } }),
  ]);

  // Split this month by type
  const thisMonthExpenses = allThisMonth.filter((e) => e.type === "EXPENSE");
  const thisMonthIncome   = allThisMonth.filter((e) => e.type === "INCOME");
  const thisMonthExpTotal = thisMonthExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const thisMonthIncTotal = thisMonthIncome.reduce((s, e) => s + Number(e.amount), 0);
  const thisMonthBalance  = thisMonthIncTotal - thisMonthExpTotal;

  // Global all-time balance
  const globalIncTotal  = globalRows.filter((r) => r.type === "INCOME").reduce((s, r) => s + Number(r.amount), 0);
  const globalExpTotal  = globalRows.filter((r) => r.type === "EXPENSE").reduce((s, r) => s + Number(r.amount), 0);
  const globalBalance   = globalIncTotal - globalExpTotal;

  // Prev month (aggregated in JS)
  const prevExpTotal = prevMonthRows.filter((r) => r.type === "EXPENSE").reduce((s, r) => s + Number(r.amount), 0);
  const prevIncTotal = prevMonthRows.filter((r) => r.type === "INCOME").reduce((s, r) => s + Number(r.amount), 0);
  const prevBalance  = prevIncTotal - prevExpTotal;

  // Year totals
  const yearExpTotal = yearRows.filter((r) => r.type === "EXPENSE").reduce((s, r) => s + Number(r.amount), 0);
  const yearIncTotal = yearRows.filter((r) => r.type === "INCOME").reduce((s, r) => s + Number(r.amount), 0);

  // Category totals (expenses only)
  const categoryTotals: Record<string, number> = {};
  const categoryCounts: Record<string, number> = {};
  for (const e of thisMonthExpenses) {
    const cat = e.category as string;
    categoryTotals[cat] = (categoryTotals[cat] ?? 0) + Number(e.amount);
    categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1;
  }

  // Monthly totals Jan–Dec — single pass over yearRows
  const monthlyExpTotals = Array(12).fill(0) as number[];
  const monthlyIncTotals = Array(12).fill(0) as number[];
  for (const r of yearRows) {
    const m = new Date(r.date).getMonth();
    if (r.type === "EXPENSE") monthlyExpTotals[m] += Number(r.amount);
    else monthlyIncTotals[m] += Number(r.amount);
  }

  // Daily expense totals for current month — single pass
  const daysInMonth = new Date(year, month, 0).getDate();
  const dailyTotals = Array(daysInMonth).fill(0) as number[];
  for (const e of thisMonthExpenses) {
    const d = new Date(e.date).getDate() - 1;
    if (d >= 0 && d < daysInMonth) dailyTotals[d] += Number(e.amount);
  }

  // Six-month comparison — single pass over sixMonthRows
  const sixMonthMap = new Map<string, { expense: number; income: number }>();
  for (const { y: y2, m: m2 } of six) {
    sixMonthMap.set(`${y2}-${m2}`, { expense: 0, income: 0 });
  }
  for (const r of sixMonthRows) {
    const d = new Date(r.date);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    const bucket = sixMonthMap.get(key);
    if (bucket) {
      if (r.type === "EXPENSE") bucket.expense += Number(r.amount);
      else bucket.income += Number(r.amount);
    }
  }
  const sixMonthTotals = six.map(({ m: m2, y: y2 }) => ({
    label: `${MONTHS[m2 - 1].slice(0, 3)} ${y2}`,
    m: m2, y: y2,
    ...(sixMonthMap.get(`${y2}-${m2}`) ?? { expense: 0, income: 0 }),
  }));

  const daysWithData = dailyTotals.filter((d) => d > 0).length;
  const avgPerDay    = daysWithData > 0 ? thisMonthExpTotal / daysWithData : 0;

  // Top 5 expenses
  const top5 = [...thisMonthExpenses]
    .sort((a, b) => Number(b.amount) - Number(a.amount))
    .slice(0, 5)
    .map((e) => ({ id: e.id, description: e.description, amount: Number(e.amount), category: e.category as Category, date: e.date.toISOString().slice(0, 10) }));

  // Filtered transactions for list view
  const filtered = allThisMonth.filter((e) => {
    if (filterType !== "ALL" && e.type !== filterType) return false;
    if (filterCat && e.type === "EXPENSE" && e.category !== filterCat) return false;
    return true;
  });

  return {
    transactions: filtered.map((e) => ({
      id: e.id, amount: Number(e.amount), type: e.type as TxType,
      category: e.category as Category, description: e.description,
      date: e.date.toISOString().slice(0, 10), notes: e.notes,
    })),
    thisMonthExpTotal, thisMonthIncTotal, thisMonthBalance,
    prevExpTotal, prevIncTotal, prevBalance,
    yearExpTotal, yearIncTotal,
    categoryTotals, categoryCounts,
    monthlyExpTotals, monthlyIncTotals, dailyTotals, sixMonthTotals, top5,
    globalBalance,
    avgPerDay, expCount: thisMonthExpenses.length, incCount: thisMonthIncome.length,
    year, month, filterCat, filterType,
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
    const txType      = String(form.get("txType") ?? "EXPENSE") as TxType;
    const description = String(form.get("description") ?? "").trim().slice(0, 200);
    const amountRaw   = String(form.get("amount") ?? "").trim();
    const category    = (txType === "EXPENSE" ? String(form.get("category") ?? "OTHER") : "OTHER") as Category;
    const date        = String(form.get("date") ?? "").trim();
    const notes       = String(form.get("notes") ?? "").trim().slice(0, 1000);

    if (!["INCOME", "EXPENSE"].includes(txType)) {
      throw redirect(request.url, { headers: { "Set-Cookie": await serializeFlash({ type: "error", message: "Invalid transaction type." }) } });
    }
    if (!description || !amountRaw || !date) {
      throw redirect(request.url, { headers: { "Set-Cookie": await serializeFlash({ type: "error", message: "Description, amount and date are required." }) } });
    }
    const amount = parseFloat(amountRaw);
    if (isNaN(amount) || amount <= 0 || amount > 999999.99) {
      throw redirect(request.url, { headers: { "Set-Cookie": await serializeFlash({ type: "error", message: "Invalid amount." }) } });
    }
    if (txType === "EXPENSE" && !CATEGORIES.includes(category)) {
      throw redirect(request.url, { headers: { "Set-Cookie": await serializeFlash({ type: "error", message: "Invalid category." }) } });
    }
    const parsedDate = new Date(date + "T12:00:00");
    if (isNaN(parsedDate.getTime())) {
      throw redirect(request.url, { headers: { "Set-Cookie": await serializeFlash({ type: "error", message: "Invalid date." }) } });
    }
    await db.expense.create({ data: { userId: user.id, type: txType, description, amount, category, date: parsedDate, notes: notes || null } });
    const msg = txType === "INCOME" ? "Income added." : "Expense added.";
    throw redirect(request.url, { headers: { "Set-Cookie": await serializeFlash({ type: "success", message: msg }) } });
  }

  if (intent === "delete") {
    const id = String(form.get("id") ?? "");
    await db.expense.deleteMany({ where: { id, userId: user.id } });
    throw redirect(request.url, { headers: { "Set-Cookie": await serializeFlash({ type: "success", message: "Deleted." }) } });
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

// ── Add Transaction Modal ─────────────────────────────────────────────────────

function AddTransactionModal({ open, onClose, defaultDate }: { open: boolean; onClose: () => void; defaultDate: string }) {
  const navigation = useNavigation();
  const submitting = navigation.state !== "idle";
  const formRef  = useRef<HTMLFormElement>(null);
  const firstRef = useRef<HTMLInputElement>(null);
  const [txType, setTxType] = useState<TxType>("EXPENSE");

  useEffect(() => { if (open) { setTxType("EXPENSE"); setTimeout(() => firstRef.current?.focus(), 50); } }, [open]);
  useEffect(() => { if (!submitting && open) { formRef.current?.reset(); onClose(); } }, [submitting]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const isIncome = txType === "INCOME";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex w-full max-w-md flex-col rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 max-h-[calc(100svh-2rem)]">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between rounded-t-2xl border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${isIncome ? "bg-emerald-50" : "bg-red-50"}`}>
              {isIncome ? <ArrowUpRight size={16} className="text-emerald-600" /> : <ArrowDownLeft size={16} className="text-red-500" />}
            </div>
            <h2 className="text-sm font-bold text-slate-900">Add Transaction</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={16} /></button>
        </div>

        <Form method="post" ref={formRef} className="flex min-h-0 flex-col">
          <input type="hidden" name="intent" value="add" />
          <input type="hidden" name="txType" value={txType} />

          <div className="overflow-y-auto px-5 py-5 space-y-4">
            {/* Type toggle */}
            <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1 gap-1">
              <button type="button" onClick={() => setTxType("EXPENSE")}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all ${
                  !isIncome ? "bg-red-500 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                <ArrowDownLeft size={13} /> Expense
              </button>
              <button type="button" onClick={() => setTxType("INCOME")}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all ${
                  isIncome ? "bg-emerald-500 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                <ArrowUpRight size={13} /> Income
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {isIncome ? "Income Source" : "Description"} <span className="text-red-500">*</span>
              </label>
              <input ref={firstRef} name="description" type="text"
                placeholder={isIncome ? "e.g. Part-time job, allowance" : "e.g. Lunch at cafeteria"}
                maxLength={200} required
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
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Date <span className="text-red-500">*</span></label>
                <input name="date" type="date" defaultValue={defaultDate} required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
              </div>
            </div>

            {!isIncome && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Category</label>
                <CustomSelect name="category" defaultValue="OTHER"
                  options={CATEGORIES.map((c) => ({ value: c, label: CATEGORY_CONFIG[c].label, icon: CATEGORY_CONFIG[c].icon }))} />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Notes <span className="text-slate-400 font-normal">(optional)</span></label>
              <textarea name="notes" rows={2} maxLength={1000} placeholder="Any additional notes…"
                className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
            </div>
          </div>

          {/* Footer */}
          <div className="flex shrink-0 gap-3 rounded-b-2xl border-t border-slate-100 bg-white px-5 py-4">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={submitting}
              className={`flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition disabled:opacity-60 ${isIncome ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-500 hover:bg-red-600"}`}>
              {submitting ? "Saving…" : isIncome ? "Add Income" : "Add Expense"}
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}
// ── Delete Button ─────────────────────────────────────────────────────────────

function DeleteButton({ id }: { id: string }) {
  const [confirm, setConfirm] = useState(false);
  const navigation = useNavigation();
  const submitting = navigation.state !== "idle" && navigation.formData?.get("id") === id;
  if (confirm) {
    return (
      <Form method="post" className="flex items-center gap-1">
        <input type="hidden" name="intent" value="delete" />
        <input type="hidden" name="id" value={id} />
        <button type="button" onClick={() => setConfirm(false)} className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100">Cancel</button>
        <button type="submit" disabled={submitting} className="rounded px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">{submitting ? "…" : "Confirm"}</button>
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
  transactions,
  filterCat,
  filterType,
  setCategory,
  setTypeFilter,
  onAdd,
}: {
  transactions: ReturnType<typeof useLoaderData<typeof loader>>["transactions"];
  filterCat: string | null;
  filterType: string;
  setCategory: (cat: Category | null) => void;
  setTypeFilter: (t: TxType | "ALL") => void;
  onAdd: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Type filter row */}
      <div className="flex gap-1.5 border-b border-slate-100 px-4 py-3">
        {(["ALL", "EXPENSE", "INCOME"] as const).map((t) => (
          <button key={t} type="button" onClick={() => { setTypeFilter(t); if (t === "INCOME") setCategory(null); }}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              filterType === t
                ? t === "INCOME" ? "bg-emerald-500 text-white" : t === "EXPENSE" ? "bg-red-500 text-white" : "bg-indigo-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}>
            {t === "ALL" ? "All" : t === "INCOME" ? "Income" : "Expenses"}
          </button>
        ))}
      </div>

      {/* Category filter — only when showing expenses/all */}
      {filterType !== "INCOME" && (
        <div className="flex gap-1.5 overflow-x-auto border-b border-slate-100 px-4 py-2.5 scrollbar-none">
          <button type="button" onClick={() => setCategory(null)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${!filterCat ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
            All categories
          </button>
          {CATEGORIES.map((cat) => {
            const active = filterCat === cat;
            return (
              <button key={cat} type="button" onClick={() => setCategory(active ? null : cat)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${active ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                {CATEGORY_CONFIG[cat].label}
              </button>
            );
          })}
        </div>
      )}

      {transactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Wallet size={22} /></div>
          <p className="mt-3 text-sm font-semibold text-slate-700">No transactions yet</p>
          <p className="mt-1 text-xs text-slate-400">Add your first income or expense this month.</p>
          <button type="button" onClick={onAdd} className="mt-4 flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors">
            <Plus size={14} /> Add Transaction
          </button>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {transactions.map((tx) => {
            const isIncome = tx.type === "INCOME";
            const cfg = CATEGORY_CONFIG[tx.category];
            const Icon = isIncome ? ArrowUpRight : cfg.icon;
            const iconBg = isIncome ? "bg-emerald-50" : cfg.bg;
            const iconColor = isIncome ? "text-emerald-600" : cfg.color;
            return (
              <div key={tx.id} className="flex items-center gap-3 px-4 py-3 group">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
                  <Icon size={16} className={iconColor} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{tx.description}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {isIncome
                      ? <span className="text-[10px] font-bold text-emerald-600">Income</span>
                      : <span className={`text-[10px] font-bold ${cfg.color}`}>{cfg.label}</span>}
                    <span className="text-[10px] text-slate-400">·</span>
                    <span className="text-[10px] text-slate-400">{fmtDate(tx.date)}</span>
                  </div>
                  {tx.notes && <p className="mt-0.5 truncate text-[11px] text-slate-400">{tx.notes}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-sm font-extrabold ${isIncome ? "text-emerald-600" : "text-slate-900"}`}>
                    {isIncome ? "+" : "-"}৳{fmt(tx.amount)}
                  </span>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity"><DeleteButton id={tx.id} /></div>
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
  thisMonthExpTotal,
  thisMonthIncTotal,
  thisMonthBalance,
  prevExpTotal,
  prevBalance,
  yearExpTotal,
  yearIncTotal,
  avgPerDay,
  expCount,
  incCount,
  categoryTotals,
  categoryCounts,
  monthlyExpTotals,
  monthlyIncTotals,
  dailyTotals,
  sixMonthTotals,
  top5,
  year,
  month,
}: {
  thisMonthExpTotal: number;
  thisMonthIncTotal: number;
  thisMonthBalance: number;
  prevExpTotal: number;
  prevBalance: number;
  yearExpTotal: number;
  yearIncTotal: number;
  avgPerDay: number;
  expCount: number;
  incCount: number;
  categoryTotals: Record<string, number>;
  categoryCounts: Record<string, number>;
  monthlyExpTotals: number[];
  monthlyIncTotals: number[];
  dailyTotals: number[];
  sixMonthTotals: { label: string; m: number; y: number; expense: number; income: number }[];
  top5: { id: string; description: string; amount: number; category: Category; date: string }[];
  year: number;
  month: number;
}) {
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);
  const [hoveredDay, setHoveredDay]     = useState<number | null>(null);

  const expDiff    = thisMonthExpTotal - prevExpTotal;
  const expDiffPct = prevExpTotal > 0 ? ((expDiff / prevExpTotal) * 100) : null;
  const balDiff    = thisMonthBalance - prevBalance;

  const catBreakdown = (Object.entries(categoryTotals) as [Category, number][]).sort((a, b) => b[1] - a[1]);
  const maxMonthly   = Math.max(...monthlyExpTotals, ...monthlyIncTotals, 1);
  const maxDaily     = Math.max(...dailyTotals, 1);
  const maxSix       = Math.max(...sixMonthTotals.map((s) => Math.max(s.expense, s.income)), 1);
  const topCat       = catBreakdown[0]?.[0] as Category | undefined;

  return (
    <div className="space-y-5">
      {/* KPI row — 4 cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Balance */}
        <div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50 px-5 py-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-indigo-600">Balance</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100">
              <Wallet size={15} className="text-indigo-600" />
            </div>
          </div>
          <p className={`text-xl font-extrabold ${thisMonthBalance >= 0 ? "text-emerald-700" : "text-red-600"}`}>
            {thisMonthBalance >= 0 ? "+" : ""}৳{fmt(thisMonthBalance)}
          </p>
          <div className={`mt-1 flex items-center gap-1 text-xs font-semibold ${balDiff >= 0 ? "text-emerald-600" : "text-red-500"}`}>
            {balDiff >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {balDiff >= 0 ? "+" : ""}৳{fmt(Math.abs(balDiff))} vs last month
          </div>
        </div>

        {/* Income */}
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-slate-500">Income</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
              <ArrowUpRight size={15} className="text-emerald-600" />
            </div>
          </div>
          <p className="text-xl font-extrabold text-emerald-700">+৳{fmt(thisMonthIncTotal)}</p>
          <p className="mt-1 text-xs text-slate-400">{incCount} transaction{incCount !== 1 ? "s" : ""}</p>
        </div>

        {/* Expenses */}
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-slate-500">Expenses</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50">
              <ArrowDownLeft size={15} className="text-red-500" />
            </div>
          </div>
          <p className="text-xl font-extrabold text-red-600">-৳{fmt(thisMonthExpTotal)}</p>
          <div className={`mt-1 flex items-center gap-1 text-xs font-semibold ${expDiffPct !== null ? (expDiff > 0 ? "text-red-500" : "text-emerald-600") : "text-slate-400"}`}>
            {expDiffPct !== null && (expDiff > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />)}
            {expDiffPct !== null ? `${expDiff > 0 ? "+" : ""}${expDiffPct.toFixed(1)}% vs last month` : `${expCount} tx`}
          </div>
        </div>

        {/* Top category */}
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-slate-500">Top Category</p>
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${topCat ? CATEGORY_CONFIG[topCat].bg : "bg-slate-50"}`}>
              {topCat ? (() => { const Icon = CATEGORY_CONFIG[topCat].icon; return <Icon size={15} className={CATEGORY_CONFIG[topCat].color} />; })() : <MoreHorizontal size={15} className="text-slate-400" />}
            </div>
          </div>
          <p className={`text-xl font-extrabold truncate ${topCat ? "text-slate-900" : "text-slate-400"}`}>{topCat ? CATEGORY_CONFIG[topCat].label : "—"}</p>
          <p className="mt-1 text-xs text-slate-400">{topCat ? `৳${fmt(categoryTotals[topCat])} · ${categoryCounts[topCat]} tx` : "No expenses yet"}</p>
        </div>
      </div>

      {/* Income vs Expense bar chart */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4">
          <h3 className="text-sm font-bold text-slate-900">{year} — Income vs Expenses</h3>
          <div className="mt-1.5 flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-400" />Income</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-400" />Expenses</span>
          </div>
        </div>
        <div className="px-6 py-5">
          <div className="flex items-end gap-1 h-[160px]">
            {monthlyExpTotals.map((expTotal, i) => {
              const incTotal = monthlyIncTotals[i];
              const expH = maxMonthly > 0 ? (expTotal / maxMonthly) * 128 : 0;
              const incH = maxMonthly > 0 ? (incTotal / maxMonthly) * 128 : 0;
              const isCur = i + 1 === month;
              const isHov = hoveredMonth === i;
              return (
                <div key={i} className="relative flex flex-1 flex-col items-center gap-1 cursor-default"
                  onMouseEnter={() => setHoveredMonth(i)} onMouseLeave={() => setHoveredMonth(null)}>
                  {isHov && (expTotal > 0 || incTotal > 0) && (
                    <div className="absolute bottom-full mb-1 z-10 pointer-events-none">
                      <div className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-[10px] font-semibold text-white whitespace-nowrap shadow-lg text-center">
                        {MONTHS[i].slice(0, 3)}<br />+৳{fmt(incTotal)} / -৳{fmt(expTotal)}
                      </div>
                    </div>
                  )}
                  <div className="relative w-full flex items-end gap-px" style={{ height: 128 }}>
                    <div className={`flex-1 rounded-t-sm transition-all ${isCur ? "bg-emerald-500" : "bg-emerald-300"}`}
                      style={{ height: `${Math.max(incH, incTotal > 0 ? 3 : 0)}px` }} />
                    <div className={`flex-1 rounded-t-sm transition-all ${isCur ? "bg-red-500" : "bg-red-300"}`}
                      style={{ height: `${Math.max(expH, expTotal > 0 ? 3 : 0)}px` }} />
                  </div>
                  <span className={`text-[9px] font-bold mt-0.5 ${isCur ? "text-indigo-600" : "text-slate-400"}`}>
                    {MONTHS[i].slice(0, 1)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Two column: category breakdown + right panel */}
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* Category breakdown */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-4">
            <h3 className="text-sm font-bold text-slate-900">Spending by Category</h3>
            <p className="mt-0.5 text-xs text-slate-400">{MONTHS[month - 1]} {year} · expenses only</p>
          </div>
          {catBreakdown.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <p className="text-sm font-semibold text-slate-700">No expense data yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {catBreakdown.map(([cat, total]) => {
                const cfg = CATEGORY_CONFIG[cat as Category];
                const Icon = cfg.icon;
                const pct = thisMonthExpTotal > 0 ? ((total / thisMonthExpTotal) * 100) : 0;
                const barW = ((total / catBreakdown[0][1]) * 100);
                const count = categoryCounts[cat] ?? 0;
                return (
                  <div key={cat} className="flex items-center gap-4 px-6 py-3.5">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${cfg.bg}`}>
                      <Icon size={16} className={cfg.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-semibold text-slate-800">{cfg.label}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="hidden sm:inline text-xs text-slate-400">{count} tx</span>
                          <span className="hidden sm:inline text-xs font-semibold text-slate-500 w-9 text-right">{pct.toFixed(1)}%</span>
                          <span className="text-sm font-extrabold text-slate-900 text-right">৳{fmt(total)}</span>
                        </div>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div className={`h-full rounded-full ${cfg.bar} transition-all`} style={{ width: `${barW}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: daily + 6-month */}
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-4 py-4">
              <h3 className="text-sm font-bold text-slate-900">Daily Expenses — {MONTHS[month - 1]}</h3>
            </div>
            <div className="px-4 py-4">
              <div className="flex items-end gap-[3px] h-[80px]">
                {dailyTotals.map((total, i) => {
                  const h = maxDaily > 0 ? (total / maxDaily) * 64 : 0;
                  const isHov = hoveredDay === i;
                  return (
                    <div key={i} className="relative flex flex-1 flex-col items-center cursor-default"
                      onMouseEnter={() => setHoveredDay(i)} onMouseLeave={() => setHoveredDay(null)}>
                      {isHov && total > 0 && (
                        <div className="absolute bottom-full mb-1 z-10 pointer-events-none">
                          <div className="rounded-md bg-slate-900 px-2 py-1 text-[10px] font-semibold text-white whitespace-nowrap shadow-lg">
                            Day {i + 1}: ৳{fmt(total)}
                          </div>
                        </div>
                      )}
                      <div className={`w-full rounded-t-sm ${total > 0 ? (isHov ? "bg-red-500" : "bg-red-300") : "bg-slate-100"}`}
                        style={{ height: `${Math.max(h, total > 0 ? 3 : 2)}px` }} />
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex justify-between text-[9px] text-slate-400">
                <span>1</span><span>{Math.ceil(dailyTotals.length / 2)}</span><span>{dailyTotals.length}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-4 py-4">
              <h3 className="text-sm font-bold text-slate-900">Last 6 Months</h3>
            </div>
            <div className="divide-y divide-slate-50">
              {sixMonthTotals.map((item, i) => {
                const expW = maxSix > 0 ? (item.expense / maxSix) * 100 : 0;
                const incW = maxSix > 0 ? (item.income  / maxSix) * 100 : 0;
                const isCur = item.m === month && item.y === year;
                return (
                  <div key={i} className="px-4 py-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-semibold ${isCur ? "text-indigo-600" : "text-slate-500"}`}>{item.label}</span>
                      <span className={`text-xs font-bold ${item.income - item.expense >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {item.income - item.expense >= 0 ? "+" : ""}৳{fmt(item.income - item.expense)}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] text-emerald-500 w-3">↑</span>
                        <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${incW}%` }} />
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] text-red-400 w-3">↓</span>
                        <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full rounded-full bg-red-400 transition-all" style={{ width: `${expW}%` }} />
                        </div>
                      </div>
                    </div>
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
              const pct = thisMonthExpTotal > 0 ? ((exp.amount / thisMonthExpTotal) * 100).toFixed(1) : "0";
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
                    <p className="text-sm font-extrabold text-red-600">-৳{fmt(exp.amount)}</p>
                    <p className="text-[10px] text-slate-400">{pct}% of expenses</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Year summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 mb-1">{year} Income</p>
          <p className="text-xl font-extrabold text-emerald-700">+৳{fmt(yearIncTotal)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 mb-1">{year} Expenses</p>
          <p className="text-xl font-extrabold text-red-600">-৳{fmt(yearExpTotal)}</p>
        </div>
        <div className={`rounded-2xl border px-5 py-4 shadow-sm ${yearIncTotal - yearExpTotal >= 0 ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
          <p className="text-xs font-semibold text-slate-500 mb-1">{year} Net Balance</p>
          <p className={`text-xl font-extrabold ${yearIncTotal - yearExpTotal >= 0 ? "text-emerald-700" : "text-red-600"}`}>
            {yearIncTotal - yearExpTotal >= 0 ? "+" : ""}৳{fmt(yearIncTotal - yearExpTotal)}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const data = useLoaderData<typeof loader>();
  const {
    transactions, thisMonthExpTotal, thisMonthIncTotal, thisMonthBalance,
    prevExpTotal, prevIncTotal, prevBalance, yearExpTotal, yearIncTotal,
    globalBalance,
    avgPerDay, expCount, incCount, categoryTotals, categoryCounts,
    monthlyExpTotals, monthlyIncTotals, dailyTotals, sixMonthTotals, top5,
    year, month, filterCat, filterType, now,
  } = data;

  const [searchParams, setSearchParams] = useSearchParams();
  const [modalOpen, setModalOpen] = useState(false);
  const todayStr  = now.slice(0, 10);
  const activeTab = searchParams.get("tab") === "analytics" ? "analytics" : "transactions";

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

  function setTypeFilter(t: TxType | "ALL") {
    const p = new URLSearchParams(searchParams);
    if (t === "ALL") p.delete("type"); else p.set("type", t);
    setSearchParams(p);
  }

  function setTab(tab: "transactions" | "analytics") {
    const p = new URLSearchParams(searchParams);
    if (tab === "analytics") p.set("tab", "analytics"); else p.delete("tab");
    setSearchParams(p);
  }

  return (
    <>
      <AddTransactionModal open={modalOpen} onClose={() => setModalOpen(false)} defaultDate={todayStr} />

      <div className="space-y-5">
        {/* Controls row */}
        <div className="space-y-2">
          {/* Row 1: month nav + Add button */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => goMonth(-1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 shadow-sm">
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-bold text-slate-900 min-w-[110px] text-center">{MONTHS[month - 1]} {year}</span>
              <button type="button" onClick={() => goMonth(1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 shadow-sm">
                <ChevronRight size={16} />
              </button>
            </div>
            <button type="button" onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition">
              <Plus size={16} />
              <span>Add Transaction</span>
            </button>
          </div>
          {/* Row 2: tab switcher */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            <button type="button" onClick={() => setTab("transactions")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${activeTab === "transactions" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              <List size={13} /> Transactions
            </button>
            <button type="button" onClick={() => setTab("analytics")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${activeTab === "analytics" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              <BarChart2 size={13} /> Analytics
            </button>
          </div>
        </div>

        {/* Balance strip — 4 cards */}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <div className={`rounded-2xl border-2 px-5 py-4 shadow-sm ${globalBalance >= 0 ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
            <p className="text-xs font-bold text-slate-500 mb-1">Balance</p>
            <p className={`text-2xl font-extrabold ${globalBalance >= 0 ? "text-emerald-700" : "text-red-600"}`}>
              {globalBalance >= 0 ? "+" : ""}৳{fmt(globalBalance)}
            </p>
            <p className="mt-1.5 text-xs text-slate-400">All time</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 mb-1">Income</p>
            <p className="text-2xl font-extrabold text-emerald-700">+৳{fmt(thisMonthIncTotal)}</p>
            <p className="mt-1 text-xs text-slate-400">{incCount} transaction{incCount !== 1 ? "s" : ""}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 mb-1">Expenses</p>
            <p className="text-2xl font-extrabold text-red-600">-৳{fmt(thisMonthExpTotal)}</p>
            <p className="mt-1 text-xs text-slate-400">{expCount} transaction{expCount !== 1 ? "s" : ""}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 mb-1">{year} Net</p>
            <p className={`text-2xl font-extrabold ${yearIncTotal - yearExpTotal >= 0 ? "text-emerald-700" : "text-red-600"}`}>
              {yearIncTotal - yearExpTotal >= 0 ? "+" : ""}৳{fmt(yearIncTotal - yearExpTotal)}
            </p>
            <p className="mt-1 text-xs text-slate-400">Full year balance</p>
          </div>
        </div>

        {/* Tab content */}
        {activeTab === "transactions" ? (
          <TransactionsView
            transactions={transactions}
            filterCat={filterCat}
            filterType={filterType ?? "ALL"}
            setCategory={setCategory}
            setTypeFilter={setTypeFilter}
            onAdd={() => setModalOpen(true)}
          />
        ) : (
          <AnalyticsView
            thisMonthExpTotal={thisMonthExpTotal}
            thisMonthIncTotal={thisMonthIncTotal}
            thisMonthBalance={thisMonthBalance}
            prevExpTotal={prevExpTotal}
            prevBalance={prevBalance}
            yearExpTotal={yearExpTotal}
            yearIncTotal={yearIncTotal}
            avgPerDay={avgPerDay}
            expCount={expCount}
            incCount={incCount}
            categoryTotals={categoryTotals}
            categoryCounts={categoryCounts}
            monthlyExpTotals={monthlyExpTotals}
            monthlyIncTotals={monthlyIncTotals}
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


import { useEffect, useRef, useState } from "react";
import { Form, useLoaderData, useNavigation, useSearchParams } from "react-router";
import {
  Activity,
  Apple,
  BarChart2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Flame,
  Heart,
  List,
  Moon,
  MoreHorizontal,
  Pizza,
  Plus,
  Scale,
  Sun,
  Trash2,
  TrendingDown,
  TrendingUp,
  UtensilsCrossed,
  X,
} from "lucide-react";

import type { Route } from "./+types/health";
import { CustomSelect } from "~/components/ui/select";

export function meta() {
  return [{ title: "Health Tracker | UniBuddy" }];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MEAL_TYPES = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"] as const;
type MealType = (typeof MEAL_TYPES)[number];

const FOOD_HABITS = [
  "VERY_HEALTHY",
  "HEALTHY",
  "NEUTRAL",
  "UNHEALTHY",
  "VERY_UNHEALTHY",
] as const;
type FoodHabit = (typeof FOOD_HABITS)[number];

const MEAL_CONFIG: Record<
  MealType,
  {
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    color: string;
    bg: string;
  }
> = {
  BREAKFAST: { label: "Breakfast", icon: Sun,              color: "text-amber-600",  bg: "bg-amber-50"  },
  LUNCH:     { label: "Lunch",     icon: UtensilsCrossed,  color: "text-emerald-600",bg: "bg-emerald-50"},
  DINNER:    { label: "Dinner",    icon: Moon,             color: "text-indigo-600", bg: "bg-indigo-50" },
  SNACK:     { label: "Snack",     icon: Apple,            color: "text-rose-600",   bg: "bg-rose-50"   },
};

const HABIT_CONFIG: Record<
  FoodHabit,
  { label: string; color: string; bg: string; dot: string; score: number }
> = {
  VERY_HEALTHY:   { label: "Very Healthy",   color: "text-emerald-700", bg: "bg-emerald-100", dot: "bg-emerald-500", score: 5 },
  HEALTHY:        { label: "Healthy",        color: "text-green-700",   bg: "bg-green-100",   dot: "bg-green-400",   score: 4 },
  NEUTRAL:        { label: "Neutral",        color: "text-slate-600",   bg: "bg-slate-100",   dot: "bg-slate-400",   score: 3 },
  UNHEALTHY:      { label: "Unhealthy",      color: "text-orange-700",  bg: "bg-orange-100",  dot: "bg-orange-400",  score: 2 },
  VERY_UNHEALTHY: { label: "Very Unhealthy", color: "text-red-700",     bg: "bg-red-100",     dot: "bg-red-500",     score: 1 },
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

  const url   = new URL(request.url);
  const now   = new Date();
  const year  = Math.max(2000, Math.min(2100, parseInt(url.searchParams.get("year")  ?? "", 10) || now.getFullYear()));
  const month = Math.max(1,    Math.min(12,   parseInt(url.searchParams.get("month") ?? "", 10) || (now.getMonth() + 1)));

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd   = new Date(year, month, 0, 23, 59, 59, 999);

  const [weightLogs, dietLogs, allWeightLogs, pastDietDescriptions] = await Promise.all([
    db.weightLog.findMany({
      where:   { userId: user.id, date: { gte: monthStart, lte: monthEnd } },
      orderBy: { date: "desc" },
    }),
    db.dietLog.findMany({
      where:   { userId: user.id, date: { gte: monthStart, lte: monthEnd } },
      orderBy: [{ date: "desc" }, { mealType: "asc" }],
    }),
    db.weightLog.findMany({
      where:   { userId: user.id },
      orderBy: { date: "desc" },
      take:    30,
    }),
    db.dietLog.findMany({
      where:    { userId: user.id },
      select:   { description: true },
      distinct: ["description"],
      orderBy:  { createdAt: "desc" },
      take:     100,
    }),
  ]);

  // Weight analytics
  const weights     = weightLogs.map((w) => Number(w.weightKg));
  const currentW    = weights[0] ?? null;
  const minW        = weights.length ? Math.min(...weights) : null;
  const maxW        = weights.length ? Math.max(...weights) : null;
  const avgW        = weights.length ? weights.reduce((s, v) => s + v, 0) / weights.length : null;
  const firstW      = weights[weights.length - 1] ?? null;
  const weightDelta = currentW !== null && firstW !== null ? +(currentW - firstW).toFixed(2) : null;

  // Last 30 weight entries for trend chart (query returns desc, reverse to asc for chart)
  const weightTrend = [...allWeightLogs].reverse().map((w) => ({
    date:   w.date.toISOString().slice(0, 10),
    weight: Number(w.weightKg),
  }));

  // Diet analytics
  const totalCalories   = dietLogs.reduce((s, d) => s + (d.calories ?? 0), 0);
  const avgCaloriesRaw  = dietLogs.filter((d) => d.calories).length;
  const avgCalories     = avgCaloriesRaw > 0
    ? Math.round(totalCalories / avgCaloriesRaw)
    : null;

  // Habit score
  const habitScores = dietLogs.map((d) => HABIT_CONFIG[d.habit as FoodHabit].score);
  const avgHabitScore = habitScores.length
    ? habitScores.reduce((s, v) => s + v, 0) / habitScores.length
    : null;

  // Meal distribution
  const mealCounts: Record<string, number> = {};
  for (const d of dietLogs) {
    mealCounts[d.mealType] = (mealCounts[d.mealType] ?? 0) + 1;
  }

  // Habit counts
  const habitCounts: Record<string, number> = {};
  for (const d of dietLogs) {
    habitCounts[d.habit] = (habitCounts[d.habit] ?? 0) + 1;
  }

  return {
    weightLogs: weightLogs.map((w) => ({
      id:     w.id,
      weight: Number(w.weightKg),
      date:   w.date.toISOString().slice(0, 10),
      notes:  w.notes,
    })),
    dietLogs: dietLogs.map((d) => ({
      id:          d.id,
      date:        d.date.toISOString().slice(0, 10),
      mealType:    d.mealType as MealType,
      description: d.description,
      calories:    d.calories,
      habit:       d.habit as FoodHabit,
      notes:       d.notes,
    })),
    analytics: {
      currentW, minW, maxW, avgW: avgW ? +avgW.toFixed(2) : null,
      weightDelta,
      totalCalories, avgCalories,
      avgHabitScore: avgHabitScore ? +avgHabitScore.toFixed(2) : null,
      mealCounts, habitCounts,
    },
    weightTrend,
    pastDescriptions: pastDietDescriptions.map((d) => d.description),
    year, month,
    today: now.toISOString().slice(0, 10),
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

  await rateLimit({ key: `health:${user.id}`, limit: 60, windowSec: 30 });

  const form   = await request.formData();
  const intent = form.get("intent") as string;

  if (intent === "add-weight") {
    const weightRaw = String(form.get("weight") ?? "").trim();
    const date      = String(form.get("date") ?? "").trim();
    const notes     = String(form.get("notes") ?? "").trim().slice(0, 1000);

    if (!weightRaw || !date) {
      throw redirect(request.url, { headers: { "Set-Cookie": await serializeFlash({ type: "error", message: "Weight and date are required." }) } });
    }
    const weight = parseFloat(weightRaw);
    if (isNaN(weight) || weight < 20 || weight > 500) {
      throw redirect(request.url, { headers: { "Set-Cookie": await serializeFlash({ type: "error", message: "Weight must be between 20–500 kg." }) } });
    }
    const parsedDate = new Date(date + "T12:00:00");
    if (isNaN(parsedDate.getTime())) {
      throw redirect(request.url, { headers: { "Set-Cookie": await serializeFlash({ type: "error", message: "Invalid date." }) } });
    }
    await db.weightLog.create({ data: { userId: user.id, weightKg: weight, date: parsedDate, notes: notes || null } });
    throw redirect(request.url, { headers: { "Set-Cookie": await serializeFlash({ type: "success", message: "Weight logged." }) } });
  }

  if (intent === "delete-weight") {
    const id = String(form.get("id") ?? "");
    await db.weightLog.deleteMany({ where: { id, userId: user.id } });
    throw redirect(request.url, { headers: { "Set-Cookie": await serializeFlash({ type: "success", message: "Entry deleted." }) } });
  }

  if (intent === "add-diet") {
    const description = String(form.get("description") ?? "").trim().slice(0, 300);
    const mealType    = String(form.get("mealType") ?? "BREAKFAST") as MealType;
    const habit       = String(form.get("habit") ?? "NEUTRAL") as FoodHabit;
    const date        = String(form.get("date") ?? "").trim();
    const caloriesRaw = String(form.get("calories") ?? "").trim();
    const notes       = String(form.get("notes") ?? "").trim().slice(0, 1000);

    if (!description || !date) {
      throw redirect(request.url, { headers: { "Set-Cookie": await serializeFlash({ type: "error", message: "Description and date are required." }) } });
    }
    if (!MEAL_TYPES.includes(mealType)) {
      throw redirect(request.url, { headers: { "Set-Cookie": await serializeFlash({ type: "error", message: "Invalid meal type." }) } });
    }
    if (!FOOD_HABITS.includes(habit)) {
      throw redirect(request.url, { headers: { "Set-Cookie": await serializeFlash({ type: "error", message: "Invalid habit rating." }) } });
    }
    const parsedDate = new Date(date + "T12:00:00");
    if (isNaN(parsedDate.getTime())) {
      throw redirect(request.url, { headers: { "Set-Cookie": await serializeFlash({ type: "error", message: "Invalid date." }) } });
    }
    const calories = caloriesRaw ? parseInt(caloriesRaw, 10) : null;
    await db.dietLog.create({ data: { userId: user.id, date: parsedDate, mealType, description, calories: calories ?? undefined, habit, notes: notes || null } });
    throw redirect(request.url, { headers: { "Set-Cookie": await serializeFlash({ type: "success", message: "Meal logged." }) } });
  }

  if (intent === "delete-diet") {
    const id = String(form.get("id") ?? "");
    await db.dietLog.deleteMany({ where: { id, userId: user.id } });
    throw redirect(request.url, { headers: { "Set-Cookie": await serializeFlash({ type: "success", message: "Meal deleted." }) } });
  }

  throw redirect(request.url);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt2(n: number) { return n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
function fmtDate(str: string) { return new Date(str + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }); }

function HabitBadge({ habit }: { habit: FoodHabit }) {
  const cfg = HABIT_CONFIG[habit];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${cfg.bg} ${cfg.color}`}>
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ── Delete button ─────────────────────────────────────────────────────────────

function DeleteButton({ id, intent }: { id: string; intent: string }) {
  const [confirm, setConfirm] = useState(false);
  const navigation = useNavigation();
  const submitting = navigation.state !== "idle" && navigation.formData?.get("id") === id;
  if (confirm) {
    return (
      <Form method="post" className="flex items-center gap-1">
        <input type="hidden" name="intent" value={intent} />
        <input type="hidden" name="id" value={id} />
        <button type="button" onClick={() => setConfirm(false)} className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100">Cancel</button>
        <button type="submit" disabled={submitting} className="rounded px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">
          {submitting ? "…" : "Confirm"}
        </button>
      </Form>
    );
  }
  return (
    <button type="button" onClick={() => setConfirm(true)} className="rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500 transition-colors">
      <Trash2 size={14} />
    </button>
  );
}

// ── Add Weight Modal ──────────────────────────────────────────────────────────

function AddWeightModal({ open, onClose, today }: { open: boolean; onClose: () => void; today: string }) {
  const navigation = useNavigation();
  const submitting = navigation.state !== "idle";
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50); }, [open]);
  useEffect(() => { if (!submitting && open) { formRef.current?.reset(); onClose(); } }, [submitting]); // eslint-disable-line

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex w-full max-w-sm flex-col rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 max-h-[calc(100svh-2rem)]">
        {/* Header — sticky */}
        <div className="flex shrink-0 items-center justify-between rounded-t-2xl border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50"><Scale size={16} className="text-indigo-600" /></div>
            <h2 className="text-sm font-bold text-slate-900">Log Weight</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><X size={16} /></button>
        </div>
        {/* Scrollable body */}
        <Form method="post" ref={formRef} className="flex min-h-0 flex-col">
          <input type="hidden" name="intent" value="add-weight" />
          <div className="overflow-y-auto px-5 py-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Weight (kg) <span className="text-red-500">*</span></label>
              <div className="relative">
                <input ref={inputRef} name="weight" type="number" min="20" max="500" step="0.1" placeholder="70.0" required
                  className="w-full rounded-lg border border-slate-300 py-2 pr-10 pl-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-semibold">kg</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Date <span className="text-red-500">*</span></label>
              <input name="date" type="date" defaultValue={today} required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Notes <span className="text-slate-400 font-normal">(optional)</span></label>
              <textarea name="notes" rows={2} maxLength={1000} placeholder="How are you feeling?"
                className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
            </div>
          </div>
          {/* Footer — sticky */}
          <div className="flex shrink-0 gap-3 rounded-b-2xl border-t border-slate-100 bg-white px-5 py-4">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={submitting} className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
              {submitting ? "Logging…" : "Log Weight"}
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}

// ── Add Diet Modal ────────────────────────────────────────────────────────────

function AddDietModal({ open, onClose, today, pastDescriptions }: { open: boolean; onClose: () => void; today: string; pastDescriptions: string[] }) {
  const navigation = useNavigation();
  const submitting = navigation.state !== "idle";
  const formRef    = useRef<HTMLFormElement>(null);
  const inputRef   = useRef<HTMLInputElement>(null);
  const listRef    = useRef<HTMLUListElement>(null);

  const [query,       setQuery]       = useState("");
  const [showSug,     setShowSug]     = useState(false);
  const [activeIdx,   setActiveIdx]   = useState(-1);

  const suggestions = query.trim().length > 0
    ? pastDescriptions.filter((d) => d.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : [];

  function pickSuggestion(val: string) {
    setQuery(val);
    setShowSug(false);
    setActiveIdx(-1);
    // Also set the actual input value so form sees it
    if (inputRef.current) inputRef.current.value = val;
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showSug || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      pickSuggestion(suggestions[activeIdx]);
    } else if (e.key === "Escape") {
      setShowSug(false);
      setActiveIdx(-1);
    }
  }

  useEffect(() => {
    if (activeIdx >= 0 && listRef.current) {
      const el = listRef.current.children[activeIdx] as HTMLElement;
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIdx]);

  useEffect(() => { if (open) { setQuery(""); setShowSug(false); setActiveIdx(-1); setTimeout(() => inputRef.current?.focus(), 50); } }, [open]);
  useEffect(() => { if (!submitting && open) { formRef.current?.reset(); setQuery(""); onClose(); } }, [submitting]); // eslint-disable-line

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex w-full max-w-md flex-col rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 max-h-[calc(100svh-2rem)]">
        {/* Header — sticky */}
        <div className="flex shrink-0 items-center justify-between rounded-t-2xl border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50"><UtensilsCrossed size={16} className="text-emerald-600" /></div>
            <h2 className="text-sm font-bold text-slate-900">Log Meal</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><X size={16} /></button>
        </div>
        {/* Scrollable body */}
        <Form method="post" ref={formRef} className="flex min-h-0 flex-col">
        <div className="overflow-y-auto px-5 py-5 space-y-4">
          <input type="hidden" name="intent" value="add-diet" />
          <div className="relative">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">What did you eat? <span className="text-red-500">*</span></label>
            <input
              ref={inputRef}
              name="description"
              type="text"
              placeholder="e.g. Rice, chicken & salad"
              maxLength={300}
              required
              autoComplete="off"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setShowSug(true); setActiveIdx(-1); }}
              onFocus={() => { if (query.trim()) setShowSug(true); }}
              onBlur={() => setTimeout(() => setShowSug(false), 150)}
              onKeyDown={handleKeyDown}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
            {showSug && suggestions.length > 0 && (
              <ul
                ref={listRef}
                className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
                role="listbox"
              >
                {suggestions.map((s, i) => (
                  <li
                    key={s}
                    role="option"
                    aria-selected={activeIdx === i}
                    onMouseDown={() => pickSuggestion(s)}
                    className={`cursor-pointer px-3 py-2 text-sm transition-colors ${
                      activeIdx === i ? "bg-indigo-50 text-indigo-700 font-semibold" : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {s}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Meal Type</label>
              <CustomSelect name="mealType" defaultValue="BREAKFAST"
                options={MEAL_TYPES.map((m) => ({ value: m, label: MEAL_CONFIG[m].label, icon: MEAL_CONFIG[m].icon }))} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Date <span className="text-red-500">*</span></label>
              <input name="date" type="date" defaultValue={today} required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Habit Rating</label>
              <CustomSelect name="habit" defaultValue="NEUTRAL"
                options={FOOD_HABITS.map((h) => ({ value: h, label: HABIT_CONFIG[h].label }))} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Calories <span className="text-slate-400 font-normal">(optional)</span></label>
              <div className="relative">
                <input name="calories" type="number" min="1" max="9999" placeholder="350"
                  className="w-full rounded-lg border border-slate-300 py-2 pr-12 pl-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-semibold">kcal</span>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Notes <span className="text-slate-400 font-normal">(optional)</span></label>
            <textarea name="notes" rows={2} maxLength={1000} placeholder="Any thoughts about this meal…"
              className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
          </div>
        </div>
          {/* Footer — sticky */}
          <div className="flex shrink-0 gap-3 rounded-b-2xl border-t border-slate-100 bg-white px-5 py-4">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={submitting} className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
              {submitting ? "Logging…" : "Log Meal"}
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}

// ── Weight Chart ──────────────────────────────────────────────────────────────

function WeightChart({ trend }: { trend: { date: string; weight: number }[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  if (trend.length === 0) {
    return (
      <div className="flex h-[140px] items-center justify-center text-sm text-slate-400">
        No weight data yet. Start logging to see your trend.
      </div>
    );
  }
  const weights = trend.map((t) => t.weight);
  const minVal  = Math.min(...weights);
  const maxVal  = Math.max(...weights);
  const range   = maxVal - minVal || 1;
  const H       = 120;
  const W       = 100; // percentage width per point
  const pts     = trend.map((t, i) => {
    const x = (i / Math.max(trend.length - 1, 1)) * 100;
    const y = H - ((t.weight - minVal) / range) * (H - 16);
    return { ...t, x, y };
  });

  // SVG polyline
  const polyline = pts.map((p) => `${p.x}%,${p.y}`).join(" ");

  return (
    <div className="relative" style={{ height: 140 }}>
      <svg width="100%" height={H} viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" className="absolute inset-0 overflow-visible">
        {/* Gradient fill */}
        <defs>
          <linearGradient id="wgrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <polygon
          points={`0,${H} ${polyline} 100,${H}`}
          fill="url(#wgrad)"
        />
        <polyline
          points={polyline}
          fill="none"
          stroke="#6366f1"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {pts.map((p, i) => (
          <circle
            key={i}
            cx={`${p.x}%`}
            cy={p.y}
            r={hovered === i ? 5 : 3}
            fill={hovered === i ? "#6366f1" : "#fff"}
            stroke="#6366f1"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          />
        ))}
      </svg>
      {/* Tooltip */}
      {hovered !== null && (
        <div
          className="pointer-events-none absolute z-10 -translate-y-full -translate-x-1/2 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-lg whitespace-nowrap"
          style={{ left: `${pts[hovered].x}%`, top: pts[hovered].y - 8 }}>
          {fmtDate(pts[hovered].date)}: {fmt2(pts[hovered].weight)} kg
        </div>
      )}
      {/* Y axis labels */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between pb-0 pt-0">
        <span className="text-[10px] text-slate-400">{fmt2(maxVal)} kg</span>
        <span className="text-[10px] text-slate-400">{fmt2(minVal)} kg</span>
      </div>
    </div>
  );
}

// ── Weight Tab ────────────────────────────────────────────────────────────────

function WeightTab({
  weightLogs,
  analytics,
  weightTrend,
  onAdd,
}: {
  weightLogs: ReturnType<typeof useLoaderData<typeof loader>>["weightLogs"];
  analytics:  ReturnType<typeof useLoaderData<typeof loader>>["analytics"];
  weightTrend: ReturnType<typeof useLoaderData<typeof loader>>["weightTrend"];
  onAdd: () => void;
}) {
  const { currentW, minW, maxW, avgW, weightDelta } = analytics;
  return (
    <div className="space-y-5">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[
          {
            label: "Current",
            value: currentW !== null ? `${fmt2(currentW)} kg` : "—",
            sub:   currentW !== null ? "Latest entry" : "No data yet",
            icon: Scale, iconBg: "bg-indigo-50", iconColor: "text-indigo-600",
          },
          {
            label: "Change (Month)",
            value: weightDelta !== null ? `${weightDelta > 0 ? "+" : ""}${fmt2(weightDelta)} kg` : "—",
            sub:   weightDelta !== null ? (weightDelta > 0 ? "Gained" : weightDelta < 0 ? "Lost" : "Stable") : "Need ≥2 entries",
            icon: weightDelta !== null && weightDelta > 0 ? TrendingUp : TrendingDown,
            iconBg: weightDelta !== null && weightDelta > 0 ? "bg-rose-50" : "bg-emerald-50",
            iconColor: weightDelta !== null && weightDelta > 0 ? "text-rose-600" : "text-emerald-600",
          },
          {
            label: "Min (Month)",
            value: minW !== null ? `${fmt2(minW)} kg` : "—",
            sub:   "Lowest this month",
            icon: Activity, iconBg: "bg-emerald-50", iconColor: "text-emerald-600",
          },
          {
            label: "Avg (Month)",
            value: avgW !== null ? `${fmt2(avgW)} kg` : "—",
            sub:   `Max: ${maxW !== null ? `${fmt2(maxW)} kg` : "—"}`,
            icon: BarChart2, iconBg: "bg-amber-50", iconColor: "text-amber-600",
          },
        ].map((kpi) => {
          const KpiIcon = kpi.icon;
          return (
            <div key={kpi.label} className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-500">{kpi.label}</p>
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${kpi.iconBg}`}>
                  <KpiIcon size={15} className={kpi.iconColor} />
                </div>
              </div>
              <p className="text-xl font-extrabold text-slate-900">{kpi.value}</p>
              <p className="mt-1 text-xs text-slate-400">{kpi.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Trend chart */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4">
          <h3 className="text-sm font-bold text-slate-900">Weight Trend</h3>
          <p className="mt-0.5 text-xs text-slate-400">Last up to 30 entries across all time</p>
        </div>
        <div className="px-6 py-4">
          <WeightChart trend={weightTrend} />
        </div>
      </div>

      {/* Logs list */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-sm font-bold text-slate-900">This Month's Entries</h3>
          <button type="button" onClick={onAdd}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors">
            <Plus size={13} /> Log Weight
          </button>
        </div>
        {weightLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Scale size={22} /></div>
            <p className="mt-3 text-sm font-semibold text-slate-700">No entries yet</p>
            <p className="mt-1 text-xs text-slate-400">Start tracking your weight for this month.</p>
            <button type="button" onClick={onAdd} className="mt-4 flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors">
              <Plus size={14} /> Log First Entry
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {weightLogs.map((log) => (
              <div key={log.id} className="flex items-center gap-4 px-5 py-3.5 group">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50">
                  <Scale size={16} className="text-indigo-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold text-slate-900">{fmt2(log.weight)} kg</p>
                  <p className="text-xs text-slate-400 mt-0.5">{fmtDate(log.date)}{log.notes ? ` · ${log.notes}` : ""}</p>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <DeleteButton id={log.id} intent="delete-weight" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Diet Tab ──────────────────────────────────────────────────────────────────

function DietTab({
  dietLogs,
  analytics,
  onAdd,
}: {
  dietLogs:  ReturnType<typeof useLoaderData<typeof loader>>["dietLogs"];
  analytics: ReturnType<typeof useLoaderData<typeof loader>>["analytics"];
  onAdd: () => void;
}) {
  const { totalCalories, avgCalories, avgHabitScore, mealCounts, habitCounts } = analytics;

  // Derive overall habit label
  let habitLabel = "—";
  if (avgHabitScore !== null) {
    if (avgHabitScore >= 4.5) habitLabel = "Very Healthy";
    else if (avgHabitScore >= 3.5) habitLabel = "Healthy";
    else if (avgHabitScore >= 2.5) habitLabel = "Neutral";
    else if (avgHabitScore >= 1.5) habitLabel = "Unhealthy";
    else habitLabel = "Very Unhealthy";
  }

  // Group diet logs by date
  const grouped: Record<string, typeof dietLogs> = {};
  for (const d of dietLogs) {
    if (!grouped[d.date]) grouped[d.date] = [];
    grouped[d.date].push(d);
  }
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-5">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[
          {
            label: "Total Calories",
            value: totalCalories > 0 ? `${totalCalories.toLocaleString()} kcal` : "—",
            sub:   avgCalories !== null ? `Avg ${avgCalories} kcal/meal` : "Log calories to track",
            icon: Flame, iconBg: "bg-orange-50", iconColor: "text-orange-600",
          },
          {
            label: "Meals Logged",
            value: String(dietLogs.length),
            sub:   `${sortedDates.length} day${sortedDates.length !== 1 ? "s" : ""} tracked`,
            icon: UtensilsCrossed, iconBg: "bg-emerald-50", iconColor: "text-emerald-600",
          },
          {
            label: "Food Habit Score",
            value: avgHabitScore !== null ? `${avgHabitScore}/5` : "—",
            sub:   habitLabel,
            icon: Heart, iconBg: "bg-rose-50", iconColor: "text-rose-600",
          },
          {
            label: "Top Meal",
            value: (() => {
              const best = Object.entries(mealCounts).sort((a, b) => b[1] - a[1])[0];
              return best ? MEAL_CONFIG[best[0] as MealType].label : "—";
            })(),
            sub: "Most frequent this month",
            icon: Coffee, iconBg: "bg-amber-50", iconColor: "text-amber-600",
          },
        ].map((kpi) => {
          const KpiIcon = kpi.icon;
          return (
            <div key={kpi.label} className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-500">{kpi.label}</p>
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${kpi.iconBg}`}>
                  <KpiIcon size={15} className={kpi.iconColor} />
                </div>
              </div>
              <p className="text-xl font-extrabold text-slate-900">{kpi.value}</p>
              <p className="mt-1 text-xs text-slate-400">{kpi.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Habit breakdown + meal breakdown */}
      {dietLogs.length > 0 && (
        <div className="grid gap-5 lg:grid-cols-2">
          {/* Habit distribution */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="text-sm font-bold text-slate-900">Food Habit Breakdown</h3>
            </div>
            <div className="divide-y divide-slate-50">
              {(Object.entries(habitCounts) as [FoodHabit, number][])
                .sort((a, b) => HABIT_CONFIG[b[0]].score - HABIT_CONFIG[a[0]].score)
                .map(([habit, count]) => {
                  const cfg  = HABIT_CONFIG[habit];
                  const pct  = dietLogs.length > 0 ? ((count / dietLogs.length) * 100) : 0;
                  return (
                    <div key={habit} className="flex items-center gap-4 px-5 py-3">
                      <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${cfg.dot}`} />
                      <span className={`text-sm font-semibold ${cfg.color} flex-1`}>{cfg.label}</span>
                      <span className="text-xs text-slate-400 w-10 text-right">{count} meal{count !== 1 ? "s" : ""}</span>
                      <div className="w-24 h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div className={`h-full rounded-full ${cfg.dot}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-bold text-slate-500 w-10 text-right">{pct.toFixed(0)}%</span>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Meal type distribution */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="text-sm font-bold text-slate-900">Meal Type Distribution</h3>
            </div>
            <div className="divide-y divide-slate-50">
              {MEAL_TYPES.map((meal) => {
                const count = mealCounts[meal] ?? 0;
                const cfg   = MEAL_CONFIG[meal];
                const Icon  = cfg.icon;
                const pct   = dietLogs.length > 0 ? ((count / dietLogs.length) * 100) : 0;
                return (
                  <div key={meal} className="flex items-center gap-3 px-5 py-3.5">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${cfg.bg}`}>
                      <Icon size={14} className={cfg.color} />
                    </div>
                    <span className="text-sm font-semibold text-slate-700 flex-1">{cfg.label}</span>
                    <span className="text-xs text-slate-400 w-10 text-right">{count}</span>
                    <div className="w-24 h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className={`h-full rounded-full ${cfg.bg.replace("bg-", "bg-").replace("-50", "-400")}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-bold text-slate-500 w-10 text-right">{pct.toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Logs list — grouped by date */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-sm font-bold text-slate-900">Food Diary</h3>
          <button type="button" onClick={onAdd}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors">
            <Plus size={13} /> Log Meal
          </button>
        </div>
        {dietLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400"><UtensilsCrossed size={22} /></div>
            <p className="mt-3 text-sm font-semibold text-slate-700">No meals logged</p>
            <p className="mt-1 text-xs text-slate-400">Start tracking what you eat each day.</p>
            <button type="button" onClick={onAdd} className="mt-4 flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors">
              <Plus size={14} /> Log First Meal
            </button>
          </div>
        ) : (
          <div>
            {sortedDates.map((date) => (
              <div key={date}>
                <div className="border-b border-slate-100 bg-slate-50 px-5 py-2">
                  <p className="text-xs font-bold text-slate-500">{fmtDate(date)}</p>
                </div>
                <div className="divide-y divide-slate-50">
                  {grouped[date].map((log) => {
                    const cfg  = MEAL_CONFIG[log.mealType];
                    const Icon = cfg.icon;
                    return (
                      <div key={log.id} className="flex items-center gap-3 px-5 py-3.5 group">
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${cfg.bg}`}>
                          <Icon size={15} className={cfg.color} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-800">{log.description}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span className={`text-[10px] font-bold ${cfg.color}`}>{cfg.label}</span>
                            {log.calories && (
                              <>
                                <span className="text-[10px] text-slate-300">·</span>
                                <span className="text-[10px] text-slate-500 font-semibold">{log.calories} kcal</span>
                              </>
                            )}
                            <HabitBadge habit={log.habit} />
                          </div>
                          {log.notes && <p className="mt-0.5 truncate text-[11px] text-slate-400">{log.notes}</p>}
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <DeleteButton id={log.id} intent="delete-diet" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HealthPage() {
  const data = useLoaderData<typeof loader>();
  const { weightLogs, dietLogs, analytics, weightTrend, year, month, today } = data;

  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") === "diet" ? "diet" : "weight";

  const [weightModalOpen, setWeightModalOpen] = useState(false);
  const [dietModalOpen,   setDietModalOpen]   = useState(false);

  function setTab(tab: "weight" | "diet") {
    const p = new URLSearchParams(searchParams);
    if (tab === "diet") p.set("tab", "diet"); else p.delete("tab");
    setSearchParams(p);
  }

  function goMonth(delta: number) {
    let m = month + delta, y = year;
    if (m < 1)  { m = 12; y--; }
    if (m > 12) { m = 1;  y++; }
    const p = new URLSearchParams(searchParams);
    p.set("year", String(y)); p.set("month", String(m));
    setSearchParams(p);
  }

  return (
    <>
      <AddWeightModal open={weightModalOpen} onClose={() => setWeightModalOpen(false)} today={today} />
      <AddDietModal   open={dietModalOpen}   onClose={() => setDietModalOpen(false)}   today={today} pastDescriptions={data.pastDescriptions} />

      <div className="space-y-5">
        {/* Controls row */}
        <div className="space-y-2">
          {/* Row 1: month nav + action buttons */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => goMonth(-1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition-colors shadow-sm">
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-bold text-slate-900 min-w-[110px] text-center">
                {MONTHS[month - 1]} {year}
              </span>
              <button type="button" onClick={() => goMonth(1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition-colors shadow-sm">
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setWeightModalOpen(true)}
                className="flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors shadow-sm">
                <Scale size={14} /> Weight
              </button>
              <button type="button" onClick={() => setDietModalOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700">
                <Plus size={16} /> Meal
              </button>
            </div>
          </div>
          {/* Row 2: tab switcher */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            <button type="button" onClick={() => setTab("weight")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === "weight" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              <Scale size={13} /> Weight
            </button>
            <button type="button" onClick={() => setTab("diet")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === "diet" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              <UtensilsCrossed size={13} /> Diet & Food
            </button>
          </div>
        </div>

        {/* Tab content */}
        {activeTab === "weight" ? (
          <WeightTab weightLogs={weightLogs} analytics={analytics} weightTrend={weightTrend} onAdd={() => setWeightModalOpen(true)} />
        ) : (
          <DietTab dietLogs={dietLogs} analytics={analytics} onAdd={() => setDietModalOpen(true)} />
        )}
      </div>
    </>
  );
}
